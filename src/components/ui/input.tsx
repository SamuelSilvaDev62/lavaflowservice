import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-2xl px-4 py-2 text-base text-foreground transition-all duration-200 placeholder:text-muted-foreground/70 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground neo-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-[inset_2px_2px_4px_var(--neo-dark),inset_-2px_-2px_4px_var(--neo-light),0_0_0_3px_color-mix(in_oklab,var(--color-primary)_15%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
