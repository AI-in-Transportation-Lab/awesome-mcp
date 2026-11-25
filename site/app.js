// Awesome MCP site. Plain ES modules; all data comes from ./data/*.json.
const $ = (id) => document.getElementById(id);
const PAGE = 30;
const BOARD_ROWS = 7;

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

const SVG_NS = "http://www.w3.org/2000/svg";
/** An icon from the sprite in icons.svg. */
function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `icons.svg#${name}`);
  svg.append(use);
  return svg;
}
const CAT_ICON = { all: "layout-grid", servers: "server", clients: "devices", sdks: "package", agents: "hierarchy-2", tools: "tool", security: "shield-check", benchmarks: "gauge", learning: "book-2", directories: "list-details" };

/** Links like "benchmark/" point into this repository. */
const hrefOf = (it) => (/^https?:/.test(it.url) ? it.url : `https://github.com/${meta.repo}/tree/main/${it.url}`);
/** GitHub owners get their avatar as the tile; everything else shows its category icon. */
function githubOwner(url) {
  try { const u = new URL(url); return u.hostname === "github.com" ? u.pathname.split("/")[1] : null; } catch { return null; }
}
function tileFor(it, catId) {
  const owner = githubOwner(hrefOf(it));
  const tile = h("span", { class: "tile", "aria-hidden": "true" }, icon(CAT_ICON[catId] ?? "layout-grid"));
  if (owner) {
    const img = h("img", { src: `https://github.com/${encodeURIComponent(owner)}.png?size=80`, alt: "", width: "40", height: "40", loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.remove());
    tile.append(img);
  }
  return tile;
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
  const s = haystack.toLowerCase();
  return terms().every((w) => s.includes(w));
};
function highlight(text) {
  const t = terms();
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? h("mark", {}, part) : part));
}

// ---------- hero board ----------
function renderBoard() {
  const rows = papers.slice(0, BOARD_ROWS);
  $("board").replaceChildren(
    ...rows.map((p) =>
      h("li", {},
        h("span", { class: "mono" }, p.published ?? ""),
        h("a", { href: p.url, rel: "noopener" }, p.title),
        p.category && h("span", { class: "code-tag" }, p.category))));
  $("board-date").textContent = `${papers.length} indexed`;
}

// ---------- resources ----------
const resourceText = (it) => [it.name, it.description, ...(it.tags ?? []), it.official ? "official" : ""].join(" ");
const resourceMatches = (catId) => cats.find((x) => x.id === catId).items.filter((it) => !state.q || matches(resourceText(it)));

function renderCategories() {
  const all = cats.reduce((n, c) => n + resourceMatches(c.id).length, 0);
  const tab = (id, label, n) =>
    h("button", { type: "button", role: "tab", "aria-selected": state.cat === id, onclick: () => { state.cat = id; renderResources(); } },
      h("span", { class: "lab" }, icon(CAT_ICON[id] ?? "layout-grid"), label), h("span", { class: "n" }, String(n)));
  $("cats").replaceChildren(tab("all", "All", all), ...cats.map((c) => tab(c.id, c.title, resourceMatches(c.id).length)));
}

function renderResources() {
  renderCategories();
  const cat = cats.find((c) => c.id === state.cat);
  $("cat-desc").textContent = cat ? cat.description : "Everything listed, across all categories";
  const pool = state.cat === "all" ? cats : [cat];
  const rows = pool.flatMap((c) => resourceMatches(c.id).map((it) => ({ it, c })));
  $("resource-list").replaceChildren(
    ...rows.map(({ it, c }) =>
      h("li", { class: "card" },
        h("div", { class: "card-head" },
          tileFor(it, c.id),
          h("div", { class: "card-title" }, h("a", { href: hrefOf(it), rel: "noopener" }, highlight(it.name)), icon("arrow-up-right"))),
        h("p", { class: "row-desc" }, highlight(it.description)),
        (it.official || it.tags?.length > 0 || state.cat === "all") &&
          h("div", { class: "row-meta" },
            it.official && h("span", { class: "flag official" }, icon("rosette-discount-check"), "official"),
            state.cat === "all" && h("span", { class: "flag" }, c.title),
            (it.tags ?? []).map((t) => h("button", { class: "tag", type: "button", onclick: () => setQuery(t) }, t))))));
  $("resource-empty").hidden = rows.length > 0;
  renderStatus();
}

