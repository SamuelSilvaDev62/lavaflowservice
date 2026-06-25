import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-neo-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-neo)] active:translate-y-0 active:shadow-[var(--shadow-neo-inset)]",
        premium:
          "btn-premium",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-neo-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-neo)] active:translate-y-0 active:shadow-[var(--shadow-neo-inset)]",
        outline:
          "bg-card text-foreground shadow-[var(--shadow-neo-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-neo)] active:translate-y-0 active:shadow-[var(--shadow-neo-inset)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-neo-sm)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-neo)] active:translate-y-0 active:shadow-[var(--shadow-neo-inset)]",
        ghost: "hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 h-11 px-5 py-2 sm:min-h-10 sm:h-10",
        sm: "h-9 rounded-xl px-3 text-xs sm:h-8",
        lg: "min-h-12 h-12 rounded-2xl px-8",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
