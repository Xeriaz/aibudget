import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  FileCode,
  Shield,
  Layers,
  DollarSign,
  Sun,
  Moon,
  Palette,
  Edit2,
  Check,
  X
} from 'lucide-react';
import type { PlanSettings, Category } from '../types';
import { db } from '../db/db';
import {
  exportToJson,
  exportToCsv,
  parseImportFile,
  applyImport,
  resetDatabaseToDefaults,
  type ParsedImportPreview
} from '../lib/exportImport';
import { triggerHaptic, formatCurrency, resolveCategoryBucket } from '../lib/calculations';
import { CategoryIcon } from './CategoryIcon';

interface SettingsTabProps {
  settings: PlanSettings;
  categories: Category[];
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onRefresh: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  categories,
  theme,
  onThemeChange,
  onRefresh
}) => {
  // Plan Settings state
  const [selectedFramework, setSelectedFramework] = useState(settings.selectedFramework);
  const [customEssentialsPct, setCustomEssentialsPct] = useState(settings.customEssentialsPct ?? 50);
  const [customSelfCarePct, setCustomSelfCarePct] = useState(settings.customSelfCarePct ?? 30);
  const [customInvestmentsPct, setCustomInvestmentsPct] = useState(settings.customInvestmentsPct ?? 20);
  const [useManualSalary, setUseManualSalary] = useState(settings.useManualSalary);
  const [manualSalary, setManualSalary] = useState(settings.manualSalary ?? 2500);

  // Sync local state when settings prop updates (e.g. after import or reset)
  useEffect(() => {
    setSelectedFramework(settings.selectedFramework);
    setCustomEssentialsPct(settings.customEssentialsPct ?? 50);
    setCustomSelfCarePct(settings.customSelfCarePct ?? 30);
    setCustomInvestmentsPct(settings.customInvestmentsPct ?? 20);
    setUseManualSalary(settings.useManualSalary);
    setManualSalary(settings.manualSalary ?? 2500);
  }, [settings]);

  // Custom category rename state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');

  // Import preview modal state
  const [importPreview, setImportPreview] = useState<ParsedImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customTotal = customEssentialsPct + customSelfCarePct + customInvestmentsPct;
  const isCustomValid = customTotal === 100;

  // Escape key handler for Import Preview modal
  useEffect(() => {
    if (!importPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessingImport) {
        setImportPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importPreview, isProcessingImport]);

  const handleSaveSettings = async (overrides?: Partial<PlanSettings>) => {
    const nextEssentials = overrides?.customEssentialsPct ?? customEssentialsPct;
    const nextSelfCare = overrides?.customSelfCarePct ?? customSelfCarePct;
    const nextInvestments = overrides?.customInvestmentsPct ?? customInvestmentsPct;
    const nextFramework = overrides?.selectedFramework ?? selectedFramework;

    // Prevent saving invalid custom percentage allocations that do not total 100%
    if (
      nextFramework === 'custom' &&
      (overrides?.customEssentialsPct !== undefined ||
        overrides?.customSelfCarePct !== undefined ||
        overrides?.customInvestmentsPct !== undefined) &&
      nextEssentials + nextSelfCare + nextInvestments !== 100
    ) {
      return;
    }

    triggerHaptic([10, 20]);
    const updated: PlanSettings = {
      id: 'current',
      selectedFramework: nextFramework,
      customEssentialsPct:
        nextEssentials + nextSelfCare + nextInvestments === 100
          ? nextEssentials
          : (settings.customEssentialsPct ?? 50),
      customSelfCarePct:
        nextEssentials + nextSelfCare + nextInvestments === 100
          ? nextSelfCare
          : (settings.customSelfCarePct ?? 30),
      customInvestmentsPct:
        nextEssentials + nextSelfCare + nextInvestments === 100
          ? nextInvestments
          : (settings.customInvestmentsPct ?? 20),
      useManualSalary: overrides?.useManualSalary ?? useManualSalary,
      manualSalary: overrides?.manualSalary ?? manualSalary
    };
    await db.settings.put(updated);
    onRefresh();
  };

  const handleSliderKeyUp = (
    e: React.KeyboardEvent<HTMLInputElement>,
    overrides: Partial<PlanSettings>
  ) => {
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) {
      handleSaveSettings(overrides);
    }
  };

  const handleCategoryBucketChange = async (
    catId: string,
    bucket: 'essentials' | 'selfCareAndWants' | 'investments'
  ) => {
    triggerHaptic(10);
    await db.categories.update(catId, { customBucket: bucket });
    onRefresh();
  };

  const handleStartRenameCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleSaveRenameCategory = async (catId: string) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      setEditingCatId(null);
      return;
    }
    triggerHaptic(10);
    await db.categories.update(catId, { name: trimmed });
    setEditingCatId(null);
    onRefresh();
  };

  const handleDeleteCustomCategory = async (cat: Category) => {
    if (cat.isDefault) return;
    if (confirm(`Delete custom category "${cat.name}"? Affected transactions and bills will become uncategorized.`)) {
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
      onRefresh();
    }
  };

  // Export handlers
  const handleExportJson = async () => {
    triggerHaptic(15);
    await exportToJson();
  };

  const handleExportCsv = async () => {
    triggerHaptic(15);
    await exportToCsv();
  };

  // File import selector
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportFileName(file.name);
      const preview = await parseImportFile(file);
      setImportPreview(preview);
      triggerHaptic(15);
    } catch (err: any) {
      alert(`Import error: ${err.message || 'Could not parse file'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyImportMode = async (mode: 'merge' | 'replace') => {
    if (!importPreview) return;
    setIsProcessingImport(true);
    triggerHaptic([20, 40]);
    try {
      await applyImport(importPreview, mode);
      setImportPreview(null);
      alert(
        `Successfully imported data with ${mode.toUpperCase()} mode!`
      );
      onRefresh();
    } catch (err: any) {
      alert(`Failed to apply import: ${err.message}`);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleResetData = async () => {
    if (confirm('Are you sure you want to erase all data and reset to fresh default categories? This action cannot be undone.')) {
      triggerHaptic(50);
      await resetDatabaseToDefaults();
      alert('Data reset successfully.');
      onRefresh();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders size={18} className="text-indigo-600 dark:text-indigo-400" /> Lifestyle Plan & Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
          Configure appearance, income assumptions, budget frameworks, category mapping, and data backups.
        </p>
      </div>

      {/* Appearance & Theme Selector */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Appearance & Theme</h3>
          </div>
          <span className="text-xs font-semibold capitalize text-indigo-600 dark:text-indigo-400">
            {theme} Mode
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onThemeChange('light');
            }}
            className={`p-3.5 rounded-2xl text-left border transition-all flex items-center gap-3 ${
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 shadow-sm shadow-indigo-500/10'
                : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/15'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                theme === 'light'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-neutral-400'
              }`}
            >
              <Sun size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Light Theme</div>
              <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight mt-0.5">
                Crisp daylight surfaces
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onThemeChange('dark');
            }}
            className={`p-3.5 rounded-2xl text-left border transition-all flex items-center gap-3 ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 shadow-sm shadow-indigo-500/10'
                : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/15'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                theme === 'dark'
                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-neutral-400'
              }`}
            >
              <Moon size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Dark Theme</div>
              <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight mt-0.5">
                OLED midnight contrast
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Income Base Configuration */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Income Base Mode</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-neutral-400">
              {useManualSalary ? 'Fixed Target' : 'Dynamic from Inflows'}
            </span>
            <input
              type="checkbox"
              checked={useManualSalary}
              onChange={e => {
                const nextVal = e.target.checked;
                setUseManualSalary(nextVal);
                handleSaveSettings({ useManualSalary: nextVal });
              }}
              className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {useManualSalary ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-neutral-400">Target Monthly Income:</span>
              <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                {formatCurrency(manualSalary)}
              </span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2">
              {[1800, 2500, 3200, 4000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setManualSalary(val);
                    handleSaveSettings({ manualSalary: val });
                  }}
                  className={`py-2 rounded-xl text-xs font-semibold font-mono border transition-all ${
                    manualSalary === val
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  €{val}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <input
                type="range"
                aria-label="Target Monthly Income Slider"
                min="500"
                max="10000"
                step="50"
                value={manualSalary}
                onChange={e => {
                  const val = Number(e.target.value);
                  setManualSalary(val);
                }}
                onMouseUp={() => handleSaveSettings({ manualSalary })}
                onTouchEnd={() => handleSaveSettings({ manualSalary })}
                onKeyUp={e => handleSliderKeyUp(e, { manualSalary })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/70 dark:border-white/5 text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
            Your budget caps automatically scale to the total <strong className="text-emerald-600 dark:text-emerald-400">Income</strong> transactions registered in the active month. If no income has been logged yet, it gracefully falls back to your reference salary of {formatCurrency(manualSalary)}.
          </div>
        )}
      </div>

      {/* Framework Selector */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Allocation Framework</h3>
          </div>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{selectedFramework}</span>
        </div>

        {/* Framework Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { id: '50/30/20', title: '50 / 30 / 20', desc: 'Standard Balanced (50% Essentials, 30% Wants, 20% Wealth)' },
            { id: '60/20/20', title: '60 / 20 / 20', desc: 'Urban High-Rent (60% Essentials, 20% Wants, 20% Wealth)' },
            { id: '70/20/10', title: '70 / 20 / 10', desc: 'Essentials Heavy (70% Essentials, 20% Wants, 10% Wealth)' },
            { id: 'custom', title: 'Custom Ratio', desc: 'Fine-tune exact percentages to match your personal strategy' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => {
                triggerHaptic(10);
                setSelectedFramework(f.id as any);
                handleSaveSettings({ selectedFramework: f.id as any });
              }}
              className={`p-3 rounded-2xl text-left border transition-all ${
                selectedFramework === f.id
                  ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 shadow-sm shadow-indigo-500/10'
                  : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/15'
              }`}
            >
              <div className="text-sm font-bold text-slate-900 dark:text-white">{f.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-tight">
                {f.desc}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Sliders */}
        {selectedFramework === 'custom' && (
          <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Custom Sliders
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  isCustomValid
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                Total: {customTotal}% {isCustomValid ? '✓' : '(Must equal 100%)'}
              </span>
            </div>

            {/* Essentials Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Essentials & Needs:</span>
                <span className="font-extrabold font-mono text-slate-900 dark:text-white">{customEssentialsPct}%</span>
              </div>
              <input
                type="range"
                aria-label="Essentials Percentage"
                min="0"
                max="100"
                value={customEssentialsPct}
                onChange={e => setCustomEssentialsPct(Number(e.target.value))}
                onMouseUp={() => handleSaveSettings({ customEssentialsPct })}
                onTouchEnd={() => handleSaveSettings({ customEssentialsPct })}
                onKeyUp={e => handleSliderKeyUp(e, { customEssentialsPct })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Self-Care Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">Self-Care & Wants:</span>
                <span className="font-extrabold font-mono text-slate-900 dark:text-white">{customSelfCarePct}%</span>
              </div>
              <input
                type="range"
                aria-label="Self-Care Percentage"
                min="0"
                max="100"
                value={customSelfCarePct}
                onChange={e => setCustomSelfCarePct(Number(e.target.value))}
                onMouseUp={() => handleSaveSettings({ customSelfCarePct })}
                onTouchEnd={() => handleSaveSettings({ customSelfCarePct })}
                onKeyUp={e => handleSliderKeyUp(e, { customSelfCarePct })}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Investments Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-teal-600 dark:text-teal-400 font-semibold">Investments & Wealth:</span>
                <span className="font-extrabold font-mono text-slate-900 dark:text-white">{customInvestmentsPct}%</span>
              </div>
              <input
                type="range"
                aria-label="Investments Percentage"
                min="0"
                max="100"
                value={customInvestmentsPct}
                onChange={e => setCustomInvestmentsPct(Number(e.target.value))}
                onMouseUp={() => handleSaveSettings({ customInvestmentsPct })}
                onTouchEnd={() => handleSaveSettings({ customInvestmentsPct })}
                onKeyUp={e => handleSliderKeyUp(e, { customInvestmentsPct })}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Bucket Re-assignment & Custom Category Management */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Shield size={16} className="text-indigo-600 dark:text-indigo-400" /> Category Bucket Mappings
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Assign each spending category to Essentials, Self-Care, or Investments, and manage custom categories.
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {categories
            .filter(c => !c.name.toLowerCase().includes('salary'))
            .map(cat => {
              const currentBucket = resolveCategoryBucket(cat);
              const isEditingThis = editingCatId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${cat.colorHex || '#6366f1'}20`,
                        color: cat.colorHex || '#6366f1'
                      }}
                    >
                      <CategoryIcon iconName={cat.iconName} size={14} />
                    </div>

                    {isEditingThis ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={e => setEditingCatName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRenameCategory(cat.id);
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                          autoFocus
                          aria-label="Edit category name"
                          className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-indigo-500 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRenameCategory(cat.id)}
                          aria-label="Save category name"
                          className="p-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          aria-label="Cancel rename"
                          className="p-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-neutral-400"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {cat.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={currentBucket}
                      onChange={e => handleCategoryBucketChange(cat.id, e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-neutral-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="essentials">Essentials (50%)</option>
                      <option value="selfCareAndWants">Self-Care (30%)</option>
                      <option value="investments">Investments (20%)</option>
                    </select>

                    {!cat.isDefault && !isEditingThis && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartRenameCategory(cat)}
                          title={`Rename ${cat.name}`}
                          aria-label={`Rename ${cat.name}`}
                          className="p-1.5 rounded-xl bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300/70 dark:hover:bg-white/15 text-slate-600 dark:text-neutral-400 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomCategory(cat)}
                          title={`Delete ${cat.name}`}
                          aria-label={`Delete ${cat.name}`}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Data Management & Portability */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Download size={16} className="text-indigo-600 dark:text-indigo-400" /> Data Portability & Backup
          </h3>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Your financial data is stored locally in your browser's IndexedDB. Export anytime for safekeeping.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white active:scale-95 transition-all"
          >
            <FileCode size={16} className="text-indigo-600 dark:text-indigo-400" /> Export JSON
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white active:scale-95 transition-all"
          >
            <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" /> Export CSV
          </button>
        </div>

        {/* Import file picker */}
        <div className="pt-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500/10 dark:bg-indigo-600/20 hover:bg-indigo-500/20 dark:hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold active:scale-95 transition-all"
          >
            <Upload size={16} /> Import Backup (.json or .csv)
          </button>
        </div>

        {/* Maintenance / Reset */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-neutral-500">Reset or purge local cache</span>
          <button
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition-all"
          >
            <Trash2 size={13} /> Clear All Data
          </button>
        </div>
      </div>

      {/* Import Review & Confirmation Modal */}
      {importPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => {
            if (!isProcessingImport) setImportPreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-preview-title"
            className="w-full max-w-md bg-white dark:bg-[#121217] text-slate-900 dark:text-white border border-slate-200 dark:border-white/15 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 id="import-preview-title" className="text-base font-bold flex items-center gap-2">
                <Upload size={18} className="text-indigo-600 dark:text-indigo-400" /> Import Preview
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 uppercase">
                {importPreview.type}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-neutral-300">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-neutral-400">File:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-56">{importFileName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500 dark:text-neutral-400">Transactions Detected:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{importPreview.transactionCount}</span>
              </div>
              {importPreview.type === 'json' && (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-neutral-400">Categories Included:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{importPreview.categoryCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-neutral-400">Recurring Bills:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{importPreview.recurringCount}</span>
                  </div>
                </>
              )}
            </div>

            {/* Sample items */}
            {importPreview.sampleItems.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Sample Entries:
                </span>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 space-y-1 text-[11px] text-slate-600 dark:text-neutral-400">
                  {importPreview.sampleItems.map((s, idx) => (
                    <div key={idx} className="truncate">• {s}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Choice: Merge vs Replace */}
            <div className="pt-3 space-y-2">
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                Choose how you would like to apply this import:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isProcessingImport}
                  onClick={() => handleApplyImportMode('merge')}
                  className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold active:scale-95 transition-all text-center shadow-lg shadow-indigo-600/25"
                >
                  <div className="font-extrabold">Merge</div>
                  <div className="text-[10px] font-normal opacity-80">Smart deduplicate</div>
                </button>
                <button
                  disabled={isProcessingImport}
                  onClick={() => handleApplyImportMode('replace')}
                  className="p-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition-all text-center shadow-lg shadow-rose-600/25"
                >
                  <div className="font-extrabold">Replace</div>
                  <div className="text-[10px] font-normal opacity-80">Wipe and restore</div>
                </button>
              </div>
            </div>

            <button
              onClick={() => setImportPreview(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
