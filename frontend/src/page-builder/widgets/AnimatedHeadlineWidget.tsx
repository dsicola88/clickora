import { useEffect, useMemo, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface AnimatedHeadlineContent {
  prefix: string;
  rotatingWords: string[];
  suffix: string;
  animation: "fade" | "slide" | "typed" | "highlight";
  intervalMs: number;
  tag: "h1" | "h2" | "h3";
  highlightColor: string;
}

export function AnimatedHeadlineWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<AnimatedHeadlineContent>;
  const prefix = c.prefix ?? "Construa páginas";
  const words = useMemo(
    () => (c.rotatingWords?.length ? c.rotatingWords : ["incríveis", "rápidas", "que vendem"]),
    [c.rotatingWords],
  );
  const suffix = c.suffix ?? "em minutos.";
  const animation = c.animation ?? "fade";
  const intervalMs = c.intervalMs ?? 2200;
  const Tag = (c.tag ?? "h2") as "h1" | "h2" | "h3";
  const highlightColor = c.highlightColor ?? "#e63946";

  const [index, setIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(words[0] ?? "");

  // Cycle through words
  useEffect(() => {
    if (words.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(t);
  }, [words.length, intervalMs]);

  // Typed animation: char-by-char
  useEffect(() => {
    if (animation !== "typed") {
      setDisplayedText(words[index] ?? "");
      return;
    }
    const target = words[index] ?? "";
    let i = 0;
    setDisplayedText("");
    const t = setInterval(() => {
      i += 1;
      setDisplayedText(target.slice(0, i));
      if (i >= target.length) clearInterval(t);
    }, 60);
    return () => clearInterval(t);
  }, [index, animation, words]);

  const css = stylesToCss(widget.styles, device);
  const word = words[index] ?? "";

  const renderWord = () => {
    switch (animation) {
      case "slide":
        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              color: highlightColor,
              animation: "lov-ah-slide 0.5s ease-out",
            }}
          >
            {word}
          </span>
        );
      case "typed":
        return (
          <span style={{ color: highlightColor }}>
            {displayedText}
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "0.9em",
                background: highlightColor,
                marginLeft: 2,
                verticalAlign: "middle",
                animation: "lov-ah-blink 1s steps(1) infinite",
              }}
            />
          </span>
        );
      case "highlight":
        return (
          <span
            key={index}
            style={{
              background: `linear-gradient(120deg, ${highlightColor}40 0%, ${highlightColor}40 100%)`,
              backgroundSize: "100% 0.4em",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "0 88%",
              color: "inherit",
              padding: "0 4px",
            }}
          >
            {word}
          </span>
        );
      case "fade":
      default:
        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              color: highlightColor,
              animation: "lov-ah-fade 0.5s ease-out",
            }}
          >
            {word}
          </span>
        );
    }
  };

  return (
    <>
      <style>{`
        @keyframes lov-ah-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lov-ah-slide { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lov-ah-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      `}</style>
      <Tag style={{ margin: 0, ...css }}>
        {prefix} {renderWord()} {suffix}
      </Tag>
    </>
  );
}
