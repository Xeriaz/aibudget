import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Calendar, FileText, Check, Trash2, Tag } from 'lucide-react';
import { format } from 'date-fns';
import type { Transaction, Category, BucketType } from '../types';
import { db } from '../db/db';
import { CategoryIcon, AVAILABLE_ICONS } from './CategoryIcon';
import { triggerHaptic, resolveCategoryBucket } from '../lib/calculations';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
  categories: Category[];
  onSaved: () => void;
  onDeleted?: (id: string) => void;
}

const PARENT_BUCKET_TABS: { key: BucketType; label: string; badgeColor: string }[] = [
  { key: 'essentials', label: 'Essentials', badgeColor: 'bg-emerald-500' },
  { key: 'selfCareAndWants', label: 'Self-Care & Wants', badgeColor: 'bg-purple-500' },
  { key: 'investments', label: 'Wealth / DCA', badgeColor: 'bg-teal-500' }
];

function getFilteredCategoriesForType(categories: Category[], txType: 'expense' | 'income'): Category[] {
  return categories.filter(c => {
    if (txType === 'income') {
      return (
        c.name.toLowerCase().includes('salary') ||
        c.name.toLowerCase().includes('income') ||
        !c.customBucket
      );
    }
    return !c.name.toLowerCase().includes('salary');
  });
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  transactionToEdit,
  categories,
  onSaved,
  onDeleted
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [activeBucket, setActiveBucket] = useState<BucketType>('essentials');
  const [bucketSelectedCategory, setBucketSelectedCategory] = useState<Record<BucketType, string>>({
    essentials: '',
    selfCareAndWants: '',
    investments: ''
  });

  // Quick category creation modal state
  const [showNewCatModal, setShowNewCatModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatIcon, setNewCatIcon] = useState<string>('tag');
  const [newCatColor, setNewCatColor] = useState<string>('#6366F1');
  const [newCatBucket, setNewCatBucket] = useState<'essentials' | 'selfCareAndWants' | 'investments'>('selfCareAndWants');

  const filteredCategories = useMemo(
    () => getFilteredCategoriesForType(categories, type),
    [categories, type]
  );

  const displayedCategories = useMemo(() => {
    if (type === 'income') {
      return filteredCategories;
    }
    return filteredCategories.filter(c => resolveCategoryBucket(c) === activeBucket);
  }, [filteredCategories, type, activeBucket]);

  // Initialize form state when modal opens or transactionToEdit changes
  useEffect(() => {
    if (!isOpen) return;
    if (transactionToEdit) {
      setType(transactionToEdit.type);
      setAmountStr(transactionToEdit.amount.toString());
      setTitle(transactionToEdit.title);
      setNote(transactionToEdit.note || '');
      setCategoryId(transactionToEdit.categoryId || '');
      setDateStr(transactionToEdit.transactionDate || format(new Date(), 'yyyy-MM-dd'));
      if (transactionToEdit.categoryId) {
        const cat = categories.find(c => c.id === transactionToEdit.categoryId);
        if (cat) {
          const b = resolveCategoryBucket(cat);
          setActiveBucket(b);
          setBucketSelectedCategory(prev => ({ ...prev, [b]: cat.id }));
        }
      }
    } else {
      setType('expense');
      setAmountStr('');
      setTitle('');
      setNote('');
      setDateStr(format(new Date(), 'yyyy-MM-dd'));
      const expenseCats = getFilteredCategoriesForType(categories, 'expense');
      const essentialsCat = expenseCats.find(c => resolveCategoryBucket(c) === 'essentials');
      const defaultCat = essentialsCat || expenseCats[0] || categories[0];
      const defaultId = defaultCat?.id || '';
      setCategoryId(defaultId);
      if (defaultCat) {
        const b = resolveCategoryBucket(defaultCat);
        setActiveBucket(b);
        setBucketSelectedCategory(prev => ({ ...prev, [b]: defaultId }));
      }
    }
    setShowNewCatModal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionToEdit, isOpen]);

  // Ensure selected categoryId is always valid for the current filteredCategories when type or categories change
  useEffect(() => {
    if (!isOpen) return;
    if (filteredCategories.length === 0) return;
    const isValid = filteredCategories.some(c => c.id === categoryId);
    if (!isValid) {
      const fallback = type === 'expense'
        ? (filteredCategories.find(c => resolveCategoryBucket(c) === 'essentials') || filteredCategories[0])
        : filteredCategories[0];
      setCategoryId(fallback.id);
      if (type === 'expense') {
        const b = resolveCategoryBucket(fallback);
        setActiveBucket(b);
        setBucketSelectedCategory(prev => ({ ...prev, [b]: fallback.id }));
      }
    }
  }, [type, filteredCategories, categoryId, isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNewCatModal) {
          setShowNewCatModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showNewCatModal, onClose]);

  if (!isOpen) return null;

  const handleTypeChange = (nextType: 'expense' | 'income') => {
    triggerHaptic(10);
    setType(nextType);
    const nextFiltered = getFilteredCategoriesForType(categories, nextType);
    if (nextFiltered.length > 0 && !nextFiltered.some(c => c.id === categoryId)) {
      const fallback = nextType === 'expense'
        ? (nextFiltered.find(c => resolveCategoryBucket(c) === 'essentials') || nextFiltered[0])
        : nextFiltered[0];
      setCategoryId(fallback.id);
      if (nextType === 'expense') {
        const b = resolveCategoryBucket(fallback);
        setActiveBucket(b);
        setBucketSelectedCategory(prev => ({ ...prev, [b]: fallback.id }));
      }
    }
  };

  const handleBucketTabClick = (bucket: BucketType) => {
    triggerHaptic(10);
    setActiveBucket(bucket);
    const bucketCats = filteredCategories.filter(c => resolveCategoryBucket(c) === bucket);
    if (bucketCats.length > 0) {
      const rememberedId = bucketSelectedCategory[bucket];
      const targetCat = bucketCats.find(c => c.id === rememberedId) || bucketCats[0];
      setCategoryId(targetCat.id);
      setBucketSelectedCategory(prev => ({ ...prev, [bucket]: targetCat.id }));
    }
  };

  const handleShortcutAdd = (inc: number) => {
    triggerHaptic(10);
    const curr = parseFloat(amountStr) || 0;
    const sum = Math.round((curr + inc) * 100) / 100;
    const nextVal = sum.toFixed((curr + inc) % 1 !== 0 ? 2 : 0);
    setAmountStr(nextVal);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    const txTitle = title.trim() || (type === 'income' ? 'Income Deposit' : 'General Expense');
    const nowIso = new Date().toISOString();

    if (transactionToEdit) {
      await db.transactions.update(transactionToEdit.id, {
        title: txTitle,
        amount: parsedAmount,
        type,
        categoryId: categoryId || undefined,
        transactionDate: dateStr,
        note: note.trim() || undefined,
        updatedAt: nowIso
      });
    } else {
      const newTx: Transaction = {
        id: 'tx_' + crypto.randomUUID(),
        title: txTitle,
        amount: parsedAmount,
        currencyCode: 'EUR',
        type,
        categoryId: categoryId || undefined,
        transactionDate: dateStr,
        note: note.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await db.transactions.add(newTx);
    }

    triggerHaptic([15, 30, 20]);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!transactionToEdit) return;
    if (confirm('Delete this transaction?')) {
      triggerHaptic(30);
      await db.transactions.delete(transactionToEdit.id);
      if (onDeleted) onDeleted(transactionToEdit.id);
      onSaved();
      onClose();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Category = {
      id: 'cat_' + crypto.randomUUID(),
      name: newCatName.trim(),
      iconName: newCatIcon,
      colorHex: newCatColor,
      isDefault: false,
      customBucket: newCatBucket
    };

    await db.categories.add(newCat);
    triggerHaptic(20);
    setCategoryId(newCat.id);
    setActiveBucket(newCatBucket);
    setBucketSelectedCategory(prev => ({ ...prev, [newCatBucket]: newCat.id }));
    setShowNewCatModal(false);
    setNewCatName('');
    onSaved();
  };

  const handleDeleteCustomCategory = async (e: React.MouseEvent, cat: Category) => {
    e.stopPropagation();
    if (cat.isDefault) return;
    if (confirm(`Delete custom category "${cat.name}"?`)) {
      triggerHaptic(25);
      await db.transaction(
        'rw',
        [db.categories, db.transactions, db.recurringPayments],
        async () => {
          await db.categories.delete(cat.id);
          await db.transactions
            .where('categoryId')
            .equals(cat.id)
            .modify({ categoryId: undefined });
          await db.recurringPayments
            .where('categoryId')
            .equals(cat.id)
            .modify({ categoryId: undefined });
        }
      );
      if (categoryId === cat.id) {
        const remaining = filteredCategories.filter(c => c.id !== cat.id);
        const nextInSameBucket = remaining.find(c => resolveCategoryBucket(c) === activeBucket);
        const fallback = nextInSameBucket || remaining[0];
        setCategoryId(fallback?.id || '');
        if (fallback) {
          const b = resolveCategoryBucket(fallback);
          setActiveBucket(b);
          setBucketSelectedCategory(prev => ({ ...prev, [b]: fallback.id }));
        }
      }
      onSaved();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md transition-opacity overflow-hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-modal-title"
        className="w-full max-w-lg max-w-[100vw] bg-white dark:bg-[#121217] text-slate-900 dark:text-white border-t sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-200 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <h2 id="tx-modal-title" className="text-lg font-bold tracking-tight">
              {transactionToEdit ? 'Edit Transaction' : 'Log Transaction'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => {
              triggerHaptic(5);
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-5 space-y-6 pb-safe">
          {/* Segmented Type Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-black/40 rounded-2xl border border-slate-200/80 dark:border-white/5">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
                type === 'income'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Income Inflow
            </button>
          </div>

          {/* Hero Numeric Amount Input */}
          <div className="text-center py-2">
            <div className="inline-flex items-center justify-center gap-1 max-w-full">
              <span className="text-3xl font-light text-slate-400 dark:text-neutral-400 shrink-0">€</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                autoFocus={!transactionToEdit}
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="text-5xl font-extrabold font-mono tracking-tight bg-transparent text-center focus:outline-none w-56 max-w-[200px] sm:max-w-xs text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-neutral-700"
              />
            </div>
            {/* Quick Amount Increment Chips */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              {[5, 10, 20, 50, 100].map(inc => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleShortcutAdd(inc)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-slate-200/80 dark:hover:bg-white/15 hover:border-slate-300 dark:hover:border-white/20 active:scale-95 transition-all"
                >
                  +€{inc}
                </button>
              ))}
            </div>
          </div>

          {/* Title and Note */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                Title / Merchant
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={type === 'expense' ? 'e.g. Supermarket, Cafe, Rent' : 'e.g. Salary, Dividend, Bonus'}
                className="w-full max-w-full px-4 py-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                Note / Memo (Optional)
              </label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Extra context or tags..."
                  className="w-full max-w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Category Selector with Solution 3 Parent Tabs */}
          <div className="w-full min-w-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => {
                  if (type === 'expense') {
                    setNewCatBucket(activeBucket);
                  }
                  setShowNewCatModal(true);
                }}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0"
              >
                <Plus size={14} /> New Category
              </button>
            </div>

            {/* Parent Category Segmented Tabs (for Expenses) */}
            {type === 'expense' && (
              <div
                role="tablist"
                aria-label="Parent Categories"
                className="grid grid-cols-3 p-1 mb-3 bg-slate-100 dark:bg-black/40 rounded-2xl border border-slate-200/80 dark:border-white/5"
              >
                {PARENT_BUCKET_TABS.map(tab => {
                  const isActive = activeBucket === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleBucketTabClick(tab.key)}
                      className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 text-center ${
                        isActive
                          ? 'bg-white dark:bg-[#1a1a24] text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                          : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.badgeColor}`}
                        aria-hidden="true"
                      />
                      {tab.key === 'selfCareAndWants' ? (
                        <>
                          <span className="hidden min-[380px]:inline">Self-Care & Wants</span>
                          <span className="min-[380px]:hidden">Self-Care</span>
                        </>
                      ) : (
                        <span>{tab.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Subcategories (Wrapped Grid) */}
            <div className="flex flex-wrap gap-2 pt-0.5 pb-1 w-full min-w-0">
              {displayedCategories.length === 0 ? (
                <div className="py-3 px-1 text-center w-full text-xs text-slate-400 dark:text-neutral-500">
                  No categories in this group.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatBucket(activeBucket);
                      setShowNewCatModal(true);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 underline font-medium ml-1"
                  >
                    Create one
                  </button>
                </div>
              ) : (
                displayedCategories.map(cat => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <div key={cat.id} className="relative flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(10);
                          setCategoryId(cat.id);
                          if (type === 'expense') {
                            const b = resolveCategoryBucket(cat);
                            setBucketSelectedCategory(prev => ({ ...prev, [b]: cat.id }));
                          }
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all border ${
                          !cat.isDefault ? 'pr-7' : ''
                        } ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-900 dark:text-white shadow-sm font-semibold'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-900/70 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.colorHex}25`, color: cat.colorHex }}
                        >
                          <CategoryIcon iconName={cat.iconName} size={14} />
                        </div>
                        <span>{cat.name}</span>
                      </button>
                      {!cat.isDefault && (
                        <button
                          type="button"
                          onClick={e => handleDeleteCustomCategory(e, cat)}
                          title={`Delete category ${cat.name}`}
                          aria-label={`Delete category ${cat.name}`}
                          className="absolute right-1.5 p-1 rounded-md text-slate-400 hover:text-rose-500 dark:text-neutral-500 dark:hover:text-rose-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Date
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full max-w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 pb-2 flex items-center gap-3">
            {transactionToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all shrink-0"
                title="Delete Transaction"
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {transactionToEdit ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>
        </form>

        {/* Embedded Quick New Category Creator Modal */}
        {showNewCatModal && (
          <div className="absolute inset-0 bg-white dark:bg-[#0c0c10] z-20 p-5 sm:p-6 flex flex-col justify-between animate-in fade-in duration-150 overflow-y-auto overflow-x-hidden">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-white">
                  <Tag size={18} className="text-indigo-600 dark:text-indigo-400" /> Create Custom Category
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Pet Care, Games, Coffee"
                    className="w-full max-w-full px-4 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Budget Bucket Allocation
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'essentials', label: 'Essentials (50%)', color: '#3B82F6' },
                      { key: 'selfCareAndWants', label: 'Self-Care (30%)', color: '#8B5CF6' },
                      { key: 'investments', label: 'Invest (20%)', color: '#14B8A6' }
                    ].map(b => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setNewCatBucket(b.key as any)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          newCatBucket === b.key
                            ? 'border-indigo-500 bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-900 dark:text-white'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Theme Color
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      '#6366F1', '#3B82F6', '#10B981', '#F59E0B',
                      '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6',
                      '#06B6D4', '#F43F5E'
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          newCatColor === color ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Select Icon
                  </label>
                  <div className="flex gap-2 flex-wrap max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200/60 dark:border-white/5">
                    {AVAILABLE_ICONS.map(iconKey => (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setNewCatIcon(iconKey)}
                        className={`p-2 rounded-lg transition-all ${
                          newCatIcon === iconKey
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-white/5'
                        }`}
                      >
                        <CategoryIcon iconName={iconKey} size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewCatModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
              >
                Create Category
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
