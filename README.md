<div align="center">

# Awesome MCP

**One place for Model Context Protocol papers, servers, clients, SDKs, benchmarks and tutorials.**

[![Code: MIT](https://img.shields.io/badge/code-MIT-lightgrey)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CC-BY-4.0)
[![Last commit](https://img.shields.io/github/last-commit/AI-in-Transportation-Lab/awesome-mcp)](https://github.com/AI-in-Transportation-Lab/awesome-mcp/commits/main)
[![Stars](https://img.shields.io/github/stars/AI-in-Transportation-Lab/awesome-mcp?style=flat)](https://github.com/AI-in-Transportation-Lab/awesome-mcp/stargazers)

[Website](https://ai-in-transportation-lab.github.io/awesome-mcp/) · [Papers](PAPERS.md) · [Survey references](SURVEY.md) · [Servers](#servers) · [Clients](#clients) · [SDKs](#sdks) · [Benchmark](#benchmark-and-reference-server) · [Contribute](CONTRIBUTING.md)

</div>

> [!NOTE]
> **Our survey**
>
> [Model Context Protocols in Adaptive Transport Systems: A Survey](https://arxiv.org/abs/2508.19239)
> <br><sub>Gaurab Chhetri, Shriyank Somvanshi, Md Monzurul Islam, Shamyo Brotee, Mahmuda Sultana Mimi, Dipti Koirala, Biplov Pandey, Subasish Das</sub>
>
> [Read on arXiv](https://arxiv.org/abs/2508.19239) · [Cite it](#cite) · [Works it cites](SURVEY.md) · [Benchmark and code](#benchmark-and-reference-server)

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that lets language-model applications connect to external tools, data and prompts through a uniform interface. This repository collects what you need to work with it: the research literature, servers, clients, SDKs, benchmarks and tutorials. It is maintained by the [AI in Transportation Lab](https://github.com/AI-in-Transportation-Lab).

Everything below is searchable on the **[website](https://ai-in-transportation-lab.github.io/awesome-mcp/)**, and papers are refreshed from arXiv every day.

**686** preprints · **526** published papers · **243** survey references · **19** servers · **10** clients · **15** SDKs and frameworks

<details>
<summary><b>Contents</b></summary>

- [Latest preprints](#latest-preprints)
- [Latest published papers](#latest-published-papers)
- [Survey references](#survey-references)
- [Servers](#servers)
- [Clients](#clients)
- [SDKs](#sdks)
- [Agent frameworks](#agent-frameworks)
- [Developer tools](#developer-tools)
- [Security](#security)
- [Benchmarks](#benchmarks)
- [Learning](#learning)
- [Directories](#directories)
- [Benchmark](#benchmark-and-reference-server)
- [Contributing](#contributing)
- [Cite](#cite)
- [License](#license)

</details>

## Latest preprints

New arXiv papers about the Model Context Protocol, newest first. The scope is computer science and electrical engineering papers that name the protocol in the title or abstract. The full list of 686 preprints, grouped by month, is in **[PAPERS.md](PAPERS.md)** and on the [website](https://ai-in-transportation-lab.github.io/awesome-mcp/).

| Date | Title | Authors |
| --- | --- | --- |
| 2026-11-23 | [LimoBench: How Street Smart Are Large Language Models?](https://arxiv.org/abs/2611.31682) | Gautam Choudhary, Jack Peng, Udesh Kumarasinghe et al. |
| 2026-11-22 | [EMIP: Embodied Multi-Party Interaction Platform](https://arxiv.org/abs/2611.29333) | Koichiro Terao, Rikunari Sagara, Moe Nagao et al. |
| 2026-11-22 | [IteraSong: LLM-Guided Iterative Symbolic Music Creation in a Web DAW](https://arxiv.org/abs/2611.29225) | Di Lu, Xinran Zhang, Yan Gao et al. |
| 2026-11-21 | [Ads for Agents: Measuring Ad-Serving MCP Servers](https://arxiv.org/abs/2611.28911) | Shahrooz Pouryousef, Sohini Chakraborty, Ali Montazer et al. |
| 2026-11-20 | [Epistemic Guard: Out-of-Process MCP Receipt Proxying, Post-Turn Prose Supervision, and Provenance-Gated Memory for Tool-Using Autonomous Agents](https://arxiv.org/abs/2611.27095) | Sean Maxwell |
| 2026-11-20 | [Subverting Tool Arguments: Defense-Evading Metadata Poisoning in LLM Agents](https://arxiv.org/abs/2611.27041) | Shih-Chieh Dai, Xinyu Sun, Haichuan Zhang et al. |
| 2026-11-19 | [SYLVA: Self-Correcting Multi-Agent Markets over Frozen LLMs via Escrow Settlement, Step-Level Fault Isolation, and Contextual Routing](https://arxiv.org/abs/2611.28148) | Hui Zhao |
| 2026-11-19 | [InfantConnect: integrating developmental brain atlases and electrophysiological network analysis](https://arxiv.org/abs/2611.26911) | Alessandro Crimi, Paweł Gryboś |
| 2026-11-19 | [Law at the Speed of AI: Critical Legal Infrastructure for the Machine Age: Autonomy Under Law Architecture (AULA)](https://arxiv.org/abs/2611.25985) | Natasha E Blycha, James Myint, Chen Feng et al. |
| 2026-11-18 | [FinVeriQA: Financial Research Agents for Question Answering: Routing, Retrieval, MCP Tool Use, and Provenance-Aware Evidence Verification](https://arxiv.org/abs/2611.25071) | Meenakshi Rajpurohit, Anna Phan, Ravikumar Komandur Narayanan et al. |
| 2026-11-17 | [Foundation Model-Driven Agentic AI for 6G](https://arxiv.org/abs/2611.23494) | Mohammad Ghassemi, Han Zhang, Akram Bin Sediq et al. |
| 2026-11-16 | [When Tool Names Are Not Identities: Measuring Provider Misbinding in MCP-Based AI Agents](https://arxiv.org/abs/2611.21577) | Zeynab Anbiaee, Sajjad Dadkhah, Ali A. Ghorbani |
| 2026-11-16 | [Experience Rot: Experienced Agents Fail Where Novices Succeed](https://arxiv.org/abs/2611.20922) | Zhen Xu, Hang Yin, Zitao Zhang et al. |
| 2026-11-15 | [Type-Confusion Security](https://arxiv.org/abs/2611.20298) | Silei Ren, Hanxi Chen, Suraaj Kanniwadi et al. |
| 2026-11-14 | [Do Rule-Based Tools Help LLMs Translate Endangered Uralic Languages in the Prompt or over MCP?](https://arxiv.org/abs/2611.19439) | Iaroslav Chelombitko, Mika Hämäläinen |
| 2026-11-14 | [Beyond Plain MCP: Do Decision Models and Code Mode Make Tool Use Cheaper and Faster?](https://arxiv.org/abs/2611.19123) | Abhishek Rai |
| 2026-11-12 | [Alloy: A Multi-Material Physics Engine for Robot Learning](https://arxiv.org/abs/2611.16312) | Pranay Gupta, Deepanshu Rohilla |
| 2026-11-11 | [ProdPilot: A Layered Model Context Protocol System for Automated Production Readiness and Deployment of Vibe-Coded Projects](https://arxiv.org/abs/2611.17381) | Muhammad Sudais Khalid, Muhammad Junaid Asif, Rehan Naveed Abbasi et al. |
| 2026-11-11 | [SpaceMCP: Vision Language Model Spatial Reasoning via Model Context Protocol](https://arxiv.org/abs/2611.15680) | Ameen Izhac, Nobuko Yoshida, Ronald Clark |
| 2026-11-10 | [OverServe: Resource Amplification Attacks on SaaS Agents via Tool--Prompt Co-Design](https://arxiv.org/abs/2611.14808) | Ruiheng Yu, Oteo Mamo, Siyu Gan et al. |

<sub>Last updated 2026-11-25.</sub>

## Latest published papers

Journal and conference papers found through [OpenAlex](https://openalex.org), newest first. All 526 are in **[PUBLISHED.md](PUBLISHED.md)** and on the [website](https://ai-in-transportation-lab.github.io/awesome-mcp/).

| Date | Title | Venue |
| --- | --- | --- |
| 2026-11-23 | [A Multilingual Security Benchmark for Indirect Prompt Injection in a Local Model Context Protocol File‐Summarization Workflow](https://doi.org/10.1002/spy2.70272) | Security and Privacy |
| 2026-11-22 | [Fully automated safety monitoring via sensor-based agentic LLM with Model Context Protocol](https://doi.org/10.1016/j.autcon.2026.107392) | Automation in Construction |
| 2026-11-21 | [Beyond Jenkins Logs: Benchmarking MCP-Enabled AI for Root-Cause Analysis and Remediation in Enterprise CI/CD](https://openalex.org/W7238546181) | International Journal of Business & Computational Science |
| 2026-11-18 | [Spatio-Temporal Provenance Guard: Detecting Privilege Escalation Attacks That Exploit Spatio-Temporal Data Loss in Multi-Agent MCP Environments](https://doi.org/10.3390/app162211449) | Applied Sciences |
| 2026-11-14 | [MCP Tool Poisoning in Agentic AI Frameworks: A Cross-Framework Measurement Study](https://doi.org/10.1145/3847352.3848107) | ACM Workshop on Artificial Intelligence and Security (AISec) |
| 2026-11-14 | [POSTER: From Signals to Risk: Taxonomy-Guided Mapping of Security-Relevant Signals in Open-Source MCP Servers](https://doi.org/10.1145/3830454.3846460) | ACM SIGSAC Conference on Computer and Communications Security (CCS) |
| 2026-11-10 | [Tool-augmented LLMs for chemical engineering: A model-source-driven MCP framework for membrane process simulation](https://doi.org/10.1016/j.cherd.2026.11.026) | Chemical Engineering Research and Design |
| 2026-11-09 | [Directional Contract Transition Revalidation for Model Context Protocol Tools: An Approval Continuity Framework for Evolving Agent Capabilities](https://doi.org/10.3390/fi18110615) | Future Internet |
| 2026-11-07 | [Finlet AI: An Evidence-Driven Multi-Agent Financial Intelligence Platform Using Model Context Protocol and Deterministic Risk Governance](https://doi.org/10.48175/ijarsct-40710) | International Journal of Advanced Research in Science Communication and Technology |
| 2026-11-07 | [MULTI-AGENT COORDINATION AND DISCOVERY USING MODEL CONTEXT PROTOCOL](https://doi.org/10.62441/actainnovations.vi.3587) | Acta Innovations |

## Survey references

The 243 works cited by our survey, grouped by the section or subsection that first cites them. This list is separate from the arXiv tracker and does not change when new papers appear. The analysis is in the survey; the list is here so you can find and filter what it builds on. See **[SURVEY.md](SURVEY.md)** or the [website](https://ai-in-transportation-lab.github.io/awesome-mcp/#survey).

| Where the survey cites them | Works |
| --- | ---: |
| Introduction | 20 |
| Survey Methodology | 11 |
| Autonomous and Adaptive Systems: Definitions and a Reference Model | 9 |
| Background and Positioning | 53 |
| Taxonomy of Unifying Models for Autonomous and Adaptive Systems | 10 |
| Adaptive Protocol Mechanisms | 5 |
| Context-Aware Frameworks | 2 |
| Unification Models | 5 |
| System Integration Architectures | 7 |
| Model Context Protocol: Specification, Architecture, and Mechanisms | 27 |
| MCP versus Established Protocols and Middleware | 27 |
| MCP in Context-Aware Transport Systems | 28 |
| Multi-Robot Coordination | 9 |
| Smart Manufacturing and Industrial Cyber-Physical Systems | 6 |
| Edge-AI Fleets and Federated Edge Intelligence | 4 |
| Performance Analysis and Evaluation | 11 |
| Challenges and Open Problems | 5 |
| Future Research Directions | 4 |

## Servers

MCP servers that expose tools, resources and prompts for real systems

| Name | Description | Tags |
| --- | --- | --- |
| [Reference servers](https://github.com/modelcontextprotocol/servers) | The protocol's reference implementations: filesystem, git, fetch, memory and more | **official** `reference` `files` |
| [GitHub MCP Server](https://github.com/github/github-mcp-server) | GitHub's official server for repositories, issues, pull requests and Actions | **official** `devtools` |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Browser automation through Playwright, driven by accessibility snapshots | **official** `browser` |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Lets coding agents inspect, debug and automate Chrome through DevTools | **official** `browser` `devtools` |
| [Context7](https://github.com/upstash/context7) | Serves up-to-date, version-specific library documentation to agents | `docs` |
| [Notion MCP Server](https://github.com/makenotion/notion-mcp-server) | Notion's official server for reading and editing workspaces | **official** `productivity` |
| [Atlassian Remote MCP Server](https://github.com/atlassian/atlassian-mcp-server) | Atlassian's official remote server for Jira and Confluence | **official** `productivity` |
| [Cloudflare MCP servers](https://github.com/cloudflare/mcp-server-cloudflare) | Product-specific Cloudflare servers for Workers, DNS, logs and more | **official** `cloud` |
| [Supabase MCP](https://github.com/supabase/mcp) | Connects assistants to Supabase projects, databases and edge functions | **official** `database` `cloud` |
| [AWS MCP servers](https://github.com/awslabs/mcp) | Open-source MCP servers for AWS services and documentation | **official** `cloud` |
| [Microsoft MCP catalog](https://github.com/microsoft/mcp) | Catalog of official Microsoft MCP server implementations | **official** `cloud` |
| [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server) | HashiCorp's server for the Terraform registry and workspaces | **official** `devops` |
| [Stripe agent toolkit](https://github.com/stripe/ai) | Stripe's tools for AI agents, including an MCP server for payments APIs | **official** `payments` |
| [Figma Context MCP](https://github.com/GLips/Figma-Context-MCP) | Gives coding agents Figma layout and style information | `design` |
| [Blender MCP](https://github.com/ahujasid/mcp-for-blender) | Controls Blender 3D scenes from an LLM client | `3d` |
| [ROS MCP Server](https://github.com/robotmcp/ros-mcp-server) | Connects LLMs to ROS and ROS 2 robots through MCP | `robotics` `transportation` |
| [lit-mcp](https://github.com/gauravfs-14/lit-mcp) | Academic literature search across databases, for LLM-assisted literature reviews | `research` |
| [WritBase](https://github.com/Writbase/writbase) | MCP-native task management for fleets of AI agents, with permissions and provenance | `agents` |
| [operant-mcp](https://github.com/operantlabs/operant-mcp) | Security testing server with tools for penetration testing and forensics | `security` |

## Clients

Applications that connect to MCP servers

| Name | Description | Tags |
| --- | --- | --- |
| [Claude Desktop](https://claude.ai/download) | Anthropic's desktop app, the original MCP host | **official** `chat` |
| [Claude Code](https://github.com/anthropics/claude-code) | Agentic coding tool for the terminal with MCP support | **official** `coding` `cli` |
| [Cursor](https://cursor.com) | AI code editor with MCP server support | `coding` `editor` |
| [VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) | Use MCP servers with agent mode in Visual Studio Code | `coding` `editor` |
| [Zed](https://github.com/zed-industries/zed) | High-performance editor that can load MCP servers as context servers | `coding` `editor` |
| [Cline](https://github.com/cline/cline) | Autonomous coding agent for the IDE and CLI with MCP support | `coding` |
| [Continue](https://github.com/continuedev/continue) | Open-source coding agent that can use MCP servers | `coding` |
| [goose](https://github.com/aaif-goose/goose) | Extensible open-source AI agent built around MCP extensions | `agents` |
| [LibreChat](https://github.com/LibreChat-AI/LibreChat) | Self-hosted chat UI with agents and MCP support | `chat` |
| [Cherry Studio](https://github.com/CherryHQ/cherry-studio) | Desktop AI workspace with MCP support | `chat` |

## SDKs

Libraries for building MCP servers and clients

| Name | Description | Tags |
| --- | --- | --- |
| [Python SDK](https://github.com/modelcontextprotocol/python-sdk) | The official Python SDK | **official** `python` |
| [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | The official TypeScript SDK | **official** `typescript` |
| [Java SDK](https://github.com/modelcontextprotocol/java-sdk) | The official Java SDK | **official** `java` |
| [Kotlin SDK](https://github.com/modelcontextprotocol/kotlin-sdk) | The official Kotlin SDK | **official** `kotlin` |
| [C# SDK](https://github.com/modelcontextprotocol/csharp-sdk) | The official C# SDK, maintained with Microsoft | **official** `csharp` |
| [Go SDK](https://github.com/modelcontextprotocol/go-sdk) | The official Go SDK, maintained with Google | **official** `go` |
| [Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) | The official Rust SDK | **official** `rust` |
| [Swift SDK](https://github.com/modelcontextprotocol/swift-sdk) | The official Swift SDK | **official** `swift` |
| [Ruby SDK](https://github.com/modelcontextprotocol/ruby-sdk) | The official Ruby SDK | **official** `ruby` |
| [PHP SDK](https://github.com/modelcontextprotocol/php-sdk) | The official PHP SDK | **official** `php` |
| [FastMCP](https://github.com/PrefectHQ/fastmcp) | The fast, Pythonic way to build MCP servers and clients | `python` |
| [mcp-use](https://github.com/mcp-use/mcp-use) | Full-stack framework for building MCP servers, clients and MCP Apps | `typescript` `python` |
| [Spring AI](https://github.com/spring-projects/spring-ai) | Application framework for AI engineering on the JVM, with MCP client and server support | `java` |
| [MCP Apps (ext-apps)](https://github.com/modelcontextprotocol/ext-apps) | Spec and SDK for interactive UIs served over MCP | **official** `ui` |
| [MCP-UI](https://github.com/MCP-UI-Org/mcp-ui) | UI over MCP: SDK for returning interactive components from tools | `ui` |

## Agent frameworks

Agent frameworks with built-in MCP support

| Name | Description | Tags |
| --- | --- | --- |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Lightweight multi-agent framework with MCP server support | `python` |
| [Google Agent Development Kit](https://github.com/google/adk-python) | Code-first toolkit for building and evaluating agents, with MCP tools | `python` |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Typed Python agent framework with MCP client support | `python` |
| [mcp-agent](https://github.com/lastmile-ai/mcp-agent) | Builds effective agents from MCP servers and simple workflow patterns | `python` |

## Developer tools

Testing, debugging, proxying and registry infrastructure

| Name | Description | Tags |
| --- | --- | --- |
| [MCP Inspector](https://github.com/modelcontextprotocol/inspector) | Interactive tool for testing and debugging MCP servers | **official** `testing` |
| [MCP Registry](https://github.com/modelcontextprotocol/registry) | Community-driven registry service for MCP servers | **official** `registry` |
| [mcpo](https://github.com/open-webui/mcpo) | Exposes MCP servers as OpenAPI HTTP servers | `proxy` |
| [mcp-proxy](https://github.com/sparfenyuk/mcp-proxy) | Bridges Streamable HTTP and stdio MCP transports | `proxy` |
| [Docker MCP Gateway](https://github.com/docker/mcp-gateway) | Docker CLI plugin that runs and manages MCP servers in containers | `gateway` |
| [MCP Context Forge](https://github.com/IBM/mcp-context-forge) | Gateway, registry and proxy that sits in front of MCP and A2A servers | `gateway` |

## Security

Scanning and guidance for MCP deployments

| Name | Description | Tags |
| --- | --- | --- |
| [Agent Scan](https://github.com/snyk/agent-scan) | Security scanner for AI agents, MCP servers and agent skills (formerly mcp-scan) | `scanner` |
| [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Official guidance on attacks and mitigations for MCP implementations | **official** `guidance` |
| [MCPSecBench](https://github.com/AIS2Lab/MCPSecBench) | Systematic security benchmark and playground for MCP | `benchmark` |
| [MCPTox](https://github.com/zhiqiangwang4/MCPTox-Benchmark) | Benchmark for tool-poisoning attacks on real-world MCP servers | `benchmark` |

## Benchmarks

Benchmarks that measure how well models and agents use MCP

| Name | Description | Tags |
| --- | --- | --- |
| [MCP overhead micro-benchmark](https://github.com/benchmark/) | Serialization and transport micro-benchmark with a reference MAPE-K MCP server (this repository) | `latency` `this-repo` |
| [MCP-Bench](https://github.com/Accenture/mcp-bench) | Benchmarks tool-using LLM agents on complex real-world tasks across MCP servers | `agents` |
| [MCP-Universe](https://github.com/SalesforceAIResearch/MCP-Universe) | Framework for benchmarking models against real-world MCP servers | `agents` |
| [LiveMCPBench](https://github.com/icip-cas/LiveMCPBench) | Evaluates whether agents can navigate a large set of MCP tools | `agents` `tool-selection` |
| [MCPMark](https://github.com/eval-sys/mcpmark) | Stress-testing benchmark for models and agents on MCP tasks | `agents` |
| [MCPEval](https://github.com/SalesforceAIResearch/MCPEval) | MCP-based deep evaluation system for agents | `agents` |
| [MCPToolBench++](https://github.com/mcp-tool-bench/MCPToolBenchPP) | Tool-use benchmark for agents and models over MCP tools | `tool-use` |

## Learning

Specification, documentation, courses and tutorials

| Name | Description | Tags |
| --- | --- | --- |
| [MCP documentation](https://modelcontextprotocol.io) | Official documentation and introduction | **official** `docs` |
| [Specification](https://modelcontextprotocol.io/specification/latest) | The latest protocol specification | **official** `spec` |
| [Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture) | Hosts, clients, servers and the layers of the protocol | **official** `docs` |
| [Build a server](https://modelcontextprotocol.io/docs/develop/build-server) | Official tutorial for writing your first MCP server | **official** `tutorial` |
| [Build a client](https://modelcontextprotocol.io/docs/develop/build-client) | Official tutorial for writing your first MCP client | **official** `tutorial` |
| [Hugging Face MCP Course](https://huggingface.co/learn/mcp-course) | Free course on building and using MCP | `course` |
| [MCP: Build Rich-Context AI Apps with Anthropic](https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/) | Short course from DeepLearning.AI and Anthropic | `course` |
| [MCP for Beginners](https://github.com/microsoft/mcp-for-beginners) | Open-source curriculum with examples in several languages | `course` |

## Directories

Where to find more servers and clients

| Name | Description | Tags |
| --- | --- | --- |
| [Official MCP Registry](https://registry.modelcontextprotocol.io) | The community registry of published MCP servers | **official** `registry` |
| [Smithery](https://smithery.ai) | Registry and hosting for MCP servers | `registry` |
| [Glama MCP directory](https://glama.ai/mcp/servers) | Searchable directory of MCP servers | `registry` |
| [mcp.so](https://mcp.so) | Community directory of MCP servers and clients | `registry` |
| [awesome-mcp-servers (punkpeye)](https://github.com/punkpeye/awesome-mcp-servers) | Large collection of MCP servers | `list` |
| [awesome-mcp-servers (wong2)](https://github.com/wong2/awesome-mcp-servers) | Curated list of MCP servers | `list` |
| [awesome-mcp-clients](https://github.com/punkpeye/awesome-mcp-clients) | Collection of MCP clients | `list` |
| [awesome-remote-mcp-servers](https://github.com/punkpeye/awesome-remote-mcp-servers) | Collection of remote MCP servers | `list` |

## Benchmark and reference server

[`benchmark/`](benchmark/) is the executable artifact for our survey: serialization and transport micro-benchmarks, plus a reference MAPE-K MCP server pinned to the official Python SDK 2.3.0. Median of three runs on an Apple M4 Pro, echoing a 50-detection perception frame over loopback:

| Path | Payload (B) | Median (ms) | p99 (ms) |
| --- | ---: | ---: | ---: |
| Raw TCP + MessagePack | 7,702 | 0.07 | 0.08 |
| Zenoh pub/sub | 3,445 | 0.09 | 0.17 |
| DDS (Cyclone) pub/sub | 3,445 | 0.11 | 0.19 |
| gRPC unary (Protobuf) | 3,445 | 0.15 | 0.21 |
| JSON-RPC 2.0 over stdio (no SDK) | 7,609 | 0.28 | 0.33 |
| MCP stdio `tools/call` | 7,609 | 1.01 | 1.24 |
| MCP Streamable HTTP `tools/call` | 7,609 | 2.12 | 3.04 |

> [!IMPORTANT]
> The benchmark is synthetic and single-host. Read the numbers as orders of magnitude, not guarantees. Setup, scripts and limits are in [`benchmark/README.md`](benchmark/README.md).

## Contributing

Contributions are welcome: new servers, clients, tutorials, benchmarks, corrections. Papers are collected automatically, so there is no need to submit those. Start with [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](https://github.com/AI-in-Transportation-Lab/awesome-mcp/issues/new/choose).

> [!NOTE]
> The tables in this file are generated from [`data/`](data/). To add or fix an entry, edit the JSON there and open a pull request.

## Cite

If this collection or the benchmark is useful in your work, please cite our survey. GitHub's **Cite this repository** button uses [CITATION.cff](CITATION.cff).

```bibtex
@article{chhetri2025model,
  title   = {Model Context Protocols in Adaptive Transport Systems: A Survey},
  author  = {Gaurab Chhetri and
            Shriyank Somvanshi and
            Md Monzurul Islam and
            Shamyo Brotee and
            Mahmuda Sultana Mimi and
            Dipti Koirala and
            Biplov Pandey and
            Subasish Das},
  journal = {arXiv preprint arXiv:2508.19239},
  year    = {2025}
}
```

<sub>We will update the citation when the survey is published.</sub>

## License

| What | License |
| --- | --- |
| Code: `scripts/`, `site/`, `benchmark/` and the workflows | [MIT](LICENSE) |
| Content: `data/`, the generated lists and the documentation | [CC BY 4.0](LICENSE-CC-BY-4.0) |

Paper metadata comes from arXiv and OpenAlex, which publish it openly. Fonts and icons on the site keep their own licenses, in [`site/fonts/`](site/fonts/LICENSE.txt) and [`site/icons.LICENSE.txt`](site/icons.LICENSE.txt).
