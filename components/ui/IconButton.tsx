import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  danger?: boolean;
  size?: "xs" | "sm" | "md";
}

function stateClasses(size: string, active?: boolean, danger?: boolean): string {
  const compact = size === "xs";
  if (danger) {
    return compact
      ? "text-content-faint hover:text-red-400"
      : "text-content-secondary hover:bg-surface-raised hover:text-red-400";
  }
  if (active) {
    return compact
      ? "text-accent-400 hover:text-accent-300"
      : "text-accent-400 hover:bg-surface-raised hover:text-accent-300";
  }
  return compact
    ? "text-content-faint hover:text-content-primary"
    : "text-content-secondary hover:bg-surface-raised hover:text-content-primary";
}

const sizeStyles = {
  xs: "rounded p-0.5",
  sm: "rounded-md p-1.5",
  md: "rounded-md p-2",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active, danger, size = "md", className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        sizeStyles[size],
        "transition-colors",
        stateClasses(size, active, danger),
        disabled && "cursor-not-allowed opacity-30",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = "IconButton";

export default IconButton;
