import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import App from '../../App';
import { db, initializeDatabase } from '../../db/db';
import { makeTransaction } from '../factories';

describe('Flow 3: Transaction Lifecycle & Ledger Filtering', () => {
  it('logs an expense and income via TransactionModal, auto-updates category on type toggle, handles decimal + quick chip additions, and updates Overview & Ledger', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for DB initialization & Overview render
    await screen.findByText('Net Cash Flow');

    // Open TransactionModal from top "+ Log" button
    await user.click(screen.getByRole('button', { name: /^log$/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Log Transaction' })).toBeInTheDocument();

    // Attempt to save with empty amount -> triggers alert validation
    await user.click(screen.getByRole('button', { name: /record transaction/i }));
    expect(window.alert).toHaveBeenCalledWith(
      'Please enter a valid amount greater than 0'
    );

    // Test decimal amount + quick increment chip operator precedence fix (12.55 + 5 = 17.55, not 18)
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    await user.type(amountInput, '12.55');
    await user.click(screen.getByRole('button', { name: '+€5' }));
    expect(amountInput.value).toBe('17.55');

    // Clear and use quick increment chips +€50 and +€20 (= €70 whole number -> '70')
    await user.clear(amountInput);
    await user.click(screen.getByRole('button', { name: '+€50' }));
    await user.click(screen.getByRole('button', { name: '+€20' }));
    expect(amountInput.value).toBe('70');

    const titleInput = screen.getByPlaceholderText(/supermarket, cafe, rent/i);
    await user.type(titleInput, 'Organic Market');

    const noteInput = screen.getByPlaceholderText(/extra context or tags/i);
    await user.type(noteInput, 'Weekly produce');

    await user.click(screen.getByRole('button', { name: /record transaction/i }));

    // Modal closes and Overview updates Total Spent to €70.00
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Log Transaction' })
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('€70.00').length).toBeGreaterThan(0);

    // Now log an Income Inflow of €3,000 via floating "Log Transaction" button
    // Verify switching from Expense to Income automatically selects "Salary / Income" (cat-salary) instead of keeping cat-groceries
    await user.click(screen.getByTitle('Log Transaction'));
    await user.click(screen.getByRole('button', { name: /income inflow/i }));

    const salaryChip = screen.getByRole('button', { name: /salary \/ income/i });
    expect(salaryChip.className).toContain('border-indigo-500');

    const incAmountInput = screen.getByPlaceholderText('0.00');
    await user.clear(incAmountInput);
    await user.type(incAmountInput, '3000');

    const incomeTitleInput = screen.getByPlaceholderText(/salary, dividend, bonus/i);
    await user.type(incomeTitleInput, 'Monthly Tech Salary');

    await user.click(screen.getByRole('button', { name: /record transaction/i }));

    // Verify Net Cash Flow updates to €2,930.00 (3000 - 70) and the saved income transaction has cat-salary
    await waitFor(() => {
      expect(screen.getByText('€2,930.00')).toBeInTheDocument();
    });
    const allTxs = await db.transactions.toArray();
    const incomeTx = allTxs.find(t => t.type === 'income');
    expect(incomeTx?.categoryId).toBe('cat-salary');
  });

  it('closes TransactionModal on Escape key press and backdrop click', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    // Open and close via Escape key
    await user.click(screen.getByRole('button', { name: /^log$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Open and close via backdrop click
    await user.click(screen.getByRole('button', { name: /^log$/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(dialog.parentElement as HTMLElement);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('creates a custom category inline inside TransactionModal and assigns it to a transaction', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Net Cash Flow');
    await user.click(screen.getByRole('button', { name: /^log$/i }));

    await user.click(screen.getByRole('button', { name: /new category/i }));
    expect(
      screen.getByRole('heading', { name: /create custom category/i })
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/pet care, games, coffee/i),
      'Pet Supplies'
    );
    await user.click(screen.getByRole('button', { name: /essentials \(50%\)/i }));
    await user.click(screen.getByRole('button', { name: /^create category$/i }));

    // Wait for the new category chip to appear in the horizontal selector and select it
    const petCategoryChip = await screen.findByRole('button', {
      name: /^pet supplies$/i
    });
    await user.click(petCategoryChip);

    await user.click(screen.getByRole('button', { name: '+€20' }));
    await user.type(
      screen.getByPlaceholderText(/supermarket, cafe, rent/i),
      'Dog Food'
    );
    await user.click(screen.getByRole('button', { name: /record transaction/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Log Transaction' })
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Pet Supplies')).toBeInTheDocument();
  });

  it('filters, searches, edits, and deletes transactions in LedgerTab', async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    await initializeDatabase();
    await db.transactions.bulkAdd([
      makeTransaction({
        id: 'tx_1',
        title: 'Specialty Coffee',
        note: 'Oat flat white',
        amount: 5.5,
        type: 'expense',
        categoryId: 'cat-dining',
        transactionDate: todayStr
      }),
      makeTransaction({
        id: 'tx_2',
        title: 'City Supermarket',
        note: 'Dinner ingredients',
        amount: 64.5,
        type: 'expense',
        categoryId: 'cat-groceries',
        transactionDate: todayStr
      }),
      makeTransaction({
        id: 'tx_3',
        title: 'Freelance Payout',
        note: 'Design sprint',
        amount: 500,
        type: 'income',
        categoryId: 'cat-salary',
        transactionDate: todayStr
      })
    ]);

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    // Navigate to Ledger tab
    await user.click(screen.getByRole('button', { name: /ledger/i }));

    // Verify all 3 transactions and summary strip
    expect(await screen.findByText('Specialty Coffee')).toBeInTheDocument();
    expect(screen.getByText('City Supermarket')).toBeInTheDocument();
    expect(screen.getByText('Freelance Payout')).toBeInTheDocument();
    expect(screen.getAllByText('€500.00').length).toBeGreaterThan(0); // Inflow
    expect(screen.getAllByText('€70.00').length).toBeGreaterThan(0); // Outflow (5.5 + 64.5)

    // Filter by type: income
    await user.click(screen.getByRole('button', { name: /^income$/i }));
    expect(screen.getByText('Freelance Payout')).toBeInTheDocument();
    expect(screen.queryByText('Specialty Coffee')).not.toBeInTheDocument();

    // Reset filters
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText('Specialty Coffee')).toBeInTheDocument();

    // Search by note ("Oat flat white")
    const searchInput = screen.getByPlaceholderText(
      /search merchants, notes, categories/i
    );
    await user.type(searchInput, 'flat white');
    expect(screen.getByText('Specialty Coffee')).toBeInTheDocument();
    expect(screen.queryByText('City Supermarket')).not.toBeInTheDocument();

    // Click transaction row to edit it
    await user.click(screen.getByText('Specialty Coffee'));
    expect(
      await screen.findByRole('heading', { name: 'Edit Transaction' })
    ).toBeInTheDocument();

    const titleField = screen.getByDisplayValue('Specialty Coffee');
    await user.clear(titleField);
    await user.type(titleField, 'Artisan Coffee Roasters');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Artisan Coffee Roasters')).toBeInTheDocument();
    });

    // Clear search and delete the transaction via row delete button
    await user.clear(searchInput);
    const coffeeRow = screen
      .getByText('Artisan Coffee Roasters')
      .closest('.group') as HTMLElement;
    const deleteBtn = within(coffeeRow).getByTitle('Delete');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.queryByText('Artisan Coffee Roasters')
      ).not.toBeInTheDocument();
    });
    expect(await db.transactions.get('tx_1')).toBeUndefined();
  });

  it('renders the interactive 12-month Cash Flow chart in LedgerTab, supports year switching, and filters transactions when clicking a month bar', async () => {
    const currentYear = new Date().getFullYear();
    await initializeDatabase();
    await db.transactions.bulkAdd([
      makeTransaction({
        id: 'tx_jan_inc',
        title: 'January Salary',
        amount: 3000,
        type: 'income',
        categoryId: 'cat-salary',
        transactionDate: `${currentYear}-01-10`
      }),
      makeTransaction({
        id: 'tx_jan_exp',
        title: 'January Rent',
        amount: 1100,
        type: 'expense',
        categoryId: 'cat-housing',
        transactionDate: `${currentYear}-01-12`
      }),
      makeTransaction({
        id: 'tx_mar_exp',
        title: 'March Flight',
        amount: 450,
        type: 'expense',
        categoryId: 'cat-dining',
        transactionDate: `${currentYear}-03-05`
      }),
      makeTransaction({
        id: 'tx_prev_year',
        title: 'Last Year Bonus',
        amount: 2000,
        type: 'income',
        categoryId: 'cat-salary',
        transactionDate: `${currentYear - 1}-06-15`
      })
    ]);

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    await user.click(screen.getByRole('button', { name: /ledger/i }));

    const chartRegion = await screen.findByLabelText('Annual Cash Flow Chart');
    expect(within(chartRegion).getByTestId('chart-year-label')).toHaveTextContent(String(currentYear));

    // Both January and March transactions are initially visible
    expect(screen.getByText('January Salary')).toBeInTheDocument();
    expect(screen.getByText('March Flight')).toBeInTheDocument();

    // Click January bar to filter to January only
    const janBarBtn = within(chartRegion).getByRole('button', { name: new RegExp(`^Jan ${currentYear}:`, 'i') });
    await user.click(janBarBtn);
    expect(janBarBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('January Salary')).toBeInTheDocument();
    expect(screen.getByText('January Rent')).toBeInTheDocument();
    expect(screen.queryByText('March Flight')).not.toBeInTheDocument();

    // Click January bar again to clear the month filter
    await user.click(janBarBtn);
    expect(janBarBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('March Flight')).toBeInTheDocument();

    // Switch to previous year via Previous Year button
    await user.click(within(chartRegion).getByRole('button', { name: /previous year/i }));
    expect(within(chartRegion).getByTestId('chart-year-label')).toHaveTextContent(String(currentYear - 1));

    // Click June of previous year to filter to Last Year Bonus
    const junPrevBtn = within(chartRegion).getByRole('button', { name: new RegExp(`^Jun ${currentYear - 1}:`, 'i') });
    await user.click(junPrevBtn);
    expect(screen.getByText('Last Year Bonus')).toBeInTheDocument();
    expect(screen.queryByText('January Salary')).not.toBeInTheDocument();
  });
});
