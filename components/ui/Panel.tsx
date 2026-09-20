import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "float" | "glass" | "overlay" | "solid";
}

const variantStyles = {
  float: "border border-surface-border bg-surface-primary/95 shadow-panel",
  glass: "bg-surface-primary/80",
  overlay: "bg-surface-primary/90",
  solid: "border border-surface-border bg-surface-primary shadow-panel",
};

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ variant = "float", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-theme backdrop-blur-md",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

Panel.displayName = "Panel";

export default Panel;
