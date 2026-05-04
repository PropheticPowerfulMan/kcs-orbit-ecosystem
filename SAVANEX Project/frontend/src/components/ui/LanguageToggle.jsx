import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const setLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('savanex_lang', lng);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-github-border bg-slate-900/55 px-2 py-1 backdrop-blur">
      <button
        onClick={() => setLanguage('en')}
        className={`rounded-lg px-3 py-1 text-xs font-semibold ${i18n.language === 'en' ? 'bg-kcs-blue text-slate-950' : 'text-slate-300'}`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('fr')}
        className={`rounded-lg px-3 py-1 text-xs font-semibold ${i18n.language === 'fr' ? 'bg-kcs-blue text-slate-950' : 'text-slate-300'}`}
      >
        FR
      </button>
    </div>
  );
};

export default LanguageToggle;