// ---------- papers ----------
const paperText = (p) => [p.title, (p.authors ?? []).join(" "), p.summary ?? "", p.id].join(" ");
const paperPool = () =>
  papers.filter((p) => (state.year === "all" || (p.published ?? "").startsWith(state.year)) && (!state.q || matches(paperText(p))));

function renderYears() {
  const years = [...new Set(papers.map((p) => (p.published ?? "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const count = (y) => papers.filter((p) => (y === "all" || (p.published ?? "").startsWith(y)) && (!state.q || matches(paperText(p)))).length;
  const chip = (y, label) =>
    h("button", { type: "button", "aria-pressed": state.year === y, onclick: () => { state.year = y; state.shown = PAGE; renderPapers(); } },
      label, h("span", { class: "n" }, String(count(y))));
  $("years").replaceChildren(chip("all", "All years"), ...years.map((y) => chip(y, y)));
}

function renderPapers() {
  renderYears();
  const pool = paperPool();
  const authors = (p) => (p.authors?.length > 4 ? `${p.authors.slice(0, 4).join(", ")} et al.` : (p.authors ?? []).join(", "));
  $("paper-list").replaceChildren(
    ...pool.slice(0, state.shown).map((p) =>
      h("li", {},
        h("span", { class: "mono" }, p.published ?? ""),
        h("div", { class: "p-title" },
          h("a", { href: p.url, rel: "noopener" }, highlight(p.title)),
          h("p", { class: "p-authors" }, authors(p)),
          p.summary && h("details", { class: "abs" }, h("summary", {}, icon("chevron-right"), "Abstract"), h("p", {}, p.summary))),
        p.category && h("span", { class: "code-tag" }, p.category))));
  $("paper-empty").hidden = pool.length > 0;
  const more = $("more");
  more.hidden = pool.length <= state.shown;
  more.textContent = `Show more (${pool.length - state.shown} left)`;
  renderStatus();
}

// ---------- benchmark: latency on a log scale ----------
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
const MIN_MS = 0.05, MAX_MS = 6;
const TICKS = [0.1, 0.2, 0.5, 1, 2, 5];
const pos = (ms) => ((Math.log10(ms) - Math.log10(MIN_MS)) / (Math.log10(MAX_MS) - Math.log10(MIN_MS))) * 100;
const fmt = (ms) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1)).replace(/^0(?=\.)/, "0");

function renderBenchmark() {
  const T = bench.transport_us;
  const med = (k) => T[k].median_us.median / 1000;
  const p99 = (k) => T[k].p99_us.median / 1000;
  const floor = med("tcp-msgpack");
  $("bench-sub").textContent =
    `A round trip over MCP stdio takes ${Math.round(med("mcp-stdio") / floor)}x the median of raw TCP, and Streamable HTTP takes ${Math.round(med("mcp-shttp") / floor)}x`;

  const ticks = (labels) => TICKS.map((t) => h("div", { class: "tick", style: `left:${pos(t)}%` }, labels && h("span", {}, `${t} ms`)));
  $("bench").replaceChildren(
    h("div", { class: "chart", role: "img", "aria-label": "Median and 99th percentile latency per transport on a log scale" },
      h("div", { class: "axis" }, h("div", {}), h("div", { class: "plot" }, ticks(true))),
      BENCH.map(([k, label]) =>
        h("div", { class: `lane${k.startsWith("mcp") ? " mcp" : ""}` },
          h("div", {},
            h("span", { class: "name" }, label),
            h("span", { class: "vals" }, `${T[k].payload_bytes.toLocaleString("en-US")} B, median ${fmt(med(k))} ms, p99 ${fmt(p99(k))} ms`)),
          h("div", { class: "plot", "aria-hidden": "true" },
            ticks(false),
            h("div", { class: "span", style: `left:${pos(med(k))}%;width:${pos(p99(k)) - pos(med(k))}%` }),
            h("div", { class: "cap", style: `left:${pos(p99(k))}%` }),
            h("div", { class: "dot", style: `left:${pos(med(k))}%` }))))),
    h("p", { class: "legend" },
      h("span", {}, h("i", { class: "l-dot" }), "Median"),
      h("span", {}, h("i", { class: "l-cap" }), "99th percentile"),
      h("span", {}, `Median of ${bench.runs} runs on ${bench.machine}`)));
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
  const btn = $("copy");
  const set = (name, text) => btn.replaceChildren(icon(name), h("span", {}, text));
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(bib); set("check", "Copied"); }
    catch { set("copy", "Select and copy"); }
    setTimeout(() => set("copy", "Copy"), 1800);
  });
}

