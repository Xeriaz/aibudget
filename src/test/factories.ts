import type {
  Transaction,
  Category,
  RecurringPayment,
  PlanSettings
} from '../types';
import { DEFAULT_SETTINGS } from '../db/db';

let idCounter = 1;

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const id = overrides.id ?? `tx_test_${idCounter++}`;
  const now = '2026-10-15T12:00:00.000Z';
  return {
    id,
    title: 'Test Transaction',
    amount: 50,
    currencyCode: 'EUR',
    type: 'expense',
    categoryId: 'cat-groceries',
    transactionDate: '2026-10-15',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  const id = overrides.id ?? `cat_test_${idCounter++}`;
  return {
    id,
    name: 'Custom Category',
    iconName: 'tag',
    colorHex: '#6366F1',
    isDefault: false,
    customBucket: 'selfCareAndWants',
    ...overrides
  };
}

export function makeRecurringPayment(
  overrides: Partial<RecurringPayment> = {}
): RecurringPayment {
  const id = overrides.id ?? `rec_test_${idCounter++}`;
  const now = '2026-10-15T12:00:00.000Z';
  return {
    id,
    title: 'Netflix Subscription',
    amount: 15.99,
    currencyCode: 'EUR',
    billingCycle: 'monthly',
    isAutoPay: true,
    categoryId: 'cat-subs',
    nextDueDate: '2026-10-18',
    reminderEnabled: true,
    reminderDaysBefore: 2,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makeSettings(overrides: Partial<PlanSettings> = {}): PlanSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides
  };
}
