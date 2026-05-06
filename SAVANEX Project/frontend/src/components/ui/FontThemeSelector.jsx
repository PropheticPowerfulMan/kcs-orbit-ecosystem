import React, { useMemo, useState } from 'react';
import { Type } from 'lucide-react';
import {
  applyFontTheme,
  FONT_THEMES,
  FONT_THEME_STORAGE_KEY,
  getStoredFontTheme,
} from '../../constants/fontThemes';

const selectClass = 'rounded-xl border border-github-border bg-slate-900/50 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition hover:border-kcs-blue/50 focus:border-kcs-blue';

const FontThemeSelector = () => {
  const [fontTheme, setFontTheme] = useState(() => getStoredFontTheme());

  const activeTheme = useMemo(
    () => FONT_THEMES.find((theme) => theme.id === fontTheme) || FONT_THEMES[0],
    [fontTheme]
  );

  const previewStyle = useMemo(() => {
    if (fontTheme === 'editorial') {
      return { fontFamily: 'Fraunces, Source Serif 4, serif' };
    }

    if (fontTheme === 'lab') {
      return { fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif' };
    }

    return { fontFamily: 'Poppins, Manrope, sans-serif' };
  }, [fontTheme]);

  const handleChange = (event) => {
    const nextTheme = event.target.value;
    setFontTheme(nextTheme);
    window.localStorage.setItem(FONT_THEME_STORAGE_KEY, nextTheme);
    applyFontTheme(nextTheme);
  };

  return (
    <label className="flex items-center gap-2 rounded-xl border border-github-border bg-slate-900/40 px-2.5 py-2 text-slate-200 backdrop-blur sm:px-3">
      <Type size={15} className="text-kcs-blue" />
      <div className="hidden min-w-0 flex-col md:flex">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Police</span>
        <span className="truncate text-[11px] text-slate-400" style={previewStyle}>{activeTheme.preview}</span>
      </div>
      <select
        value={fontTheme}
        onChange={handleChange}
        className={selectClass}
        style={previewStyle}
        aria-label="Choisir la police de l'application"
        title={`Police active: ${activeTheme.label}`}
      >
        {FONT_THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default FontThemeSelector;