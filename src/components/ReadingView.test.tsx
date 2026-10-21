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

  it("renders every Godan प्रमुख विषय #### subheading boldly as a semantic h4, not a paragraph", () => {
    const content = [
      "## गहन विश्लेषण",
      "### 10. प्रमुख विषय",
      "#### कर्ज़ और महाजनी व्यवस्था",
      "कर्ज़ उपन्यास में एक घटना नहीं, स्थायी संरचना है।",
      "",
      "#### जाति और पंचायत",
      "सामाजिक व्यवस्था गरीब परिवार पर नैतिक अनुशासन लागू करती है।",
      "",
      "#### किसान और श्रम",
      "होरी मेहनती है, फिर भी मेहनत आर्थिक सुरक्षा की गारंटी नहीं देती।",
      "",
      "#### स्त्री और निर्णय",
      "धनिया और झुनिया अपने फैसले स्वयं लेने वाली नैतिक शक्तियाँ हैं।",
    ].join("\n");
    const { container } = render(<ReadingView language="hi" content={content} />);
    const names = ["कर्ज़ और महाजनी व्यवस्था", "जाति और पंचायत", "किसान और श्रम", "स्त्री और निर्णय"];
    for (const name of names) {
      const h4 = screen.getByRole("heading", { name, level: 4 });
      expect(h4.classList.contains("rv-h4")).toBe(true);
      expect(h4.style.fontWeight).toBe("800");
      expect(h4.id).toMatch(/^rv-chapter-\d+$/);
      expect(container.querySelector(`a[href="#${h4.id}"]`)).toHaveTextContent(name);
    }
    expect(container.querySelectorAll(".rv-prose h4.rv-h4")).toHaveLength(4);
    expect(screen.getByText(/कर्ज़ उपन्यास में एक घटना नहीं/).tagName).toBe("P");
  });

  it("applies bold h4 headings and section anchors to English books too", () => {
    const { container } = render(<ReadingView language="en" content={"## Deeper analysis\n\n### Major themes\n\n#### Debt and labor\n\nThe story explores structural debt."} />);
    const heading = screen.getByRole("heading", { name: "Debt and labor", level: 4 });
    expect(heading.style.fontWeight).toBe("800");
    expect(container.querySelector(`a[href="#${heading.id}"]`)).toBeTruthy();
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

  it("numbers fourteen chapters and marks nested sections alphabetically", () => {
    const chapters = Array.from({ length: 14 }, (_, i) =>
      `## Chapter ${i + 1}\n\nDistinct chapter text ${i + 1}.`
    ).join("\n\n");
    const content = `${chapters}\n\n### First point\n\nDetails.\n\n### Second point\n\nMore details.`;
    const { container } = render(<ReadingView content={content} language="en" title="Example" />);
    const links = [...container.querySelectorAll(".rv-toc-list a")];
    expect(links).toHaveLength(16);
    expect(links[0].textContent).toContain("1.Chapter 1");
    expect(links[13].textContent).toContain("14.Chapter 14");
    expect(links[14].textContent).toContain("A.First point");
    expect(links[15].textContent).toContain("B.Second point");
    expect(links[13].closest("li")?.classList.contains("rv-toc-main")).toBe(true);
    for (const link of links) {
      const target = link.getAttribute("href");
      expect(target?.startsWith("#rv-chapter-")).toBe(true);
      expect(container.querySelector(target!)).toBeTruthy();
    }
  });

  it("uses A/B subpoints under a Hindi chapter", () => {
    const { container } = render(
      <ReadingView content={"## कहानी\n\nकथा।\n\n### पात्र\n\nएक पात्र।\n\n### विचार\n\nएक विचार।"} language="hi" />,
    );
    const labels = [...container.querySelectorAll(".rv-toc-list a")].map(x => x.textContent);
    expect(labels).toEqual(["1.कहानी", "A.पात्र", "B.विचार"]);
  });
});
