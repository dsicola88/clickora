import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresellMarketingOverlays } from "./PresellMarketingOverlays";

const TRACK = "https://api.example.com/api/track/r/11111111-1111-4111-8111-111111111111";

function leaveViewport() {
  act(() => {
    document.documentElement.dispatchEvent(new MouseEvent("mouseleave", { clientY: 0, bubbles: true }));
  });
}

describe("PresellMarketingOverlays — popup de saída honesto", () => {
  const assign = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    assign.mockReset();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      search: "?gclid=G1",
      assign,
    } as unknown as Location);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("«Fechar» e o fundo só fecham — nunca navegam para a oferta", () => {
    render(
      <PresellMarketingOverlays pageId="p1" settings={{ exitPopup: true }} trackHref={TRACK} language="en" />,
    );
    leaveViewport();
    fireEvent.click(screen.getByTestId("presell-exit-close"));
    expect(screen.queryByTestId("presell-exit-sheet")).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("fundo fecha sem navegar", () => {
    render(
      <PresellMarketingOverlays pageId="p2" settings={{ exitPopup: true }} trackHref={TRACK} language="en" />,
    );
    leaveViewport();
    fireEvent.click(screen.getByTestId("presell-exit-backdrop"));
    expect(screen.queryByTestId("presell-exit-sheet")).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("CTA é link nativo para /track/r/ com os parâmetros do anúncio", () => {
    render(
      <PresellMarketingOverlays pageId="p3" settings={{ exitPopup: true }} trackHref={TRACK} language="en" />,
    );
    leaveViewport();
    const cta = screen.getByTestId("presell-exit-cta");
    expect(cta.tagName).toBe("A");
    expect(cta.getAttribute("href")).toContain("/track/r/");
    expect(cta.getAttribute("href")).toContain("gclid=G1");
  });

  it("contador e «prova social» legados não renderizam nada", () => {
    vi.useFakeTimers();
    const { container } = render(
      <PresellMarketingOverlays
        pageId="p4"
        settings={{ countdownTimer: true, socialProof: true, countdownDurationMinutes: 5 }}
        trackHref={TRACK}
        language="pt"
      />,
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(container.innerHTML).toBe("");
    vi.useRealTimers();
  });
});
