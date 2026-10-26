import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Zap,
  Bell,
  ShieldCheck,
  Heart,
  Wallet
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Transaction, Category, RecurringPayment, PlanSettings } from '../types';
import {
  calculateMonthSummary,
  formatCurrency,
  getDaysUntilDue,
  getMonthlyMultiplier,
  markBillAsPaid,
  triggerHaptic
} from '../lib/calculations';
import { CategoryIcon } from './CategoryIcon';

interface OverviewTabProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringPayment[];
  settings: PlanSettings;
  theme?: 'dark' | 'light';
  onRefresh: () => void;
  onOpenFastAdd?: () => void;
  onSelectTransactionToEdit: (tx: Transaction) => void;
  onNavigateToTab: (tab: 'overview' | 'ledger' | 'bills' | 'settings') => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  currentDate,
  setCurrentDate,
  transactions,
  categories,
  recurring,
  settings,
  theme = 'dark',
  onRefresh,
  onNavigateToTab
}) => {
  const { t, i18n } = useTranslation();
  const [billsTimeframe, setBillsTimeframe] = useState<'7' | '30'>('7');

  const summary = calculateMonthSummary(transactions, categories, recurring, settings, currentDate);
  const isViewingToday = isSameMonth(currentDate, new Date());

  const handlePrevMonth = () => {
    triggerHaptic(10);
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic(10);
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleResetToToday = () => {
    triggerHaptic(15);
    setCurrentDate(new Date());
  };

  // Recharts Donut data
  const donutData = summary.categorySpending.map(item => ({
    name: item.category.name,
    value: item.amount,
    color: item.category.colorHex || '#6366f1'
  }));

  // Filter upcoming bills
  const maxDays = billsTimeframe === '7' ? 7 : 30;
  const upcomingBills = recurring
    .filter(r => r.isActive)
    .map(r => ({
      ...r,
      daysLeft: getDaysUntilDue(r.nextDueDate)
    }))
    .filter(r => r.daysLeft <= maxDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const handleMarkPaid = async (bill: RecurringPayment) => {
    await markBillAsPaid(bill);
    onRefresh();
  };

  // Income to Spend ratio bar percentage (capped at 100 for display, with overflow indicator)
  const spendRatio = summary.incomeTotal > 0 ? (summary.expenseTotal / summary.incomeTotal) * 100 : 0;

  // Tri-color segment bar calculations
  const totalBudgetCap = summary.effectiveIncomeBase || 1;
  const essentialsCapPct = (summary.essentials.budgetCap / totalBudgetCap) * 100;
  const selfCareCapPct = (summary.selfCare.budgetCap / totalBudgetCap) * 100;
  const investmentsCapPct = (summary.investments.budgetCap / totalBudgetCap) * 100;

  // Over-limit indicators for Self-Care and Essentials
  const isSelfCareOver = summary.selfCare.remaining < 0;
  const selfCareOverAmount = Math.abs(summary.selfCare.remaining);

  const isEssentialsOver = summary.essentials.spent > summary.essentials.budgetCap;
  const essentialsOverAmount = Math.max(0, summary.essentials.spent - summary.essentials.budgetCap);

  const monthYearLabel = format(currentDate, 'MMMM yyyy');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Period Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl p-1 shadow-xs dark:shadow-inner transition-colors">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all"
            aria-label={t('overview.previousMonth')}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 text-sm font-bold tracking-tight text-slate-900 dark:text-white min-w-32 text-center capitalize">
            {monthYearLabel}
          </span>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all"
            aria-label={t('overview.nextMonth')}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!isViewingToday && (
          <button
            onClick={handleResetToToday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 dark:hover:bg-indigo-500/30 active:scale-95 transition-all"
          >
            {t('overview.currentMonth')}
          </button>
        )}
      </div>

      {/* Net Cash Flow Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-indigo-50/40 to-slate-100/80 dark:from-neutral-900/90 dark:via-neutral-900/70 dark:to-neutral-950 border border-slate-200/80 dark:border-white/10 p-6 shadow-md dark:shadow-2xl backdrop-blur-xl transition-colors">
        <div className="absolute -top-16 right-0 translate-x-1/4 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 left-0 -translate-x-1/4 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 tracking-wider uppercase">
              {t('overview.netCashFlow')}
            </span>
            <div
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                summary.netSavings >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
              }`}
            >
              <TrendingUp size={12} className={summary.netSavings < 0 ? 'rotate-180' : ''} />
              {summary.netSavings >= 0
                ? t('overview.savedPct', { rate: summary.savingsRate.toFixed(1) })
                : t('overview.deficitPct', { rate: summary.savingsRate.toFixed(1) })}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl sm:text-5xl font-extrabold font-mono tracking-tight ${
                summary.netSavings >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(summary.netSavings)}
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">{t('overview.thisPeriod')}</span>
          </div>

          {/* Income-to-Spend Visual Meter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
              <span>{t('overview.spendRatio')}</span>
              <span className="font-medium text-slate-700 dark:text-neutral-300">
                {t('overview.ofIncome', { ratio: spendRatio.toFixed(0) })}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200/80 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  spendRatio > 100
                    ? 'bg-rose-500'
                    : spendRatio > 80
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-emerald-400 to-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, spendRatio))}%` }}
              />
            </div>
          </div>

          {/* Dual Inflow / Outflow Metric Cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                <ArrowUpRight size={14} /> {t('overview.totalIncome')}
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary.incomeTotal)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                <ArrowDownRight size={14} /> {t('overview.totalSpent')}
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary.expenseTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lifestyle & Wealth Plan Card (50/30/20 Smart Blueprint) */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
              {t('overview.lifestyleEngine')} ({settings.selectedFramework})
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              {t('overview.incomeBase')} {formatCurrency(summary.effectiveIncomeBase)}{' '}
              {settings.useManualSalary ? t('overview.manualTarget') : t('overview.actualInflow')}
            </p>
          </div>
          <button
            onClick={() => {
              triggerHaptic(5);
              onNavigateToTab('settings');
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            {t('overview.adjust')}
          </button>
        </div>

        {/* Multi-segment allocation preview bar */}
        <div className="space-y-1">
          <div className="h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex p-0.5 border border-slate-200 dark:border-white/5">
            <div
              className="h-full bg-blue-500 rounded-l-full transition-all duration-300"
              style={{ width: `${essentialsCapPct}%` }}
              title={`Essentials Cap: ${essentialsCapPct.toFixed(0)}%`}
            />
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${selfCareCapPct}%` }}
              title={`Self-Care Cap: ${selfCareCapPct.toFixed(0)}%`}
            />
            <div
              className="h-full bg-teal-400 rounded-r-full transition-all duration-300"
              style={{ width: `${investmentsCapPct}%` }}
              title={`Investments Cap: ${investmentsCapPct.toFixed(0)}%`}
            />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-neutral-400 px-1">
            <span className="text-blue-600 dark:text-blue-400">{t('overview.essentialsTitle')} ({essentialsCapPct.toFixed(0)}%)</span>
            <span className="text-purple-600 dark:text-purple-400">{t('overview.selfCareTitle')} ({selfCareCapPct.toFixed(0)}%)</span>
            <span className="text-teal-600 dark:text-teal-400">{t('overview.investmentsTitle')} ({investmentsCapPct.toFixed(0)}%)</span>
          </div>
        </div>

        {/* 3 Tri-Color Status Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Self-Care Remaining & Daily Safe Pace */}
          <div
            className={`p-3.5 rounded-2xl bg-purple-500/10 border space-y-2 transition-colors ${
              isSelfCareOver
                ? 'border-rose-500/40 dark:border-rose-500/50'
                : 'border-purple-500/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Heart size={14} /> {t('overview.selfCareTitle')}
              </span>
              <div className="flex items-center gap-1.5">
                {isSelfCareOver && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    {t('overview.overLimit')}
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                  {summary.selfCare.percentage}%
                </span>
              </div>
            </div>
            <div>
              <div
                className={`text-xl font-extrabold font-mono tracking-tight ${
                  isSelfCareOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(summary.selfCare.remaining)}
              </div>
              <div
                className={`text-[11px] ${
                  isSelfCareOver
                    ? 'text-rose-600/90 dark:text-rose-400/90 font-medium'
                    : 'text-purple-700/80 dark:text-purple-300/80'
                }`}
              >
                {isSelfCareOver
                  ? t('overview.overMonthlyCap', { amount: formatCurrency(selfCareOverAmount) })
                  : t('overview.bufferRemaining')}
              </div>
            </div>
            <div className="pt-1 border-t border-purple-500/15 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-neutral-400">{t('overview.dailySafeToSpend')}:</span>
              <span
                className={`font-bold font-mono ${
                  isSelfCareOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(summary.selfCare.dailySafePace || 0)}/day
              </span>
            </div>
          </div>

          {/* Investments Target & Funded % */}
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <TrendingUp size={14} /> {t('overview.investmentsTitle')}
              </span>
              <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                {summary.investments.percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                {formatCurrency(summary.investments.spent)}
              </div>
              <div className="text-[11px] text-teal-700/80 dark:text-teal-300/80">
                {t('overview.spentOf', { total: formatCurrency(summary.investments.budgetCap) })}
              </div>
            </div>
            <div className="pt-1 border-t border-teal-500/15 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-neutral-400">{t('overview.funded')}:</span>
              <span className="font-bold font-mono text-teal-700 dark:text-teal-300">
                {(summary.investments.fundedProgressPct || 0).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Essentials Cap & Committed Bills */}
          <div
            className={`p-3.5 rounded-2xl bg-blue-500/10 border space-y-2 transition-colors ${
              isEssentialsOver
                ? 'border-rose-500/40 dark:border-rose-500/50'
                : 'border-blue-500/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <ShieldCheck size={14} /> {t('overview.essentialsTitle')}
              </span>
              <div className="flex items-center gap-1.5">
                {isEssentialsOver && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    {t('overview.overCap')}
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                  {summary.essentials.percentage}%
                </span>
              </div>
            </div>
            <div>
              <div
                className={`text-xl font-extrabold font-mono tracking-tight ${
                  isEssentialsOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(summary.essentials.spent)}
              </div>
              <div
                className={`text-[11px] ${
                  isEssentialsOver
                    ? 'text-rose-600/90 dark:text-rose-400/90 font-medium'
                    : 'text-blue-700/80 dark:text-blue-300/80'
                }`}
              >
                {isEssentialsOver
                  ? t('overview.spentOfOver', {
                      total: formatCurrency(summary.essentials.budgetCap),
                      over: formatCurrency(essentialsOverAmount)
                    })
                  : t('overview.spentOf', {
                      total: formatCurrency(summary.essentials.budgetCap)
                    })}
              </div>
            </div>
            <div className="pt-1 border-t border-blue-500/15 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-neutral-400">{t('overview.committedBills')}:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrency(summary.essentials.committedBills || 0)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Commitments Widget */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {t('overview.upcomingBills')}
            </h3>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/5">
            <button
              onClick={() => {
                triggerHaptic(5);
                setBillsTimeframe('7');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                billsTimeframe === '7'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('overview.next7Days')}
            </button>
            <button
              onClick={() => {
                triggerHaptic(5);
                setBillsTimeframe('30');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                billsTimeframe === '30'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('overview.next30Days')}
            </button>
          </div>
        </div>

        {upcomingBills.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/70 dark:border-white/5">
            {t('overview.noUpcomingBills')}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingBills.map(bill => {
              const cat = categories.find(c => c.id === bill.categoryId);
              const isOverdue = bill.daysLeft < 0;
              const isToday = bill.daysLeft === 0;
              const isTomorrow = bill.daysLeft === 1;
              const isReminderDue =
                bill.isActive && bill.reminderEnabled && bill.daysLeft <= bill.reminderDaysBefore;

              let tagText = t('overview.dueInDays', { days: bill.daysLeft });
              let tagStyle =
                'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-neutral-300 border-slate-300/80 dark:border-white/10';
              if (isOverdue) {
                tagText = t('overview.overdueDays', { days: Math.abs(bill.daysLeft) });
                tagStyle =
                  'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30';
              } else if (isToday) {
                tagText = t('overview.dueToday');
                tagStyle =
                  'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse';
              } else if (isTomorrow) {
                tagText = t('overview.dueTomorrow');
                tagStyle =
                  'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
              } else if (isReminderDue) {
                tagStyle =
                  'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40';
              }

              const monthlyCost = bill.amount * getMonthlyMultiplier(bill.billingCycle);

              return (
                <div
                  key={bill.id}
                  onClick={() => {
                    triggerHaptic(10);
                    onNavigateToTab('bills');
                  }}
                  className={`group flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-2xl bg-white dark:bg-neutral-900/80 border shadow-2xs dark:shadow-none transition-all cursor-pointer gap-2.5 sm:gap-3 ${
                    !bill.isActive
                      ? 'border-slate-200/60 dark:border-white/5 opacity-50 bg-slate-100 dark:bg-neutral-950'
                      : isReminderDue
                      ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 hover:border-amber-500/60'
                      : 'border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  {/* Top row on mobile / Left group on sm+ */}
                  <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${cat?.colorHex || '#8b5cf6'}25`,
                          color: cat?.colorHex || '#8b5cf6'
                        }}
                      >
                        <CategoryIcon iconName={cat?.iconName || 'repeat'} size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {bill.title}
                          </span>
                          {bill.isAutoPay && (
                            <span title={t('overview.autoDebit')}>
                              <Zap size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            </span>
                          )}
                          {bill.reminderEnabled && (
                            <span
                              title={
                                isReminderDue
                                  ? `Reminder Alert: Due within ${bill.reminderDaysBefore}d`
                                  : `Reminder ${bill.reminderDaysBefore}d before`
                              }
                              className={`inline-flex items-center gap-1 ${
                                isReminderDue
                                  ? 'px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-700 dark:text-amber-300'
                                  : ''
                              }`}
                            >
                              <Bell
                                size={12}
                                className={`text-amber-500 dark:text-amber-400 shrink-0 ${
                                  isReminderDue ? 'animate-bounce' : ''
                                }`}
                              />
                              {isReminderDue && <span>Reminder</span>}
                            </span>
                          )}
                          {!bill.isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-neutral-400">
                              {t('common.paused')}
                            </span>
                          )}
                        </div>

                        {/* Desktop: badge and cycle placed inline under title */}
                        <div className="hidden sm:flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tagStyle}`}>
                            {tagText}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-neutral-400 capitalize">
                            {bill.billingCycle} • {format(parseISO(bill.nextDueDate), 'MMM d')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile: Amount and monthly equivalent on the right of the top row */}
                    <div className="text-right sm:hidden shrink-0">
                      <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                        {formatCurrency(bill.amount, bill.currencyCode)}
                      </div>
                      {bill.billingCycle !== 'monthly' && (
                        <div className="text-[10px] font-mono text-slate-500 dark:text-neutral-400">
                          ~{formatCurrency(monthlyCost)}/mo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom row on mobile (Due status left, Actions right) / Controls on sm+ */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5 sm:border-0 sm:pt-0 sm:gap-3 shrink-0">
                    {/* Mobile: Due status & billing cycle */}
                    <div className="flex sm:hidden items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tagStyle}`}>
                        {tagText}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-neutral-400 capitalize truncate">
                        {bill.billingCycle} • {format(parseISO(bill.nextDueDate), 'MMM d')}
                      </span>
                    </div>

                    {/* Action buttons + Desktop Amount */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="hidden sm:block text-right">
                        <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                          {formatCurrency(bill.amount, bill.currencyCode)}
                        </div>
                        {bill.billingCycle !== 'monthly' && (
                          <div className="text-[10px] font-mono text-slate-500 dark:text-neutral-400">
                            ~{formatCurrency(monthlyCost)}/mo
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleMarkPaid(bill);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
                        title="Mark Paid & Advance Due Date"
                      >
                        <CheckCircle2 size={13} /> {t('overview.paid')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spending by Category Donut Chart & Ranked List */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{t('overview.spendingByCategory')}</h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
            {t('overview.totalSpent')}: {formatCurrency(summary.expenseTotal)}
          </span>
        </div>

        {summary.expenseTotal === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/70 dark:border-white/5">
            {t('overview.noExpensesMonth')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Interactive Recharts Donut with Center Metric */}
            <div className="relative h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'light' ? '#ffffff' : '#18181b',
                      borderRadius: '12px',
                      border: theme === 'light' ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                      color: theme === 'light' ? '#0f172a' : '#fff',
                      fontSize: '12px',
                      boxShadow: theme === 'light' ? '0 4px 12px rgba(15,23,42,0.08)' : 'none'
                    }}
                    itemStyle={{
                      color: theme === 'light' ? '#0f172a' : '#fff'
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val)), t('overview.totalSpent')]}
                  />
                  <Pie
                    data={donutData}
                    innerRadius={65}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Metric in Donut Hole */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                  {t('overview.totalSpent')}
                </span>
                <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                  {formatCurrency(summary.expenseTotal)}
                </span>
              </div>
            </div>

            {/* Ranked Category List */}
            <div className="space-y-2.5 pt-2">
              {summary.categorySpending.map(item => (
                <div
                  key={item.category.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${item.category.colorHex || '#6366f1'}25`,
                          color: item.category.colorHex || '#6366f1'
                        }}
                      >
                        <CategoryIcon iconName={item.category.iconName} size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.category.name}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-white block">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-neutral-400">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Percentage bar */}
                  <div className="h-1.5 w-full bg-slate-200/80 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                        backgroundColor: item.category.colorHex || '#6366f1'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
