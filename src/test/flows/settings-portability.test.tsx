import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { db, initializeDatabase, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../../db/db';
import { makeTransaction, makeCategory, makeSettings } from '../factories';
import type { BackupData } from '../../lib/exportImport';

describe('Flow 5 & 6: Settings Configuration, Category Mappings & Data Import/Reset UI', () => {
  it('switches theme, configures manual salary & allocation framework (including 0% and keyboard slider support), and remaps/renames/deletes categories', async () => {
    await initializeDatabase();
    // Add a category without explicit customBucket but with an essentials keyword ("Transit Pass")
    await db.categories.add(
      makeCategory({
        id: 'cat-transit-custom',
        name: 'Transit Pass',
        isDefault: false,
        customBucket: undefined
      })
    );
    await db.transactions.add(
      makeTransaction({
        id: 'tx_transit_1',
        title: 'Metro Card',
        categoryId: 'cat-transit-custom'
      })
    );

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Net Cash Flow');

    // Navigate to Settings tab
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(
      await screen.findByText(/lifestyle plan & settings/i)
    ).toBeInTheDocument();

    // Switch to Light Theme
    await user.click(screen.getByRole('button', { name: /light theme/i }));
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('aibudget_theme')).toBe('light');

    // Enable manual salary mode and choose €3200 preset
    const salaryCheckbox = screen.getByRole('checkbox');
    await user.click(salaryCheckbox);

    const preset3200 = await screen.findByRole('button', { name: '€3200' });
    await user.click(preset3200);

    await waitFor(async () => {
      const saved = await db.settings.get('current');
      expect(saved?.useManualSalary).toBe(true);
      expect(saved?.manualSalary).toBe(3200);
    });

    // Switch allocation framework to 60 / 20 / 20
    await user.click(screen.getByRole('button', { name: /60 \/ 20 \/ 20/i }));
    await waitFor(async () => {
      const saved = await db.settings.get('current');
      expect(saved?.selectedFramework).toBe('60/20/20');
    });

    // Switch to Custom Ratio and verify 100% total validation badge
    await user.click(screen.getByRole('button', { name: /custom ratio/i }));
    expect(await screen.findByText(/total: 100% ✓/i)).toBeInTheDocument();

    // Test invalid custom total (e.g. changing Essentials to 70 -> total 120% !== 100) does NOT persist to Dexie
    const essentialsSlider = screen.getByLabelText('Essentials Percentage');
    fireEvent.change(essentialsSlider, { target: { value: '70' } });
    fireEvent.keyUp(essentialsSlider, { key: 'ArrowRight' });
    expect(screen.getByText(/total: 120% \(must equal 100%\)/i)).toBeInTheDocument();
    const savedAfterInvalid = await db.settings.get('current');
    expect(savedAfterInvalid?.customEssentialsPct).toBe(50);

    // Now set Self-Care to 0% and Investments to 30% -> 70 + 0 + 30 = 100%, and save via keyboard ArrowRight
    const selfCareSlider = screen.getByLabelText('Self-Care Percentage');
    const investmentsSlider = screen.getByLabelText('Investments Percentage');
    fireEvent.change(selfCareSlider, { target: { value: '0' } });
    fireEvent.change(investmentsSlider, { target: { value: '30' } });
    fireEvent.keyUp(investmentsSlider, { key: 'ArrowRight' });

    await waitFor(async () => {
      const saved = await db.settings.get('current');
      expect(saved?.customEssentialsPct).toBe(70);
      expect(saved?.customSelfCarePct).toBe(0);
      expect(saved?.customInvestmentsPct).toBe(30);
    });
    // Ensure 0% slider is preserved and not overwritten by default 30%
    expect((selfCareSlider as HTMLInputElement).value).toBe('0');

    // Verify category without customBucket ("Transit Pass") resolves to 'essentials' via resolveCategoryBucket
    const transitRow = screen.getByText('Transit Pass').closest('div.flex.items-center.justify-between') as HTMLElement;
    const transitSelect = transitRow.querySelector('select') as HTMLSelectElement;
    expect(transitSelect.value).toBe('essentials');

    // Rename custom category "Transit Pass" -> "City Metro"
    await user.click(screen.getByRole('button', { name: /rename transit pass/i }));
    const renameInput = screen.getByLabelText('Edit category name');
    await user.clear(renameInput);
    await user.type(renameInput, 'City Metro');
    await user.click(screen.getByRole('button', { name: /save category name/i }));

    await waitFor(async () => {
      const updatedCat = await db.categories.get('cat-transit-custom');
      expect(updatedCat?.name).toBe('City Metro');
    });

    // Delete custom category "City Metro" and verify affected transaction categoryId is cleared
    await user.click(screen.getByRole('button', { name: /delete city metro/i }));
    await waitFor(async () => {
      expect(await db.categories.get('cat-transit-custom')).toBeUndefined();
      const affectedTx = await db.transactions.get('tx_transit_1');
      expect(affectedTx?.categoryId).toBeUndefined();
    });

    // Reassign Groceries category bucket from essentials to selfCareAndWants
    const groceriesRow = screen.getByText('Groceries').closest('div.flex.items-center.justify-between') as HTMLElement;
    const selectEl = groceriesRow.querySelector('select') as HTMLSelectElement;
    await user.selectOptions(selectEl, 'selfCareAndWants');

    await waitFor(async () => {
      const groc = await db.categories.get('cat-groceries');
      expect(groc?.customBucket).toBe('selfCareAndWants');
    });
  });

  it('previews a backup file in the Import Preview modal, syncs SettingsTab state after import and reset, and clears all data', async () => {
    await initializeDatabase();
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('Net Cash Flow');

    await user.click(screen.getByRole('button', { name: /settings/i }));
    await screen.findByText(/data portability & backup/i);

    const backupPayload: BackupData = {
      version: 1,
      exportedAt: '2026-10-15T12:00:00.000Z',
      transactions: [
        makeTransaction({
          id: 'tx_imported_1',
          title: 'Imported Dinner',
          amount: 48,
          transactionDate: '2026-10-15'
        })
      ],
      categories: DEFAULT_CATEGORIES,
      recurringPayments: [],
      settings: makeSettings({
        selectedFramework: '70/20/10',
        useManualSalary: true,
        manualSalary: 4000
      })
    };

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify(backupPayload)], 'my-backup.json', {
      type: 'application/json'
    });

    await user.upload(fileInput, file);

    // Import Preview modal appears with counts and sample entry
    expect(await screen.findByText('Import Preview')).toBeInTheDocument();
    expect(screen.getByText('my-backup.json')).toBeInTheDocument();
    expect(screen.getByText(/imported dinner/i)).toBeInTheDocument();

    // Click Merge button
    await user.click(screen.getByRole('button', { name: /merge/i }));

    await waitFor(async () => {
      const tx = await db.transactions.get('tx_imported_1');
      expect(tx?.title).toBe('Imported Dinner');
    });

    // Verify SettingsTab synced local state with imported settings (70/20/10 and €4,000.00 manual salary)
    expect(await screen.findByText('70/20/10')).toBeInTheDocument();
    expect(screen.getByText('€4,000.00')).toBeInTheDocument();

    // Now test Clear All Data button -> resets DB and syncs SettingsTab back to 50/30/20
    await user.click(screen.getByRole('button', { name: /clear all data/i }));

    await waitFor(async () => {
      expect(await db.transactions.count()).toBe(0);
    });
    expect(await screen.findByText(DEFAULT_SETTINGS.selectedFramework)).toBeInTheDocument();
  });
});