// ---------- wiring ----------
function renderStatus() {
  const nRes = cats.reduce((n, c) => n + resourceMatches(c.id).length, 0);
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  const nPap = papers.filter((p) => !state.q || matches(paperText(p))).length;
  const latest = papers.reduce((m, p) => ((p.added ?? "") > m ? p.added : m), "");
  $("stats").textContent = state.q
    ? `${nPap} of ${papers.length} papers and ${nRes} of ${total} resources match`
    : latest && `Index updated ${latest}`;
}

function setQuery(value) {
  $("q").value = value;
  onQuery();
  $("q").scrollIntoView({ block: "center", behavior: "smooth" });
}

function onQuery() {
  state.q = $("q").value.trim();
  state.shown = PAGE;
  const url = new URL(location.href);
  if (state.q) url.searchParams.set("q", state.q); else url.searchParams.delete("q");
  history.replaceState(null, "", url);
  if (state.q) state.cat = "all";
  else if (state.cat === "all") state.cat = cats[0].id;
  renderResources();
  renderPapers();
}

async function main() {
  [meta, papers, cats, bench] = await Promise.all([
    getJSON("data/meta.json"), getJSON("data/papers.json"), getJSON("data/resources.json"), getJSON("data/benchmark.json"),
  ]);
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  $("lede").textContent = `Search ${papers.length} arXiv papers and ${total} curated servers, clients, SDKs, benchmarks and tutorials. New papers are indexed every night.`;
  state.cat = cats[0].id;
  renderBoard();
  renderResources();
  renderPapers();
  renderBenchmark();
  renderCite();
  $("q").addEventListener("input", onQuery);
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { $("q").value = initial; onQuery(); }
  $("more").addEventListener("click", () => { state.shown += PAGE; renderPapers(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(input|textarea)$/i.test(document.activeElement?.tagName ?? "")) { e.preventDefault(); $("q").focus(); }
  });
}

/** Mobile drawer: a native <dialog>, so focus is trapped and Escape closes it. */
function setupMenu() {
  const drawer = $("drawer");
  const opener = $("menu-open");
  opener.addEventListener("click", () => drawer.showModal());
  $("menu-close").addEventListener("click", () => drawer.close());
  // A click on the backdrop lands on the dialog element itself, outside its box.
  drawer.addEventListener("click", (e) => {
    const r = drawer.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) drawer.close();
  });
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => drawer.close()));
  // Rotating a phone or resizing past the breakpoint should not leave it open.
  matchMedia("(min-width: 641px)").addEventListener("change", (m) => { if (m.matches && drawer.open) drawer.close(); });
  drawer.addEventListener("close", () => opener.focus({ preventScroll: true }));
}

setupMenu();
main().catch((err) => {
  console.error(err);
  $("stats").textContent = "Could not load the data. Refresh, or browse the lists on GitHub.";
});
