// Rebuild site/icons.svg, a sprite of Tabler outline icons (MIT), pinned to one release.
//   node scripts/build-icons.js
import fs from "node:fs";

const VERSION = "3.52.0";
const ICONS = [
  "route", "brand-github", "search", "server", "devices", "package", "hierarchy-2", "tool", "shield-check",
  "gauge", "book-2", "list-details", "layout-grid", "arrow-up-right", "rosette-discount-check", "chevron-right",
  "copy", "check", "file-text", "plus", "quote", "external-link", "menu-2", "x", "books", "world", "chevron-down",
];

const symbols = [];
for (const name of ICONS) {
  const url = `https://cdn.jsdelivr.net/npm/@tabler/icons@${VERSION}/icons/outline/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const svg = await res.text();
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, "").trim();
  symbols.push(`  <symbol id="${name}" viewBox="0 0 24 24">${inner}</symbol>`);
}
const out = `<svg xmlns="http://www.w3.org/2000/svg">\n  <!-- Tabler Icons ${VERSION}, MIT license, https://tabler.io/icons -->\n${symbols.join("\n")}\n</svg>\n`;
fs.writeFileSync(new URL("../site/icons.svg", import.meta.url), out);
console.log(`Wrote ${ICONS.length} icons`);
