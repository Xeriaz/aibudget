import {
  differenceInCalendarDays,
  startOfDay,
  parseISO,
  addWeeks,
  addMonths,
  addYears,
  format,
  getDaysInMonth,
  getDate
} from 'date-fns';
import type {
  Transaction,
  Category,
  RecurringPayment,
  PlanSettings,
  BucketType,
  BucketCalculation,
  BillingCycle
} from '../types';
import { db } from '../db/db';

export function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if unsupported/restricted
    }
  }
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function getMonthlyMultiplier(cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':
      return 52 / 12;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'yearly':
      return 1 / 12;
    default:
      return 1;
  }
}

export function getDaysUntilDue(dueDateIso: string): number {
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDateIso));
  return differenceInCalendarDays(due, today);
}

export function getNextRecurringDate(currentIso: string, cycle: BillingCycle): string {
  const current = parseISO(currentIso);
  let next: Date;
  switch (cycle) {
    case 'weekly':
      next = addWeeks(current, 1);
      break;
    case 'monthly':
      next = addMonths(current, 1);
      break;
    case 'quarterly':
      next = addMonths(current, 3);
      break;
    case 'yearly':
      next = addYears(current, 1);
      break;
    default:
      next = addMonths(current, 1);
  }
  return format(next, 'yyyy-MM-dd');
}

