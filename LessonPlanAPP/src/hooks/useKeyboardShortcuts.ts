import { useEffect } from "react";

export const useKeyboardShortcuts = (actions: { save?: () => void; undo?: () => void; redo?: () => void; print?: () => void }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === "s" && actions.save) {
        event.preventDefault();
        actions.save();
      }
      if (event.key.toLowerCase() === "z" && !event.shiftKey && actions.undo) {
        event.preventDefault();
        actions.undo();
      }
      if ((event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) && actions.redo) {
        event.preventDefault();
        actions.redo();
      }
      if (event.key.toLowerCase() === "p" && actions.print) {
        event.preventDefault();
        actions.print();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions]);
};
