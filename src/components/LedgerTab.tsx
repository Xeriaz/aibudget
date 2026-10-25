import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Trash2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import type { Transaction, Category } from '../types';
import { formatCurrency, triggerHaptic } from '../lib/calculations';
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

  const hasActiveFilters = searchQuery !== '' || selectedType !== 'all' || selectedCategoryId !== 'all' || selectedMonth !== 'all';

  const resetFilters = () => {
    triggerHaptic(10);
    setSearchQuery('');
    setSelectedType('all');
    setSelectedCategoryId('all');
    setSelectedMonth('all');
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Type filter
      if (selectedType !== 'all' && t.type !== selectedType) return false;

      // Category filter
      if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) return false;

      // Month filter
      if (selectedMonth !== 'all' && !t.transactionDate.startsWith(selectedMonth)) return false;

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
    }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [transactions, selectedType, selectedCategoryId, selectedMonth, searchQuery, categoryMap]);

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
        {availableMonths.length > 0 && (
          <select
            value={selectedMonth}
            onChange={e => {
              triggerHaptic(5);
              setSelectedMonth(e.target.value);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 focus:outline-none shrink-0"
          >
            <option value="all">All Months</option>
            {availableMonths.map(m => (
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
