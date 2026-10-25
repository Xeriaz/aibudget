import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Trash2, Bell, Zap } from 'lucide-react';
import { format } from 'date-fns';
import type { RecurringPayment, Category, BillingCycle } from '../types';
import { db } from '../db/db';
import { CategoryIcon } from './CategoryIcon';
import { triggerHaptic } from '../lib/calculations';

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
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isAutoPay, setIsAutoPay] = useState(true);
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
      setCategoryId(categories[0]?.id || '');
      setNextDueDate(format(new Date(), 'yyyy-MM-dd'));
      setReminderEnabled(true);
      setReminderDaysBefore(2);
    }
  }, [recurringToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title for the recurring bill');
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
        isActive: true,
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
    if (confirm('Cancel and remove this recurring bill?')) {
      triggerHaptic(30);
      await db.recurringPayments.delete(recurringToEdit.id);
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md">
      <div
        className="w-full max-w-lg bg-[#121217] text-white border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold">
            {recurringToEdit ? 'Edit Recurring Bill' : 'Add Recurring Commitment'}
          </h2>
          <button
            onClick={() => {
              triggerHaptic(5);
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Amount input */}
          <div className="text-center py-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Billing Amount
            </span>
            <div className="inline-flex items-center justify-center gap-1">
              <span className="text-3xl font-light text-neutral-400">€</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="text-4xl font-extrabold tracking-tight bg-transparent text-center focus:outline-none w-48 text-white placeholder-neutral-700"
              />
            </div>
          </div>

          {/* Title & Note */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Bill / Subscription Name
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Netflix, Gym, Rent, Internet"
                className="w-full px-4 py-3 bg-neutral-900 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Note / Memo (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Plan tier, account number, or notes"
                className="w-full px-4 py-3 bg-neutral-900 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Billing Cycle Selector */}
          <div>
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
              Cadence / Cycle
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setBillingCycle(cycle);
                  }}
                  className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    billingCycle === cycle
                      ? 'border-indigo-500 bg-indigo-500/20 text-white'
                      : 'border-white/10 text-neutral-400 hover:border-white/20'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          {/* Next Due Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Next Due Date
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-3.5 text-neutral-500" />
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={e => setNextDueDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-Debit & Reminders */}
          <div className="p-4 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold">Auto-Debit Active</div>
                  <div className="text-xs text-neutral-400">Payment debits automatically</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAutoPay}
                onChange={e => {
                  triggerHaptic(10);
                  setIsAutoPay(e.target.checked);
                }}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            <div className="border-t border-white/5 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Bell size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Reminder Alert</div>
                    <div className="text-xs text-neutral-400">Advance notification badge</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => {
                    triggerHaptic(10);
                    setReminderEnabled(e.target.checked);
                  }}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {reminderEnabled && (
                <div className="flex items-center gap-2 pl-11 pt-1">
                  <span className="text-xs text-neutral-400">Remind me:</span>
                  {[0, 1, 2, 3, 5, 7].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        triggerHaptic(5);
                        setReminderDaysBefore(days);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        reminderDaysBefore === days
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'border-white/10 text-neutral-400 hover:border-white/20'
                      }`}
                    >
                      {days === 0 ? 'Same day' : `${days}d before`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            {recurringToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
                title="Cancel Bill"
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {recurringToEdit ? 'Save Bill' : 'Create Recurring Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
