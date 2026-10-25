import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportToJson,
  exportToCsv,
  parseCsvFile,
  parseImportFile,
  applyImport,
  resetDatabaseToDefaults,
  type BackupData
} from '../lib/exportImport';
import { db, initializeDatabase, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../db/db';
import {
  makeTransaction,
  makeCategory,
  makeRecurringPayment,
  makeSettings
} from './factories';

describe('Flow 6: Data Portability (Export, Import, Merge/Replace & Reset)', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  describe('Export to JSON & CSV', () => {
    it('exports database tables to a JSON download', async () => {
      await db.transactions.add(
        makeTransaction({ id: 'tx_exp_1', title: 'Coffee', amount: 4.5 })
      );
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      await exportToJson();

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
      expect(blobArg.type).toBe('application/json');
      const parsed = JSON.parse(await blobArg.text()) as BackupData;
      expect(parsed.version).toBe(1);
      expect(parsed.transactions).toHaveLength(1);
      expect(parsed.transactions[0].title).toBe('Coffee');
      expect(parsed.categories).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('exports transactions to a properly escaped CSV download and round-trips back via parseImportFile & applyImport', async () => {
      await db.transactions.add(
        makeTransaction({
          id: 'tx_csv_out',
          title: 'Cafe "De Paris", Central',
          note: 'Lunch, "special"',
          amount: 18.5,
          currencyCode: 'USD',
          type: 'expense',
          categoryId: 'cat-dining',
          transactionDate: '2026-10-15'
        })
      );
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      await exportToCsv();

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
      const csvText = await blobArg.text();
      const lines = csvText.split('\r\n');
      expect(lines[0]).toBe('Date,Title,Type,Amount,Currency,Category,Note,ID');
      expect(lines[1]).toContain(
        '2026-10-15,"Cafe ""De Paris"", Central",expense,18.50,USD,"Dining & Drinks","Lunch, ""special""",tx_csv_out'
      );
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Verify full CSV round-trip fidelity
      const csvFile = new File([csvText], 'exported.csv', { type: 'text/csv' });
      const preview = await parseImportFile(csvFile);
      expect(preview.type).toBe('csv');
      expect(preview.sampleItems[0]).toContain('-€18.5');

      await applyImport(preview, 'replace');
      const restored = await db.transactions.get('tx_csv_out');
      expect(restored).toBeDefined();
      expect(restored?.title).toBe('Cafe "De Paris", Central');
      expect(restored?.note).toBe('Lunch, "special"');
      expect(restored?.currencyCode).toBe('USD');
      expect(restored?.categoryId).toBe('cat-dining');
    });
  });

  describe('Parsing CSV & JSON Import Files', () => {
    it('parses CSV rows with quoted commas, escaped quotes, types, categories, currency, ID, and negative amounts', () => {
      const csv = [
        'Date,Title,Type,Amount,Currency,Category,Note,ID',
        '2026-10-10,"Market, ""Fresh""",expense,42.30,EUR,Groceries,"Weekly, ""groceries""",tx_custom_1',
        '2026-10-01,Monthly Salary,income,3000.00,EUR,Salary / Income,Main job,tx_custom_2',
        '2026-10-11,ATM Withdrawal,,-50.00,GBP,,Cash,'
      ].join('\n');

      const parsed = parseCsvFile(csv);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toMatchObject({
        id: 'tx_custom_1',
        title: 'Market, "Fresh"',
        type: 'expense',
        amount: 42.3,
        currencyCode: 'EUR',
        categoryId: 'cat-groceries',
        transactionDate: '2026-10-10',
        note: 'Weekly, "groceries"'
      });
      expect(parsed[1]).toMatchObject({
        id: 'tx_custom_2',
        title: 'Monthly Salary',
        type: 'income',
        amount: 3000,
        categoryId: 'cat-salary'
      });
      expect(parsed[2]).toMatchObject({
        title: 'ATM Withdrawal',
        type: 'expense',
        amount: 50,
        currencyCode: 'GBP'
      });
    });

    it('creates an import preview for valid JSON and CSV with +/- signs, and throws on malformed JSON', async () => {
      const payload: BackupData = {
        version: 1,
        exportedAt: '2026-10-15T12:00:00.000Z',
        transactions: [makeTransaction({ title: 'Rent', amount: 900, type: 'expense' })],
        categories: DEFAULT_CATEGORIES,
        recurringPayments: [makeRecurringPayment({ title: 'Internet' })],
        settings: DEFAULT_SETTINGS
      };

      const validFile = new File([JSON.stringify(payload)], 'backup.json', {
        type: 'application/json'
      });
      const preview = await parseImportFile(validFile);

      expect(preview.type).toBe('json');
      expect(preview.transactionCount).toBe(1);
      expect(preview.categoryCount).toBe(DEFAULT_CATEGORIES.length);
      expect(preview.recurringCount).toBe(1);
      expect(preview.sampleItems[0]).toContain('-€900');

      const csvFile = new File(
        ['Date,Title,Type,Amount\n2026-10-01,Bonus,income,500\n2026-10-02,Lunch,expense,15'],
        'sample.csv',
        { type: 'text/csv' }
      );
      const csvPreview = await parseImportFile(csvFile);
      expect(csvPreview.sampleItems[0]).toContain('+€500');
      expect(csvPreview.sampleItems[1]).toContain('-€15');

      const invalidFile = new File(['{not-valid-json'], 'broken.json', {
        type: 'application/json'
      });
      await expect(parseImportFile(invalidFile)).rejects.toThrow(
        'Invalid JSON backup file structure.'
      );
    });
  });

  describe('Applying Imports (Merge vs Replace) & Database Reset', () => {
    it('merges JSON backup: deduplicates matching IDs, deduplicates ID-less records by signature, and preserves distinct transactions with explicit different IDs', async () => {
      // Seed existing transactions
      await db.transactions.bulkAdd([
        makeTransaction({
          id: 'tx_same_id',
          title: 'Supermarket',
          amount: 45,
          transactionDate: '2026-10-05'
        }),
        makeTransaction({
          id: 'tx_coffee_morning',
          title: 'Coffee',
          amount: 3.5,
          transactionDate: '2026-10-06'
        })
      ]);

      const incomingBackup: BackupData = {
        version: 1,
        exportedAt: '2026-10-15T12:00:00.000Z',
        transactions: [
          // 1. Duplicate by ID -> skipped
          makeTransaction({
            id: 'tx_same_id',
            title: 'Supermarket Updated',
            amount: 45,
            transactionDate: '2026-10-05'
          }),
          // 2. Distinct transaction on same day with same title & amount, but explicit different ID -> preserved!
          makeTransaction({
            id: 'tx_coffee_afternoon',
            title: 'Coffee',
            amount: 3.5,
            transactionDate: '2026-10-06'
          }),
          // 3. Transaction without an explicit ID that matches existing signature -> skipped!
          {
            ...makeTransaction({
              title: 'Coffee',
              amount: 3.5,
              transactionDate: '2026-10-06'
            }),
            id: ''
          },
          // 4. Brand new transaction
          makeTransaction({
            id: 'tx_brand_new',
            title: 'Bookstore',
            amount: 28,
            transactionDate: '2026-10-07'
          })
        ],
        categories: [makeCategory({ id: 'cat-books', name: 'Books' })],
        recurringPayments: [makeRecurringPayment({ id: 'rec_gym', title: 'Gym' })],
        settings: makeSettings({ selectedFramework: '70/20/10' })
      };

      const file = new File([JSON.stringify(incomingBackup)], 'backup.json', {
        type: 'application/json'
      });
      const preview = await parseImportFile(file);

      await applyImport(preview, 'merge');

      const allTxs = await db.transactions.toArray();
      expect(allTxs).toHaveLength(4); // 2 existing + 1 second coffee with distinct ID + 1 brand new
      expect(allTxs.map(t => t.id)).toEqual(
        expect.arrayContaining([
          'tx_same_id',
          'tx_coffee_morning',
          'tx_coffee_afternoon',
          'tx_brand_new'
        ])
      );
      expect(await db.categories.get('cat-books')).toBeDefined();
      expect(await db.recurringPayments.get('rec_gym')).toBeDefined();
      expect((await db.settings.get('current'))?.selectedFramework).toBe('70/20/10');
    });

    it('replaces all existing data when applyImport is called with replace mode', async () => {
      await db.transactions.add(
        makeTransaction({ id: 'tx_old', title: 'Old Expense', amount: 100 })
      );
      await db.recurringPayments.add(
        makeRecurringPayment({ id: 'rec_old', title: 'Old Bill' })
      );

      const incomingBackup: BackupData = {
        version: 1,
        exportedAt: '2026-10-15T12:00:00.000Z',
        transactions: [
          makeTransaction({ id: 'tx_fresh', title: 'Fresh Expense', amount: 25 })
        ],
        categories: [],
        recurringPayments: [],
        settings: makeSettings({ manualSalary: 4200, useManualSalary: true })
      };

      const file = new File([JSON.stringify(incomingBackup)], 'replace.json', {
        type: 'application/json'
      });
      const preview = await parseImportFile(file);

      await applyImport(preview, 'replace');

      const allTxs = await db.transactions.toArray();
      expect(allTxs).toHaveLength(1);
      expect(allTxs[0].id).toBe('tx_fresh');
      expect(await db.recurringPayments.count()).toBe(0);
      // Should re-seed default categories when backup has empty categories array
      expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
      expect((await db.settings.get('current'))?.manualSalary).toBe(4200);
    });

    it('resets the entire database back to factory defaults atomically', async () => {
      await db.transactions.add(makeTransaction());
      await db.recurringPayments.add(makeRecurringPayment());
      await db.categories.add(makeCategory({ id: 'cat-extra' }));
      await db.settings.put(makeSettings({ selectedFramework: '60/20/20' }));

      await resetDatabaseToDefaults();

      expect(await db.transactions.count()).toBe(0);
      expect(await db.recurringPayments.count()).toBe(0);
      expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
      expect(await db.settings.get('current')).toEqual(DEFAULT_SETTINGS);
    });
  });
});
