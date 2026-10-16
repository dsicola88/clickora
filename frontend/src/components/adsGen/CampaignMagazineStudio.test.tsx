import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CampaignMagazineStudio } from "./CampaignMagazineStudio";
import { fixtureBundle, fixtureResearch } from "@/test/fixtures/keywordResearchFixture";

describe("CampaignMagazineStudio", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "navigator",
      {
        ...navigator,
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      } as Navigator,
    );
  });

  it("mostra copy estilo PDF com contadores de caracteres", () => {
    const { container } = render(
      <CampaignMagazineStudio
        research={fixtureResearch}
        tab="copy"
        onTabChange={() => {}}
        bundle={fixtureBundle}
        issues={fixtureResearch.validation ?? []}
        onBundleChange={() => {}}
        query=""
        onQueryChange={() => {}}
        intent="ALL"
        onIntentChange={() => {}}
        selected={new Set()}
        onSelectedChange={() => {}}
        onEditKeyword={() => {}}
        onCopyKeywords={() => {}}
        onCopySelected={() => {}}
        onExportKeywordsCsv={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "PV V2" })).toBeInTheDocument();
    expect(screen.getByText("Títulos")).toBeInTheDocument();
    expect(screen.getByText("PV V2 Official Site")).toBeInTheDocument();
    expect(screen.getByText(/18\/30/)).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
