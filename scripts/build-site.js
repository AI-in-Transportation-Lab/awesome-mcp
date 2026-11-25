// Assemble the static site into _site/: the app from site/ plus the data it reads.
import fs from "node:fs";
import { ROOT, loadCategories } from "./lib/data.js";

const out = new URL("_site/", ROOT);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(new URL("data/", out), { recursive: true });

fs.cpSync(new URL("site/", ROOT), out, { recursive: true });
fs.copyFileSync(new URL("data/meta.json", ROOT), new URL("data/meta.json", out));
fs.copyFileSync(new URL("data/papers.json", ROOT), new URL("data/papers.json", out));
fs.copyFileSync(new URL("benchmark/results/macbook-m4-pro/aggregate.json", ROOT), new URL("data/benchmark.json", out));
fs.writeFileSync(new URL("data/resources.json", out), JSON.stringify(loadCategories()));
fs.writeFileSync(new URL(".nojekyll", out), "");

console.log("Site built in _site/");