export async function markBillAsPaid(bill: RecurringPayment) {
  triggerHaptic(20);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowIso = new Date().toISOString();

  const newTx: Transaction = {
    id: 'tx_' + crypto.randomUUID(),
    title: bill.title,
    note: `Automated recurring payment (${bill.billingCycle})`,
    amount: bill.amount,
    currencyCode: bill.currencyCode || 'EUR',
    type: 'expense',
    categoryId: bill.categoryId,
    transactionDate: todayStr,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const nextDueDate = getNextRecurringDate(bill.nextDueDate, bill.billingCycle);

  await db.transaction('rw', [db.transactions, db.recurringPayments], async () => {
    await db.transactions.add(newTx);
    await db.recurringPayments.update(bill.id, {
      nextDueDate,
      updatedAt: nowIso
    });
  });

  return newTx;
}

export function resolveCategoryBucket(cat?: Category): BucketType {
  if (!cat) return 'selfCareAndWants';
  if (cat.customBucket) return cat.customBucket;

  const name = cat.name.toLowerCase();
  if (
    name.includes('rent') ||
    name.includes('groc') ||
    name.includes('util') ||
    name.includes('transit') ||
    name.includes('insur') ||
    name.includes('bill') ||
    name.includes('housing') ||
    name.includes('health') ||
    name.includes('transport')
  ) {
    return 'essentials';
  }

  if (
    name.includes('invest') ||
    name.includes('sav') ||
    name.includes('stock') ||
    name.includes('crypto') ||
    name.includes('wealth')
  ) {
    return 'investments';
  }

  return 'selfCareAndWants';
}

export function getFrameworkPercentages(settings: PlanSettings): {
  essentialsPct: number;
  selfCarePct: number;
  investmentsPct: number;
} {
  switch (settings.selectedFramework) {
    case '50/30/20':
      return { essentialsPct: 50, selfCarePct: 30, investmentsPct: 20 };
    case '60/20/20':
      return { essentialsPct: 60, selfCarePct: 20, investmentsPct: 20 };
    case '70/20/10':
      return { essentialsPct: 70, selfCarePct: 20, investmentsPct: 10 };
    case 'custom':
      return {
        essentialsPct: settings.customEssentialsPct ?? 50,
        selfCarePct: settings.customSelfCarePct ?? 30,
        investmentsPct: settings.customInvestmentsPct ?? 20
      };
    default:
      return { essentialsPct: 50, selfCarePct: 30, investmentsPct: 20 };
  }
}

export interface MonthSummary {
  selectedYear: number;
  selectedMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  incomeTotal: number;
  expenseTotal: number;
  netSavings: number;
  savingsRate: number;
  effectiveIncomeBase: number;
  essentials: BucketCalculation;
  selfCare: BucketCalculation;
  investments: BucketCalculation;
  categorySpending: {
    category: Category;
    amount: number;
    percentage: number;
  }[];
  activeRecurringTotalMonthly: number;
}

export function calculateMonthSummary(
  transactions: Transaction[],
  categories: Category[],
  recurring: RecurringPayment[],
  settings: PlanSettings,
  targetDate: Date = new Date()
): MonthSummary {
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  // Filter transactions for target month
  const monthTxs = transactions.filter(t => t.transactionDate.startsWith(targetPrefix));

  let realIncomeTotal = 0;
  let realExpenseTotal = 0;
  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const catSpendingMap = new Map<string, number>();

  let essentialsSpent = 0;
  let selfCareSpent = 0;
  let investmentsSpent = 0;

  for (const tx of monthTxs) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      realIncomeTotal += amt;
    } else {
      realExpenseTotal += amt;
      const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      const bucket = resolveCategoryBucket(cat);

      if (bucket === 'essentials') {
        essentialsSpent += amt;
      } else if (bucket === 'investments') {
        investmentsSpent += amt;
      } else {
        selfCareSpent += amt;
      }

      const catKey = tx.categoryId || 'uncategorized';
      catSpendingMap.set(catKey, (catSpendingMap.get(catKey) || 0) + amt);
    }
  }

  // 1. Effective Income Base
  let effectiveIncomeBase = settings.useManualSalary ? settings.manualSalary : realIncomeTotal;
  if (!settings.useManualSalary && realIncomeTotal <= 0) {
    effectiveIncomeBase = settings.manualSalary ?? 2500;
  }

  // 2. Framework percentages
  const { essentialsPct, selfCarePct, investmentsPct } = getFrameworkPercentages(settings);

  // 3. Budgets
  const essentialsCap = effectiveIncomeBase * (essentialsPct / 100);
  const selfCareCap = effectiveIncomeBase * (selfCarePct / 100);
  const investmentsTarget = effectiveIncomeBase * (investmentsPct / 100);

  // Remaining days in the month calculation
  const totalDaysInMonth = getDaysInMonth(targetDate);
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const isPastMonth =
    targetYear < todayYear || (targetYear === todayYear && targetMonth < todayMonth);
  const isCurrentMonth = targetYear === todayYear && targetMonth === todayMonth;

  const remainingDays = isPastMonth
    ? 0
    : isCurrentMonth
    ? Math.max(1, totalDaysInMonth - getDate(today) + 1)
    : totalDaysInMonth;

  // Monthly active recurring sum for Essentials committed bills
  let monthlyCommittedBills = 0;
  for (const bill of recurring) {
    if (bill.isActive) {
      const cat = bill.categoryId ? categoryMap.get(bill.categoryId) : undefined;
      const bucket = resolveCategoryBucket(cat);
      const monthlyEquiv = bill.amount * getMonthlyMultiplier(bill.billingCycle);
      if (bucket === 'essentials') {
        monthlyCommittedBills += monthlyEquiv;
      }
    }
  }

  const selfCareRemaining = selfCareCap - selfCareSpent;
  const dailySafePace = remainingDays > 0 ? Math.max(0, selfCareRemaining / remainingDays) : 0;

  const investmentFundedPct = investmentsTarget > 0 ? (investmentsSpent / investmentsTarget) * 100 : 0;
  const investmentAmountLeft = Math.max(0, investmentsTarget - investmentsSpent);

  const essentialsRemaining = essentialsCap - essentialsSpent;

  // Category breakdown list
  const categorySpending = Array.from(catSpendingMap.entries())
    .map(([catId, amount]) => {
      const cat = categoryMap.get(catId) || {
        id: catId,
        name: 'Uncategorized',
        iconName: 'tag',
        colorHex: '#71717A',
        isDefault: false
      };
      const percentage = realExpenseTotal > 0 ? (amount / realExpenseTotal) * 100 : 0;
      return { category: cat, amount, percentage };
    })
    .sort((a, b) => b.amount - a.amount);

  // Recurring payments total normalized
  const activeRecurringTotalMonthly = recurring
    .filter(r => r.isActive)
    .reduce((acc, r) => acc + r.amount * getMonthlyMultiplier(r.billingCycle), 0);

  const netSavings = realIncomeTotal - realExpenseTotal;
  const savingsRate = realIncomeTotal > 0 ? (netSavings / realIncomeTotal) * 100 : 0;

  return {
    selectedYear: targetYear,
    selectedMonth: targetMonth,
    incomeTotal: realIncomeTotal,
    expenseTotal: realExpenseTotal,
    netSavings,
    savingsRate,
    effectiveIncomeBase,
    essentials: {
      bucket: 'essentials',
      title: 'Essentials & Needs',
      percentage: essentialsPct,
      budgetCap: essentialsCap,
      spent: essentialsSpent,
      remaining: essentialsRemaining,
      committedBills: monthlyCommittedBills
    },
    selfCare: {
      bucket: 'selfCareAndWants',
      title: 'Self-Care & Lifestyle',
      percentage: selfCarePct,
      budgetCap: selfCareCap,
      spent: selfCareSpent,
      remaining: selfCareRemaining,
      dailySafePace: dailySafePace
    },
    investments: {
      bucket: 'investments',
      title: 'Investments & Wealth',
      percentage: investmentsPct,
      budgetCap: investmentsTarget,
      spent: investmentsSpent,
      remaining: investmentsTarget - investmentsSpent,
      fundedProgressPct: investmentFundedPct,
      amountLeft: investmentAmountLeft
    },
    categorySpending,
    activeRecurringTotalMonthly
  };
}
