import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewTab } from '../../components/OverviewTab';
import type { Category, PlanSettings, Transaction, RecurringPayment } from '../../types';

describe('OverviewTab Over-Limit Styling (Self-Care & Essentials)', () => {
  const mockCategories: Category[] = [
    { id: 'cat-groceries', name: 'Groceries', iconName: 'shopping-cart', colorHex: '#3B82F6', isDefault: true, customBucket: 'essentials' },
    { id: 'cat-dining', name: 'Dining Out', iconName: 'utensils', colorHex: '#8B5CF6', isDefault: true, customBucket: 'selfCareAndWants' }
  ];

  const defaultSettings: PlanSettings = {
    id: 'current',
    selectedFramework: '50/30/20',
    customEssentialsPct: 50,
    customSelfCarePct: 30,
    customInvestmentsPct: 20,
    useManualSalary: true,
    manualSalary: 1000 // Essentials Cap = 500, Self-Care Cap = 300, Wealth Cap = 200
  };

  const dummyRecurring: RecurringPayment[] = [];

  it('renders normal styling when spending is within budget limits', () => {
    // Spent: Essentials = 200 (limit 500), Self-Care = 100 (limit 300)
    const txs: Transaction[] = [
      {
        id: 'tx1',
        title: 'Market',
        amount: 200,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-groceries',
        transactionDate: '2026-10-15',
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T10:00:00Z'
      },
      {
        id: 'tx2',
        title: 'Dinner',
        amount: 100,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-dining',
        transactionDate: '2026-10-16',
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T10:00:00Z'
      }
    ];

    render(
      <OverviewTab
        currentDate={new Date('2026-10-20')}
        setCurrentDate={vi.fn()}
        transactions={txs}
        categories={mockCategories}
        recurring={dummyRecurring}
        settings={defaultSettings}
        onRefresh={vi.fn()}
        onSelectTransactionToEdit={vi.fn()}
        onNavigateToTab={vi.fn()}
      />
    );

    // Over limit badges should not be displayed
    expect(screen.queryByText('Over Limit')).not.toBeInTheDocument();
    expect(screen.queryByText('Over Cap')).not.toBeInTheDocument();

    // Normal labels
    expect(screen.getByText('buffer remaining')).toBeInTheDocument();
    expect(screen.getByText('spent of €500.00')).toBeInTheDocument();
  });

  it('shows red amounts, over-limit badges, and overage subtexts when exceeding limits', () => {
    // Spent: Essentials = 650 (limit 500, +150 over), Self-Care = 400 (limit 300, -100 buffer remaining / 100 over)
    const txs: Transaction[] = [
      {
        id: 'tx1',
        title: 'Supermarket',
        amount: 650,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-groceries',
        transactionDate: '2026-10-15',
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T10:00:00Z'
      },
      {
        id: 'tx2',
        title: 'Fine Dining & Concert',
        amount: 400,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-dining',
        transactionDate: '2026-10-16',
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T10:00:00Z'
      }
    ];

    render(
      <OverviewTab
        currentDate={new Date('2026-10-20')}
        setCurrentDate={vi.fn()}
        transactions={txs}
        categories={mockCategories}
        recurring={dummyRecurring}
        settings={defaultSettings}
        onRefresh={vi.fn()}
        onSelectTransactionToEdit={vi.fn()}
        onNavigateToTab={vi.fn()}
      />
    );

    // Over limit badges should be visible
    expect(screen.getByText('Over Limit')).toBeInTheDocument();
    expect(screen.getByText('Over Cap')).toBeInTheDocument();

    // Overage subtexts should be displayed
    expect(screen.getByText('€100.00 over monthly cap')).toBeInTheDocument();
    expect(screen.getByText('spent of €500.00 (+€150.00 over)')).toBeInTheDocument();

    // The amounts in the status blocks should be rendered in red
    const selfCareAmount = screen.getByText('-€100.00');
    expect(selfCareAmount.className).toContain('text-rose-600');

    const essentialsAmounts = screen.getAllByText('€650.00');
    // First match is in the Essentials status block
    expect(essentialsAmounts[0].className).toContain('text-rose-600');
  });
});
