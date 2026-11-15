import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentationChoiceModal } from "./SegmentationChoiceModal";

const copy = {
  title: "What would you like to see first?",
  reviewLabel: "View Review",
  officialLabel: "Official Page",
  closeLabel: "Close",
  allowClose: true,
  reviewUrl: "",
  officialUrl: "",
};

describe("SegmentationChoiceModal", () => {
  it("renderiza título e CTAs com hrefs rastreáveis", () => {
    render(
      <SegmentationChoiceModal
        copy={copy}
        reviewHref="https://api.example/track/r/1?to=https%3A%2F%2Fa.test&co_seg=review"
        officialHref="https://api.example/track/r/1?to=https%3A%2F%2Fb.test&co_seg=official"
        dismissed={false}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId("presell-segmentation-sheet")).toBeTruthy();
    expect(screen.getByText("What would you like to see first?")).toBeTruthy();
    const review = screen.getByTestId("presell-segmentation-review");
    const official = screen.getByTestId("presell-segmentation-official");
    expect(review.getAttribute("href")).toContain("co_seg=review");
    expect(official.getAttribute("href")).toContain("co_seg=official");
  });

  it("Close dispara onDismiss e Escape também", () => {
    const onDismiss = vi.fn();
    render(
      <SegmentationChoiceModal
        copy={copy}
        reviewHref="https://offer.example/"
        officialHref="https://offer.example/"
        dismissed={false}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByTestId("presell-segmentation-close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("não renderiza quando dismissed", () => {
    render(
      <SegmentationChoiceModal
        copy={copy}
        reviewHref="https://offer.example/"
        officialHref="https://offer.example/"
        dismissed
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByTestId("presell-segmentation-sheet")).toBeNull();
  });
});
