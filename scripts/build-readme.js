// Generate README.md, PAPERS.md, PUBLISHED.md and SURVEY.md from data/. Do not edit those files by hand.
import fs from "node:fs";
import { ROOT, loadMeta, loadPapers, loadPublished, loadSurvey, loadCategories, loadBenchmark, authorLine, cell } from "./lib/data.js";

const meta = loadMeta();
const papers = loadPapers();
const published = loadPublished();
const survey = loadSurvey();
const cats = loadCategories();
const bench = loadBenchmark();
const repoUrl = `https://github.com/${meta.repo}`;
const anchor = (t) => t.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

// A deterministic "last updated": the newest date we have data for, so the file
// only changes when the data does.
const lastUpdated = papers.reduce((m, p) => ((p.added ?? "") > m ? p.added : m), "");

// ---------- tables ----------
const link = (item) => `[${cell(item.name)}](${item.url})`;
const tagCell = (item) =>
  [...(item.official ? ["**official**"] : []), ...(item.tags ?? []).map((t) => `\`${t}\``)].join(" ");
const resourceTable = (items) =>
  ["| Name | Description | Tags |", "| --- | --- | --- |", ...items.map((i) => `| ${link(i)} | ${cell(i.description)} | ${tagCell(i)} |`)].join("\n");

const paperRow = (p) => `| ${p.published ?? ""} | [${cell(p.title)}](${p.url}) | ${cell(authorLine(p.authors))} |`;
const latest = papers.slice(0, 20);

const pubRow = (p) => `| ${p.published ?? ""} | [${cell(p.title)}](${p.url}) | ${cell(p.venue)} |`;
const latestPub = published.slice(0, 10);

// Survey references grouped by where the survey first cites them.
const groupCount = (g) => survey.entries.filter((e) => e.group === g.id).length;
const surveyTable = [
  "| Where the survey cites them | Works |",
  "| --- | ---: |",
  ...survey.groups.map((g) => `| ${cell(g.title)} | ${groupCount(g)} |`),
].join("\n");

// ---------- benchmark summary ----------
const T = bench.transport_us;
const ms = (us) => (us / 1000).toFixed(2);
const rows = [
  ["Raw TCP + MessagePack", "tcp-msgpack"],
  ["Zenoh pub/sub", "zenoh-pubsub"],
  ["DDS (Cyclone) pub/sub", "dds-cyclone"],
  ["gRPC unary (Protobuf)", "grpc-unary"],
  ["JSON-RPC 2.0 over stdio (no SDK)", "jsonrpc-stdio"],
  ["MCP stdio `tools/call`", "mcp-stdio"],
  ["MCP Streamable HTTP `tools/call`", "mcp-shttp"],
];
const benchTable = [
  "| Path | Payload (B) | Median (ms) | p99 (ms) |",
  "| --- | ---: | ---: | ---: |",
  ...rows.map(([label, k]) => `| ${label} | ${T[k].payload_bytes.toLocaleString("en-US")} | ${ms(T[k].median_us.median)} | ${ms(T[k].p99_us.median)} |`),
].join("\n");

// ---------- README ----------
const toc = [
  ["Latest preprints", "latest-preprints"],
  ["Latest published papers", "latest-published-papers"],
  ["Survey references", "survey-references"],
  ...cats.map((c) => [c.title, anchor(c.title)]),
  ["Benchmark", "benchmark-and-reference-server"],
  ["Contributing", "contributing"],
  ["Cite", "cite"],
  ["License", "license"],
]
  .map(([t, a]) => `- [${t}](#${a})`)
  .join("\n");

const count = (id) => cats.find((c) => c.id === id)?.items.length ?? 0;
const stats = [
  [papers.length, "preprints"],
  [published.length, "published papers"],
  [survey.entries.length, "survey references"],
  [count("servers"), "servers"],
  [count("clients"), "clients"],
  [count("sdks"), "SDKs and frameworks"],
]
  .map(([n, label]) => `**${n}** ${label}`)
  .join(" · ");

