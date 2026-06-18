import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "./lib/cn.js";

export type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
