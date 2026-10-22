import { useEffect, useId, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { resolveResponsive } from "../store";
import { stylesToCssWidgetContent } from "../style-utils";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavItem[];
}

export type NavLayout = "horizontal" | "vertical" | "dropdown";
export type NavPointer = "none" | "underline" | "overline" | "double-line" | "framed" | "background";
export type NavStickyMode = "none" | "sticky" | "fixed";

export interface NavMenuContent {
  items: NavItem[];
  layout: NavLayout;
  align: "left" | "center" | "right";
  pointer: NavPointer;
  color: string;
  hoverColor: string;
  activeColor: string;
  fontSize: number;
  fontWeight: number;
  gap: number;
  itemPaddingX: number;
  itemPaddingY: number;
  underlineOnHover: boolean;
  submenuBg: string;
  submenuColor: string;
  submenuHoverColor: string;
  submenuMinWidth: number;
  mobileBreakpoint: number;
  mobileAlign: "left" | "center" | "right";
  toggleColor: string;
  toggleSize: number;
  /** Espelhado na secção (barra de menu Elementor). */
  stickyMode: NavStickyMode;
}

const DEFAULTS: NavMenuContent = {
  items: [],
  layout: "horizontal",
  align: "center",
  pointer: "underline",
  color: "#0f172a",
  hoverColor: "#e63946",
  activeColor: "#e63946",
  fontSize: 15,
  fontWeight: 500,
  gap: 24,
  itemPaddingX: 4,
  itemPaddingY: 6,
  underlineOnHover: true,
  submenuBg: "#ffffff",
  submenuColor: "#0f172a",
  submenuHoverColor: "#e63946",
  submenuMinWidth: 180,
  mobileBreakpoint: 767,
  mobileAlign: "left",
  toggleColor: "#0f172a",
  toggleSize: 28,
  stickyMode: "none",
};

function resolveContent(c: Partial<NavMenuContent>, widget: WidgetNode, device: DeviceType): NavMenuContent {
  const typo = resolveResponsive(widget.styles.typography, device);
  const pointer: NavPointer =
    c.pointer ??
    (c.underlineOnHover === false ? "none" : c.underlineOnHover === true ? "underline" : DEFAULTS.pointer);

  return {
    items: c.items ?? DEFAULTS.items,
    layout: c.layout ?? DEFAULTS.layout,
    align: c.align ?? DEFAULTS.align,
    pointer,
    color: c.color ?? widget.styles.color ?? DEFAULTS.color,
    hoverColor: c.hoverColor ?? DEFAULTS.hoverColor,
    activeColor: c.activeColor ?? c.hoverColor ?? DEFAULTS.activeColor,
    fontSize: c.fontSize ?? typo?.fontSize ?? DEFAULTS.fontSize,
    fontWeight: c.fontWeight ?? typo?.fontWeight ?? DEFAULTS.fontWeight,
    gap: c.gap ?? DEFAULTS.gap,
    itemPaddingX: c.itemPaddingX ?? DEFAULTS.itemPaddingX,
    itemPaddingY: c.itemPaddingY ?? DEFAULTS.itemPaddingY,
    underlineOnHover: pointer !== "none",
    submenuBg: c.submenuBg ?? DEFAULTS.submenuBg,
    submenuColor: c.submenuColor ?? DEFAULTS.submenuColor,
    submenuHoverColor: c.submenuHoverColor ?? DEFAULTS.submenuHoverColor,
    submenuMinWidth: c.submenuMinWidth ?? DEFAULTS.submenuMinWidth,
    mobileBreakpoint: c.mobileBreakpoint ?? DEFAULTS.mobileBreakpoint,
    mobileAlign: c.mobileAlign ?? DEFAULTS.mobileAlign,
    toggleColor: c.toggleColor ?? DEFAULTS.toggleColor,
    toggleSize: c.toggleSize ?? DEFAULTS.toggleSize,
    stickyMode: c.stickyMode ?? DEFAULTS.stickyMode,
  };
}

function pointerCss(cls: string, pointer: NavPointer, hoverColor: string, activeColor: string): string {
  if (pointer === "none") return "";
  if (pointer === "underline" || pointer === "overline" || pointer === "double-line") {
    const edge = pointer === "overline" ? "top:0;bottom:auto" : "bottom:0;top:auto";
    const height = pointer === "double-line" ? 3 : 2;
    return `
.${cls} > li > a{position:relative}
.${cls} > li > a::after{content:"";position:absolute;left:0;${edge};width:100%;height:${height}px;background:${hoverColor};transform:scaleX(0);transform-origin:right;transition:transform .25s;${pointer === "double-line" ? "box-shadow:0 -2px 0 " + hoverColor : ""}}
.${cls} > li > a:hover::after,.${cls} > li > a.is-active::after{transform:scaleX(1);transform-origin:left}
.${cls} > li > a.is-active::after{background:${activeColor}}
`;
  }
  if (pointer === "framed") {
    return `
.${cls} > li > a{border:1px solid transparent;border-radius:4px;padding-left:10px;padding-right:10px}
.${cls} > li > a:hover,.${cls} > li > a.is-active{border-color:${hoverColor}}
.${cls} > li > a.is-active{border-color:${activeColor}}
`;
  }
  // background
  return `
.${cls} > li > a{border-radius:4px;padding-left:10px;padding-right:10px}
.${cls} > li > a:hover{background:${hoverColor}22;color:${hoverColor}}
.${cls} > li > a.is-active{background:${activeColor}22;color:${activeColor}}
`;
}

