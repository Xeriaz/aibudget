import { format } from 'date-fns';
import { db, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../db/db';
import type { Transaction, Category, RecurringPayment, PlanSettings } from '../types';

export interface BackupData {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  categories: Category[];
  recurringPayments: RecurringPayment[];
  settings: PlanSettings;
}

export async function exportToJson(): Promise<void> {
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const recurringPayments = await db.recurringPayments.toArray();
  const settings = (await db.settings.get('current')) || DEFAULT_SETTINGS;

  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    recurringPayments,
    settings
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fileName = `aiBudget-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToCsv(): Promise<void> {
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const headers = ['Date', 'Title', 'Type', 'Amount', 'Currency', 'Category', 'Note', 'ID'];
  const rows = transactions.map(t => [
    t.transactionDate,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    t.type,
    t.amount.toFixed(2),
    t.currencyCode || 'EUR',
    `"${(t.categoryId ? catMap.get(t.categoryId) || 'Other' : '').replace(/"/g, '""')}"`,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.id
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const fileName = `aiBudget-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedImportPreview {
  type: 'json' | 'csv';
  transactionCount: number;
  categoryCount: number;
  recurringCount: number;
  sampleItems: string[];
  rawPayload: any;
}

export function parseCsvFile(csvText: string): Partial<Transaction>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('desc') || h.includes('payee'));
  const typeIdx = headers.findIndex(h => h.includes('type'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total'));
  const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('memo'));

  const parsed: Partial<Transaction>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple regex CSV splitter handling quotes
    const values: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let char of rawLine) {
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    values.push(entry.trim());

    const title = titleIdx !== -1 && values[titleIdx] ? values[titleIdx].replace(/^"|"$/g, '') : `Transaction #${i}`;
    let rawAmount = amountIdx !== -1 && values[amountIdx] ? parseFloat(values[amountIdx].replace(/[^0-9.-]/g, '')) : 0;
    let type: 'income' | 'expense' = 'expense';
    if (typeIdx !== -1 && values[typeIdx]) {
      const t = values[typeIdx].toLowerCase();
      type = t.includes('in') || t.includes('credit') || t.includes('deposit') ? 'income' : 'expense';
    } else if (rawAmount < 0) {
      type = 'expense';
      rawAmount = Math.abs(rawAmount);
    }

    const txDate = dateIdx !== -1 && values[dateIdx] ? values[dateIdx].replace(/^"|"$/g, '') : format(new Date(), 'yyyy-MM-dd');
    const note = noteIdx !== -1 && values[noteIdx] ? values[noteIdx].replace(/^"|"$/g, '') : '';

    parsed.push({
      id: 'tx_csv_' + crypto.randomUUID(),
      title,
      amount: Math.abs(rawAmount) || 0,
      currencyCode: 'EUR',
      type,
      transactionDate: txDate.slice(0, 10),
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return parsed;
}

export async function parseImportFile(file: File): Promise<ParsedImportPreview> {
  const text = await file.text();

  if (file.name.endsWith('.json') || text.trim().startsWith('{')) {
    try {
      const data = JSON.parse(text) as BackupData;
      const txs = Array.isArray(data.transactions) ? data.transactions : [];
      const cats = Array.isArray(data.categories) ? data.categories : [];
      const recs = Array.isArray(data.recurringPayments) ? data.recurringPayments : [];

      return {
        type: 'json',
        transactionCount: txs.length,
        categoryCount: cats.length,
        recurringCount: recs.length,
        sampleItems: txs.slice(0, 3).map(t => `${t.transactionDate}: ${t.title} (${t.type === 'income' ? '+' : '-'}€${t.amount})`),
        rawPayload: data
      };
    } catch (err) {
      throw new Error('Invalid JSON backup file structure.');
    }
  } else {
    // Treat as CSV
    const csvTxs = parseCsvFile(text);
    return {
      type: 'csv',
      transactionCount: csvTxs.length,
      categoryCount: 0,
      recurringCount: 0,
      sampleItems: csvTxs.slice(0, 3).map(t => `${t.transactionDate}: ${t.title} (€${t.amount})`),
      rawPayload: csvTxs
    };
  }
}

export async function applyImport(
  preview: ParsedImportPreview,
  mode: 'merge' | 'replace'
): Promise<void> {
  if (mode === 'replace') {
    await db.transactions.clear();
    await db.categories.clear();
    await db.recurringPayments.clear();
    await db.settings.clear();
  }

  if (preview.type === 'json') {
    const data = preview.rawPayload as BackupData;

    // Categories
    if (data.categories && data.categories.length > 0) {
      if (mode === 'replace') {
        await db.categories.bulkPut(data.categories);
      } else {
        for (const cat of data.categories) {
          await db.categories.put(cat);
        }
      }
    } else if (mode === 'replace') {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    }

    // Transactions
    if (data.transactions && data.transactions.length > 0) {
      if (mode === 'replace') {
        await db.transactions.bulkPut(data.transactions);
      } else {
        // Smart merge by ID or composite key (date + title + amount)
        const existing = await db.transactions.toArray();
        const existingIds = new Set(existing.map(t => t.id));
        const existingSignatures = new Set(existing.map(t => `${t.transactionDate}_${t.title}_${t.amount}`));

        const toAdd: Transaction[] = [];
        for (const tx of data.transactions) {
          const sig = `${tx.transactionDate}_${tx.title}_${tx.amount}`;
          if (!existingIds.has(tx.id) && !existingSignatures.has(sig)) {
            toAdd.push(tx);
          }
        }
        if (toAdd.length > 0) {
          await db.transactions.bulkAdd(toAdd);
        }
      }
    }

    // Recurring
    if (data.recurringPayments && data.recurringPayments.length > 0) {
      if (mode === 'replace') {
        await db.recurringPayments.bulkPut(data.recurringPayments);
      } else {
        for (const rec of data.recurringPayments) {
          await db.recurringPayments.put(rec);
        }
      }
    }

    // Settings
    if (data.settings) {
      await db.settings.put(data.settings);
    } else if (mode === 'replace') {
      await db.settings.put(DEFAULT_SETTINGS);
    }
  } else {
    // CSV transactions
    const csvTxs = preview.rawPayload as Transaction[];
    if (mode === 'replace') {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
      await db.settings.put(DEFAULT_SETTINGS);
      await db.transactions.bulkAdd(csvTxs);
    } else {
      const existing = await db.transactions.toArray();
      const existingSignatures = new Set(existing.map(t => `${t.transactionDate}_${t.title}_${t.amount}`));
      const toAdd = csvTxs.filter(tx => !existingSignatures.has(`${tx.transactionDate}_${tx.title}_${tx.amount}`));
      if (toAdd.length > 0) {
        await db.transactions.bulkAdd(toAdd);
      }
    }
  }
}

export async function resetDatabaseToDefaults(): Promise<void> {
  await db.transactions.clear();
  await db.recurringPayments.clear();
  await db.categories.clear();
  await db.settings.clear();
  await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  await db.settings.put(DEFAULT_SETTINGS);
}
