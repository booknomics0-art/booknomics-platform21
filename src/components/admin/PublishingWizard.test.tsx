import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublishingWizard } from "./PublishingWizard";
import { adminGetBook, adminUpdateBook } from "@/lib/adminApi";

vi.mock("@/lib/adminApi", () => ({
  adminGetBook: vi.fn(),
  adminUpdateBook: vi.fn(),
}));
vi.mock("@/components/admin/BookAssetsEditor", () => ({ BookAssetsEditor: () => <div>Assets</div> }));

const source = {
  id: "176b3e49-c7a8-462a-95cb-9c756bbf4c1b",
  title: "$100M Leads", author: "Alex Hormozi", category: "Marketing", language: "en",
  slug: "100m-leads-alex-hormozi-summary", seo_slug: null, tagline: null,
  overview: "Real live overview", key_ideas: "Real book insights",
  deep_summary: "Real full journey", deep_analysis: "Real deeper analysis",
  daily_application: "Real application", action_system: "Real action system",
  practice_tracker: "Real tracker", reflection_questions: "Real reflections",
  real_life_example: "Real example", affiliate_link: null, cover_url: null,
  reading_time: 7, rating: 4.5, year: null,
};

describe("full-content publishing wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminGetBook).mockResolvedValue(source);
  });

  it("fetches the actual complete D1 book and exposes deep content", async () => {
    render(<PublishingWizard initial={{ id: source.id, title: source.title }} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByDisplayValue("Real live overview")).toBeTruthy();
    expect(adminGetBook).toHaveBeenCalledWith(source.id);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Deep reading" }), { button: 0, ctrlKey: false });
    expect(screen.getByDisplayValue("Real full journey")).toBeTruthy();
    expect(screen.getByDisplayValue("Real deeper analysis")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Action & mastery" }), { button: 0, ctrlKey: false });
    expect(screen.getByDisplayValue("Real tracker")).toBeTruthy();
    expect(screen.getByDisplayValue("Real reflections")).toBeTruthy();
  });

  it("saves one edited field with the original value as a conflict guard", async () => {
    const onSaved = vi.fn();
    vi.mocked(adminUpdateBook).mockResolvedValue({ ...source, overview: "Edited overview" });
    render(<PublishingWizard initial={{ id: source.id, title: source.title }} onSaved={onSaved} onClose={vi.fn()} />);
    const textarea = await screen.findByDisplayValue("Real live overview");
    fireEvent.change(textarea, { target: { value: "Edited overview" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to live book" }));
    await waitFor(() => {
      expect(adminUpdateBook).toHaveBeenCalledWith(source.id,
        { overview: "Edited overview" }, { expected: { overview: "Real live overview" } });
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByDisplayValue("Edited overview")).toBeTruthy();
    expect(screen.getByText("No unsaved changes")).toBeTruthy();
  });
});