export function NavMenuWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const raw = widget.content as Partial<NavMenuContent>;
  const c = resolveContent(raw, widget, device);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const reactId = useId().replace(/:/g, "");
  const cls = `lov-nav-${widget.id.replace(/[^a-zA-Z0-9]/g, "")}-${reactId}`;

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${c.mobileBreakpoint}px)`);
    const sync = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [c.mobileBreakpoint]);

  const justify =
    c.align === "center" ? "center" : c.align === "right" ? "flex-end" : "flex-start";
  const mobileJustify =
    c.mobileAlign === "center" ? "center" : c.mobileAlign === "right" ? "flex-end" : "flex-start";

  const isDropdownLayout = c.layout === "dropdown";
  const isVertical = c.layout === "vertical";
  const collapsible = isMobile || isDropdownLayout;
  const menuOpen = !collapsible || open;

  const css = `
.${cls}-wrap{width:100%;display:flex;flex-direction:column;align-items:stretch}
.${cls}-toggle{display:none;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer;padding:6px;color:${c.toggleColor};align-self:${c.align === "center" ? "center" : c.align === "right" ? "flex-end" : "flex-start"}}
.${cls}-wrap.is-collapsible .${cls}-toggle{display:inline-flex}
.${cls}-wrap.is-collapsible .${cls}-panel{display:none;width:100%;margin-top:8px}
.${cls}-wrap.is-collapsible .${cls}-panel.is-open{display:block}
.${cls}-toggle svg{width:${c.toggleSize}px;height:${c.toggleSize}px}
.${cls}{display:flex;align-items:${isVertical ? "stretch" : "center"};gap:${c.gap}px;justify-content:${justify};list-style:none;padding:0;margin:0;flex-wrap:wrap;flex-direction:${isVertical ? "column" : "row"}}
.${cls} > li{position:relative}
.${cls} a{color:${c.color};font-size:${c.fontSize}px;font-weight:${c.fontWeight};text-decoration:none;display:inline-flex;align-items:center;gap:4px;padding:${c.itemPaddingY}px ${c.itemPaddingX}px;transition:color .15s,background .15s,border-color .15s}
.${cls} a:hover{color:${c.hoverColor}}
.${cls} a.is-active{color:${c.activeColor}}
${pointerCss(cls, c.pointer, c.hoverColor, c.activeColor)}
.${cls} ul{position:absolute;top:100%;left:0;background:${c.submenuBg};list-style:none;padding:8px 0;margin:0;min-width:${c.submenuMinWidth}px;box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:6px;opacity:0;visibility:hidden;transform:translateY(8px);transition:all .2s;z-index:50}
.${cls} li:hover > ul,.${cls} li:focus-within > ul{opacity:1;visibility:visible;transform:translateY(0)}
.${cls} ul a{padding:8px 16px;display:block;color:${c.submenuColor};width:100%}
.${cls} ul a:hover{color:${c.submenuHoverColor}}
.${cls} ul a::after{display:none !important}
@media (max-width: ${c.mobileBreakpoint}px) {
  .${cls}-wrap:not(.is-dropdown) .${cls}-toggle{display:inline-flex}
  .${cls}-wrap:not(.is-dropdown) .${cls}-panel{display:none;width:100%;margin-top:8px}
  .${cls}-wrap:not(.is-dropdown) .${cls}-panel.is-open{display:block}
  .${cls}{flex-direction:column;align-items:stretch;justify-content:${mobileJustify};gap:0;width:100%;background:${c.submenuBg};border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.1);padding:8px 0}
  .${cls} > li > a{width:100%;padding:10px 14px}
  .${cls} ul{position:static;opacity:1;visibility:visible;transform:none;box-shadow:none;min-width:0;padding:0 0 0 12px;background:transparent}
}
`;

  const outer = stylesToCssWidgetContent(widget.styles, device);
  const wrapClass = [
    `${cls}-wrap`,
    isDropdownLayout ? "is-dropdown is-collapsible" : "",
    isMobile && !isDropdownLayout ? "is-collapsible" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav style={outer} aria-label="Menu de navegação">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className={wrapClass}>
        {collapsible ? (
          <button
            type="button"
            className={`${cls}-toggle`}
            aria-expanded={menuOpen}
            aria-controls={`${cls}-panel`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </button>
        ) : null}
        <div id={`${cls}-panel`} className={`${cls}-panel${menuOpen ? " is-open" : ""}`}>
          <ul className={cls}>
            {c.items.map((item) => (
              <NavItemRender key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function NavItemRender({ item }: { item: NavItem }) {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const href = item.href || "#";
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (!href.startsWith("#") || href === "#") {
        setIsActive(false);
        return;
      }
      setIsActive(window.location.hash === href);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [href]);

  return (
    <li>
      <a href={href} className={isActive ? "is-active" : undefined}>
        {item.label}
        {hasChildren ? <ChevronDown size={14} aria-hidden /> : null}
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
