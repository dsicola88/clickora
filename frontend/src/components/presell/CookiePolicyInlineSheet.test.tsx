import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CookiePolicyInlineSheet } from "./CookiePolicyInlineSheet";

describe("CookiePolicyInlineSheet", () => {
  it("abre in-page e não oferece link externo merchant (fuga)", () => {
    render(
      <CookiePolicyInlineSheet
        language="en"
        open
        onClose={() => {}}
        policyUrl="https://tryvisivra.com/terms-of-privacy?aff_id=1"
      />,
    );
    expect(screen.getByTestId("cookie-policy-inline-sheet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/new tab/i)).toBeNull();
  });
});
