import jsPDF from "jspdf";

interface Book { title: string; author: string; language?: string; practice_tracker?: string | null; }

// Extract day-wise tasks from markdown table or list, fallback to generic 7 days.
const extractDays = (md: string | null | undefined, isHi: boolean): string[] => {
  const fallback = isHi
    ? ["आज का task पूरा करें", "Practice repeat करें", "Progress note करें", "1 reflection लिखें", "Habit improve करें", "Track + adjust", "Reflect + plan"]
    : ["Start: do today's task", "Repeat the practice", "Write progress note", "Add 1 reflection", "Improve the habit", "Track + adjust", "Reflect + plan ahead"];
  if (!md) return fallback;
  const lines = md.split("\n").map(l => l.trim());
  const days: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\|?\s*(?:Day\s*)?(\d|दिन\s*\d)[^|]*\|\s*([^|]+)\|/i);
    if (m) days.push(m[2].replace(/\*\*/g, "").trim());
  }
  if (days.length >= 5) return days.slice(0, 7);
  // try list pattern "Day 1: ..."
  const listed: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(?:[-*]\s*)?(?:Day|दिन)\s*\d+\s*[:\-–]\s*(.+)/i);
    if (m) listed.push(m[1].replace(/\*\*/g, "").trim());
  }
  return listed.length >= 5 ? listed.slice(0, 7) : fallback;
};

export const downloadTrackerPdf = (book: Book) => {
  const isHi = book.language === "hi";
  const days = extractDays(book.practice_tracker, isHi);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  // Header band
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("BOOKINSIGHT  ·  7-DAY PRACTICE TRACKER", M, 38);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  const safeTitle = book.title.replace(/[^\x00-\x7F]/g, ""); // jsPDF default font lacks Devanagari
  doc.text(safeTitle || "Practice Tracker", M, 68);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`by ${book.author}`, M, 82);

  // Subtitle
  doc.setTextColor(40);
  doc.setFontSize(11);
  doc.text("Print this page. Tick a box each day. Small steps compound.", M, 120);

  // Table header
  const startY = 150;
  const rowH = 78;
  doc.setDrawColor(220);
  doc.setLineWidth(0.6);

  for (let i = 0; i < 7; i++) {
    const y = startY + i * rowH;
    // Row card
    doc.setFillColor(250, 248, 244);
    doc.roundedRect(M, y, W - M * 2, rowH - 12, 8, 8, "F");

    // Day label circle
    doc.setFillColor(212, 175, 55);
    doc.circle(M + 28, y + 32, 18, "F");
    doc.setTextColor(28, 25, 23);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(String(i + 1), M + 28, y + 37, { align: "center" });

    // Task text
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`DAY ${i + 1}`, M + 60, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11.5);
    doc.setTextColor(28, 25, 23);
    const task = days[i] || (isHi ? "अपना task पूरा करें" : "Complete today's task");
    const safeTask = task.replace(/[^\x00-\x7F\u0900-\u097F]/g, "").replace(/[\u0900-\u097F]+/g, ""); // strip non-Latin to avoid box glyphs
    const finalTask = safeTask.trim() || (i < days.length ? `Day ${i + 1} practice` : "Today's practice");
    const wrapped = doc.splitTextToSize(finalTask, W - M * 2 - 180);
    doc.text(wrapped, M + 60, y + 40);

    // Checkboxes
    const cbY = y + 22;
    const cbX = W - M - 110;
    doc.setDrawColor(180);
    ["Done", "Note"].forEach((lbl, k) => {
      doc.rect(cbX + k * 55, cbY, 14, 14);
      doc.setFontSize(9); doc.setTextColor(110);
      doc.setFont("helvetica", "normal");
      doc.text(lbl, cbX + k * 55 + 18, cbY + 11);
    });

    // Notes line
    doc.setDrawColor(225);
    doc.line(M + 60, y + 58, W - M - 16, y + 58);
  }

  // Footer
  const fy = startY + 7 * rowH + 6;
  doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(120);
  doc.text("Consistency > Perfection.  Reflect on Day 7 and start your next 7-day cycle.", M, fy);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("BookInsight AI", W - M, fy, { align: "right" });

  const slug = (book.title || "tracker").toLowerCase().replace(/[^\x00-\x7F]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tracker";
  doc.save(`${slug}-7day-tracker.pdf`);
};
