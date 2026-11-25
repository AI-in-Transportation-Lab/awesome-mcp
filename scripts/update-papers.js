// Fetch new MCP papers from the arXiv API and merge them into data/papers.json.
//
//   node scripts/update-papers.js              newest 100 results (daily job)
//   node scripts/update-papers.js --pages 8    deeper crawl, e.g. for a backfill
//
// Existing entries are never removed or rewritten, except that entries missing
// metadata (authors, date, summary) are enriched from the arXiv API.
import fs from "node:fs";
import { search, byIds } from "./lib/arxiv.js";

const FILE = new URL("../data/papers.json", import.meta.url);
// Papers that mention the protocol by name. Add more clauses here to widen the net.
const QUERY = 'all:"model context protocol"';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const pages = Number(arg("pages", 1));
const today = new Date().toISOString().slice(0, 10);

const papers = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
const byId = new Map(papers.map((p) => [p.id, p]));

// 1. Enrich entries that only have an id and a title.
const bare = papers.filter((p) => !p.published).map((p) => p.id);
if (bare.length) {
  console.log(`Enriching ${bare.length} entries from the arXiv API`);
  for (const meta of await byIds(bare)) Object.assign(byId.get(meta.id), meta);
}

// 2. Add anything new.
const found = await search(QUERY, { pages });
let added = 0;
for (const p of found) {
  if (byId.has(p.id)) continue;
  byId.set(p.id, { ...p, added: today });
  added++;
}
console.log(`Fetched ${found.length}, added ${added}, total ${byId.size}`);

const out = [...byId.values()].sort(
  (a, b) => (b.published || "").localeCompare(a.published || "") || b.id.localeCompare(a.id)
);
fs.mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