const bibtex = `@article{chhetri2025model,
  title   = {${meta.paper.title}},
  author  = {${meta.paper.authors.join(" and\n            ")}},
  journal = {arXiv preprint arXiv:${meta.paper.arxiv}},
  year    = {${meta.paper.year}}
}`;

const sections = cats
  .map(
    (c) => `## ${c.title}

${c.description}

${resourceTable(c.items)}
`
  )
  .join("\n");

const readme = `<div align="center">

# ${meta.name}

**${meta.tagline}**

[![Code: MIT](https://img.shields.io/badge/code-MIT-lightgrey)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CC-BY-4.0)
[![Last commit](https://img.shields.io/github/last-commit/${meta.repo})](${repoUrl}/commits/main)
[![Stars](https://img.shields.io/github/stars/${meta.repo}?style=flat)](${repoUrl}/stargazers)

[Website](${meta.site}) · [Papers](PAPERS.md) · [Survey references](SURVEY.md) · [Servers](#servers) · [Clients](#clients) · [SDKs](#sdks) · [Benchmark](#benchmark-and-reference-server) · [Contribute](CONTRIBUTING.md)

</div>

> [!NOTE]
> **Our survey**
>
> [${meta.paper.title}](${meta.paper.url})
> <br><sub>${meta.paper.authors.join(", ")}</sub>
>
> [Read on arXiv](${meta.paper.url}) · [Cite it](#cite) · [Works it cites](SURVEY.md) · [Benchmark and code](#benchmark-and-reference-server)

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that lets language-model applications connect to external tools, data and prompts through a uniform interface. This repository collects what you need to work with it: the research literature, servers, clients, SDKs, benchmarks and tutorials. It is maintained by the [AI in Transportation Lab](https://github.com/AI-in-Transportation-Lab).

Everything below is searchable on the **[website](${meta.site})**, and papers are refreshed from arXiv every day.

${stats}

<details>
<summary><b>Contents</b></summary>

${toc}

</details>

## Latest preprints

New arXiv papers about the Model Context Protocol, newest first. The scope is computer science and electrical engineering papers that name the protocol in the title or abstract. The full list of ${papers.length} preprints, grouped by month, is in **[PAPERS.md](PAPERS.md)** and on the [website](${meta.site}).

| Date | Title | Authors |
| --- | --- | --- |
${latest.map(paperRow).join("\n")}

<sub>Last updated ${lastUpdated}.</sub>

## Latest published papers

Journal and conference papers found through [OpenAlex](https://openalex.org), newest first. All ${published.length} are in **[PUBLISHED.md](PUBLISHED.md)** and on the [website](${meta.site}).

| Date | Title | Venue |
| --- | --- | --- |
${latestPub.map(pubRow).join("\n")}

## Survey references

The ${survey.entries.length} works cited by our survey, grouped by the section or subsection that first cites them. This list is separate from the arXiv tracker and does not change when new papers appear. The analysis is in the survey; the list is here so you can find and filter what it builds on. See **[SURVEY.md](SURVEY.md)** or the [website](${meta.site}#survey).

${surveyTable}

${sections}
## Benchmark and reference server

[\`benchmark/\`](benchmark/) is the executable artifact for our survey: serialization and transport micro-benchmarks, plus a reference MAPE-K MCP server pinned to the official Python SDK 2.3.0. Median of three runs on an Apple M4 Pro, echoing a 50-detection perception frame over loopback:

${benchTable}

> [!IMPORTANT]
> The benchmark is synthetic and single-host. Read the numbers as orders of magnitude, not guarantees. Setup, scripts and limits are in [\`benchmark/README.md\`](benchmark/README.md).

## Contributing

Contributions are welcome: new servers, clients, tutorials, benchmarks, corrections. Papers are collected automatically, so there is no need to submit those. Start with [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](${repoUrl}/issues/new/choose).

> [!NOTE]
> The tables in this file are generated from [\`data/\`](data/). To add or fix an entry, edit the JSON there and open a pull request.

## Cite

If this collection or the benchmark is useful in your work, please cite our survey. GitHub's **Cite this repository** button uses [CITATION.cff](CITATION.cff).

\`\`\`bibtex
${bibtex}
\`\`\`

<sub>We will update the citation when the survey is published.</sub>

## License

| What | License |
| --- | --- |
| Code: \`scripts/\`, \`site/\`, \`benchmark/\` and the workflows | [MIT](LICENSE) |
| Content: \`data/\`, the generated lists and the documentation | [CC BY 4.0](LICENSE-CC-BY-4.0) |

Paper metadata comes from arXiv and OpenAlex, which publish it openly. Fonts and icons on the site keep their own licenses, in [\`site/fonts/\`](site/fonts/LICENSE.txt) and [\`site/icons.LICENSE.txt\`](site/icons.LICENSE.txt).
`;

