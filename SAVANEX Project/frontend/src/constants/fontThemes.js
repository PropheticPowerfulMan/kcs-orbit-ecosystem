export const FONT_THEME_STORAGE_KEY = 'savanex_font_theme';

export const FONT_THEMES = [
  {
    id: 'modern',
    label: 'Modern KCS',
    preview: 'Manrope / Poppins',
  },
  {
    id: 'editorial',
    label: 'Editorial Serif',
    preview: 'Source Serif 4 / Fraunces',
  },
  {
    id: 'lab',
    label: 'Data Lab',
    preview: 'IBM Plex Sans / Space Grotesk',
  },
];

export function normalizeFontTheme(themeId) {
  return FONT_THEMES.some((theme) => theme.id === themeId) ? themeId : FONT_THEMES[0].id;
}

export function getStoredFontTheme() {
  if (typeof window === 'undefined') {
    return FONT_THEMES[0].id;
  }

  return normalizeFontTheme(window.localStorage.getItem(FONT_THEME_STORAGE_KEY));
}

export function applyFontTheme(themeId) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-font-theme', normalizeFontTheme(themeId));
}