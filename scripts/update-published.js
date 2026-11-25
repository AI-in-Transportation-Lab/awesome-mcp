// Track peer-reviewed publications about MCP through OpenAlex and merge them into
// data/published.json.
//
//   node scripts/update-published.js            newest 100 (daily job)
//   node scripts/update-published.js --pages 6  deeper crawl, e.g. for a backfill
//
// OpenAlex gives anonymous clients a small shared daily budget. Set OPENALEX_API_KEY
// (a free key) to get your own. If the request fails the existing file is kept and
// the script still exits 0, so a quota error never breaks the daily job.
import fs from "node:fs";
import { topicsOf } from "./lib/topics.js";

const FILE = new URL("../data/published.json", import.meta.url);
const API = "https://api.openalex.org/works";
const today = new Date().toISOString().slice(0, 10);

// Journal and conference papers that name the protocol in the abstract and say
// "MCP" or the full name in the title. Repositories (preprints) are excluded.
const FILTER = [
  'title_and_abstract.search:"model context protocol"',
  'title.search:mcp|"model context protocol"',
  "primary_location.source.type:journal|conference",
  `to_publication_date:${today}`,
].join(",");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const pages = Number(arg("pages", 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(n) {
  const params = new URLSearchParams({
    filter: FILTER,
    sort: "publication_date:desc",
    "per-page": "100",
    page: String(n),
    select: "id,doi,title,publication_date,type,primary_location,authorships,cited_by_count,open_access",
  });
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": "awesome-mcp-updater" } });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
  return (await res.json()).results;
}

const clean = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const shape = (w) => ({
  id: w.id.replace("https://openalex.org/", ""),
  title: clean(w.title),
  authors: (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean).slice(0, 12),
  published: w.publication_date,
  venue: clean(w.primary_location?.source?.display_name ?? ""),
  type: w.type,
  url: w.doi ?? `https://openalex.org/${w.id.replace("https://openalex.org/", "")}`,
  openAccess: Boolean(w.open_access?.is_oa),
  citedBy: w.cited_by_count ?? 0,
});

const existing = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
const byId = new Map(existing.map((p) => [p.id, p]));

try {
  let fetched = 0, added = 0;
  for (let n = 1; n <= pages; n++) {
    if (n > 1) await sleep(500);
    const results = await page(n);
    for (const w of results) {
      const p = shape(w);
      if (!p.title) continue;
      const prev = byId.get(p.id);
      byId.set(p.id, { ...p, added: prev?.added ?? today });
      if (!prev) added++;
    }
    fetched += results.length;
    if (results.length < 100) break;
  }
  console.log(`Fetched ${fetched}, added ${added}, total ${byId.size}`);
} catch (err) {
  console.warn(`OpenAlex update skipped: ${err.message}`);
}

const out = [...byId.values()]
  .map((p) => ({ ...p, topics: topicsOf(p.title) }))
  .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? "") || a.id.localeCompare(b.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
