import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  centered?: boolean;
};

export function PageHeader({ title, description, actions, centered = false }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0 ${centered ? "text-center sm:text-center sm:flex-col" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl break-words">{title}</h1>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground md:text-base">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div
          className={`flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:max-w-none sm:flex-none [&_button]:shrink-0 [&_button]:whitespace-nowrap ${
            centered ? "justify-center sm:justify-center" : "justify-end"
          }`}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
