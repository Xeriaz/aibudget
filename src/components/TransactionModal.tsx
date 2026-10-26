import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Calendar, FileText, Check, Trash2, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
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

const PARENT_BUCKET_TABS: { key: BucketType; labelKey: string; badgeColor: string }[] = [
  { key: 'essentials', labelKey: 'transactionModal.parentTabEssentials', badgeColor: 'bg-emerald-500' },
  { key: 'selfCareAndWants', labelKey: 'transactionModal.parentTabSelfCare', badgeColor: 'bg-purple-500' },
  { key: 'investments', labelKey: 'transactionModal.parentTabInvestments', badgeColor: 'bg-teal-500' }
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
  const { t } = useTranslation();
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
      alert(t('transactionModal.enterValidAmount'));
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
    if (confirm(t('transactionModal.confirmDelete'))) {
      triggerHaptic(30);
      await db.transactions.delete(transactionToEdit.id);
      if (onDeleted) onDeleted(transactionToEdit.id);
      onSaved();
      onClose();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const newCat: Category = {
      id: 'cat_' + crypto.randomUUID(),
      name: trimmed,
      iconName: newCatIcon,
      colorHex: newCatColor,
      isDefault: false,
      customBucket: type === 'expense' ? newCatBucket : undefined
    };

    triggerHaptic(15);
    await db.categories.add(newCat);
    onSaved();

    setCategoryId(newCat.id);
    if (type === 'expense') {
      setActiveBucket(newCatBucket);
      setBucketSelectedCategory(prev => ({ ...prev, [newCatBucket]: newCat.id }));
    }
    setShowNewCatModal(false);
    setNewCatName('');
  };

  const handleDeleteCustomCategory = async (e: React.MouseEvent, cat: Category) => {
    e.stopPropagation();
    if (confirm(t('transactionModal.deleteCategoryConfirm', { name: cat.name }))) {
      triggerHaptic(20);
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
              {transactionToEdit ? t('transactionModal.editTransaction') : t('transactionModal.logTransaction')}
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
              {t('transactionModal.expense')}
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
              {t('transactionModal.incomeInflow')}
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
                {t('transactionModal.titleMerchant')}
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={type === 'expense' ? t('transactionModal.titlePlaceholderExpense') : t('transactionModal.titlePlaceholderIncome')}
                className="w-full max-w-full px-4 py-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                {t('transactionModal.noteMemo')}
              </label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={t('transactionModal.notePlaceholder')}
                  className="w-full max-w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Category Selector with Solution 3 Parent Tabs */}
          <div className="w-full min-w-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                {t('transactionModal.category')}
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
                <Plus size={14} /> {t('transactionModal.newCategory')}
              </button>
            </div>

            {/* Parent Category Segmented Tabs (for Expenses) */}
            {type === 'expense' && (
              <div
                role="tablist"
                aria-label={t('transactionModal.parentCategories')}
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
                          : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${tab.badgeColor} shrink-0`} />
                      <span className="truncate">{t(tab.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Categories Grid (Filtered by Active Parent Tab or Income) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {displayedCategories.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-400 dark:text-neutral-500">
                  No categories in this group. Click "New Category" to add one!
                </div>
              ) : (
                displayedCategories.map(cat => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <div key={cat.id} className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(5);
                          setCategoryId(cat.id);
                          if (type === 'expense') {
                            setBucketSelectedCategory(prev => ({ ...prev, [activeBucket]: cat.id }));
                          }
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-xs'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200/70 dark:border-white/5 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-white/15'
                        } ${!cat.isDefault ? 'pr-7' : ''}`}
                      >
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.colorHex}25`, color: cat.colorHex }}
                        >
                          <CategoryIcon iconName={cat.iconName} size={14} />
                        </div>
                        <span className="truncate">{cat.name}</span>
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
              {t('transactionModal.date')}
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
                title={t('transactionModal.deleteTx')}
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {transactionToEdit ? t('transactionModal.saveChanges') : t('transactionModal.recordTransaction')}
            </button>
          </div>
        </form>

        {/* Embedded Quick New Category Creator Modal */}
        {showNewCatModal && (
          <div className="absolute inset-0 bg-white dark:bg-[#0c0c10] z-20 p-5 sm:p-6 flex flex-col justify-between animate-in fade-in duration-150 overflow-y-auto overflow-x-hidden">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-white">
                  <Tag size={18} className="text-indigo-600 dark:text-indigo-400" /> {t('transactionModal.createCustomCategory')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form id="new-cat-form" onSubmit={handleCreateCategory} className="space-y-4 pt-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    {t('transactionModal.categoryName')}
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder={t('transactionModal.categoryNamePlaceholder')}
                    autoFocus
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {type === 'expense' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                      {t('transactionModal.targetBucket')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'essentials', label: t('settings.essentialsBucket') },
                        { key: 'selfCareAndWants', label: t('settings.selfCareBucket') },
                        { key: 'investments', label: t('settings.investmentsBucket') }
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
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    {t('transactionModal.chooseIcon')}
                  </label>
                  <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-neutral-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                    {AVAILABLE_ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewCatIcon(icon)}
                        className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                          newCatIcon === icon
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        <CategoryIcon iconName={icon} size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-2">
                    {t('transactionModal.chooseAccentColor')}
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      '#6366F1',
                      '#EC4899',
                      '#10B981',
                      '#F59E0B',
                      '#EF4444',
                      '#8B5CF6',
                      '#06B6D4',
                      '#14B8A6'
                    ].map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewCatColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          newCatColor === col ? 'scale-125 ring-2 ring-white ring-offset-2' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-4 flex items-center gap-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowNewCatModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-neutral-400"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="new-cat-form"
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/30"
              >
                {t('transactionModal.createCategoryBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
