import { createContext, ReactNode, useContext, useLayoutEffect, useMemo, useState } from "react";
import { schoolImage } from "../data/defaults";
import { Language } from "../types/lesson";

interface AppContextValue {
  dark: boolean;
  language: Language;
  imageUrl: string;
  toggleDark: () => void;
  setLanguage: (language: Language) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [dark, setDark] = useState(() => localStorage.getItem("plp:theme") ? localStorage.getItem("plp:theme") === "dark" : true);
  const [language, setLanguageState] = useState<Language>("en");
  const imageUrl = schoolImage;

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    localStorage.setItem("plp:theme", dark ? "dark" : "light");
  }, [dark]);



  const value = useMemo<AppContextValue>(
    () => ({
      dark,
      language,
      imageUrl,
      toggleDark: () => setDark((value) => {
        const next = !value;
        document.documentElement.classList.toggle("dark", next);
        document.documentElement.style.colorScheme = next ? "dark" : "light";
        return next;
      }),
      setLanguage: setLanguageState
    }),
    [dark, language]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
};
