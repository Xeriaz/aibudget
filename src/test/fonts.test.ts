import { describe, it, expect, beforeEach } from 'vitest';
import { AVAILABLE_FONTS, DEFAULT_FONT_ID, getSavedFont, applyFont, FONT_STORAGE_KEY } from '../lib/fonts';

describe('Font Preferences & Switching (Local User Isolation)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-sans');
    if (document.body) {
      document.body.style.fontFamily = '';
    }
  });

  it('provides 5 popular font options including the default Plus Jakarta Sans', () => {
    expect(AVAILABLE_FONTS.length).toBe(5);
    const ids = AVAILABLE_FONTS.map(f => f.id);
    expect(ids).toContain('plus-jakarta-sans');
    expect(ids).toContain('inter');
    expect(ids).toContain('roboto');
    expect(ids).toContain('poppins');
    expect(ids).toContain('system');
  });

  it('falls back to default font if none is saved in localStorage', () => {
    expect(getSavedFont()).toBe(DEFAULT_FONT_ID);
  });

  it('retrieves saved font from localStorage if valid', () => {
    localStorage.setItem(FONT_STORAGE_KEY, 'inter');
    expect(getSavedFont()).toBe('inter');
  });

  it('applies font to CSS custom property --font-sans and body, and persists to localStorage', () => {
    applyFont('poppins');
    const poppinsOption = AVAILABLE_FONTS.find(f => f.id === 'poppins')!;

    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe('poppins');
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(poppinsOption.family);
    expect(document.body.style.fontFamily).toBe(poppinsOption.family);
  });

  it('switches to native system font cleanly', () => {
    applyFont('system');
    const systemOption = AVAILABLE_FONTS.find(f => f.id === 'system')!;

    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(systemOption.family);
  });
});
