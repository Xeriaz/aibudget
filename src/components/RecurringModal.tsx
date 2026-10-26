import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Trash2, Bell, Zap, PauseCircle, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { RecurringPayment, Category, BillingCycle } from '../types';
import { db } from '../db/db';
import { triggerHaptic, getCategoryDisplayName } from '../lib/calculations';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringToEdit?: RecurringPayment | null;
  categories: Category[];
  onSaved: () => void;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  recurringToEdit,
  categories,
  onSaved
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isAutoPay, setIsAutoPay] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [nextDueDate, setNextDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(2);

  useEffect(() => {
    if (recurringToEdit) {
      setTitle(recurringToEdit.title);
      setNote(recurringToEdit.note || '');
      setAmountStr(recurringToEdit.amount.toString());
      setBillingCycle(recurringToEdit.billingCycle);
      setIsAutoPay(recurringToEdit.isAutoPay);
      setIsActive(recurringToEdit.isActive ?? true);
      setCategoryId(recurringToEdit.categoryId || '');
      setNextDueDate(recurringToEdit.nextDueDate);
      setReminderEnabled(recurringToEdit.reminderEnabled);
      setReminderDaysBefore(recurringToEdit.reminderDaysBefore ?? 2);
    } else {
      setTitle('');
      setNote('');
      setAmountStr('');
      setBillingCycle('monthly');
      setIsAutoPay(true);
      setIsActive(true);
      setCategoryId(categories[0]?.id || '');
      setNextDueDate(format(new Date(), 'yyyy-MM-dd'));
      setReminderEnabled(true);
      setReminderDaysBefore(2);
    }
  }, [recurringToEdit, isOpen, categories]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert(t('recurringModal.enterValidAmount'));
      return;
    }
    if (!title.trim()) {
      alert(t('recurringModal.enterTitle'));
      return;
    }

    const nowIso = new Date().toISOString();

    if (recurringToEdit) {
      await db.recurringPayments.update(recurringToEdit.id, {
        title: title.trim(),
        note: note.trim() || undefined,
        amount: parsedAmount,
        currencyCode: 'EUR',
        billingCycle,
        isAutoPay,
        isActive,
        categoryId: categoryId || undefined,
        nextDueDate,
        reminderEnabled,
        reminderDaysBefore,
        updatedAt: nowIso
      });
    } else {
      const newRec: RecurringPayment = {
        id: 'rec_' + crypto.randomUUID(),
        title: title.trim(),
        note: note.trim() || undefined,
        amount: parsedAmount,
        currencyCode: 'EUR',
        billingCycle,
        isAutoPay,
        categoryId: categoryId || undefined,
        nextDueDate,
        reminderEnabled,
        reminderDaysBefore,
        isActive,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await db.recurringPayments.add(newRec);
    }

    triggerHaptic([15, 20]);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!recurringToEdit) return;
    if (confirm(t('recurringModal.confirmDelete'))) {
      triggerHaptic(30);
      await db.recurringPayments.delete(recurringToEdit.id);
      onSaved();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-modal-title"
        className="w-full max-w-lg max-w-[100vw] bg-white dark:bg-[#121217] text-slate-900 dark:text-white border-t sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <h2 id="recurring-modal-title" className="text-lg font-bold">
            {recurringToEdit ? t('recurringModal.editRecurring') : t('recurringModal.newRecurring')}
          </h2>
          <button
            type="button"
            aria-label={t('common.closeModal')}
            onClick={() => {
              triggerHaptic(5);
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-5 space-y-5 pb-safe">
          {/* Amount input */}
          <div className="text-center py-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              {t('recurringModal.amount')}
            </span>
            <div className="inline-flex items-center justify-center gap-1 max-w-full">
              <span className="text-3xl font-light text-slate-400 dark:text-neutral-400 shrink-0">€</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="text-4xl font-extrabold font-mono tracking-tight bg-transparent text-center focus:outline-none w-48 max-w-[200px] sm:max-w-xs text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-neutral-700"
              />
            </div>
          </div>

          {/* Title & Note */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {t('recurringModal.titleService')}
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('recurringModal.titlePlaceholder')}
                className="w-full max-w-full px-4 py-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {t('recurringModal.note')}
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('recurringModal.notePlaceholder')}
                className="w-full max-w-full px-4 py-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Billing Cycle Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              {t('recurringModal.billingCycle')}
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setBillingCycle(cycle);
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold capitalize border transition-all truncate text-center ${
                    billingCycle === cycle
                      ? 'border-indigo-500 bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-900 dark:text-white'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  {t(`recurringModal.${cycle}` as any)}
                </button>
              ))}
            </div>
          </div>

          {/* Next Due Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {t('recurringModal.nextDueDate')}
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={e => setNextDueDate(e.target.value)}
                  className="w-full max-w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {t('recurringModal.category')}
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full max-w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {getCategoryDisplayName(cat, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status, Auto-Debit & Reminders */}
          <div className="p-4 bg-slate-50 dark:bg-neutral-900/60 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-4 min-w-0 overflow-hidden">
            {/* Active / Paused Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-neutral-400'
                  }`}
                >
                  {isActive ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {isActive ? t('common.active') : t('common.paused')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                    {t('recurringModal.activeSubscription')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label={isActive ? t('recurringModal.pauseBill') : t('recurringModal.resumeBill')}
                onClick={() => {
                  triggerHaptic(10);
                  setIsActive(!isActive);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                {isActive ? t('common.active') : t('common.paused')}
              </button>
            </div>

            <div className="border-t border-slate-200 dark:border-white/5 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Zap size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t('recurringModal.autoDebit')}</div>
                  <div className="text-xs text-slate-500 dark:text-neutral-400 truncate">{t('recurringModal.autoDebitDesc')}</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAutoPay}
                onChange={e => {
                  triggerHaptic(10);
                  setIsAutoPay(e.target.checked);
                }}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-white/5 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Bell size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t('bills.reminder')}</div>
                    <div className="text-xs text-slate-500 dark:text-neutral-400 truncate">{t('recurringModal.reminder')}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => {
                    triggerHaptic(10);
                    setReminderEnabled(e.target.checked);
                  }}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {reminderEnabled && (
                <div className="flex items-center gap-1.5 sm:gap-2 sm:pl-11 pt-1 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-neutral-400 shrink-0">{t('recurringModal.remindMe')}</span>
                  {[0, 1, 2, 3, 5, 7].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        triggerHaptic(5);
                        setReminderDaysBefore(days);
                      }}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        reminderDaysBefore === days
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      {days === 0 ? t('recurringModal.sameDay') : t('recurringModal.daysBefore', { count: days })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 pb-2 flex items-center gap-3">
            {recurringToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all shrink-0"
                title={t('recurringModal.cancelBillTooltip')}
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {recurringToEdit ? t('recurringModal.saveBill') : t('recurringModal.createRecurringBill')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