// ---------- PAPERS.md ----------
const byMonth = new Map();
for (const p of papers) {
  const m = (p.published ?? "undated").slice(0, 7);
  if (!byMonth.has(m)) byMonth.set(m, []);
  byMonth.get(m).push(p);
}
const monthName = (m) =>
  m === "undated" ? "Undated" : new Date(`${m}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const papersMd = `# Preprints

${papers.length} arXiv preprints on the Model Context Protocol, newest first. Generated from [\`data/papers.json\`](data/papers.json) and refreshed daily; searchable on the [website](${meta.site}). Back to the [README](README.md).

${[...byMonth]
  .map(
    ([m, ps]) => `## ${monthName(m)} (${ps.length})

${ps.map((p) => `- [${p.title.replace(/([[\]])/g, "\\$1")}](${p.url})${p.authors?.length ? ` · ${authorLine(p.authors)}` : ""}`).join("\n")}
`
  )
  .join("\n")}`;

// ---------- PUBLISHED.md ----------
const monthsOf = (list, key) => {
  const m = new Map();
  for (const p of list) {
    const k = (p[key] ?? "undated").slice(0, 7);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  return m;
};
const pubMd = `# Published papers

${published.length} journal and conference papers about the Model Context Protocol, found through [OpenAlex](https://openalex.org), newest first. Generated from [\`data/published.json\`](data/published.json); searchable on the [website](${meta.site}). Back to the [README](README.md).

${[...monthsOf(published, "published")]
  .map(
    ([m, ps]) => `## ${monthName(m)} (${ps.length})

${ps.map((p) => `- [${p.title.replace(/([[\]])/g, "\\$1")}](${p.url})${p.venue ? ` · ${p.venue}` : ""}`).join("\n")}
`
  )
  .join("\n")}`;

// ---------- SURVEY.md ----------
const surveyMd = `# Survey references

${survey.entries.length} works. ${survey.meta.description} Bibliography snapshot: ${survey.meta.snapshot}. Searchable on the [website](${meta.site}#survey). Back to the [README](README.md).

${survey.groups
  .map((g) => {
    const items = survey.entries.filter((e) => e.group === g.id);
    return `## ${g.title} (${items.length})

${items
  .map((e) => `- ${e.url ? `[${e.title.replace(/([[\]])/g, "\\$1")}](${e.url})` : e.title}${e.authors.length ? ` · ${authorLine(e.authors)}` : ""}${e.year ? ` · ${e.year}` : ""}${e.venue ? ` · ${e.venue}` : ""}`)
  .join("\n")}
`;
  })
  .join("\n")}`;

fs.writeFileSync(new URL("README.md", ROOT), readme);
fs.writeFileSync(new URL("PUBLISHED.md", ROOT), pubMd);
fs.writeFileSync(new URL("SURVEY.md", ROOT), surveyMd);
fs.writeFileSync(new URL("PAPERS.md", ROOT), papersMd);
console.log(`README.md ${readme.length}, PAPERS.md ${papersMd.length}, PUBLISHED.md ${pubMd.length}, SURVEY.md ${surveyMd.length} chars`);
