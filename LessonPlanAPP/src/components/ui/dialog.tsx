import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./button";

export const Dialog = ({
  open,
  title,
  children,
  onClose,
  size = "default"
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "preview" | "message" | "compact";
}) => {
  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/80 p-2 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className={`glass flex w-full flex-col overflow-hidden rounded-lg border-cyan-300/20 p-3 sm:p-4 ${
              size === "preview"
                ? "h-[96dvh] max-h-[96dvh] max-w-[98vw] sm:w-[96vw] lg:h-[94dvh] lg:w-[92vw] xl:w-[88vw] 2xl:w-[82vw]"
                : size === "message"
                  ? "h-[77dvh] w-[77vw] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)]"
                  : size === "compact"
                    ? "max-h-[min(88dvh,420px)] max-w-[min(92vw,520px)]"
                    : "max-h-[96dvh] max-w-[min(96vw,1180px)]"
            }`}
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, scale: 0.98 }}
          >
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <h2 className="min-w-0 truncate font-display text-lg font-bold text-white sm:text-xl">{title}</h2>
              <Button variant="ghost" onClick={onClose} aria-label="Close">
                <X size={18} />
              </Button>
            </div>
            <div className="min-w-0 flex-1 overflow-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(dialog, document.body);
};
