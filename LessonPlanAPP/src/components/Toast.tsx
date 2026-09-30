import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface ToastContextValue {
  notify: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState("");

  const value = useMemo(
    () => ({
      notify: (next: string) => {
        setMessage(next);
        window.setTimeout(() => setMessage(""), 2600);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {message && (
          <motion.div
            className="theme-dark-panel fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border border-cyan-300/25 bg-[#071824]/95 px-4 py-3 text-sm font-semibold text-[#e7faff] shadow-fluent"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <CheckCircle2 className="text-emerald-300" size={18} />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
};
