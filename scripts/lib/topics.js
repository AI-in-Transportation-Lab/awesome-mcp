// Keyword topics, derived from a title (and abstract when we have one). They are
// recomputed on every update, so editing a rule here relabels everything.
const RULES = {
  security: /\b(secur\w*|attack\w*|vulnerab\w*|poison\w*|injection|malicious|privacy|threat\w*|adversar\w*|authori[sz]\w*|exploit\w*|jailbreak\w*)\b/i,
  benchmark: /\b(benchmark\w*|leaderboard|stress[- ]test\w*|testbed|dataset)\b/i,
  // Deliberately no road or general transportation topic: those words pull in road-traffic papers
  // that are outside our scope. Adaptive and autonomous systems is the survey's own subject.
  adaptive: /\b(self-adaptive|adaptive systems?|autonomic|MAPE-K|autonomous systems?|cyber-physical|digital twins?|edge[- ]AI)\b/i,
  robotics: /\b(robot\w*|embodied)\b|\bROS ?2?\b/i,
  networks: /\b(6G|5G|IoT|edge computing|telecom\w*|wireless|O-RAN|network slicing|latency)\b/i,
  industrial: /\b(manufactur\w*|industrial|PLC|OPC ?UA|factory|cyber-physical|CPS)\b/i,
  agents: /\b(multi-agent|multiagent|agent interoperability|A2A|agent-to-agent|swarm\w*)\b/i,
};

export const TOPIC_LABELS = {
  security: "Security",
  benchmark: "Benchmarks",
  adaptive: "Adaptive systems",
  robotics: "Robotics",
  networks: "Networks and edge",
  industrial: "Industrial",
  agents: "Multi-agent",
};

export function topicsOf(...texts) {
  const s = texts.filter(Boolean).join(" ");
  return Object.keys(RULES).filter((t) => RULES[t].test(s));
}
