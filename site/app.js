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

const getJSON = (path) =>
  fetch(path).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });

// Each section has its own search; the box in the hero fills all of them.
const state = {
  resQ: "", papQ: "", surQ: "",
  cat: "servers",
  tab: "preprints", year: "all", topic: "all", shown: PAGE,
  group: "all",
};
let meta, preprints, published, survey, cats, bench, topicLabels;

// ---------- search helpers ----------
const termsOf = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (q, haystack) => {
  const s = haystack.toLowerCase();
  return termsOf(q).every((w) => s.includes(w));
};
function highlight(text, q) {
  const t = termsOf(q);
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? h("mark", {}, part) : part));
}
const authorsLine = (list = [], max = 4) => (list.length > max ? `${list.slice(0, max).join(", ")} et al.` : list.join(", "));

// ---------- hero board ----------
function renderBoard() {
  $("board").replaceChildren(
    ...preprints.slice(0, BOARD_ROWS).map((p) =>
      h("li", {},
        h("span", { class: "mono" }, p.published ?? ""),
        h("a", { href: p.url, rel: "noopener" }, p.title),
        p.category && h("span", { class: "code-tag" }, p.category))));
  $("board-date").textContent = `${preprints.length} indexed`;
}

// ---------- resources ----------
const hrefOf = (it) => (/^https?:/.test(it.url) ? it.url : `https://github.com/${meta.repo}/tree/main/${it.url}`);
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
const resourceText = (it) => [it.name, it.description, ...(it.tags ?? []), it.official ? "official" : ""].join(" ");
const resourceMatches = (catId) => cats.find((x) => x.id === catId).items.filter((it) => !state.resQ || matches(state.resQ, resourceText(it)));

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
          h("div", { class: "card-title" }, h("a", { href: hrefOf(it), rel: "noopener" }, highlight(it.name, state.resQ)), icon("arrow-up-right"))),
        h("p", { class: "row-desc" }, highlight(it.description, state.resQ)),
        (it.official || it.tags?.length > 0 || state.cat === "all") &&
          h("div", { class: "row-meta" },
            it.official && h("span", { class: "flag official" }, icon("rosette-discount-check"), "official"),
            state.cat === "all" && h("span", { class: "flag" }, c.title),
            (it.tags ?? []).map((t) => h("button", { class: "tag", type: "button", onclick: () => setResourceQuery(t) }, t))))));
  $("resource-empty").hidden = rows.length > 0;
  renderStatus();
}

// ---------- papers: preprints and published ----------
const SOURCES = {
  preprints: { label: "Preprints", note: "arXiv preprints, newest first" },
  published: { label: "Published", note: "Journal and conference papers from OpenAlex, newest first" },
};
const sourceList = () => (state.tab === "published" ? published : preprints);
const paperText = (p) => [p.title, (p.authors ?? []).join(" "), p.summary ?? "", p.venue ?? "", p.id].join(" ");
const yearOf = (p) => (p.published ?? "").slice(0, 4);
const inQuery = (p) => !state.papQ || matches(state.papQ, paperText(p));
const countWhere = (list, test) => list.reduce((n, p) => n + (test(p) ? 1 : 0), 0);

function renderTabs() {
  $("tabs").replaceChildren(
    ...Object.entries(SOURCES).map(([id, s]) => {
      const n = countWhere(id === "published" ? published : preprints, inQuery);
      return h("button", { type: "button", role: "tab", "aria-selected": state.tab === id, onclick: () => { state.tab = id; state.year = "all"; state.topic = "all"; state.shown = PAGE; renderPapers(); } },
        s.label, h("span", { class: "n" }, String(n)));
    }));
  $("papers-sub").textContent = SOURCES[state.tab].note;
}

