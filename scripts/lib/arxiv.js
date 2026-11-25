// Minimal arXiv API client (Atom feed). No dependencies; needs Node 18+ for fetch.
const API = "https://export.arxiv.org/api/query";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const clean = (s) => decode(s).replace(/\s+/g, " ").trim();
const pick = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? clean(m[1]) : "";
};

/** Strip the host and version: http://arxiv.org/abs/2508.19239v2 -> 2508.19239 */
export function arxivId(url) {
  return url.replace(/^.*\/abs\//, "").replace(/v\d+$/, "");
}

export function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const id = arxivId(pick(e, "id"));
    return {
      id,
      title: pick(e, "title"),
      authors: [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => clean(m[1])),
      published: pick(e, "published").slice(0, 10),
      category: (e.match(/<arxiv:primary_category[^>]*term="([^"]+)"/) || [])[1] || "",
      summary: pick(e, "summary"),
      url: `https://arxiv.org/abs/${id}`,
    };
  });
}

async function get(params, attempts = 4) {
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "awesome-mcp-updater (github.com/AI-in-Transportation-Lab/awesome-mcp)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseFeed(await res.text());
    } catch (err) {
      if (i === attempts) throw err;
      await sleep(5000 * i);
    }
  }
}

/** Newest-first search, `pages` pages of `pageSize` results. */
export async function search(query, { pages = 1, pageSize = 100 } = {}) {
  const out = [];
  for (let p = 0; p < pages; p++) {
    if (p) await sleep(3500); // arXiv asks for one request every 3 seconds
    const batch = await get({
      search_query: query,
      start: p * pageSize,
      max_results: pageSize,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

/** Look up specific papers by id, in chunks. */
export async function byIds(ids, chunk = 50) {
  const out = [];
  for (let i = 0; i < ids.length; i += chunk) {
    if (i) await sleep(3500);
    out.push(...(await get({ id_list: ids.slice(i, i + chunk).join(","), max_results: chunk })));
  }
  return out;
}
