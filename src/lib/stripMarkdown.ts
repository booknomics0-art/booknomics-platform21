export const stripMarkdown = (s: string = "") =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