function renderFilters() {
  const list = sourceList();
  const topicOk = (p) => state.topic === "all" || (p.topics ?? []).includes(state.topic);
  const yearOk = (p) => state.year === "all" || yearOf(p) === state.year;

  const topicChip = (id, label) => {
    const n = countWhere(list, (p) => inQuery(p) && yearOk(p) && (id === "all" || (p.topics ?? []).includes(id)));
    return h("button", { type: "button", "aria-pressed": state.topic === id, disabled: n === 0 && state.topic !== id, onclick: () => { state.topic = id; state.shown = PAGE; renderPapers(); } },
      label, h("span", { class: "n" }, String(n)));
  };
  $("topics").replaceChildren(topicChip("all", "All topics"), ...Object.entries(topicLabels).map(([id, label]) => topicChip(id, label)));

  const years = [...new Set(list.map(yearOf).filter(Boolean))].sort().reverse();
  const yearCount = (y) => countWhere(list, (p) => inQuery(p) && topicOk(p) && (y === "all" || yearOf(p) === y));
  const select = $("year-select");
  select.replaceChildren(
    h("option", { value: "all" }, `All years (${yearCount("all")})`),
    ...years.map((y) => h("option", { value: y }, `${y} (${yearCount(y)})`)));
  select.value = state.year;
  select.onchange = () => { state.year = select.value; state.shown = PAGE; renderPapers(); };

  const clear = $("clear");
  clear.hidden = state.topic === "all" && state.year === "all";
  clear.onclick = () => { state.topic = "all"; state.year = "all"; state.shown = PAGE; renderPapers(); };
}

function paperPool() {
  return sourceList().filter((p) => inQuery(p) && (state.year === "all" || yearOf(p) === state.year) && (state.topic === "all" || (p.topics ?? []).includes(state.topic)));
}

function renderPapers() {
  renderTabs();
  renderFilters();
  const pool = paperPool();
  const isPub = state.tab === "published";
  $("paper-list").replaceChildren(
    ...pool.slice(0, state.shown).map((p) =>
      h("li", {},
        h("span", { class: "mono" }, p.published ?? ""),
        h("div", { class: "p-title" },
          h("a", { href: p.url, rel: "noopener" }, highlight(p.title, state.papQ)),
          h("p", { class: "p-authors" }, [authorsLine(p.authors), isPub && p.venue].filter(Boolean).join(" · ")),
          !isPub && p.summary && h("details", { class: "abs" }, h("summary", {}, icon("chevron-right"), "Abstract"), h("p", {}, p.summary))),
        isPub
          ? h("span", { class: "mono cites", title: "Citations according to OpenAlex" }, p.citedBy ? `${p.citedBy} cited` : "")
          : p.category && h("span", { class: "code-tag" }, p.category))));
  $("paper-empty").hidden = pool.length > 0;
  $("result-count").textContent = `${pool.length} of ${sourceList().length} ${isPub ? "published papers" : "preprints"}`;
  const more = $("more");
  more.hidden = pool.length <= state.shown;
  more.textContent = `Show more (${pool.length - state.shown} left)`;
  renderStatus();
}

// ---------- survey references ----------
const refText = (e) => [e.title, e.authors.join(" "), e.venue, e.year ?? ""].join(" ");
const refMatches = (g) => survey.entries.filter((e) => (g === "all" || e.group === g || e.also.includes(g)) && (!state.surQ || matches(state.surQ, refText(e))));

function renderGroups() {
  const tab = (id, label, n, title) =>
    h("button", { type: "button", role: "tab", title, "aria-selected": state.group === id, onclick: () => { state.group = id; renderSurvey(); } },
      h("span", { class: "lab" }, h("span", { class: "t" }, label)), h("span", { class: "n" }, String(n)));
  $("groups").replaceChildren(tab("all", "All", refMatches("all").length), ...survey.groups.map((g) => tab(g.id, g.short ?? g.title, refMatches(g.id).length, g.title)));
}

