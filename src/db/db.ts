import Dexie, { type Table } from 'dexie';
import type { Transaction, Category, RecurringPayment, PlanSettings } from '../types';

export class AiBudgetDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  recurringPayments!: Table<RecurringPayment, string>;
  settings!: Table<PlanSettings, string>;

  constructor() {
    super('aiBudgetDB');
    this.version(1).stores({
      transactions: 'id, transactionDate, type, categoryId, createdAt',
      categories: 'id, name, isDefault, customBucket',
      recurringPayments: 'id, nextDueDate, isActive, categoryId, createdAt',
      settings: 'id'
    });
  }
}

export const db = new AiBudgetDB();

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-groceries',
    name: 'Groceries',
    iconName: 'shopping-cart',
    colorHex: '#10B981',
    isDefault: true,
    customBucket: 'essentials'
  },
  {
    id: 'cat-dining',
    name: 'Dining & Drinks',
    iconName: 'utensils',
    colorHex: '#F59E0B',
    isDefault: true,
    customBucket: 'selfCareAndWants'
  },
  {
    id: 'cat-housing',
    name: 'Housing & Utilities',
    iconName: 'home',
    colorHex: '#3B82F6',
    isDefault: true,
    customBucket: 'essentials'
  },
  {
    id: 'cat-transport',
    name: 'Transport',
    iconName: 'car',
    colorHex: '#6366F1',
    isDefault: true,
    customBucket: 'essentials'
  },
  {
    id: 'cat-subs',
    name: 'Subscriptions & Amenities',
    iconName: 'repeat',
    colorHex: '#8B5CF6',
    isDefault: true,
    customBucket: 'selfCareAndWants'
  },
  {
    id: 'cat-health',
    name: 'Health & Insurance',
    iconName: 'heart-pulse',
    colorHex: '#EF4444',
    isDefault: true,
    customBucket: 'essentials'
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    iconName: 'tv',
    colorHex: '#EC4899',
    isDefault: true,
    customBucket: 'selfCareAndWants'
  },
  {
    id: 'cat-salary',
    name: 'Salary / Income',
    iconName: 'banknote',
    colorHex: '#06B6D4',
    isDefault: true
  },
  {
    id: 'cat-investments',
    name: 'Investments & Wealth',
    iconName: 'trending-up',
    colorHex: '#14B8A6',
    isDefault: true,
    customBucket: 'investments'
  },
  {
    id: 'cat-selfcare',
    name: 'Self-Care & Wellness',
    iconName: 'sparkles',
    colorHex: '#F43F5E',
    isDefault: true,
    customBucket: 'selfCareAndWants'
  }
];

export const DEFAULT_SETTINGS: PlanSettings = {
  id: 'current',
  selectedFramework: '50/30/20',
  customEssentialsPct: 50,
  customSelfCarePct: 30,
  customInvestmentsPct: 20,
  useManualSalary: false,
  manualSalary: 2800
};

export async function initializeDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  const existingSettings = await db.settings.get('current');
  if (!existingSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  // Check if transactions are empty; if so, populate helpful demo transactions for current month
  const txCount = await db.transactions.count();
  if (txCount === 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const isoDate = (d: number) => `${year}-${month}-${String(d).padStart(2, '0')}`;

    const sampleTransactions: Transaction[] = [
      {
        id: 'tx-1',
        title: 'Monthly Tech Salary',
        note: 'Direct deposit primary payroll',
        amount: 3250.00,
        currencyCode: 'EUR',
        type: 'income',
        categoryId: 'cat-salary',
        transactionDate: isoDate(1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-2',
        title: 'Apartment Rent & Building Maint.',
        note: 'Central district studio',
        amount: 850.00,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-housing',
        transactionDate: isoDate(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-3',
        title: 'Organic Market & Weekly Groceries',
        note: 'Fresh produce, staples & pantry',
        amount: 142.50,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-groceries',
        transactionDate: isoDate(4),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-4',
        title: 'Global All-Cap ETF Portfolio',
        note: 'Monthly automated DCA investment',
        amount: 450.00,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-investments',
        transactionDate: isoDate(5),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-5',
        title: 'Bistro & Specialty Coffee',
        note: 'Weekend brunch with friends',
        amount: 38.00,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-dining',
        transactionDate: isoDate(8),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-6',
        title: 'Fiber Internet & Mobile Plan',
        note: 'High-speed home connectivity',
        amount: 49.99,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-housing',
        transactionDate: isoDate(10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'tx-7',
        title: 'Gym & Thermal Spa Pass',
        note: 'Monthly fitness membership',
        amount: 65.00,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-selfcare',
        transactionDate: isoDate(12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    await db.transactions.bulkAdd(sampleTransactions);

    // Initial Recurring Payments
    const sampleRecurring: RecurringPayment[] = [
      {
        id: 'rec-1',
        title: 'Nordic Clean Gym & Wellness',
        note: 'Monthly fitness center access',
        amount: 65.00,
        currencyCode: 'EUR',
        billingCycle: 'monthly',
        isAutoPay: true,
        categoryId: 'cat-selfcare',
        nextDueDate: isoDate(25),
        reminderEnabled: true,
        reminderDaysBefore: 2,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rec-2',
        title: 'Spotify Family & Music Cloud',
        note: 'High fidelity audio streaming',
        amount: 17.99,
        currencyCode: 'EUR',
        billingCycle: 'monthly',
        isAutoPay: true,
        categoryId: 'cat-subs',
        nextDueDate: isoDate(28),
        reminderEnabled: true,
        reminderDaysBefore: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rec-3',
        title: 'Metro Pass / Public Transit',
        note: 'Zone 1-3 monthly card',
        amount: 55.00,
        currencyCode: 'EUR',
        billingCycle: 'monthly',
        isAutoPay: false,
        categoryId: 'cat-transport',
        nextDueDate: isoDate(24),
        reminderEnabled: true,
        reminderDaysBefore: 3,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rec-4',
        title: 'High-yield Index Wealth Contribution',
        note: 'S&P 500 / MSCI World',
        amount: 200.00,
        currencyCode: 'EUR',
        billingCycle: 'monthly',
        isAutoPay: true,
        categoryId: 'cat-investments',
        nextDueDate: isoDate(27),
        reminderEnabled: false,
        reminderDaysBefore: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    await db.recurringPayments.bulkAdd(sampleRecurring);
  }
}
