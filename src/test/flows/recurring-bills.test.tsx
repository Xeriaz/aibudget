import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, addMonths, format } from 'date-fns';
import App from '../../App';
import { db, initializeDatabase } from '../../db/db';
import { makeRecurringPayment } from '../factories';

describe('Flow 4: Recurring Bills & Mark as Paid Automation', () => {
  it('adds a recurring bill, displays reminder highlights, Monthly Burn & Annual Commitment, and marks a bill as paid', async () => {
    const today = new Date();
    const dueIn2Days = format(addDays(today, 2), 'yyyy-MM-dd');

    await initializeDatabase();
    await db.recurringPayments.add(
      makeRecurringPayment({
        id: 'rec_fiber',
        title: 'Fiber Internet',
        amount: 40,
        billingCycle: 'monthly',
        categoryId: 'cat-housing',
        nextDueDate: dueIn2Days,
        reminderEnabled: true,
        reminderDaysBefore: 3, // daysLeft (2) <= 3 -> reminder badge should highlight
        isActive: true
      })
    );

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    // OverviewTab should show Reminder badge for Fiber Internet
    expect(screen.getByText('Reminder')).toBeInTheDocument();

    // Navigate to Bills tab
    await user.click(screen.getByRole('button', { name: /bills/i }));
    expect(
      await screen.findByText(/subscriptions & recurring bills/i)
    ).toBeInTheDocument();

    // BillsTab should also display Reminder highlight
    expect(screen.getByText('Reminder')).toBeInTheDocument();

    // Initial burn from Fiber Internet (€40/mo, €480/yr)
    expect(screen.getByText('1 active commitment')).toBeInTheDocument();
    expect(screen.getByText('€480.00')).toBeInTheDocument();

    // Open Add Bill modal
    await user.click(screen.getByRole('button', { name: /add bill/i }));
    expect(
      screen.getByRole('heading', { name: /add recurring commitment/i })
    ).toBeInTheDocument();

    // Validation check: empty amount triggers alert
    await user.click(screen.getByRole('button', { name: /create recurring bill/i }));
    expect(window.alert).toHaveBeenCalledWith('Please enter a valid amount');

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.type(amountInput, '20');

    // Validation check: empty title triggers alert
    await user.click(screen.getByRole('button', { name: /create recurring bill/i }));
    expect(window.alert).toHaveBeenCalledWith(
      'Please enter a title for the recurring bill'
    );

    const nameInput = screen.getByPlaceholderText(/netflix, gym, rent, internet/i);
    await user.type(nameInput, 'Cloud Storage');

    await user.click(screen.getByRole('button', { name: /create recurring bill/i }));

    // Verify new bill appears and burn updates to €60/mo (€720/yr)
    await waitFor(() => {
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
    });
    expect(screen.getByText('2 active commitments')).toBeInTheDocument();
    expect(screen.getByText('€60.00')).toBeInTheDocument();
    expect(screen.getByText('€720.00')).toBeInTheDocument();

    // Click "Paid" specifically on Fiber Internet row -> creates transaction and advances due date by 1 month
    const fiberRow = screen.getByText('Fiber Internet').closest('.group') as HTMLElement;
    await user.click(within(fiberRow).getByRole('button', { name: /paid/i }));

    await waitFor(async () => {
      const txs = await db.transactions.toArray();
      expect(txs).toHaveLength(1);
      expect(txs[0].title).toBe('Fiber Internet');
      expect(txs[0].amount).toBe(40);
    });

    const updatedFiber = await db.recurringPayments.get('rec_fiber');
    expect(updatedFiber?.nextDueDate).not.toBe(dueIn2Days);
  });

  it('pauses and resumes recurring bills via RecurringModal and BillsTab quick action, and deletes a bill', async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    await initializeDatabase();
    await db.recurringPayments.bulkAdd([
      makeRecurringPayment({
        id: 'rec_active',
        title: 'Gym Membership',
        amount: 35,
        nextDueDate: todayStr,
        isActive: true
      }),
      makeRecurringPayment({
        id: 'rec_paused',
        title: 'Paused Streaming Box',
        amount: 12,
        nextDueDate: todayStr,
        isActive: false
      })
    ]);

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    await user.click(screen.getByRole('button', { name: /bills/i }));
    expect(await screen.findByText('Gym Membership')).toBeInTheDocument();
    expect(screen.queryByText('Paused Streaming Box')).not.toBeInTheDocument();

    // Toggle "Show All (incl. Paused)"
    await user.click(screen.getByRole('button', { name: /show all \(incl\. paused\)/i }));
    expect(screen.getByText('Paused Streaming Box')).toBeInTheDocument();

    // Resume Paused Streaming Box via RecurringModal switch
    await user.click(screen.getByText('Paused Streaming Box'));
    expect(
      await screen.findByRole('heading', { name: /edit recurring bill/i })
    ).toBeInTheDocument();

    const statusSwitch = screen.getByRole('switch', { name: /resume bill/i });
    expect(statusSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(statusSwitch);
    expect(statusSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /save bill/i }));

    await waitFor(async () => {
      const updated = await db.recurringPayments.get('rec_paused');
      expect(updated?.isActive).toBe(true);
    });

    // Pause Gym Membership directly from the row quick action in BillsTab
    const pauseGymBtn = screen.getByRole('button', { name: /pause gym membership/i });
    await user.click(pauseGymBtn);
    await waitFor(async () => {
      const updated = await db.recurringPayments.get('rec_active');
      expect(updated?.isActive).toBe(false);
    });

    // Click Gym Membership to edit and delete
    await user.click(screen.getByText('Gym Membership'));
    expect(
      await screen.findByRole('heading', { name: /edit recurring bill/i })
    ).toBeInTheDocument();

    const cancelBillBtn = screen.getByTitle('Cancel Bill');
    await user.click(cancelBillBtn);

    await waitFor(() => {
      expect(screen.queryByText('Gym Membership')).not.toBeInTheDocument();
    });
    expect(await db.recurringPayments.get('rec_active')).toBeUndefined();
  });

  it('sorts future commitments in descending order by default and allows toggling to ascending and back', async () => {
    const today = new Date();
    const future2Mos = format(addMonths(today, 2), 'yyyy-MM-dd');
    const future4Mos = format(addMonths(today, 4), 'yyyy-MM-dd');
    const future6Mos = format(addMonths(today, 6), 'yyyy-MM-dd');

    await initializeDatabase();
    await db.recurringPayments.bulkAdd([
      makeRecurringPayment({
        id: 'rec_cloud',
        title: 'Cloud Backup',
        amount: 10,
        nextDueDate: future2Mos,
        isActive: true
      }),
      makeRecurringPayment({
        id: 'rec_domain',
        title: 'Domain Renewal',
        amount: 25,
        nextDueDate: future4Mos,
        isActive: true
      }),
      makeRecurringPayment({
        id: 'rec_car',
        title: 'Car Insurance',
        amount: 120,
        nextDueDate: future6Mos,
        isActive: true
      })
    ]);

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    await user.click(screen.getByRole('button', { name: /bills/i }));
    expect(await screen.findByText('Future Commitments (3)')).toBeInTheDocument();

    // Verify sort controls are rendered and default is 'desc'
    const descButton = screen.getByRole('button', { name: /desc/i });
    const ascButton = screen.getByRole('button', { name: /asc/i });
    expect(descButton).toBeInTheDocument();
    expect(ascButton).toBeInTheDocument();

    // In default desc order: Car Insurance (6 mos) -> Domain Renewal (4 mos) -> Cloud Backup (2 mos)
    const titlesDefault = screen.getAllByText(/Car Insurance|Domain Renewal|Cloud Backup/).map(el => el.textContent);
    expect(titlesDefault).toEqual(['Car Insurance', 'Domain Renewal', 'Cloud Backup']);

    // Switch to asc
    await user.click(ascButton);

    // In asc order: Cloud Backup (2 mos) -> Domain Renewal (4 mos) -> Car Insurance (6 mos)
    const titlesAsc = screen.getAllByText(/Car Insurance|Domain Renewal|Cloud Backup/).map(el => el.textContent);
    expect(titlesAsc).toEqual(['Cloud Backup', 'Domain Renewal', 'Car Insurance']);
    expect(localStorage.getItem('aibudget_future_commitments_sort')).toBe('asc');

    // Switch back to desc
    await user.click(descButton);
    const titlesDesc = screen.getAllByText(/Car Insurance|Domain Renewal|Cloud Backup/).map(el => el.textContent);
    expect(titlesDesc).toEqual(['Car Insurance', 'Domain Renewal', 'Cloud Backup']);
    expect(localStorage.getItem('aibudget_future_commitments_sort')).toBe('desc');
  });
});
