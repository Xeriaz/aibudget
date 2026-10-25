import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  getMonthlyMultiplier,
  getDaysUntilDue,
  getNextRecurringDate,
  markBillAsPaid,
  resolveCategoryBucket,
  getFrameworkPercentages,
  calculateMonthSummary,
  calculateYearlyCashFlow
} from '../lib/calculations';
import { db, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../db/db';
import {
  makeTransaction,
  makeCategory,
  makeRecurringPayment,
  makeSettings
} from './factories';

describe('Flow 2: Financial Calculations & Budget Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatCurrency & getMonthlyMultiplier', () => {
    it('formats EUR amounts with two decimals', () => {
      expect(formatCurrency(1234.5)).toContain('1,234.50');
      expect(formatCurrency(0)).toContain('0.00');
    });

    it('returns accurate monthly multipliers for each billing cycle', () => {
      expect(getMonthlyMultiplier('weekly')).toBeCloseTo(52 / 12, 5);
      expect(getMonthlyMultiplier('monthly')).toBe(1);
      expect(getMonthlyMultiplier('quarterly')).toBeCloseTo(1 / 3, 5);
      expect(getMonthlyMultiplier('yearly')).toBeCloseTo(1 / 12, 5);
    });
  });

  describe('Recurring dates & markBillAsPaid', () => {
    it('calculates days until due relative to current date', () => {
      expect(getDaysUntilDue('2026-10-15')).toBe(0);
      expect(getDaysUntilDue('2026-10-20')).toBe(5);
      expect(getDaysUntilDue('2026-10-12')).toBe(-3);
    });

    it('advances next recurring date across all cycles', () => {
      expect(getNextRecurringDate('2026-10-15', 'weekly')).toBe('2026-10-22');
      expect(getNextRecurringDate('2026-10-15', 'monthly')).toBe('2026-11-15');
      expect(getNextRecurringDate('2026-10-15', 'quarterly')).toBe('2027-01-15');
      expect(getNextRecurringDate('2026-10-15', 'yearly')).toBe('2027-10-15');
    });

    it('markBillAsPaid creates an expense transaction and advances nextDueDate atomically in DB', async () => {
      const bill = makeRecurringPayment({
        id: 'rec_rent',
        title: 'Monthly Rent',
        amount: 950,
        billingCycle: 'monthly',
        categoryId: 'cat-housing',
        nextDueDate: '2026-10-18'
      });
      await db.recurringPayments.add(bill);

      const createdTx = await markBillAsPaid(bill);

      expect(createdTx.title).toBe('Monthly Rent');
      expect(createdTx.amount).toBe(950);
      expect(createdTx.type).toBe('expense');
      expect(createdTx.categoryId).toBe('cat-housing');
      expect(createdTx.transactionDate).toBe('2026-10-15');
      expect(createdTx.note).toBe('Automated recurring payment (monthly)');

      const dbTx = await db.transactions.get(createdTx.id);
      expect(dbTx).toBeDefined();

      const updatedBill = await db.recurringPayments.get('rec_rent');
      expect(updatedBill?.nextDueDate).toBe('2026-11-18');
    });
  });

  describe('resolveCategoryBucket & getFrameworkPercentages', () => {
    it('resolves category bucket via customBucket first, then keyword fallback', () => {
      expect(resolveCategoryBucket(undefined)).toBe('selfCareAndWants');
      expect(
        resolveCategoryBucket(
          makeCategory({ name: 'Random Name', customBucket: 'investments' })
        )
      ).toBe('investments');
      expect(
        resolveCategoryBucket(
          makeCategory({ name: 'City Transit Pass', customBucket: undefined })
        )
      ).toBe('essentials');
      expect(
        resolveCategoryBucket(
          makeCategory({ name: 'Crypto Portfolio', customBucket: undefined })
        )
      ).toBe('investments');
      expect(
        resolveCategoryBucket(
          makeCategory({ name: 'Concert Tickets', customBucket: undefined })
        )
      ).toBe('selfCareAndWants');
    });

    it('returns framework percentages for presets and custom ratios (including 0% buckets)', () => {
      expect(
        getFrameworkPercentages(makeSettings({ selectedFramework: '50/30/20' }))
      ).toEqual({ essentialsPct: 50, selfCarePct: 30, investmentsPct: 20 });

      expect(
        getFrameworkPercentages(makeSettings({ selectedFramework: '60/20/20' }))
      ).toEqual({ essentialsPct: 60, selfCarePct: 20, investmentsPct: 20 });

      expect(
        getFrameworkPercentages(makeSettings({ selectedFramework: '70/20/10' }))
      ).toEqual({ essentialsPct: 70, selfCarePct: 20, investmentsPct: 10 });

      expect(
        getFrameworkPercentages(
          makeSettings({
            selectedFramework: 'custom',
            customEssentialsPct: 80,
            customSelfCarePct: 0,
            customInvestmentsPct: 20
          })
        )
      ).toEqual({ essentialsPct: 80, selfCarePct: 0, investmentsPct: 20 });
    });
  });

  describe('calculateMonthSummary', () => {
    it('calculates monthly totals, 50/30/20 buckets, daily safe pace, and committed bills', () => {
      const transactions = [
        // October 2026 income: €4,000
        makeTransaction({
          type: 'income',
          amount: 4000,
          categoryId: 'cat-salary',
          transactionDate: '2026-10-01'
        }),
        // Essentials expense: €1,200 (Groceries + Housing)
        makeTransaction({
          type: 'expense',
          amount: 1000,
          categoryId: 'cat-housing',
          transactionDate: '2026-10-03'
        }),
        makeTransaction({
          type: 'expense',
          amount: 200,
          categoryId: 'cat-groceries',
          transactionDate: '2026-10-08'
        }),
        // Self-Care expense: €350 (Dining)
        makeTransaction({
          type: 'expense',
          amount: 350,
          categoryId: 'cat-dining',
          transactionDate: '2026-10-10'
        }),
        // Investments expense: €500
        makeTransaction({
          type: 'expense',
          amount: 500,
          categoryId: 'cat-investments',
          transactionDate: '2026-10-12'
        }),
        // Previous month transaction (should be ignored for October)
        makeTransaction({
          type: 'expense',
          amount: 999,
          categoryId: 'cat-housing',
          transactionDate: '2026-09-28'
        })
      ];

      const recurring = [
        // Active essential monthly bill: €800
        makeRecurringPayment({
          amount: 800,
          billingCycle: 'monthly',
          categoryId: 'cat-housing',
          isActive: true
        }),
        // Active self-care yearly bill: €120/yr -> €10/mo
        makeRecurringPayment({
          amount: 120,
          billingCycle: 'yearly',
          categoryId: 'cat-subs',
          isActive: true
        }),
        // Inactive bill (ignored)
        makeRecurringPayment({
          amount: 500,
          billingCycle: 'monthly',
          categoryId: 'cat-housing',
          isActive: false
        })
      ];

      const summary = calculateMonthSummary(
        transactions,
        DEFAULT_CATEGORIES,
        recurring,
        DEFAULT_SETTINGS,
        new Date('2026-10-15T12:00:00.000Z')
      );

      expect(summary.incomeTotal).toBe(4000);
      expect(summary.expenseTotal).toBe(2050); // 1000 + 200 + 350 + 500
      expect(summary.netSavings).toBe(1950);
      expect(summary.savingsRate).toBeCloseTo((1950 / 4000) * 100, 5);
      expect(summary.effectiveIncomeBase).toBe(4000);

      // Essentials (50% of 4000 = 2000)
      expect(summary.essentials.budgetCap).toBe(2000);
      expect(summary.essentials.spent).toBe(1200);
      expect(summary.essentials.remaining).toBe(800);
      expect(summary.essentials.committedBills).toBe(800);

      // Self-Care (30% of 4000 = 1200)
      expect(summary.selfCare.budgetCap).toBe(1200);
      expect(summary.selfCare.spent).toBe(350);
      expect(summary.selfCare.remaining).toBe(850);
      // Oct has 31 days; on Oct 15 remainingDays = 31 - 15 + 1 = 17
      expect(summary.selfCare.dailySafePace).toBeCloseTo(850 / 17, 5);

      // Investments (20% of 4000 = 800)
      expect(summary.investments.budgetCap).toBe(800);
      expect(summary.investments.spent).toBe(500);
      expect(summary.investments.fundedProgressPct).toBeCloseTo((500 / 800) * 100, 5);
      expect(summary.investments.amountLeft).toBe(300);

      // Active recurring monthly burn: 800 + (120 / 12) = 810
      expect(summary.activeRecurringTotalMonthly).toBeCloseTo(810, 5);

      // Ranked category spending (Housing €1000 first, Investments €500 second, Dining €350 third, Groceries €200 fourth)
      expect(summary.categorySpending.map(c => c.category.id)).toEqual([
        'cat-housing',
        'cat-investments',
        'cat-dining',
        'cat-groceries'
      ]);
    });

    it('handles dailySafePace distinctly for past months (0) and future months (full month days)', () => {
      const transactions = [
        makeTransaction({
          type: 'income',
          amount: 3000,
          categoryId: 'cat-salary',
          transactionDate: '2026-09-01'
        }),
        makeTransaction({
          type: 'expense',
          amount: 300,
          categoryId: 'cat-dining',
          transactionDate: '2026-09-10'
        })
      ];

      // Past month: September 2026 (when today is Oct 15, 2026) -> dailySafePace should be 0
      const pastSummary = calculateMonthSummary(
        transactions,
        DEFAULT_CATEGORIES,
        [],
        DEFAULT_SETTINGS,
        new Date('2026-09-15T12:00:00.000Z')
      );
      expect(pastSummary.selfCare.remaining).toBe(600); // 30% of 3000 = 900 - 300
      expect(pastSummary.selfCare.dailySafePace).toBe(0);

      // Future month: November 2026 (30 days) -> dailySafePace divides by 30
      const futureSummary = calculateMonthSummary(
        [],
        DEFAULT_CATEGORIES,
        [],
        makeSettings({ useManualSalary: true, manualSalary: 3000 }),
        new Date('2026-11-01T12:00:00.000Z')
      );
      expect(futureSummary.selfCare.remaining).toBe(900);
      expect(futureSummary.selfCare.dailySafePace).toBeCloseTo(900 / 30, 5);
    });

    it('falls back to manualSalary when no income is logged or when useManualSalary is true', () => {
      const noIncomeSummary = calculateMonthSummary(
        [makeTransaction({ type: 'expense', amount: 100, transactionDate: '2026-10-15' })],
        DEFAULT_CATEGORIES,
        [],
        makeSettings({ useManualSalary: false, manualSalary: 2800 }),
        new Date('2026-10-15T12:00:00.000Z')
      );
      expect(noIncomeSummary.effectiveIncomeBase).toBe(2800);

      const manualOverrideSummary = calculateMonthSummary(
        [makeTransaction({ type: 'income', amount: 5000, transactionDate: '2026-10-01' })],
        DEFAULT_CATEGORIES,
        [],
        makeSettings({ useManualSalary: true, manualSalary: 3200 }),
        new Date('2026-10-15T12:00:00.000Z')
      );
      expect(manualOverrideSummary.effectiveIncomeBase).toBe(3200);
    });
  });

  describe('calculateYearlyCashFlow', () => {
    it('aggregates 12 months of income, expenses, and net for a target year while ignoring other years', () => {
      const txs = [
        makeTransaction({ type: 'income', amount: 3000, transactionDate: '2026-01-05' }),
        makeTransaction({ type: 'expense', amount: 1200, transactionDate: '2026-01-12' }),
        makeTransaction({ type: 'expense', amount: 300, transactionDate: '2026-01-20' }),
        makeTransaction({ type: 'income', amount: 3200, transactionDate: '2026-10-01' }),
        makeTransaction({ type: 'expense', amount: 1800, transactionDate: '2026-10-14' }),
        // Different year
        makeTransaction({ type: 'income', amount: 5000, transactionDate: '2025-10-01' })
      ];

      const yearly = calculateYearlyCashFlow(txs, 2026);
      expect(yearly.year).toBe(2026);
      expect(yearly.months).toHaveLength(12);

      // Jan (index 0)
      expect(yearly.months[0].monthKey).toBe('2026-01');
      expect(yearly.months[0].income).toBe(3000);
      expect(yearly.months[0].expense).toBe(1500);
      expect(yearly.months[0].net).toBe(1500);
      expect(yearly.months[0].transactionCount).toBe(3);

      // Feb (index 1) -> empty
      expect(yearly.months[1].income).toBe(0);
      expect(yearly.months[1].expense).toBe(0);
      expect(yearly.months[1].transactionCount).toBe(0);

      // Oct (index 9)
      expect(yearly.months[9].monthKey).toBe('2026-10');
      expect(yearly.months[9].income).toBe(3200);
      expect(yearly.months[9].expense).toBe(1800);
      expect(yearly.months[9].net).toBe(1400);

      // Yearly totals
      expect(yearly.totalIncome).toBe(6200);
      expect(yearly.totalExpense).toBe(3300);
      expect(yearly.totalNet).toBe(2900);
      expect(yearly.maxMonthlyValue).toBe(3200);
    });
  });
});
