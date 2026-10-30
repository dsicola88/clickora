import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWidgetMotionRuntime, widgetMotionClassNames } from "./components/WidgetMotionShell";
import type { WidgetNode } from "./types";
import { createWidget } from "./factory";

function makeWidget(effects: WidgetNode["effects"]): WidgetNode {
  const w = createWidget("heading");
  w.effects = effects;
  return w;
}

describe("widget motion runtime", () => {
  let observe: ReturnType<typeof vi.fn>;
  let unobserve: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let ioCallback: IntersectionObserverCallback | null;

  beforeEach(() => {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    ioCallback = null;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          ioCallback = cb;
        }
        observe = observe;
        unobserve = unobserve;
        disconnect = disconnect;
        takeRecords = () => [];
        root = null;
        rootMargin = "";
        thresholds = [];
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds scroll entrance classes for Pro-style widgets", () => {
    const w = makeWidget({ entranceAnimation: "fadeInUp", entranceTrigger: "scroll" });
    const cls = widgetMotionClassNames(w);
    expect(cls).toContain("pb-ent-scroll");
    expect(cls).toContain(`pb-m_`);
  });

  it("marks element in-view via IntersectionObserver", () => {
    const el = document.createElement("div");
    el.className = "pb-ent-scroll";
    document.body.appendChild(el);
    const w = makeWidget({ entranceAnimation: "zoomIn", entranceTrigger: "scroll" });

    renderHook(() => useWidgetMotionRuntime(el, w));
    expect(observe).toHaveBeenCalledWith(el);

    act(() => {
      ioCallback?.(
        [
          {
            isIntersecting: true,
            target: el,
            intersectionRatio: 1,
            boundingClientRect: el.getBoundingClientRect(),
            intersectionRect: el.getBoundingClientRect(),
            rootBounds: null,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(el.classList.contains("pb-in-view")).toBe(true);
    el.remove();
  });

  it("applies mouse tilt CSS variables", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(el);
    const w = makeWidget({ mouseTilt: true, mouseTiltMaxDeg: 10 });

    renderHook(() => useWidgetMotionRuntime(el, w));
    act(() => {
      el.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 50, bubbles: true }),
      );
    });
    expect(el.style.getPropertyValue("--pb-ry")).not.toBe("");
    el.remove();
  });
});
