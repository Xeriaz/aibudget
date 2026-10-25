import { describe, it, expect } from 'vitest';
import {
  db,
  initializeDatabase,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS
} from '../db/db';
import { makeCategory, makeSettings } from './factories';

describe('Flow 1: Database Initialization & Persistence', () => {
  it('seeds default categories and settings on an empty database', async () => {
    expect(await db.categories.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);

    await initializeDatabase();

    const categories = await db.categories.toArray();
    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(categories.map(c => c.id)).toEqual(
      expect.arrayContaining(DEFAULT_CATEGORIES.map(c => c.id))
    );

    const settings = await db.settings.get('current');
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('is idempotent and preserves existing categories and modified settings', async () => {
    await initializeDatabase();

    // Add a custom category and customize settings
    const customCat = makeCategory({ id: 'cat-custom', name: 'Pets' });
    await db.categories.add(customCat);

    const updatedSettings = makeSettings({
      selectedFramework: '60/20/20',
      useManualSalary: true,
      manualSalary: 3200
    });
    await db.settings.put(updatedSettings);

    // Re-run initializeDatabase
    await initializeDatabase();

    const categories = await db.categories.toArray();
    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(await db.categories.get('cat-custom')).toEqual(customCat);

    const persistedSettings = await db.settings.get('current');
    expect(persistedSettings).toEqual(updatedSettings);
  });
});
