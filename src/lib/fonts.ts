export type FontFamilyId = 'plus-jakarta-sans' | 'inter' | 'roboto' | 'poppins' | 'system';

export interface FontOption {
  id: FontFamilyId;
  name: string;
  family: string;
  description: string;
}

export const FONT_STORAGE_KEY = 'aibudget_font';

export const AVAILABLE_FONTS: FontOption[] = [
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Modern geometric sans with lively accents (Default)'
  },
  {
    id: 'inter',
    name: 'Inter',
    family: '"Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Clean, neutral, high-legibility UI standard'
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: '"Roboto", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Friendly & balanced Google design classic'
  },
  {
    id: 'poppins',
    name: 'Poppins',
    family: '"Poppins", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    description: 'Soft geometric curves with rounded charm'
  },
  {
    id: 'system',
    name: 'System Default',
    family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    description: 'Native device font (Apple SF Pro / Segoe UI / Roboto)'
  }
];

export const DEFAULT_FONT_ID: FontFamilyId = 'plus-jakarta-sans';

export function getSavedFont(): FontFamilyId {
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY);
    if (saved && AVAILABLE_FONTS.some((f) => f.id === saved)) {
      return saved as FontFamilyId;
    }
  } catch {
    // LocalStorage might fail in restricted environments
  }
  return DEFAULT_FONT_ID;
}

export function applyFont(fontId: FontFamilyId) {
  const font = AVAILABLE_FONTS.find((f) => f.id === fontId) || AVAILABLE_FONTS[0];
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--font-sans', font.family);
    if (document.body) {
      document.body.style.fontFamily = font.family;
    }
  }
  try {
    localStorage.setItem(FONT_STORAGE_KEY, font.id);
  } catch {
    // LocalStorage might fail in restricted environments
  }
}
