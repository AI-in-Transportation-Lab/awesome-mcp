// Build data/survey.json from the survey's LaTeX source and bibliography.
//
//   node scripts/import-survey.js <main.tex> <references.bib>
//
// Every cited work becomes one entry, grouped by where the survey first cites it
// (its sections, and for the taxonomy and application-domain sections their
// subsections). Only bibliographic facts are imported; the meta block in the
// file is kept by hand between runs.
import fs from "node:fs";
import path from "node:path";

const [texPath, bibPath] = process.argv.slice(2);
if (!texPath || !bibPath) {
  console.error("usage: node scripts/import-survey.js <main.tex> <references.bib>");
  process.exit(1);
}
const OUT = new URL("../data/survey.json", import.meta.url);

// ---------- LaTeX text helpers ----------
const ACCENTS = { "`": "̀", "'": "́", "^": "̂", '"': "̈", "~": "̃", "=": "̄", ".": "̇", u: "̆", v: "̌", H: "̋", c: "̧", k: "̨" };
const SPECIAL = { "\\ss": "ß", "\\o": "ø", "\\O": "Ø", "\\ae": "æ", "\\AE": "Æ", "\\oe": "œ", "\\l": "ł", "\\L": "Ł", "\\i": "ı", "\\aa": "å", "\\AA": "Å" };

const GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", tau: "τ", omega: "ω" };

function detex(s = "") {
  let t = s.replace(/\s+/g, " ");
  t = t.replace(/\$\\([a-z]+)\$/g, (all, n) => GREEK[n] ?? all);
  t = t.replace(/\\([`'^"~=.])\s*\{?\\?([a-zA-Z])\}?/g, (_, a, c) => (c + ACCENTS[a]).normalize("NFC"));
  t = t.replace(/\\([uvHck])\s*\{([a-zA-Z])\}/g, (_, a, c) => (c + ACCENTS[a]).normalize("NFC"));
  for (const [k, v] of Object.entries(SPECIAL)) t = t.split(`${k}{}`).join(v).replace(new RegExp(`${k.replace("\\", "\\\\")}(?![a-zA-Z])`, "g"), v);
  t = t.replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\_/g, "_").replace(/\\\$/g, "$").replace(/\\#/g, "#");
  t = t.replace(/---|--/g, "-").replace(/~/g, " ").replace(/``|''/g, '"');
  t = t.replace(/\\[a-zA-Z]+\*?/g, "").replace(/[{}]/g, "");
  return t.replace(/\s+/g, " ").trim();
}

// ---------- bibliography ----------
function parseBib(src) {
  const entries = new Map();
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      const ch = src[i++];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    const body = src.slice(start, i - 1);
    const fields = {};
    const fre = /(\w+)\s*=\s*/g;
    let f;
    while ((f = fre.exec(body))) {
      let j = fre.lastIndex, val = "";
      if (body[j] === "{") {
        let d = 1; const s0 = ++j;
        while (j < body.length && d > 0) { const c = body[j++]; if (c === "{") d++; else if (c === "}") d--; }
        val = body.slice(s0, j - 1);
      } else if (body[j] === '"') {
        const s0 = ++j;
        while (j < body.length && body[j] !== '"') j++;
        val = body.slice(s0, j++);
      } else {
        const s0 = j;
        while (j < body.length && body[j] !== "," && body[j] !== "\n") j++;
        val = body.slice(s0, j).trim();
      }
      fields[f[1].toLowerCase()] = val;
      fre.lastIndex = j;
    }
    entries.set(m[2], { type: m[1].toLowerCase(), fields });
    re.lastIndex = i;
  }
  return entries;
}

const toName = (a) => {
  const n = detex(a);
  if (n.includes(",")) { const [last, first] = n.split(/,\s*(.*)/s); return `${first ?? ""} ${last}`.trim(); }
  return n;
};
const authorsOf = (s = "") => s.split(/\s+and\s+/).map((a) => a.trim()).filter((a) => a && a !== "others").map(toName);

function sourceType(type, f) {
  const text = `${f.howpublished ?? ""} ${f.journal ?? ""} ${f.publisher ?? ""} ${f.note ?? ""}`.toLowerCase();
  if (f.eprint || /arxiv|techrxiv|ssrn|preprints\.org|preprint/.test(text)) return "preprint";
  if (type === "article") return "journal";
  if (type === "inproceedings" || type === "conference") return "conference";
  if (["book", "incollection", "phdthesis", "mastersthesis", "inbook"].includes(type)) return "book";
  return "standard-or-report"; // techreport, manual, online, misc: specifications, documentation, reports
}

function linkOf(f) {
  if (f.doi) return `https://doi.org/${detex(f.doi)}`;
  if (f.eprint && /^\d{4}\.\d{4,5}/.test(f.eprint)) return `https://arxiv.org/abs/${f.eprint}`;
  const u = f.url ?? (/\\url\{([^}]+)\}/.exec(f.howpublished ?? "") ?? [])[1];
  return u ? detex(u) : "";
}

// ---------- survey structure ----------
function expand(file, seen = new Set()) {
  const dir = path.dirname(file);
  const src = fs.readFileSync(file, "utf8").replace(/(^|[^\\])%.*$/gm, "$1");
  return src.replace(/\\input\{([^}]+)\}/g, (all, rel) => {
    const p = path.join(dir, rel.endsWith(".tex") ? rel : `${rel}.tex`);
    if (seen.has(p) || !fs.existsSync(p)) return all;
    seen.add(p);
    return expand(p, seen);
  });
}

function braced(src, from) {
  let i = from, d = 0, s = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") { if (d++ === 0) s = i + 1; }
    else if (src[i] === "}" && --d === 0) return [src.slice(s, i), i + 1];
  }
  return ["", from];
}
const sectionTitle = (raw) => {
  const m = /^\\rvsec\{[^}]*\}\{([\s\S]*)\}$/.exec(raw.trim());
  return detex(m ? m[1] : raw);
};

