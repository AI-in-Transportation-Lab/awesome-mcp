// Awesome MCP site. Plain ES modules; all data comes from ./data/*.json.
const $ = (id) => document.getElementById(id);
const PAGE = 30;

/** Build an element. Text always goes through textContent, so data can never inject HTML. */
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("aria-")) { node.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

const getJSON = (path) =>
  fetch(path).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });

const state = { q: "", cat: "servers", year: "all", shown: PAGE };
let meta, papers, cats, bench;

// ---------- search helpers ----------
const terms = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (haystack) => {
  const t = terms();
  const s = haystack.toLowerCase();
  return t.every((w) => s.includes(w));
};
function highlight(text) {
  const t = terms();
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? h("mark", {}, part) : part));
}

// ---------- resources ----------
const resourceText = (it) => [it.name, it.description, ...(it.tags ?? []), it.official ? "official" : ""].join(" ");
function resourceMatches(catId) {
  const c = cats.find((x) => x.id === catId);
  return c.items.filter((it) => !state.q || matches(resourceText(it)));
}

function renderCategories() {
  const all = cats.reduce((n, c) => n + resourceMatches(c.id).length, 0);
  const chip = (id, label, n) =>
    h("button", { class: "chip", type: "button", role: "tab", "aria-selected": state.cat === id, onclick: () => { state.cat = id; renderResources(); } },
      label, h("small", {}, String(n)));
  $("cats").replaceChildren(chip("all", "All", all), ...cats.map((c) => chip(c.id, c.title, resourceMatches(c.id).length)));
}

function renderResources() {
  renderCategories();
  const cat = cats.find((c) => c.id === state.cat);
  $("cat-desc").textContent = cat ? cat.description : "Everything we list, across all categories.";
  const pool = state.cat === "all" ? cats : [cat];
  const rows = pool.flatMap((c) => resourceMatches(c.id).map((it) => ({ it, c })));
  $("resource-list").replaceChildren(
    ...rows.map(({ it, c }) =>
      h("li", {},
        h("div", { class: "item-title" },
          h("a", { href: it.url, rel: "noopener" }, highlight(it.name)),
          it.official && h("span", { class: "badge official" }, "official"),
          state.cat === "all" && h("span", { class: "badge" }, c.title)),
        h("p", { class: "item-desc" }, highlight(it.description)),
        it.tags?.length > 0 &&
          h("div", { class: "tags" }, it.tags.map((t) => h("button", { class: "tag", type: "button", onclick: () => setQuery(t) }, t))))));
  $("resource-empty").hidden = rows.length > 0;
  renderStats();
}

// ---------- papers ----------
const paperText = (p) => [p.title, (p.authors ?? []).join(" "), p.summary ?? "", p.id].join(" ");
const paperPool = () =>
  papers.filter((p) => (state.year === "all" || (p.published ?? "").startsWith(state.year)) && (!state.q || matches(paperText(p))));

