import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import type { WidgetNode } from "../types";
import {
  motionClassName,
  resolveWidgetEffects,
  widgetHasMotion,
  widgetNeedsMotionRuntime,
} from "../widget-motion";
import { WidgetInlineStyle } from "../widget-custom-css";
import { cn } from "@/lib/utils";

/** Classes CSS de motion (entrada scroll, loop, fx layer). */
export function widgetMotionClassNames(widget: WidgetNode): string {
  if (!widgetHasMotion(widget.effects, widget.content)) return "";
  const e = resolveWidgetEffects(widget.effects, widget.content);
  const entrance = (e.entranceAnimation || "none").trim();
  const scrollEntrance = entrance !== "none" && e.entranceTrigger !== "load";
  const cont = (e.continuousAnimation || "none").trim();
  const scrollFx = (e.scrollingEffect || "none").trim();
  const useFx = e.mouseTilt || e.mouseTrack || (scrollFx && scrollFx !== "none");
  return cn(
    motionClassName(widget.id),
    scrollEntrance && "pb-ent-scroll",
    cont !== "none" && "pb-loop",
    useFx && "pb-fx",
  );
}

/** Sticky inline style (público). No editor costuma desligar-se. */
export function widgetStickyStyle(
  widget: WidgetNode,
  editorMode = false,
): CSSProperties | undefined {
  const e = resolveWidgetEffects(widget.effects, widget.content);
  if (!e.sticky || editorMode) return undefined;
  return {
    position: "sticky",
    top: Math.max(0, e.stickyOffsetPx ?? 0),
    zIndex: 20,
  };
}

/**
 * Runtime: IntersectionObserver, mouse tilt/track, scrolling effects.
 */
export function useWidgetMotionRuntime(
  element: HTMLElement | null,
  widget: WidgetNode,
): void {
  const effects = resolveWidgetEffects(widget.effects, widget.content);
  const needsRuntime = widgetNeedsMotionRuntime(widget.effects, widget.content);

  const entrance = (effects.entranceAnimation || "none").trim();
  const scrollEntrance = entrance !== "none" && effects.entranceTrigger !== "load";
  const scrollFx = (effects.scrollingEffect || "none").trim();

  const applyScrollFx = useCallback(() => {
    if (!element || !scrollFx || scrollFx === "none") return;
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const mid = rect.top + rect.height / 2;
    let t = (mid - vh / 2) / (vh / 2);
    t = Math.max(-1, Math.min(1, t));
    if (effects.scrollingReverse) t = -t;
    const speed = Math.max(0, Math.min(100, effects.scrollingSpeed ?? 40)) / 100;
    const amp = speed * 48;

    let tx = "0px";
    let ty = "0px";
    let rot = "0deg";
    let sc = "1";
    let op = "1";
    let bl = "0px";

    switch (scrollFx) {
      case "vertical":
        ty = `${(-t * amp).toFixed(2)}px`;
        break;
      case "horizontal":
        tx = `${(t * amp).toFixed(2)}px`;
        break;
      case "rotate":
        rot = `${(t * amp * 0.35).toFixed(2)}deg`;
        break;
      case "scale":
        sc = (1 + Math.abs(t) * speed * 0.18).toFixed(3);
        break;
      case "transparency":
        op = Math.max(0.25, 1 - Math.abs(t) * speed * 0.75).toFixed(3);
        break;
      case "blur":
        bl = `${(Math.abs(t) * speed * 8).toFixed(2)}px`;
        break;
      default:
        break;
    }

    element.style.setProperty("--pb-tx", tx);
    element.style.setProperty("--pb-ty", ty);
    element.style.setProperty("--pb-rot", rot);
    element.style.setProperty("--pb-sc", sc);
    element.style.setProperty("--pb-op", op);
    element.style.setProperty("--pb-bl", bl);
  }, [element, scrollFx, effects.scrollingReverse, effects.scrollingSpeed]);

  useEffect(() => {
    if (!element || !needsRuntime) return;

    let io: IntersectionObserver | null = null;
    if (scrollEntrance) {
      const threshold = Math.max(0, Math.min(1, (effects.entranceThreshold ?? 12) / 100));
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              element.classList.add("pb-in-view");
              if (effects.entranceOnce !== false) io?.unobserve(element);
            } else if (effects.entranceOnce === false) {
              element.classList.remove("pb-in-view");
            }
          }
        },
        { threshold, rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(element);
    }

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyScrollFx);
    };
    if (scrollFx && scrollFx !== "none") {
      applyScrollFx();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }

    const onMove = (ev: MouseEvent) => {
      if (!effects.mouseTilt && !effects.mouseTrack) return;
      const box = element.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const nx = Math.max(-1, Math.min(1, (ev.clientX - cx) / (box.width / 2 || 1)));
      const ny = Math.max(-1, Math.min(1, (ev.clientY - cy) / (box.height / 2 || 1)));
      if (effects.mouseTilt) {
        const max = Math.max(1, effects.mouseTiltMaxDeg ?? 8);
        element.style.setProperty("--pb-ry", `${(nx * max).toFixed(2)}deg`);
        element.style.setProperty("--pb-rx", `${(-ny * max).toFixed(2)}deg`);
      }
      if (effects.mouseTrack) {
        const px = Math.max(1, effects.mouseTrackPx ?? 12);
        element.style.setProperty("--pb-tx", `${(nx * px).toFixed(2)}px`);
        element.style.setProperty("--pb-ty", `${(ny * px).toFixed(2)}px`);
      }
    };
    const onLeave = () => {
      element.style.setProperty("--pb-rx", "0deg");
      element.style.setProperty("--pb-ry", "0deg");
      if (effects.mouseTrack && (!scrollFx || scrollFx === "none")) {
        element.style.setProperty("--pb-tx", "0px");
        element.style.setProperty("--pb-ty", "0px");
      }
    };
    if (effects.mouseTilt || effects.mouseTrack) {
      element.addEventListener("mousemove", onMove);
      element.addEventListener("mouseleave", onLeave);
    }

    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      element.removeEventListener("mousemove", onMove);
      element.removeEventListener("mouseleave", onLeave);
    };
  }, [
    element,
    needsRuntime,
    scrollEntrance,
    effects.entranceThreshold,
    effects.entranceOnce,
    effects.mouseTilt,
    effects.mouseTrack,
    effects.mouseTiltMaxDeg,
    effects.mouseTrackPx,
    scrollFx,
    applyScrollFx,
    widget.id,
    widget.effects,
  ]);
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(value);
      else (r as { current: T }).current = value;
    }
  };
}

type ShellProps = {
  widget: WidgetNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  children: ReactNode;
  editorMode?: boolean;
  outerRef?: Ref<HTMLDivElement>;
};

/** Invólucro público: CSS motion + runtime (scroll / mouse / sticky). */
export function WidgetMotionShell({
  widget,
  className,
  style,
  id,
  children,
  editorMode = false,
  outerRef,
}: ShellProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useWidgetMotionRuntime(node, widget);

  return (
    <div
      ref={mergeRefs(setNode, outerRef)}
      id={id}
      className={cn(className, widgetMotionClassNames(widget))}
      style={{ ...style, ...widgetStickyStyle(widget, editorMode) }}
    >
      <WidgetInlineStyle widget={widget} />
      {children}
    </div>
  );
}
