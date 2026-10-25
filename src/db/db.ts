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
  manualSalary: 2500
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
}