const tex = expand(texPath);
const bib = parseBib(fs.readFileSync(bibPath, "utf8"));

// Walk the text once, tracking the current section and subsection.
const BY_SUBSECTION = new Set(["Taxonomy of Unifying Models for Autonomous and Adaptive Systems", "MCP-Enabled Coordination across Autonomous Domains"]);
// Short labels for narrow places such as the website's category rail.
const SHORT = {
  "Introduction": "Introduction",
  "Survey Methodology": "Methodology",
  "Autonomous and Adaptive Systems: Definitions and a Reference Model": "Definitions and reference model",
  "Background and Positioning": "Background and positioning",
  "Taxonomy of Unifying Models for Autonomous and Adaptive Systems": "Taxonomy overview",
  "Adaptive Protocol Mechanisms": "Adaptive protocol mechanisms",
  "Context-Aware Frameworks": "Context-aware frameworks",
  "Unification Models": "Unification models",
  "System Integration Architectures": "System integration",
  "Model Context Protocol: Specification, Architecture, and Mechanisms": "MCP specification",
  "MCP versus Established Protocols and Middleware": "MCP vs. other protocols",
  "MCP in Context-Aware Transport Systems": "Transport systems",
  "Multi-Robot Coordination": "Multi-robot coordination",
  "Smart Manufacturing and Industrial Cyber-Physical Systems": "Manufacturing and industry",
  "Edge-AI Fleets and Federated Edge Intelligence": "Edge-AI fleets",
  "Performance Analysis and Evaluation": "Performance and evaluation",
  "Challenges and Open Problems": "Challenges",
  "Future Research Directions": "Future directions",
};
const groups = [];
const groupOf = new Map();
function group(title, section) {
  if (!groupOf.has(title)) { const g = { id: `g${groups.length + 1}`, title, short: SHORT[title] ?? title, section }; groups.push(g); groupOf.set(title, g); }
  return groupOf.get(title);
}
let curSection = "Front matter", curSub = null;
const firstSeen = new Map(); // key -> ordered groups
const tokens = /\\(section|subsection)\*?\s*(?=\{)|\\(?:cite[a-zA-Z]*)\*?(?:\[[^\]]*\])*\{([^}]*)\}/g;
let m;
while ((m = tokens.exec(tex))) {
  if (m[1]) {
    const [raw, end] = braced(tex, m.index + m[0].length);
    const title = sectionTitle(raw);
    if (m[1] === "section") { curSection = title; curSub = null; if (title === "Acronyms") break; }
    else curSub = title;
    tokens.lastIndex = end;
  } else {
    const g = group(BY_SUBSECTION.has(curSection) && curSub ? curSub : curSection, curSection);
    for (const k of m[2].split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!firstSeen.has(k)) firstSeen.set(k, []);
      if (!firstSeen.get(k).includes(g.id)) firstSeen.get(k).push(g.id);
    }
  }
}

// ---------- entries ----------
const entries = [];
const missing = [];
for (const [key, gids] of firstSeen) {
  const b = bib.get(key);
  if (!b) { missing.push(key); continue; }
  const f = b.fields;
  const venue = f.eprint ? "arXiv" : detex(f.journal ?? f.booktitle ?? f.publisher ?? f.institution ?? (/^(?!\\url)(.*)$/.exec(f.howpublished ?? "") ?? [])[1] ?? "");
  entries.push({
    key,
    title: detex(f.title ?? ""),
    authors: authorsOf(f.author ?? f.editor ?? f.organization ?? ""),
    year: Number(f.year) || null,
    venue,
    type: sourceType(b.type, f),
    url: linkOf(f),
    arxiv: f.eprint && /^\d{4}\.\d{4,5}/.test(f.eprint) ? f.eprint : undefined,
    group: gids[0],
    also: gids.slice(1),
  });
}

// Keep the hand-written meta block between runs.
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const out = {
  meta: previous.meta ?? {},
  groups,
  entries,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const byType = entries.reduce((a, e) => ((a[e.type] = (a[e.type] ?? 0) + 1), a), {});
console.log(`${entries.length} works in ${groups.length} groups`, byType, missing.length ? `MISSING: ${missing}` : "");
