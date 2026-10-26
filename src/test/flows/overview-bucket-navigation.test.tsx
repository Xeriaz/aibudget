import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { db, initializeDatabase } from '../../db/db';

describe('Overview Lifestyle & Wealth Bucket Navigation to Ledger', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await initializeDatabase();
  });

  it('navigates from Overview Self-Care, Investments, and Essentials cards to Ledger with month and bucket filters preselected', async () => {
    const user = userEvent.setup();

    // Seed transactions for current month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    await db.transactions.bulkAdd([
      {
        id: 'tx-essentials-1',
        title: 'Weekly Groceries',
        amount: 85,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-groceries', // essentials
        transactionDate: `${currentMonthKey}-05`,
        createdAt: `${currentMonthKey}-05T10:00:00Z`,
        updatedAt: `${currentMonthKey}-05T10:00:00Z`
      },
      {
        id: 'tx-essentials-2',
        title: 'Electric Utility',
        amount: 60,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-housing', // essentials (Housing & Utilities)
        transactionDate: `${currentMonthKey}-08`,
        createdAt: `${currentMonthKey}-08T10:00:00Z`,
        updatedAt: `${currentMonthKey}-08T10:00:00Z`
      },
      {
        id: 'tx-selfcare-1',
        title: 'Sushi Dinner',
        amount: 45,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-dining', // selfCareAndWants
        transactionDate: `${currentMonthKey}-10`,
        createdAt: `${currentMonthKey}-10T10:00:00Z`,
        updatedAt: `${currentMonthKey}-10T10:00:00Z`
      },
      {
        id: 'tx-selfcare-2',
        title: 'Cinema Tickets',
        amount: 25,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-entertainment', // selfCareAndWants
        transactionDate: `${currentMonthKey}-12`,
        createdAt: `${currentMonthKey}-12T10:00:00Z`,
        updatedAt: `${currentMonthKey}-12T10:00:00Z`
      },
      {
        id: 'tx-investments-1',
        title: 'Global ETF DCA',
        amount: 200,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-investments', // investments
        transactionDate: `${currentMonthKey}-15`,
        createdAt: `${currentMonthKey}-15T10:00:00Z`,
        updatedAt: `${currentMonthKey}-15T10:00:00Z`
      },
      {
        id: 'tx-past-month',
        title: 'Past Month Groceries',
        amount: 100,
        currencyCode: 'EUR',
        type: 'expense',
        categoryId: 'cat-groceries',
        transactionDate: `${prevMonthKey}-15`,
        createdAt: `${prevMonthKey}-15T10:00:00Z`,
        updatedAt: `${prevMonthKey}-15T10:00:00Z`
      }
    ]);

    render(<App />);
    await screen.findByText('Net Cash Flow');

    // 1. CLICK SELF-CARE CARD ON OVERVIEW
    const selfCareTitleEl = screen.getAllByText(/Self-Care & Lifestyle/i)[0];
    const selfCareCard = selfCareTitleEl.closest('.cursor-pointer');
    expect(selfCareCard).toBeTruthy();
    await user.click(selfCareCard!);

    // Should switch to Ledger tab
    expect(screen.getByLabelText('Annual Cash Flow Chart')).toBeInTheDocument();

    // Verify filter dropdown values in Ledger
    const monthSelect = screen.getByRole('combobox', { name: /filter by month/i }) as HTMLSelectElement;
    expect(monthSelect.value).toBe(currentMonthKey);

    const bucketSelect = screen.getByRole('combobox', { name: /filter by budget bucket/i }) as HTMLSelectElement;
    expect(bucketSelect.value).toBe('selfCareAndWants');

    // Verify filtered transactions visible in list
    expect(screen.getByText('Sushi Dinner')).toBeInTheDocument();
    expect(screen.getByText('Cinema Tickets')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Groceries')).not.toBeInTheDocument();
    expect(screen.queryByText('Electric Utility')).not.toBeInTheDocument();
    expect(screen.queryByText('Global ETF DCA')).not.toBeInTheDocument();
    expect(screen.queryByText('Past Month Groceries')).not.toBeInTheDocument();

    // Verify Active Filter indicators in chart footer
    expect(screen.getByRole('button', { name: new RegExp(`Showing ${currentMonthKey} • Clear`, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Showing Self-Care & Lifestyle • Clear/i })).toBeInTheDocument();

    // 2. SWITCH BACK TO OVERVIEW AND CLICK INVESTMENTS
    await user.click(screen.getByRole('button', { name: /^overview$/i }));
    await screen.findByText('Net Cash Flow');

    const investmentsTitleEl = screen.getAllByText(/Investments & Wealth/i)[0];
    const investmentsCard = investmentsTitleEl.closest('.cursor-pointer');
    expect(investmentsCard).toBeTruthy();
    await user.click(investmentsCard!);

    // Should be on Ledger tab with Investments filter
    expect(screen.getByLabelText('Annual Cash Flow Chart')).toBeInTheDocument();
    expect((screen.getByRole('combobox', { name: /filter by month/i }) as HTMLSelectElement).value).toBe(currentMonthKey);
    expect((screen.getByRole('combobox', { name: /filter by budget bucket/i }) as HTMLSelectElement).value).toBe('investments');

    expect(screen.getByText('Global ETF DCA')).toBeInTheDocument();
    expect(screen.queryByText('Sushi Dinner')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly Groceries')).not.toBeInTheDocument();

    // 3. SWITCH BACK TO OVERVIEW AND CLICK ESSENTIALS
    await user.click(screen.getByRole('button', { name: /^overview$/i }));
    await screen.findByText('Net Cash Flow');

    const essentialsTitleEl = screen.getAllByText(/Essentials & Needs/i)[0];
    const essentialsCard = essentialsTitleEl.closest('.cursor-pointer');
    expect(essentialsCard).toBeTruthy();
    await user.click(essentialsCard!);

    // Should be on Ledger tab with Essentials filter
    expect(screen.getByLabelText('Annual Cash Flow Chart')).toBeInTheDocument();
    expect((screen.getByRole('combobox', { name: /filter by month/i }) as HTMLSelectElement).value).toBe(currentMonthKey);
    expect((screen.getByRole('combobox', { name: /filter by budget bucket/i }) as HTMLSelectElement).value).toBe('essentials');

    expect(screen.getByText('Weekly Groceries')).toBeInTheDocument();
    expect(screen.getByText('Electric Utility')).toBeInTheDocument();
    expect(screen.queryByText('Sushi Dinner')).not.toBeInTheDocument();
    expect(screen.queryByText('Global ETF DCA')).not.toBeInTheDocument();
    expect(screen.queryByText('Past Month Groceries')).not.toBeInTheDocument();

    // 4. CLEAR BUCKET FILTER IN LEDGER
    const clearBucketBtn = screen.getByRole('button', { name: /Showing Essentials & Needs • Clear/i });
    await user.click(clearBucketBtn);

    // Now all current month transactions are visible
    expect(screen.getByText('Weekly Groceries')).toBeInTheDocument();
    expect(screen.getByText('Electric Utility')).toBeInTheDocument();
    expect(screen.getByText('Sushi Dinner')).toBeInTheDocument();
    expect(screen.getByText('Cinema Tickets')).toBeInTheDocument();
    expect(screen.getByText('Global ETF DCA')).toBeInTheDocument();
    expect(screen.queryByText('Past Month Groceries')).not.toBeInTheDocument();
  });
});
