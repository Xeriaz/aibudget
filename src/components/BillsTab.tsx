import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Zap,
  Bell,
  CheckCircle2,
  Repeat,
  Flame,
  Clock,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import { format, parseISO, isThisMonth } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { RecurringPayment, Category } from '../types';
import {
  formatCurrency,
  getDaysUntilDue,
  getMonthlyMultiplier,
  markBillAsPaid,
  triggerHaptic
} from '../lib/calculations';
import { CategoryIcon } from './CategoryIcon';
import { db } from '../db/db';

interface BillsTabProps {
  recurring: RecurringPayment[];
  categories: Category[];
  onOpenAddModal: () => void;
  onSelectToEdit: (rec: RecurringPayment) => void;
  onRefresh: () => void;
}

export const BillsTab: React.FC<BillsTabProps> = ({
  recurring,
  categories,
  onOpenAddModal,
  onSelectToEdit,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Calculations for hero metrics
  const { monthlyBurn, annualCommitment, activeCount } = useMemo(() => {
    let monthly = 0;
    let count = 0;
    for (const r of recurring) {
      if (r.isActive) {
        monthly += r.amount * getMonthlyMultiplier(r.billingCycle);
        count++;
      }
    }
    return {
      monthlyBurn: monthly,
      annualCommitment: monthly * 12,
      activeCount: count
    };
  }, [recurring]);

  // Categorize recurring bills into sections
  const { dueWithin7Days, dueThisMonth, laterCommitments } = useMemo(() => {
    const within7: (RecurringPayment & { daysLeft: number })[] = [];
    const thisMonth: (RecurringPayment & { daysLeft: number })[] = [];
    const later: (RecurringPayment & { daysLeft: number })[] = [];

    const list = filterActiveOnly ? recurring.filter(r => r.isActive) : recurring;

    for (const r of list) {
      const daysLeft = getDaysUntilDue(r.nextDueDate);
      const item = { ...r, daysLeft };
      const parsedDate = parseISO(r.nextDueDate);

      if (daysLeft <= 7) {
        within7.push(item);
      } else if (isThisMonth(parsedDate)) {
        thisMonth.push(item);
      } else {
        later.push(item);
      }
    }

    within7.sort((a, b) => a.daysLeft - b.daysLeft);
    thisMonth.sort((a, b) => a.daysLeft - b.daysLeft);
    later.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      dueWithin7Days: within7,
      dueThisMonth: thisMonth,
      laterCommitments: later
    };
  }, [recurring, filterActiveOnly]);

  const handleMarkPaid = async (e: React.MouseEvent, bill: RecurringPayment) => {
    e.stopPropagation();
    await markBillAsPaid(bill);
    onRefresh();
  };

  const handleToggleActive = async (e: React.MouseEvent, bill: RecurringPayment) => {
    e.stopPropagation();
    triggerHaptic(10);
    await db.recurringPayments.update(bill.id, {
      isActive: !bill.isActive,
      updatedAt: new Date().toISOString()
    });
    onRefresh();
  };

  const renderBillRow = (bill: RecurringPayment & { daysLeft: number }) => {
    const cat = bill.categoryId ? categoryMap.get(bill.categoryId) : undefined;
    const isOverdue = bill.daysLeft < 0;
    const isToday = bill.daysLeft === 0;
    const isTomorrow = bill.daysLeft === 1;
    const isReminderDue =
      bill.isActive && bill.reminderEnabled && bill.daysLeft <= bill.reminderDaysBefore;

    let badgeText = t('overview.dueInDays', { days: bill.daysLeft });
    let badgeClass =
      'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-neutral-300 border-slate-300/80 dark:border-white/10';
    if (isOverdue) {
      badgeText = t('overview.overdueDays', { days: Math.abs(bill.daysLeft) });
      badgeClass =
        'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30';
    } else if (isToday) {
      badgeText = t('overview.dueToday');
      badgeClass =
        'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse';
    } else if (isTomorrow) {
      badgeText = t('overview.dueTomorrow');
      badgeClass =
        'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
    } else if (isReminderDue) {
      badgeClass =
        'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40';
    }

    const monthlyCost = bill.amount * getMonthlyMultiplier(bill.billingCycle);

    return (
      <div
        key={bill.id}
        onClick={() => {
          triggerHaptic(10);
          onSelectToEdit(bill);
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
                  <span title={t('bills.autoDebit')}>
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
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}>
                  {badgeText}
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
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}>
              {badgeText}
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
              onClick={e => handleToggleActive(e, bill)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 active:scale-95 transition-all"
              title={bill.isActive ? t('bills.pauseBill') : t('bills.resumeBill')}
              aria-label={bill.isActive ? `Pause ${bill.title}` : `Resume ${bill.title}`}
            >
              {bill.isActive ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
            </button>

            <button
              type="button"
              onClick={e => handleMarkPaid(e, bill)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
              title="Mark Paid & Advance Due Date"
            >
              <CheckCircle2 size={13} /> {t('overview.paid')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" /> {t('bills.title')}
        </h2>
        <button
          onClick={() => {
            triggerHaptic(10);
            onOpenAddModal();
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
        >
          <Plus size={14} /> {t('bills.addBill')}
        </button>
      </div>

      {/* Hero Burn Projection Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/90 via-white to-slate-100/90 dark:from-indigo-950/60 dark:via-neutral-900/90 dark:to-neutral-950 border border-indigo-500/20 p-5 shadow-md dark:shadow-2xl backdrop-blur-xl space-y-4 transition-colors">
        <div className="absolute -top-12 right-0 translate-x-1/4 w-40 h-40 bg-indigo-500/15 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Flame size={14} className="text-orange-500 dark:text-orange-400" /> Committed Fixed Burn
          </span>
          <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
            {activeCount === 1 ? t('bills.activeCommitments', { count: activeCount }) : t('bills.activeCommitments_plural', { count: activeCount })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs dark:shadow-none">
            <span className="text-xs text-slate-500 dark:text-neutral-400 block mb-1">{t('bills.monthlyImpact')}</span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {formatCurrency(monthlyBurn)}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs dark:shadow-none">
            <span className="text-xs text-slate-500 dark:text-neutral-400 block mb-1">{t('bills.annualImpact')}</span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-300">
              {formatCurrency(annualCommitment)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          Scheduled Bills
        </span>
        <button
          onClick={() => {
            triggerHaptic(5);
            setFilterActiveOnly(!filterActiveOnly);
          }}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
        >
          {filterActiveOnly ? 'Show All (incl. Paused)' : t('bills.activeOnly')}
        </button>
      </div>

      {/* Section 1: Due Within 7 Days */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          <Clock size={14} /> {t('bills.dueInNext7Days')} ({dueWithin7Days.length})
        </div>
        {dueWithin7Days.length === 0 ? (
          <div className="py-4 px-4 text-xs text-slate-500 dark:text-neutral-500 bg-white/70 dark:bg-neutral-900/40 rounded-2xl border border-slate-200/70 dark:border-white/5">
            No bills due in the next 7 days.
          </div>
        ) : (
          <div className="space-y-2">
            {dueWithin7Days.map(renderBillRow)}
          </div>
        )}
      </div>

      {/* Section 2: Due This Month */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          <Calendar size={14} /> {t('bills.dueLaterThisMonth')} ({dueThisMonth.length})
        </div>
        {dueThisMonth.length === 0 ? (
          <div className="py-4 px-4 text-xs text-slate-500 dark:text-neutral-500 bg-white/70 dark:bg-neutral-900/40 rounded-2xl border border-slate-200/70 dark:border-white/5">
            No remaining bills due later this month.
          </div>
        ) : (
          <div className="space-y-2">
            {dueThisMonth.map(renderBillRow)}
          </div>
        )}
      </div>

      {/* Section 3: Later Commitments */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          <Repeat size={14} /> {t('bills.upcomingLater')} ({laterCommitments.length})
        </div>
        {laterCommitments.length === 0 ? (
          <div className="py-4 px-4 text-xs text-slate-500 dark:text-neutral-500 bg-white/70 dark:bg-neutral-900/40 rounded-2xl border border-slate-200/70 dark:border-white/5">
            No future recurring commitments scheduled beyond this month.
          </div>
        ) : (
          <div className="space-y-2">
            {laterCommitments.map(renderBillRow)}
          </div>
        )}
      </div>
    </div>
  );
};
