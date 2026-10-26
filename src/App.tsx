import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Receipt,
  CalendarClock,
  Sliders,
  Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, initializeDatabase, DEFAULT_SETTINGS } from './db/db';
import type { Transaction, Category, RecurringPayment, PlanSettings } from './types';
import { OverviewTab } from './components/OverviewTab';
import { LedgerTab } from './components/LedgerTab';
import { BillsTab } from './components/BillsTab';
import { SettingsTab } from './components/SettingsTab';
import { TransactionModal } from './components/TransactionModal';
import { RecurringModal } from './components/RecurringModal';
import { triggerHaptic } from './lib/calculations';

type ActiveTab = 'overview' | 'ledger' | 'bills' | 'settings';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringPayment | null>(null);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('aibudget_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const targetColor = theme === 'light' ? '#ffffff' : '#09090b';
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach((m) => m.setAttribute('content', targetColor));
    localStorage.setItem('aibudget_theme', theme);
  }, [theme]);

  // Lock body scroll when a modal is open to prevent background/rubber-band scrolling on iOS
  useEffect(() => {
    if (isTxModalOpen || isRecurringModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isTxModalOpen, isRecurringModalOpen]);

  // Load all DB data
  const loadData = useCallback(async () => {
    try {
      const [txList, catList, recList, set] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
        db.recurringPayments.toArray(),
        db.settings.get('current')
      ]);

      setTransactions(txList);
      setCategories(catList);
      setRecurring(recList);
      if (set) {
        setSettings(set);
      }
    } catch (err) {
      console.error('Failed to load database:', err);
    }
  }, []);

  // Initialize DB on boot
  useEffect(() => {
    const init = async () => {
      await initializeDatabase();
      await loadData();
      setIsReady(true);
    };
    init();
  }, [loadData]);

  const handleOpenAddTx = () => {
    triggerHaptic(15);
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleSelectTxToEdit = (tx: Transaction) => {
    triggerHaptic(10);
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  const handleOpenAddRecurring = () => {
    triggerHaptic(15);
    setEditingRecurring(null);
    setIsRecurringModalOpen(true);
  };

  const handleSelectRecurringToEdit = (rec: RecurringPayment) => {
    triggerHaptic(10);
    setEditingRecurring(rec);
    setIsRecurringModalOpen(true);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col items-center justify-center text-slate-900 dark:text-white space-y-4 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 dark:bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
          <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="text-center">
          <div className="text-lg font-bold tracking-tight">aiBudget</div>
          <div className="text-xs text-slate-500 dark:text-neutral-500">{t('common.loadingStorage')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-neutral-100 flex flex-col font-sans selection:bg-indigo-500/20 dark:selection:bg-indigo-500/30 selection:text-indigo-700 dark:selection:text-indigo-200 transition-colors duration-200">
      {/* Top Header / App Bar */}
      <header className="sticky top-0 z-30 pt-safe bg-white/85 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 transition-colors">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-600/20 flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-[#09090b] rounded-[10px] flex items-center justify-center transition-colors">
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">ai</span>
              </div>
            </div>
            <div>
              <div className="flex items-center leading-none">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  ai<span className="text-indigo-600 dark:text-indigo-400">Budget</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddTx}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Plus size={14} /> {t('common.log')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-4 bottom-bar-padding">
        {activeTab === 'overview' && (
          <OverviewTab
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            transactions={transactions}
            categories={categories}
            recurring={recurring}
            settings={settings}
            theme={theme}
            onRefresh={loadData}
            onOpenFastAdd={handleOpenAddTx}
            onSelectTransactionToEdit={handleSelectTxToEdit}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerTab
            transactions={transactions}
            categories={categories}
            onSelectTransactionToEdit={handleSelectTxToEdit}
            onRefresh={loadData}
            onOpenFastAdd={handleOpenAddTx}
          />
        )}

        {activeTab === 'bills' && (
          <BillsTab
            recurring={recurring}
            categories={categories}
            onOpenAddModal={handleOpenAddRecurring}
            onSelectToEdit={handleSelectRecurringToEdit}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            categories={categories}
            theme={theme}
            onThemeChange={setTheme}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Persistent Bottom Mobile Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0e0e13]/85 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/10 pb-safe transition-colors">
        <div className="max-w-xl mx-auto px-3 h-16 flex items-center justify-around relative">
          {/* Tab 1: Overview */}
          <button
            onClick={() => {
              triggerHaptic(5);
              setActiveTab('overview');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
              activeTab === 'overview'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                activeTab === 'overview' ? 'bg-indigo-500/15' : ''
              }`}
            >
              <Sparkles size={19} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav.overview')}</span>
          </button>

          {/* Tab 2: Ledger */}
          <button
            onClick={() => {
              triggerHaptic(5);
              setActiveTab('ledger');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
              activeTab === 'ledger'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                activeTab === 'ledger' ? 'bg-indigo-500/15' : ''
              }`}
            >
              <Receipt size={19} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav.ledger')}</span>
          </button>

          {/* Center Floating Log Action */}
          <div className="flex-1 flex justify-center -mt-5">
            <button
              onClick={handleOpenAddTx}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 text-white shadow-xl shadow-indigo-600/35 flex items-center justify-center active:scale-90 transition-all border-2 border-slate-50 dark:border-[#09090b]"
              title={t('common.logTransaction')}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Tab 3: Bills */}
          <button
            onClick={() => {
              triggerHaptic(5);
              setActiveTab('bills');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
              activeTab === 'bills'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                activeTab === 'bills' ? 'bg-indigo-500/15' : ''
              }`}
            >
              <CalendarClock size={19} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav.bills')}</span>
          </button>

          {/* Tab 4: Settings */}
          <button
            onClick={() => {
              triggerHaptic(5);
              setActiveTab('settings');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
              activeTab === 'settings'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                activeTab === 'settings' ? 'bg-indigo-500/15' : ''
              }`}
            >
              <Sliders size={19} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('nav.settings')}</span>
          </button>
        </div>
      </nav>

      {/* Transaction Add / Edit Modal Drawer */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        transactionToEdit={editingTx}
        categories={categories}
        onSaved={loadData}
      />

      {/* Recurring Payment Add / Edit Modal */}
      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        recurringToEdit={editingRecurring}
        categories={categories}
        onSaved={loadData}
      />
    </div>
  );
}
