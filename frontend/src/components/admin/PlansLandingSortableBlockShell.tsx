import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export type PlansLandingSortableBlockShellRenderProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  dragHandleProps: HTMLAttributes<HTMLButtonElement> & { "aria-label": string; type: "button" };
};

type Props = {
  id: string;
  children: (props: PlansLandingSortableBlockShellRenderProps) => ReactNode;
};

/** Item sortável: passe `setNodeRef` + `style` ao contentor e `dragHandleProps` ao botão do grip. */
export function PlansLandingSortableBlockShell({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  };
  const dragHandleProps: PlansLandingSortableBlockShellRenderProps["dragHandleProps"] = {
    ...attributes,
    ...listeners,
    type: "button",
    "aria-label": "Arrastar para reordenar",
    className: cn(
      "inline-flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground touch-none",
      "hover:bg-muted/55 active:cursor-grabbing",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
  };
  return <>{children({ setNodeRef, style, isDragging, dragHandleProps })}</>;
}
