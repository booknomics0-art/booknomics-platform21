// Reader regression coverage: never lose author/character emphasis when text is Hindi.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReadingView from "./ReadingView";

describe("bilingual editorial reader", () => {
  it("preserves every intended bold character label, not only the first two", () => {
    const { container } = render(
      <ReadingView language="hi" content={"## मुख्य विचार\n\n**होरी** संघर्ष करता है, **धनिया** निर्णय लेती है, **गोबर** बदलाव चाहता है और **झुनिया** अपनी गरिमा बचाती है।"} />,
    );
    const bold = [...container.querySelectorAll("strong")].map((node) => node.textContent);
    expect(bold).toEqual(expect.arrayContaining(["होरी", "धनिया", "गोबर", "झुनिया"]));
  });

  it("offers a collapsible Hindi contents with anchors for chapters and subheadings", () => {
    const { container } = render(
      <ReadingView language="hi" content={"## विस्तृत सारांश\n\nकहानी का संदर्भ।\n\n### प्रमुख पात्र\n\nहोरी और धनिया।\n\n## गहन विश्लेषण\n\nवर्ग और न्याय की जाँच।"} />,
    );
    const details = container.querySelector("details.rv-toc") as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText(/विषय-सूची/));
    expect(details.open).toBe(true);
    expect(container.querySelector('a[href="#rv-chapter-1"]')).toBeTruthy();
    expect(container.querySelector("#rv-chapter-2")).toBeTruthy();
    expect(container.querySelector("#rv-chapter-3")).toBeTruthy();
  });

  it("keeps an actual analytical paragraph under the deeper-analysis heading", () => {
    render(<ReadingView language="hi" content={"## गहन विश्लेषण\n\nश्रम और संपत्ति का असंतुलन व्यक्ति के चुनाव सीमित करता है।"} />);
    expect(screen.getByRole("heading", { name: "जो पहली नज़र में छूट जाता है" })).toBeTruthy();
    expect(screen.getByText(/श्रम और संपत्ति का असंतुलन/)).toBeTruthy();
  });

  it("supports English book summaries with the same outline navigation", () => {
    const { container } = render(
      <ReadingView language="en" content={"## Detailed summary\n\nWhat happened.\n\n### Main characters\n\nThe characters matter.\n\n## Deeper analysis\n\nWhat it means."} />,
    );
    expect(screen.getByText(/Table of contents/)).toBeTruthy();
    expect(container.querySelectorAll("a[href^='#rv-chapter-']")).toHaveLength(3);
  });
});
