export type BucketType = 'essentials' | 'selfCareAndWants' | 'investments';

export interface Transaction {
  id: string; // UUID v4
  title: string;
  note?: string;
  amount: number;
  currencyCode: string; // "EUR"
  type: 'expense' | 'income';
  categoryId?: string; // Foreign Key
  transactionDate: string; // ISO 8601 YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string; // UUID v4
  name: string;
  iconName: string; // Lucide icon name
  colorHex: string; // Hex color code
  isDefault: boolean;
  customBucket?: BucketType;
}

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPayment {
  id: string; // UUID v4
  title: string;
  note?: string;
  amount: number;
  currencyCode: string; // "EUR"
  billingCycle: BillingCycle;
  isAutoPay: boolean; // Auto-Debit vs. Manual
  categoryId?: string;
  nextDueDate: string; // ISO 8601 YYYY-MM-DD
  reminderEnabled: boolean;
  reminderDaysBefore: number; // 0, 1, 2, 3, 5, 7
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSettings {
  id: 'current';
  selectedFramework: '50/30/20' | '60/20/20' | '70/20/10' | 'custom';
  customEssentialsPct: number; // default: 50
  customSelfCarePct: number;    // default: 30
  customInvestmentsPct: number; // default: 20
  useManualSalary: boolean;     // default: false
  manualSalary: number;         // default: 2500
}

export interface BucketCalculation {
  bucket: BucketType;
  title: string;
  percentage: number;
  budgetCap: number;
  spent: number;
  remaining: number;
  dailySafePace?: number;
  fundedProgressPct?: number;
  amountLeft?: number;
  committedBills?: number;
}
