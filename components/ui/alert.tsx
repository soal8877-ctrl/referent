import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm grid grid-cols-[1rem_1fr] gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground border-border",
        destructive:
          "bg-rose-50 text-rose-900 border-rose-200 [&>svg]:text-rose-600 dark:bg-rose-950/50 dark:text-rose-100 dark:border-rose-800/80 dark:[&>svg]:text-rose-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium tracking-tight col-start-2", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm col-start-2 grid min-w-0 justify-items-start gap-1 break-words text-rose-800 dark:text-rose-100/90 [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

function AlertIcon() {
  return <AlertCircle aria-hidden />;
}

export { Alert, AlertTitle, AlertDescription, AlertIcon };
