// Generate README.md and PAPERS.md from data/. Do not edit those two files by hand.
import fs from "node:fs";
import { ROOT, loadMeta, loadPapers, loadCategories, loadBenchmark, authorLine, cell } from "./lib/data.js";

const meta = loadMeta();
const papers = loadPapers();
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
  ["Latest papers", "latest-papers"],
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
  [papers.length, "papers"],
  [count("servers"), "servers"],
  [count("clients"), "clients"],
  [count("sdks"), "SDKs and frameworks"],
]
  .map(([n, label]) => `**${n}** ${label}`)
  .join(" · ");

const bibtex = `@article{chhetri2025model,
  title   = {${meta.paper.title}},
  author  = {${meta.paper.authors.join(" and ")}},
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

[![Website](https://img.shields.io/badge/website-open-2ea44f)](${meta.site})
[![arXiv](https://img.shields.io/badge/arXiv-${meta.paper.arxiv}-b31b1b)](${meta.paper.url})
[![License: CC BY 4.0](https://img.shields.io/badge/license-CC%20BY%204.0-lightgrey)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/${meta.repo})](${repoUrl}/commits/main)
[![Stars](https://img.shields.io/github/stars/${meta.repo}?style=flat)](${repoUrl}/stargazers)

[Website](${meta.site}) · [Papers](PAPERS.md) · [Servers](#servers) · [Clients](#clients-and-hosts) · [SDKs](#sdks-and-frameworks) · [Benchmark](#benchmark-and-reference-server) · [Contribute](CONTRIBUTING.md)

</div>

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that lets language-model applications connect to external tools, data and prompts through a uniform interface. This repository collects what you need to work with it: the research literature, servers, clients, SDKs, benchmarks and tutorials. It is maintained by the [AI in Transportation Lab](https://github.com/AI-in-Transportation-Lab).

${stats}

> [!TIP]
> A searchable version of everything below lives at **[${meta.site.replace(/^https:\/\//, "").replace(/\/$/, "")}](${meta.site})**. Papers are refreshed from arXiv every day.

> [!NOTE]
> The tables in this file are generated from [\`data/\`](data/). To add or fix an entry, edit the JSON there and open a pull request; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contents

${toc}

## Latest papers

New arXiv papers that mention the Model Context Protocol, newest first. The full list of ${papers.length} papers, grouped by month, is in **[PAPERS.md](PAPERS.md)** and on the [website](${meta.site}).

| Date | Title | Authors |
| --- | --- | --- |
${latest.map(paperRow).join("\n")}

<sub>Last updated ${lastUpdated}.</sub>

${sections}
## Benchmark and reference server

[\`benchmark/\`](benchmark/) is the executable artifact for our survey: serialization and transport micro-benchmarks, plus a reference MAPE-K MCP server pinned to the official Python SDK 2.3.0. Median of three runs on an Apple M4 Pro, echoing a 50-detection perception frame over loopback:

${benchTable}

> [!IMPORTANT]
> The benchmark is synthetic and single-host. Read the numbers as orders of magnitude, not guarantees. Setup, scripts and limits are in [\`benchmark/README.md\`](benchmark/README.md).

## Contributing

Contributions are welcome: new servers, clients, tutorials, benchmarks, corrections. Papers are collected automatically, so there is no need to submit those. Start with [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](${repoUrl}/issues/new/choose).

## Cite

If this collection or the benchmark is useful in your work, please cite our survey. GitHub's **Cite this repository** button uses [CITATION.cff](CITATION.cff).

\`\`\`bibtex
${bibtex}
\`\`\`

<sub>We will update the citation when the survey is published.</sub>

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE). Share and adapt with attribution.
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
const papersMd = `# Papers

${papers.length} arXiv papers on the Model Context Protocol, newest first. Generated from [\`data/papers.json\`](data/papers.json) and refreshed daily; searchable on the [website](${meta.site}). Back to the [README](README.md).

${[...byMonth]
  .map(
    ([m, ps]) => `## ${monthName(m)} (${ps.length})

${ps.map((p) => `- [${p.title.replace(/([[\]])/g, "\\$1")}](${p.url})${p.authors?.length ? ` — ${authorLine(p.authors)}` : ""}`).join("\n")}
`
  )
  .join("\n")}`;

fs.writeFileSync(new URL("README.md", ROOT), readme);
fs.writeFileSync(new URL("PAPERS.md", ROOT), papersMd);
console.log(`README.md (${readme.length} chars), PAPERS.md (${papersMd.length} chars)`);
