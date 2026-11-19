import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CookiePolicyInlineSheet } from "./CookiePolicyInlineSheet";

describe("CookiePolicyInlineSheet", () => {
  it("abre in-page, sem link externo e sem marca SaaS (fuga de confiança)", () => {
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
    expect(screen.queryByText(/clickora|dclickora|tiktok|meta,/i)).toBeNull();
    expect(screen.getByText(/product privacy|seller/i)).toBeInTheDocument();
  });
});