function renderSurvey() {
  renderGroups();
  const g = survey.groups.find((x) => x.id === state.group);
  $("survey-desc").replaceChildren(
    g ? `Cited in "${g.title}"` : "All works the survey cites. ",
    !g && h("a", { href: meta.paper.url, rel: "noopener" }, "Read the survey"),
    !g && " for the analysis.");
  const rows = refMatches(state.group).sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  $("survey-list").replaceChildren(
    ...rows.slice(0, 200).map((e) =>
      h("li", { class: "ref" },
        h("span", { class: "mono" }, e.year ?? ""),
        h("div", { class: "p-title" },
          e.url ? h("a", { href: e.url, rel: "noopener" }, highlight(e.title, state.surQ)) : h("span", { class: "plain" }, highlight(e.title, state.surQ)),
          h("p", { class: "p-authors" }, [authorsLine(e.authors), e.venue].filter(Boolean).join(" · "))),
        )));
  $("survey-empty").hidden = rows.length > 0;
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
const fmt = (ms) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1));

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
  const q = $("q").value.trim();
  if (!q) {
    const latest = preprints.reduce((m, p) => ((p.added ?? "") > m ? p.added : m), "");
    $("stats").textContent = latest ? `Index updated ${latest}` : "";
    return;
  }
  const nRes = cats.reduce((n, c) => n + c.items.filter((it) => matches(q, resourceText(it))).length, 0);
  const nPre = countWhere(preprints, (p) => matches(q, paperText(p)));
  const nPub = countWhere(published, (p) => matches(q, paperText(p)));
  const nRef = countWhere(survey.entries, (e) => matches(q, refText(e)));
  $("stats").textContent = `${nPre} preprints, ${nPub} published papers, ${nRef} survey references and ${nRes} resources match`;
}

function syncUrl() {
  const url = new URL(location.href);
  const q = $("q").value.trim();
  if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
  history.replaceState(null, "", url);
}

/** The hero search fills every section's search and shows resources across all categories. */
function onGlobalQuery() {
  const q = $("q").value.trim();
  for (const id of ["res-q", "pap-q", "sur-q"]) $(id).value = q;
  state.resQ = state.papQ = state.surQ = q;
  state.shown = PAGE;
  if (q) { state.cat = "all"; state.group = "all"; }
  else { if (state.cat === "all") state.cat = cats[0].id; }
  syncUrl();
  renderResources(); renderPapers(); renderSurvey();
}

function setResourceQuery(value) {
  $("res-q").value = value;
  onResourceQuery();
  $("res-q").scrollIntoView({ block: "center", behavior: "smooth" });
}
function onResourceQuery() {
  state.resQ = $("res-q").value.trim();
  if (state.resQ) state.cat = "all"; else if (state.cat === "all") state.cat = cats[0].id;
  renderResources();
}
function onPaperQuery() { state.papQ = $("pap-q").value.trim(); state.shown = PAGE; renderPapers(); }
function onSurveyQuery() {
  state.surQ = $("sur-q").value.trim();
  if (state.surQ) state.group = "all";
  renderSurvey();
}

/** Mobile drawer: a native <dialog>, so focus is trapped and Escape closes it. */
function setupMenu() {
  const drawer = $("drawer");
  const opener = $("menu-open");
  opener.addEventListener("click", () => drawer.showModal());
  $("menu-close").addEventListener("click", () => drawer.close());
  drawer.addEventListener("click", (e) => {
    const r = drawer.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) drawer.close();
  });
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => drawer.close()));
  matchMedia("(min-width: 641px)").addEventListener("change", (m) => { if (m.matches && drawer.open) drawer.close(); });
  drawer.addEventListener("close", () => opener.focus({ preventScroll: true }));
}

async function main() {
  [meta, preprints, published, survey, cats, bench, topicLabels] = await Promise.all([
    getJSON("data/meta.json"), getJSON("data/papers.json"), getJSON("data/published.json"), getJSON("data/survey.json"),
    getJSON("data/resources.json"), getJSON("data/benchmark.json"), getJSON("data/topics.json"),
  ]);
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  $("lede").textContent = `Search ${preprints.length} arXiv preprints, ${published.length} published papers and ${total} curated servers, clients, SDKs, benchmarks and tutorials. New papers are indexed every night.`;
  state.cat = cats[0].id;
  renderBoard();
  renderResources();
  renderPapers();
  renderSurvey();
  renderBenchmark();
  renderCite();
  $("q").addEventListener("input", onGlobalQuery);
  $("res-q").addEventListener("input", onResourceQuery);
  $("pap-q").addEventListener("input", onPaperQuery);
  $("sur-q").addEventListener("input", onSurveyQuery);
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { $("q").value = initial; onGlobalQuery(); }
  $("more").addEventListener("click", () => { state.shown += PAGE; renderPapers(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(input|textarea)$/i.test(document.activeElement?.tagName ?? "")) { e.preventDefault(); $("q").focus(); }
  });
}

setupMenu();
main().catch((err) => {
  console.error(err);
  $("stats").textContent = "Could not load the data. Refresh, or browse the lists on GitHub.";
});
