import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  ShieldCheck,
  Heart,
  Wallet
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import type { Transaction, Category, RecurringPayment, PlanSettings } from '../types';
import {
  calculateMonthSummary,
  formatCurrency,
  getDaysUntilDue,
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
  onRefresh: () => void;
  onOpenFastAdd: () => void;
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
  onRefresh,
  onOpenFastAdd,
  onNavigateToTab
}) => {
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Period Switcher */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-sm font-bold tracking-tight text-white min-w-32 text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {!isViewingToday && (
            <button
              onClick={handleResetToToday}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 active:scale-95 transition-all"
            >
              Current Month
            </button>
          )}
        </div>

        <button
          onClick={() => {
            triggerHaptic(10);
            onOpenFastAdd();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
        >
          <Sparkles size={14} /> + Fast Log
        </button>
      </div>

      {/* Net Cash Flow Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900/90 via-neutral-900/70 to-neutral-950 border border-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase">
              Net Cash Flow
            </span>
            <div
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                summary.netSavings >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
            >
              <TrendingUp size={12} className={summary.netSavings < 0 ? 'rotate-180' : ''} />
              {summary.netSavings >= 0
                ? `+${summary.savingsRate.toFixed(1)}% Saved`
                : `${summary.savingsRate.toFixed(1)}% Deficit`}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${
                summary.netSavings >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(summary.netSavings)}
            </span>
            <span className="text-xs text-neutral-400 font-medium">this period</span>
          </div>

          {/* Income-to-Spend Visual Meter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Spend Ratio</span>
              <span className="font-medium text-neutral-300">{spendRatio.toFixed(0)}% of income</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
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
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                <ArrowUpRight size={14} /> Total Income
              </div>
              <div className="text-lg font-bold text-white tracking-tight">
                {formatCurrency(summary.incomeTotal)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 mb-1">
                <ArrowDownRight size={14} /> Total Spent
              </div>
              <div className="text-lg font-bold text-white tracking-tight">
                {formatCurrency(summary.expenseTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lifestyle & Wealth Plan Card (50/30/20 Smart Blueprint) */}
      <div className="rounded-3xl bg-neutral-900/80 border border-white/10 p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              Lifestyle & Wealth Engine ({settings.selectedFramework})
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Income base: {formatCurrency(summary.effectiveIncomeBase)}{' '}
              {settings.useManualSalary ? '(Manual Target)' : '(Actual Inflow)'}
            </p>
          </div>
          <button
            onClick={() => {
              triggerHaptic(5);
              onNavigateToTab('settings');
            }}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Adjust
          </button>
        </div>

        {/* Multi-segment allocation preview bar */}
        <div className="space-y-1">
          <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex p-0.5 border border-white/5">
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
          <div className="flex justify-between text-[11px] font-semibold text-neutral-400 px-1">
            <span className="text-blue-400">Essentials ({essentialsCapPct.toFixed(0)}%)</span>
            <span className="text-purple-400">Self-Care ({selfCareCapPct.toFixed(0)}%)</span>
            <span className="text-teal-400">Wealth ({investmentsCapPct.toFixed(0)}%)</span>
          </div>
        </div>

        {/* 3 Tri-Color Status Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Self-Care Remaining & Daily Safe Pace */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Heart size={14} /> Self-Care & Wants
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                {summary.selfCare.percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">
                {formatCurrency(summary.selfCare.remaining)}
              </div>
              <div className="text-[11px] text-purple-300/80">buffer remaining</div>
            </div>
            <div className="pt-1 border-t border-purple-500/15 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Daily Safe Pace:</span>
              <span className="font-bold text-white">
                {formatCurrency(summary.selfCare.dailySafePace || 0)}/day
              </span>
            </div>
          </div>

          {/* Investments Target & Funded % */}
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <TrendingUp size={14} /> Wealth / DCA
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                {summary.investments.percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">
                {formatCurrency(summary.investments.spent)}
              </div>
              <div className="text-[11px] text-teal-300/80">
                funded of {formatCurrency(summary.investments.budgetCap)}
              </div>
            </div>
            <div className="pt-1 border-t border-teal-500/15 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Progress:</span>
              <span className="font-bold text-teal-300">
                {(summary.investments.fundedProgressPct || 0).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Essentials Cap & Committed Bills */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Essentials
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                {summary.essentials.percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">
                {formatCurrency(summary.essentials.spent)}
              </div>
              <div className="text-[11px] text-blue-300/80">
                spent of {formatCurrency(summary.essentials.budgetCap)}
              </div>
            </div>
            <div className="pt-1 border-t border-blue-500/15 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Committed Bills:</span>
              <span className="font-bold text-white">
                {formatCurrency(summary.essentials.committedBills || 0)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Commitments Widget */}
      <div className="rounded-3xl bg-neutral-900/80 border border-white/10 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Upcoming Commitments</h3>
          </div>
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => {
                triggerHaptic(5);
                setBillsTimeframe('7');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                billsTimeframe === '7'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => {
                triggerHaptic(5);
                setBillsTimeframe('30');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                billsTimeframe === '30'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {upcomingBills.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-400 bg-white/5 rounded-2xl border border-white/5">
            No bills due within {billsTimeframe} days. You're completely clear!
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingBills.map(bill => {
              const cat = categories.find(c => c.id === bill.categoryId);
              const isOverdue = bill.daysLeft < 0;
              const isToday = bill.daysLeft === 0;
              const isTomorrow = bill.daysLeft === 1;

              let tagText = `In ${bill.daysLeft} days`;
              let tagStyle = 'bg-white/10 text-neutral-300 border-white/10';
              if (isOverdue) {
                tagText = `Overdue (${Math.abs(bill.daysLeft)}d)`;
                tagStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
              } else if (isToday) {
                tagText = 'Due Today';
                tagStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
              } else if (isTomorrow) {
                tagText = 'Tomorrow';
                tagStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              }

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${cat?.colorHex || '#8B5CF6'}25`,
                        color: cat?.colorHex || '#8B5CF6'
                      }}
                    >
                      <CategoryIcon iconName={cat?.iconName || 'repeat'} size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        {bill.title}
                        {bill.isAutoPay && (
                          <span title="Auto-Debit Enabled">
                            <Zap size={12} className="text-indigo-400" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tagStyle}`}>
                          {tagText}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {format(new Date(bill.nextDueDate), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-white">
                      {formatCurrency(bill.amount, bill.currencyCode)}
                    </span>
                    <button
                      onClick={() => handleMarkPaid(bill)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Paid
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spending by Category Donut Chart & Ranked List */}
      <div className="rounded-3xl bg-neutral-900/80 border border-white/10 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Spending Breakdown</h3>
          </div>
          <span className="text-xs text-neutral-400 font-medium">
            Total {formatCurrency(summary.expenseTotal)}
          </span>
        </div>

        {summary.expenseTotal === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 bg-white/5 rounded-2xl border border-white/5">
            No expenses logged for {format(currentDate, 'MMMM yyyy')}.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Interactive Recharts Donut with Center Metric */}
            <div className="relative h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Spent']}
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
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Total Spent
                </span>
                <span className="text-lg font-extrabold text-white">
                  {formatCurrency(summary.expenseTotal)}
                </span>
              </div>
            </div>

            {/* Ranked Category List */}
            <div className="space-y-2.5 pt-2">
              {summary.categorySpending.map(item => (
                <div
                  key={item.category.id}
                  className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors space-y-1.5"
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
                      <span className="text-xs font-bold text-white">{item.category.name}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-white block">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Micro-percentage bar */}
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
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
