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

export type CsvParsedTransaction = Partial<Transaction> & {
  categoryName?: string;
  hasExplicitId?: boolean;
};

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

function splitCsvRow(rawLine: string): string[] {
  const values: string[] = [];
  let insideQuote = false;
  let entry = '';

  for (let i = 0; i < rawLine.length; i++) {
    const char = rawLine[i];
    if (char === '"') {
      if (insideQuote && rawLine[i + 1] === '"') {
        entry += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      values.push(entry.trim());
      entry = '';
    } else {
      entry += char;
    }
  }
  values.push(entry.trim());
  return values;
}

function unquoteCsvValue(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.replace(/""/g, '"');
}

function matchCategoryIdByName(
  categoryName: string | undefined,
  categories: Category[]
): string | undefined {
  if (!categoryName) return undefined;
  const trimmed = categoryName.trim();
  if (!trimmed || trimmed.toLowerCase() === 'other' || trimmed.toLowerCase() === 'uncategorized') {
    return undefined;
  }
  const byId = categories.find(c => c.id === trimmed);
  if (byId) return byId.id;
  const byName = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  return byName?.id;
}

export function parseCsvFile(csvText: string): CsvParsedTransaction[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  // Parse header
  const headers = splitCsvRow(lines[0]).map(h => unquoteCsvValue(h).trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('desc') || h.includes('payee'));
  const typeIdx = headers.findIndex(h => h.includes('type'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total'));
  const currencyIdx = headers.findIndex(h => h.includes('curr'));
  const categoryIdx = headers.findIndex(h => h.includes('cat'));
  const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('memo'));
  const idIdx = headers.findIndex(h => h === 'id' || h.endsWith(' id') || h.endsWith('_id'));

  const parsed: CsvParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const values = splitCsvRow(rawLine);

    const rawTitle = titleIdx !== -1 ? unquoteCsvValue(values[titleIdx]) : '';
    const title = rawTitle || `Transaction #${i}`;

    const rawAmountStr = amountIdx !== -1 ? unquoteCsvValue(values[amountIdx]) : '';
    let rawAmount = rawAmountStr ? parseFloat(rawAmountStr.replace(/[^0-9.-]/g, '')) : 0;

    let type: 'income' | 'expense' = 'expense';
    if (typeIdx !== -1 && values[typeIdx]) {
      const t = unquoteCsvValue(values[typeIdx]).toLowerCase();
      type = t.includes('in') || t.includes('credit') || t.includes('deposit') ? 'income' : 'expense';
    } else if (rawAmount < 0) {
      type = 'expense';
      rawAmount = Math.abs(rawAmount);
    }

    const txDateRaw = dateIdx !== -1 ? unquoteCsvValue(values[dateIdx]) : '';
    const txDate = txDateRaw || format(new Date(), 'yyyy-MM-dd');
    const currencyCode =
      (currencyIdx !== -1 ? unquoteCsvValue(values[currencyIdx]) : '') || 'EUR';
    const categoryName =
      categoryIdx !== -1 ? unquoteCsvValue(values[categoryIdx]) : '';
    const note = noteIdx !== -1 ? unquoteCsvValue(values[noteIdx]) : '';
    const explicitId = idIdx !== -1 ? unquoteCsvValue(values[idIdx]) : '';

    const matchedDefaultCatId = matchCategoryIdByName(categoryName, DEFAULT_CATEGORIES);
    const nowIso = new Date().toISOString();

    parsed.push({
      id: explicitId || 'tx_csv_' + crypto.randomUUID(),
      hasExplicitId: Boolean(explicitId),
      title,
      amount: Math.abs(rawAmount) || 0,
      currencyCode,
      type,
      categoryId: matchedDefaultCatId,
      categoryName: categoryName || undefined,
      transactionDate: txDate.slice(0, 10),
      note,
      createdAt: nowIso,
      updatedAt: nowIso
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
        sampleItems: txs
          .slice(0, 3)
          .map(t => `${t.transactionDate}: ${t.title} (${t.type === 'income' ? '+' : '-'}€${t.amount})`),
        rawPayload: data
      };
    } catch {
      throw new Error('Invalid JSON backup file structure.');
    }
  } else {
    // Treat as CSV
    const csvTxs = parseCsvFile(text);
    const dbCategories = await db.categories.toArray();
    const allKnownCategories = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORIES;

    for (const tx of csvTxs) {
      if (!tx.categoryId && tx.categoryName) {
        tx.categoryId = matchCategoryIdByName(tx.categoryName, allKnownCategories);
      }
    }

    return {
      type: 'csv',
      transactionCount: csvTxs.length,
      categoryCount: 0,
      recurringCount: 0,
      sampleItems: csvTxs
        .slice(0, 3)
        .map(t => `${t.transactionDate}: ${t.title} (${t.type === 'income' ? '+' : '-'}€${t.amount})`),
      rawPayload: csvTxs
    };
  }
}

export async function applyImport(
  preview: ParsedImportPreview,
  mode: 'merge' | 'replace'
): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.categories, db.recurringPayments, db.settings],
    async () => {
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
            const existing = await db.transactions.toArray();
            const existingIds = new Set(existing.map(t => t.id).filter(Boolean));
            const existingSignatures = new Set(
              existing.map(t => `${t.transactionDate}_${t.title}_${t.amount}`)
            );
            // Signatures of existing records that do not have an explicit ID
            const idlessExistingSignatures = new Set(
              existing.filter(t => !t.id).map(t => `${t.transactionDate}_${t.title}_${t.amount}`)
            );

            const toAdd: Transaction[] = [];
            for (const tx of data.transactions) {
              const sig = `${tx.transactionDate}_${tx.title}_${tx.amount}`;
              const hasId = Boolean(tx.id);

              if (hasId) {
                if (existingIds.has(tx.id)) continue;
                // Only fall back to signature deduplication if an existing record lacked an ID
                if (idlessExistingSignatures.has(sig)) continue;
                existingIds.add(tx.id);
                existingSignatures.add(sig);
                toAdd.push(tx);
              } else {
                if (existingSignatures.has(sig)) continue;
                const withId: Transaction = {
                  ...tx,
                  id: 'tx_' + crypto.randomUUID()
                };
                existingIds.add(withId.id);
                existingSignatures.add(sig);
                idlessExistingSignatures.add(sig);
                toAdd.push(withId);
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
        const rawCsvTxs = preview.rawPayload as CsvParsedTransaction[];
        if (mode === 'replace') {
          await db.categories.bulkAdd(DEFAULT_CATEGORIES);
          await db.settings.put(DEFAULT_SETTINGS);
        }

        const currentCategories = await db.categories.toArray();
        const normalizedTxs: (Transaction & { hasExplicitId?: boolean })[] = rawCsvTxs.map(tx => {
          const resolvedCategoryId =
            tx.categoryId || matchCategoryIdByName(tx.categoryName, currentCategories);
          const { categoryName: _catName, ...rest } = tx;
          return {
            ...(rest as Transaction),
            id: tx.id || 'tx_csv_' + crypto.randomUUID(),
            currencyCode: tx.currencyCode || 'EUR',
            categoryId: resolvedCategoryId
          };
        });

        if (mode === 'replace') {
          const cleanTxs: Transaction[] = normalizedTxs.map(({ hasExplicitId: _h, ...t }) => t);
          await db.transactions.bulkPut(cleanTxs);
        } else {
          const existing = await db.transactions.toArray();
          const existingIds = new Set(existing.map(t => t.id));
          const existingSignatures = new Set(
            existing.map(t => `${t.transactionDate}_${t.title}_${t.amount}`)
          );

          const toAdd: Transaction[] = [];
          for (const tx of normalizedTxs) {
            const { hasExplicitId, ...cleanTx } = tx;
            const sig = `${cleanTx.transactionDate}_${cleanTx.title}_${cleanTx.amount}`;
            if (existingIds.has(cleanTx.id)) continue;
            if (!hasExplicitId && existingSignatures.has(sig)) continue;
            existingIds.add(cleanTx.id);
            existingSignatures.add(sig);
            toAdd.push(cleanTx);
          }
          if (toAdd.length > 0) {
            await db.transactions.bulkAdd(toAdd);
          }
        }
      }
    }
  );
}

export async function resetDatabaseToDefaults(): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.recurringPayments, db.categories, db.settings],
    async () => {
      await db.transactions.clear();
      await db.recurringPayments.clear();
      await db.categories.clear();
      await db.settings.clear();
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
      await db.settings.put(DEFAULT_SETTINGS);
    }
  );
}
