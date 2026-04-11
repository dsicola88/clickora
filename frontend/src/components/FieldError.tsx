import { cn } from "@/lib/utils";

interface FieldErrorProps {
  message?: string;
  className?: string;
}

export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className={cn("text-xs text-destructive mt-1 animate-in fade-in slide-in-from-top-1 duration-200", className)}>
      {message}
    </p>
  );
}
