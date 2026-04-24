import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function LegalDocLayout({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
          <span className="text-border">|</span>
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
        </div>
      </header>
      <main className={cn("mx-auto max-w-3xl px-4 py-10 prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20", className)}>
        {children}
      </main>
    </div>
  );
}
