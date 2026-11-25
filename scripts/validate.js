// Sanity-check everything under data/. Run by CI on every pull request.
import fs from "node:fs";
import { ROOT, loadMeta, loadPapers, loadCategories } from "./lib/data.js";

const errors = [];
const fail = (msg) => errors.push(msg);

const isWeb = (u) => /^https?:\/\/[^\s]+$/.test(u);
const isLocal = (u) => !/^[a-z]+:/i.test(u) && fs.existsSync(new URL(u, ROOT));

const meta = loadMeta();
for (const k of ["name", "tagline", "repo", "site", "paper"]) if (!meta[k]) fail(`meta.json: missing "${k}"`);

// Curated resources
const seenUrl = new Map();
const seenCat = new Set();
for (const cat of loadCategories()) {
  for (const k of ["id", "title", "order", "description", "items"]) {
    if (cat[k] === undefined) fail(`resources/${cat.id ?? "?"}.json: missing "${k}"`);
  }
  if (seenCat.has(cat.id)) fail(`duplicate category id "${cat.id}"`);
  seenCat.add(cat.id);
  for (const item of cat.items ?? []) {
    const where = `${cat.id}: "${item.name ?? "?"}"`;
    if (!item.name) fail(`${where}: missing name`);
    if (!item.description) fail(`${where}: missing description`);
    if (!item.url || !(isWeb(item.url) || isLocal(item.url))) fail(`${where}: bad url "${item.url}"`);
    if (item.tags && !Array.isArray(item.tags)) fail(`${where}: tags must be an array`);
    const key = (item.url ?? "").toLowerCase().replace(/\/$/, "");
    if (seenUrl.has(key)) fail(`${where}: duplicate url, already in ${seenUrl.get(key)}`);
    seenUrl.set(key, cat.id);
  }
}

// Papers
const seenId = new Set();
for (const p of loadPapers()) {
  const where = `paper ${p.id ?? "?"}`;
  for (const k of ["id", "title", "url"]) if (!p[k]) fail(`${where}: missing ${k}`);
  if (seenId.has(p.id)) fail(`${where}: duplicate id`);
  seenId.add(p.id);
  if (p.published && !/^\d{4}-\d{2}-\d{2}$/.test(p.published)) fail(`${where}: bad date "${p.published}"`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`OK: ${seenUrl.size} resources in ${seenCat.size} categories, ${seenId.size} papers`);