function renderYears() {
  const years = [...new Set(papers.map((p) => (p.published ?? "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const inQuery = (y) => papers.filter((p) => (p.published ?? "").startsWith(y) && (!state.q || matches(paperText(p)))).length;
  const chip = (y, label, n) =>
    h("button", { class: "chip", type: "button", "aria-pressed": state.year === y, onclick: () => { state.year = y; state.shown = PAGE; renderPapers(); } },
      label, h("small", {}, String(n)));
  $("years").replaceChildren(
    chip("all", "All years", papers.filter((p) => !state.q || matches(paperText(p))).length),
    ...years.map((y) => chip(y, y, inQuery(y))));
}

function renderPapers() {
  renderYears();
  const pool = paperPool();
  const authors = (p) => (p.authors?.length > 4 ? `${p.authors.slice(0, 4).join(", ")} et al.` : (p.authors ?? []).join(", "));
  $("paper-list").replaceChildren(
    ...pool.slice(0, state.shown).map((p) =>
      h("li", {},
        h("div", { class: "item-title" }, h("a", { href: p.url, rel: "noopener" }, highlight(p.title))),
        h("div", { class: "meta" }, [p.published, authors(p), p.category && `arXiv:${p.id} [${p.category}]`].filter(Boolean).join(" · ")),
        p.summary && h("details", { class: "abs" }, h("summary", {}, "Abstract"), h("p", {}, p.summary)))));
  $("paper-empty").hidden = pool.length > 0;
  const more = $("more");
  more.hidden = pool.length <= state.shown;
  more.textContent = `Show more (${pool.length - state.shown} left)`;
  renderStats();
}

// ---------- benchmark ----------
const BENCH = [
  ["tcp-msgpack", "Raw TCP + MessagePack"],
  ["zenoh-pubsub", "Zenoh pub/sub"],
  ["dds-cyclone", "DDS (Cyclone) pub/sub"],
  ["grpc-unary", "gRPC unary (Protobuf)"],
  ["jsonrpc-stdio", "JSON-RPC 2.0 over stdio, no SDK"],
  ["mcp-stdio-res", "MCP stdio resources/read, small object"],
  ["mcp-stdio", "MCP stdio tools/call"],
  ["mcp-shttp", "MCP Streamable HTTP tools/call"],
];
function renderBenchmark() {
  const T = bench.transport_us;
  const max = Math.max(...BENCH.map(([k]) => T[k].median_us.median));
  const ms = (us) => (us / 1000).toFixed(2);
  $("bench-sub").textContent = `Echo of a 50-detection perception frame over loopback. Median of ${bench.runs} runs on ${bench.machine}.`;
  $("bench").replaceChildren(
    h("div", { class: "bench-wrap" },
      h("table", { class: "bench-table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Path"), h("th", {}, "Payload (B)"), h("th", {}, "Median (ms)"), h("th", {}, "p99 (ms)"), h("th", { class: "barcell" }, ""))),
        h("tbody", {}, BENCH.map(([k, label]) =>
          h("tr", {},
            h("td", {}, label),
            h("td", {}, T[k].payload_bytes.toLocaleString("en-US")),
            h("td", {}, ms(T[k].median_us.median)),
            h("td", {}, ms(T[k].p99_us.median)),
            h("td", { class: "barcell", "aria-hidden": "true" },
              h("div", { class: "bar-track" }, h("div", { class: `bar-fill${k.startsWith("mcp") ? " mcp" : ""}`, style: `width:${(T[k].median_us.median / max) * 100}%` })))))))));
}

// ---------- cite ----------
function renderCite() {
  const p = meta.paper;
  const bib = `@article{chhetri${p.year}model,
  title   = {${p.title}},
  author  = {${p.authors.join(" and\n            ")}},
  journal = {arXiv preprint arXiv:${p.arxiv}},
  year    = {${p.year}}
}`;
  $("bibtex").textContent = bib;
  $("copy").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(bib); e.target.textContent = "Copied"; }
    catch { e.target.textContent = "Select and copy"; }
    setTimeout(() => (e.target.textContent = "Copy"), 1800);
  });
}

// ---------- wiring ----------
function renderStats() {
  const nRes = cats.reduce((n, c) => n + resourceMatches(c.id).length, 0);
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  const nPap = papers.filter((p) => !state.q || matches(paperText(p))).length;
  $("stats").textContent = state.q
    ? `${nPap} of ${papers.length} papers and ${nRes} of ${total} resources match.`
    : `${papers.length} papers · ${total} resources · updated daily`;
}

function setQuery(value) {
  $("q").value = value;
  onQuery();
  $("q").scrollIntoView({ block: "center", behavior: "smooth" });
}

function onQuery() {
  state.q = $("q").value.trim();
  const url = new URL(location.href);
  if (state.q) url.searchParams.set("q", state.q); else url.searchParams.delete("q");
  history.replaceState(null, "", url);
  state.shown = PAGE;
  if (state.q) state.cat = "all";
  else if (state.cat === "all") state.cat = cats[0].id;
  renderResources();
  renderPapers();
}

async function main() {
  [meta, papers, cats, bench] = await Promise.all([
    getJSON("data/meta.json"), getJSON("data/papers.json"), getJSON("data/resources.json"), getJSON("data/benchmark.json"),
  ]);
  $("tagline").textContent = meta.tagline;
  state.cat = cats[0].id;
  renderResources();
  renderPapers();
  renderBenchmark();
  renderCite();
  $("q").addEventListener("input", onQuery);
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { $("q").value = initial; onQuery(); }
  $("more").addEventListener("click", () => { state.shown += PAGE; renderPapers(); });
}

main().catch((err) => {
  console.error(err);
  $("stats").textContent = "Could not load the data. Please refresh, or browse the lists on GitHub.";
});
