// Shared loaders for the files under data/.
import fs from "node:fs";

export const ROOT = new URL("../../", import.meta.url);
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), "utf8"));

export const loadMeta = () => read("data/meta.json");
export const loadPapers = () => read("data/papers.json");
export const loadBenchmark = () => read("benchmark/results/macbook-m4-pro/aggregate.json");

/** Resource categories, ordered by their `order` field. */
export function loadCategories() {
  const dir = new URL("data/resources/", ROOT);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(new URL(f, dir), "utf8")))
    .sort((a, b) => a.order - b.order);
}

export const authorLine = (authors = [], max = 3) =>
  authors.length > max ? `${authors.slice(0, max).join(", ")} et al.` : authors.join(", ");

/** Escape characters that would break a Markdown table cell. */
export const cell = (s = "") => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
