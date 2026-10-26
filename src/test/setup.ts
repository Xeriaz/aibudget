import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { db } from '../db/db';
import i18n from '../i18n';

// Stub ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

beforeEach(async () => {
  await Promise.all([
    db.transactions.clear(),
    db.categories.clear(),
    db.recurringPayments.clear(),
    db.settings.clear()
  ]);
  localStorage.clear();
  await i18n.changeLanguage('en');

  // Stub browser APIs commonly used across flows
  if (typeof window !== 'undefined') {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  }
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => true),
      configurable: true,
      writable: true
    });
  }
  if (typeof URL !== 'undefined') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
