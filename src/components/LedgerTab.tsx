import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Trash2,
  RotateCcw,
  Sparkles,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import type { Transaction, Category } from '../types';
import { calculateYearlyCashFlow, formatCurrency, triggerHaptic } from '../lib/calculations';
import { CategoryIcon } from './CategoryIcon';
import { db } from '../db/db';

interface LedgerTabProps {
  transactions: Transaction[];
  categories: Category[];
  onSelectTransactionToEdit: (tx: Transaction) => void;
  onRefresh: () => void;
  onOpenFastAdd: () => void;
}

export const LedgerTab: React.FC<LedgerTabProps> = ({
  transactions,
  categories,
  onSelectTransactionToEdit,
  onRefresh,
  onOpenFastAdd
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // format: 'YYYY-MM' or 'all'
  const [chartYear, setChartYear] = useState<number>(() => new Date().getFullYear());

  // Map of categories
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.transactionDate && t.transactionDate.length >= 7) {
        set.add(t.transactionDate.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Keep chartYear synced if the user picks a specific month from another year
  useEffect(() => {
    if (selectedMonth !== 'all' && selectedMonth.length >= 4) {
      const yr = Number(selectedMonth.substring(0, 4));
      if (Number.isInteger(yr) && yr > 1900) {
        setChartYear(yr);
      }
    }
  }, [selectedMonth]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedType !== 'all' ||
    selectedCategoryId !== 'all' ||
    selectedMonth !== 'all';

  const resetFilters = () => {
    triggerHaptic(10);
    setSearchQuery('');
    setSelectedType('all');
    setSelectedCategoryId('all');
    setSelectedMonth('all');
  };

  // Base filtered transactions (type + category + search, excluding month filter so the 12-month chart shows all months)
  const baseFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Type filter
      if (selectedType !== 'all' && t.type !== selectedType) return false;

      // Category filter
      if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const catName = t.categoryId ? (categoryMap.get(t.categoryId)?.name || '').toLowerCase() : '';
        const title = (t.title || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        if (!title.includes(q) && !note.includes(q) && !catName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedType, selectedCategoryId, searchQuery, categoryMap]);

  // Yearly 12-month comparison data
  const yearlySummary = useMemo(() => {
    return calculateYearlyCashFlow(baseFilteredTransactions, chartYear);
  }, [baseFilteredTransactions, chartYear]);

  // Filter transactions (including month filter for the list & top strip)
  const filteredTransactions = useMemo(() => {
    return baseFilteredTransactions
      .filter(t => {
        if (selectedMonth !== 'all' && !t.transactionDate.startsWith(selectedMonth)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.transactionDate.localeCompare(a.transactionDate) ||
          (b.createdAt || '').localeCompare(a.createdAt || '')
      );
  }, [baseFilteredTransactions, selectedMonth]);

  // Filtered Totals
  const { totalInflow, totalOutflow } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of filteredTransactions) {
      if (t.type === 'income') inflow += t.amount;
      else outflow += t.amount;
    }
    return { totalInflow: inflow, totalOutflow: outflow };
  }, [filteredTransactions]);

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: Transaction[] } = {};
    for (const tx of filteredTransactions) {
      const d = tx.transactionDate;
      if (!groups[d]) groups[d] = [];
      groups[d].push(tx);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const handleDelete = async (e: React.MouseEvent, txId: string) => {
    e.stopPropagation();
    if (confirm('Delete this transaction?')) {
      triggerHaptic(25);
      await db.transactions.delete(txId);
      onRefresh();
    }
  };

  const formatDayHeader = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Today';
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'EEEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getDaySum = (txs: Transaction[]) => {
    return txs.reduce((acc, t) => (t.type === 'income' ? acc + t.amount : acc - t.amount), 0);
  };

  const handleToggleMonthBar = (monthKey: string) => {
    triggerHaptic(10);
    setSelectedMonth(prev => (prev === monthKey ? 'all' : monthKey));
  };

  const handlePrevYear = () => {
    triggerHaptic(10);
    setChartYear(y => y - 1);
    if (selectedMonth !== 'all') {
      setSelectedMonth('all');
    }
  };

  const handleNextYear = () => {
    triggerHaptic(10);
    setChartYear(y => y + 1);
    if (selectedMonth !== 'all') {
      setSelectedMonth('all');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Summary Strip */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-neutral-900/90 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm dark:shadow-lg backdrop-blur-md transition-colors">
        <div className="text-center">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
            Transactions
          </span>
          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            {filteredTransactions.length}
          </span>
        </div>
        <div className="text-center border-x border-slate-200 dark:border-white/10">
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Inflow
          </span>
          <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalInflow)}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Outflow
          </span>
          <span className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(totalOutflow)}
          </span>
        </div>
      </div>

      {/* Annual Month-by-Month Spend vs Income Diagram */}
      <div
        className="p-4 bg-white dark:bg-neutral-900/90 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-sm dark:shadow-lg backdrop-blur-md space-y-3 transition-colors"
        aria-label="Annual Cash Flow Chart"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={15} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Monthly Cash Flow
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Tap a month to filter transactions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                Income
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
                Spend
              </span>
            </div>

            {/* Year Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5">
              <button
                type="button"
                onClick={handlePrevYear}
                aria-label="Previous Year"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 active:scale-95 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <span
                data-testid="chart-year-label"
                className="px-2 text-xs font-extrabold font-mono text-slate-900 dark:text-white"
              >
                {chartYear}
              </span>
              <button
                type="button"
                onClick={handleNextYear}
                aria-label="Next Year"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 active:scale-95 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 12-Month Side-by-Side Bars */}
        <div className="grid grid-cols-12 gap-1 sm:gap-1.5 pt-2 pb-1 items-end border-b border-slate-200/70 dark:border-white/10">
          {yearlySummary.months.map(m => {
            const isSelected = selectedMonth === m.monthKey;
            const isDimmed = selectedMonth !== 'all' && !isSelected;
            const maxVal = yearlySummary.maxMonthlyValue;

            const incomePct =
              maxVal > 0 && m.income > 0 ? Math.max(6, Math.round((m.income / maxVal) * 100)) : 0;
            const expensePct =
              maxVal > 0 && m.expense > 0 ? Math.max(6, Math.round((m.expense / maxVal) * 100)) : 0;

            return (
              <button
                key={m.monthKey}
                type="button"
                onClick={() => handleToggleMonthBar(m.monthKey)}
                aria-label={`${m.monthLabel} ${chartYear}: Income ${formatCurrency(m.income)}, Spend ${formatCurrency(m.expense)}`}
                aria-pressed={isSelected}
                title={`${m.monthLabel} ${chartYear}\nIncome: ${formatCurrency(m.income)}\nSpend: ${formatCurrency(m.expense)}\nNet: ${m.net >= 0 ? '+' : ''}${formatCurrency(m.net)}`}
                className={`group flex flex-col items-center justify-end rounded-xl py-1.5 px-0.5 transition-all focus:outline-none ${
                  isSelected
                    ? 'bg-indigo-500/15 dark:bg-indigo-500/20 ring-1 ring-indigo-500/50'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                } ${isDimmed ? 'opacity-45 hover:opacity-85' : 'opacity-100'}`}
              >
                <div className="h-24 w-full flex items-end justify-center gap-0.5 sm:gap-1 px-0.5">
                  {/* Income Bar */}
                  <div className="h-full flex-1 max-w-[9px] flex items-end">
                    <div
                      data-testid={`bar-income-${m.monthKey}`}
                      className={`w-full rounded-t-xs transition-all duration-300 ${
                        m.income > 0
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-slate-200 dark:bg-white/10 h-[2px]'
                      }`}
                      style={m.income > 0 ? { height: `${incomePct}%` } : undefined}
                    />
                  </div>

                  {/* Expense Bar */}
                  <div className="h-full flex-1 max-w-[9px] flex items-end">
                    <div
                      data-testid={`bar-expense-${m.monthKey}`}
                      className={`w-full rounded-t-xs transition-all duration-300 ${
                        m.expense > 0
                          ? 'bg-rose-500 dark:bg-rose-400'
                          : 'bg-slate-200 dark:bg-white/10 h-[2px]'
                      }`}
                      style={m.expense > 0 ? { height: `${expensePct}%` } : undefined}
                    />
                  </div>
                </div>

                <span
                  className={`mt-1.5 text-[10px] font-mono leading-none tracking-tight ${
                    isSelected
                      ? 'font-extrabold text-indigo-600 dark:text-indigo-300'
                      : 'font-medium text-slate-500 dark:text-neutral-400 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}
                >
                  {m.monthLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Month or Annual Summary Footer */}
        <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-500 dark:text-neutral-400 flex-wrap gap-2">
          <div className="flex items-center gap-3 font-mono">
            <span>
              {chartYear} In:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatCurrency(yearlySummary.totalIncome)}
              </strong>
            </span>
            <span>
              Out:{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatCurrency(yearlySummary.totalExpense)}
              </strong>
            </span>
            <span>
              Net:{' '}
              <strong
                className={
                  yearlySummary.totalNet >= 0
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-rose-600 dark:text-rose-400'
                }
              >
                {yearlySummary.totalNet >= 0 ? '+' : ''}
                {formatCurrency(yearlySummary.totalNet)}
              </strong>
            </span>
          </div>

          {selectedMonth !== 'all' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(5);
                setSelectedMonth('all');
              }}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Showing {selectedMonth} • Clear month
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-3 text-slate-400 dark:text-neutral-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search merchants, notes, categories..."
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 shadow-2xs dark:shadow-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-slate-400 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Horizontal Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold shrink-0 active:scale-95 transition-all"
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}

        {/* Type pills */}
        {(['all', 'expense', 'income'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              triggerHaptic(5);
              setSelectedType(t);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize shrink-0 border transition-all ${
              selectedType === t
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            {t}
          </button>
        ))}

        {/* Month Dropdown / Pills */}
        {(availableMonths.length > 0 || selectedMonth !== 'all') && (
          <select
            value={selectedMonth}
            onChange={e => {
              triggerHaptic(5);
              setSelectedMonth(e.target.value);
            }}
            aria-label="Filter by month"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 focus:outline-none shrink-0"
          >
            <option value="all">All Months</option>
            {Array.from(new Set([...availableMonths, ...(selectedMonth !== 'all' ? [selectedMonth] : [])]))
              .sort()
              .reverse()
              .map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
        )}

        {/* Category Filter Dropdown */}
        <select
          value={selectedCategoryId}
          onChange={e => {
            triggerHaptic(5);
            setSelectedCategoryId(e.target.value);
          }}
          aria-label="Filter by category"
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 focus:outline-none shrink-0"
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date-Grouped Transaction List */}
      {groupedTransactions.length === 0 ? (
        <div className="py-12 text-center rounded-3xl bg-white/80 dark:bg-neutral-900/50 border border-slate-200/80 dark:border-white/5 space-y-3 shadow-xs dark:shadow-none">
          <p className="text-slate-500 dark:text-neutral-400 text-sm">No transactions match your filters.</p>
          <button
            onClick={onOpenFastAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
          >
            <Sparkles size={14} /> Add Transaction
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map(([dateStr, txs]) => {
            const dailyNet = getDaySum(txs);
            return (
              <div key={dateStr} className="space-y-2">
                {/* Date Group Header */}
                <div className="flex items-center justify-between px-2 pt-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                    {formatDayHeader(dateStr)}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      dailyNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-neutral-400'
                    }`}
                  >
                    {dailyNet >= 0 ? `+${formatCurrency(dailyNet)}` : formatCurrency(dailyNet)}
                  </span>
                </div>

                {/* Day's Transactions */}
                <div className="space-y-1.5">
                  {txs.map(tx => {
                    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                    const isIncome = tx.type === 'income';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          triggerHaptic(10);
                          onSelectTransactionToEdit(tx);
                        }}
                        className="group flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 shadow-2xs dark:shadow-none cursor-pointer active:scale-[0.99] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                            style={{
                              backgroundColor: `${cat?.colorHex || '#6366f1'}20`,
                              color: cat?.colorHex || '#6366f1'
                            }}
                          >
                            <CategoryIcon iconName={cat?.iconName} size={18} />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                              {tx.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400 truncate">
                              <span>{cat?.name || 'Uncategorized'}</span>
                              {tx.note && (
                                <>
                                  <span>•</span>
                                  <span className="truncate italic text-slate-400 dark:text-neutral-500">{tx.note}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span
                              className={`text-sm sm:text-base font-extrabold flex items-center justify-end gap-0.5 ${
                                isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {isIncome ? '+' : '-'}
                              {formatCurrency(tx.amount, tx.currencyCode)}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-neutral-500 block">
                              {format(parseISO(tx.transactionDate), 'MMM d')}
                            </span>
                          </div>

                          <button
                            onClick={e => handleDelete(e, tx.id)}
                            className="p-1.5 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-rose-500/15 dark:hover:bg-rose-500/20 text-slate-400 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
