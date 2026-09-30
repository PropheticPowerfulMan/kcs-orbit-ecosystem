import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "box-border h-10 min-w-0 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none backdrop-blur-md transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  />
);

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "box-border min-h-24 min-w-0 w-full resize-y rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none backdrop-blur-md transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  />
);

export const Select = ({ className, ...props }: InputHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "box-border h-10 min-w-0 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none backdrop-blur-md transition focus:border-primary focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  />
);
