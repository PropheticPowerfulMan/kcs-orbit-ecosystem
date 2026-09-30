import { DependencyList, useEffect } from "react";

export const useDebouncedEffect = (callback: () => void, deps: DependencyList, delay = 650) => {
  useEffect(() => {
    const handle = window.setTimeout(callback, delay);
    return () => window.clearTimeout(handle);
  }, deps);
};
