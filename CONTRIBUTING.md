# Contributing

Thanks for helping make this the place to start with the Model Context Protocol.

## What belongs here

- **Servers, clients, SDKs, agent frameworks, tools, security resources, benchmarks, tutorials and directories** that are real, usable and relevant to MCP.
- **Corrections**: broken links, outdated descriptions, projects that are archived or unmaintained.

**Papers are collected automatically** from arXiv every day, so you do not need to add them. If a relevant paper is missing, open an issue with its arXiv ID.

## How the repository works

Everything is generated from files in [`data/`](data/):

| File | Used for |
| --- | --- |
| `data/resources/<category>.json` | The curated lists. **This is what you edit.** |
| `data/papers.json` | Papers, written by the arXiv updater. Do not edit by hand. |
| `data/meta.json` | Title, website and the survey citation. |

`README.md` and `PAPERS.md` are generated, so please do not edit them directly; changes would be overwritten. The website under [`site/`](site/) reads the same data.

## Add a resource

1. Fork the repository and create a branch.
2. Add an object to the `items` array of the right file in `data/resources/`:

   ```json
   {
     "name": "Example MCP Server",
     "url": "https://github.com/example/example-mcp-server",
     "description": "One sentence on what it does and why it is useful.",
     "tags": ["database"],
     "official": false
   }
   ```

   - `description`: one factual sentence, no marketing language.
   - `tags`: a few lowercase words. Reuse existing tags where you can.
   - `official`: set `true` only when the vendor or the MCP project itself maintains it.
   - Keep items roughly in order of importance, not alphabetically.
3. Check and regenerate:

   ```bash
   node scripts/validate.js       # checks fields, URLs and duplicates
   node scripts/build-readme.js   # regenerates README.md and PAPERS.md
   ```

   Node 20 or later is enough; there is nothing to install.
4. Commit with a clear message such as `servers: add Example MCP Server`, push, and open a pull request.

## Quality bar

- The project is public, documented and has been updated recently. Archived repositories are not accepted.
- It is not already listed. The validator catches duplicate URLs.
- Entries are about MCP, not just about AI tooling in general.

## The benchmark

Changes to [`benchmark/`](benchmark/) should keep `python3 verify_artifact.py` passing. Do not overwrite `benchmark/results/macbook-m4-pro/`; run `./run_replication.sh <your-label>` to add results from another machine.
