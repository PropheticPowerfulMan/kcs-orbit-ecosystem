import { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "min-w-0 rounded-lg border border-border bg-card/90 text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-[#071824]/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_48px_rgba(0,0,0,0.34)]",
      className
    )}
    {...props}
  />
);
