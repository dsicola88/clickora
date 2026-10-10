import { createContext, useContext, type ReactNode } from "react";
import type { WidgetNode } from "./types";

export interface NestedRenderApi {
  depth: number;
  sectionId: string;
  columnId: string;
  containerId: string;
  render: (widget: WidgetNode, index: number) => ReactNode;
}

const NestedRenderContext = createContext<NestedRenderApi | null>(null);

export const NestedRenderProvider = NestedRenderContext.Provider;

export function useNestedRender() {
  return useContext(NestedRenderContext);
}
