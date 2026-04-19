import { ChevronDown } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavItem[];
}

export interface NavMenuContent {
  items: NavItem[];
  align: "left" | "center" | "right";
  color: string;
  hoverColor: string;
  fontSize: number;
  fontWeight: number;
  gap: number;
  underlineOnHover: boolean;
}

export function NavMenuWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<NavMenuContent>;
  const items = c.items ?? [];
  const align = c.align ?? "left";
  const color = c.color ?? "#0f172a";
  const hoverColor = c.hoverColor ?? "#e63946";
  const fontSize = c.fontSize ?? 15;
  const fontWeight = c.fontWeight ?? 500;
  const gap = c.gap ?? 24;
  const underlineOnHover = c.underlineOnHover ?? true;

  const cls = `lov-nav-${widget.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const css = `
.${cls}{display:flex;align-items:center;gap:${gap}px;justify-content:${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"};list-style:none;padding:0;margin:0;flex-wrap:wrap}
.${cls} > li{position:relative}
.${cls} a{color:${color};font-size:${fontSize}px;font-weight:${fontWeight};text-decoration:none;display:inline-flex;align-items:center;gap:4px;padding:6px 0;transition:color .15s;${underlineOnHover ? "position:relative" : ""}}
.${cls} a:hover{color:${hoverColor}}
${underlineOnHover ? `.${cls} a::after{content:"";position:absolute;left:0;bottom:0;width:100%;height:2px;background:${hoverColor};transform:scaleX(0);transform-origin:right;transition:transform .25s}.${cls} a:hover::after{transform:scaleX(1);transform-origin:left}` : ""}
.${cls} ul{position:absolute;top:100%;left:0;background:#fff;list-style:none;padding:8px 0;margin:0;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:6px;opacity:0;visibility:hidden;transform:translateY(8px);transition:all .2s;z-index:50}
.${cls} li:hover > ul{opacity:1;visibility:visible;transform:translateY(0)}
.${cls} ul a{padding:8px 16px;display:block}
.${cls} ul a::after{display:none}
`;

  return (
    <nav style={stylesToCss(widget.styles, device)}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ul className={cls}>
        {items.map((item) => (
          <NavItemRender key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  );
}

function NavItemRender({ item }: { item: NavItem }) {
  const hasChildren = item.children && item.children.length > 0;
  return (
    <li>
      <a href={item.href || "#"}>
        {item.label}
        {hasChildren ? <ChevronDown size={14} /> : null}
      </a>
      {hasChildren ? (
        <ul>
          {item.children!.map((child) => (
            <li key={child.id}>
              <a href={child.href || "#"}>{child.label}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
