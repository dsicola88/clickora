import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqContent {
  items: FaqItem[];
  allowMultiple: boolean;
  defaultOpen: number;
  itemBg: string;
  itemBorderColor: string;
  questionColor: string;
  answerColor: string;
  accentColor: string;
}

export function FaqWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<FaqContent>;
  const items = c.items ?? [];
  const allowMultiple = c.allowMultiple ?? false;
  const defaultOpen = c.defaultOpen ?? 0;
  const itemBg = c.itemBg ?? "#ffffff";
  const itemBorderColor = c.itemBorderColor ?? "#e5e7eb";
  const questionColor = c.questionColor ?? "#111827";
  const answerColor = c.answerColor ?? "#4b5563";
  const accentColor = c.accentColor ?? "#e63946";

  const [open, setOpen] = useState<Set<number>>(
    () => new Set(defaultOpen >= 0 && defaultOpen < items.length ? [defaultOpen] : []),
  );

  const toggle = (idx: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else {
        if (!allowMultiple) next.clear();
        next.add(idx);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione perguntas no painel de propriedades.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...stylesToCss(widget.styles, device),
      }}
    >
      {items.map((item, idx) => {
        const isOpen = open.has(idx);
        return (
          <div
            key={item.id}
            style={{
              background: itemBg,
              border: `1px solid ${isOpen ? accentColor : itemBorderColor}`,
              borderRadius: 8,
              overflow: "hidden",
              transition: "border-color 0.2s",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(idx);
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
                textAlign: "left",
                color: questionColor,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <span>{item.question}</span>
              <span
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accentColor,
                  fontSize: 18,
                  fontWeight: 700,
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                +
              </span>
            </button>
            <div
              style={{
                maxHeight: isOpen ? 600 : 0,
                overflow: "hidden",
                transition: "max-height 0.3s ease",
              }}
            >
              <div
                style={{
                  padding: "0 20px 16px",
                  color: answerColor,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: item.answer }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
