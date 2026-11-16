const state = {
  stage: "start",
  question: "",
  caseType: "diagnose",
  metric: "target metric",
  clarification: "",
  dataContext: "",
  analysisResult: null,
  assumptions: []
};

const caseTypes = {
  diagnose: {
    label: "Diagnose a metric change",
    playbook: "Clarify the metric definition -> check the time pattern (sudden or gradual) -> internal causes (data, tracking, bugs, releases) vs external causes (seasonality, competitors, events) -> check whether related products or features moved too -> segment by region, platform, new vs existing users -> decompose the metric (e.g. DAU = retained + new + resurrected - churned) -> summarize the most likely cause and the fix"
  },
  measure: {
    label: "Measure success",
    playbook: "Clarify what the product does, who it is for, and what goal it serves -> pick at most 3 well-defined success metrics -> add 1 guardrail metric -> check that each metric actually fits this situation"
  },
  launch: {
    label: "Launch or not",
    playbook: "Clarify the goal -> state a hypothesis with success and guardrail metrics -> design the experiment (randomization unit, groups, sample size, MDE, duration) -> read the results (statistical vs practical significance) -> weigh short-term vs long-term impact when results conflict -> recommend launch or not and translate it into business impact"
  },
  improve: {
    label: "Improve a product",
    playbook: "Clarify the goal (engagement, retention, or revenue) and the scope -> walk the user journey (aware -> start -> complete) to find friction -> segment users (never used, lapsed, active) -> prioritize ideas by impact x cost -> define how you would measure the top idea"
  }
};

const skillLibrary = {
  clarify: {
    name: "Clarification Skill",
    source: "Emma Ding product case framework",
    when: "Always first, especially when the question is broad or ambiguous.",
    does: "Pins down the goal, scope, metric definition, time window, target users, and constraints before any analysis.",
    output: "A small set of high-signal questions so you answer the right question."
  },
  metricDiagnosis: {
    name: "Metric Diagnosis Skill",
    source: "Author's own framework",
    when: "Use when a metric drops, spikes unexpectedly, or conflicts with another metric.",
    does: "Checks the metric definition, time pattern, data quality, internal vs external causes, related metrics, and decomposition into components.",
    output: "Ranked root-cause hypotheses and the analysis path to prove or disprove each one."
  },
  metricDesign: {
    name: "Metric Design Skill",
    source: "Emma Ding product case framework",
    when: "Use when you need to define what success looks like for a product, feature, or experiment.",
    does: "Picks up to three clearly defined success metrics (who counts, what action, what time window) plus one guardrail metric.",
    output: "A short metric set that is precise enough to compute and fits the product's goal."
  },
  userJourney: {
    name: "User Journey Skill",
    source: "Emma Ding product case framework",
    when: "Use when the goal is to improve a product or increase a behavior.",
    does: "Walks the journey from becoming aware of a feature, to starting it, to completing it, and finds where users drop off.",
    output: "The step with the most friction, which is where improvement ideas should focus."
  },
  segmentation: {
    name: "Segmentation Skill",
    source: "Emma Ding product case framework",
    when: "Use when the answer may differ by platform, region, user tenure, acquisition source, or behavior.",
    does: "Cuts the metric by platform, region, new vs existing users, acquisition source, and usage level.",
    output: "The segment that explains most of the change or holds the biggest opportunity."
  },
  inference: {
    name: "Inference Skill",
    source: "Author's own framework",
    when: "Use when descriptive numbers are not enough to know whether something caused the movement.",
    does: "Separates mix shift (the user population changed) from real change within segments; uses cohorts, counterfactuals, and causal caveats.",
    output: "A defensible interpretation of what most likely caused the change."
  },
  prioritization: {
    name: "Prioritization Skill",
    source: "Emma Ding product case framework",
    when: "Use when you have several ideas and limited time or engineering capacity.",
    does: "Scores each idea by how many users it reaches, how much it moves the goal metric, and how costly it is to build.",
    output: "A ranked shortlist with one clear top idea to test first."
  },
  sql: {
    name: "SQL Generation Skill",
    source: "Author's own framework",
    when: "Use when the analysis needs evidence from the data.",
    does: "Selects tables, joins users, events, and experiment data, and writes a query that matches the chosen framework.",
    output: "SQL you can run or adapt to your own warehouse."
  },
  experiment: {
    name: "Experiment Design Skill",
    source: "Emma Ding product case framework",
    when: "Use when a recommendation needs proof before a full rollout.",
    does: "Defines the hypothesis, randomization unit, primary metric, guardrails, sample size and MDE, duration, and the decision rule.",
    output: "A validation plan that turns an insight into a measurable decision."
  },
  executiveSummary: {
    name: "Executive Summary Skill",
    source: "Author's own framework",
    when: "Always at the end.",
    does: "Turns the analysis into a short recommendation with business impact, confidence, caveats, and next step.",
    output: "A plain-English answer a non-technical stakeholder can act on."
  }
};

const skillChains = {
  diagnose: ["clarify", "metricDiagnosis", "segmentation", "inference", "sql", "experiment", "executiveSummary"],
  measure: ["clarify", "metricDesign", "segmentation", "sql", "executiveSummary"],
  launch: ["clarify", "metricDesign", "experiment", "inference", "sql", "executiveSummary"],
  improve: ["clarify", "userJourney", "segmentation", "prioritization", "experiment", "executiveSummary"]
};

const examples = [
  "Our music streaming app's 7-day retention dropped from 42% to 29% after a redesign. How should I investigate?",
  "A meditation app just launched a Sleep Stories feature. How do we know it's doing well?",
  "A PM wants to double the number of ads in a social app's feed. Should we launch it?",
  "How would you get more people to create posts on a social app?"
];

const exampleTags = ["Diagnose", "Measure success", "Launch or not", "Improve"];

const coachNotes = {
  ask: {
    why: "A good case starts from one concrete question about a metric or a decision.",
    mistake: "Asking \"how do I improve the product?\" — too broad to analyze."
  },
  clarify: {
    why: "Always clarify first: what the metric means, who the users are, what the goal is. Answering the wrong question is the biggest red flag.",
    mistake: "Jumping straight to causes before agreeing what the number means."
  },
  structure: {
    why: "Use a framework so you don't miss anything, but adapt it to the question instead of following it blindly.",
    mistake: "Reciting a memorized framework step by step even where it doesn't fit."
  },
  query: {
    why: "Quality over quantity: three well-defined metrics beat five vague ones. Separate mix shift from real change.",
    mistake: "Reading one overall average and stopping there."
  },
  conclusion: {
    why: "End with a recommendation, the business impact, and how you'd test it. Summarize your structure out loud.",
    mistake: "Ending with \"it's complicated\" or a recommendation nobody can measure."
  }
};

const chatThread = document.querySelector("#chatThread");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const suggestions = document.querySelector("#suggestions");

function classifyQuestion(question) {
  const q = question.toLowerCase();
  if (/(measure|success|doing well|health|衡量|成功)/.test(q)) {
    return "measure";
  }
  if (/(\bshould (we|i|they)\b(?!\s+(investigate|look|dig|diagnose|analy|approach|start|think|measure))|\blaunch(?!ed)|\bship\b|\ba\/b\b|\bab test|experiment|\btest\b|上线|要不要)/.test(q)) {
    return "launch";
  }
  if (/(drop|dropped|declin|fell|decrease|went down|spike|investigate|下降|掉)/.test(q)) {
    return "diagnose";
  }
  if (/(improve|increase|grow|ideas|get more|more people|提升|改进)/.test(q)) {
    return "improve";
  }
  return "diagnose";
}

function detectMetric(question) {
  const q = question.toLowerCase();
  const candidates = [
    ["DAU", /(\bdau\b|daily active)/],
    ["retention", /(retention|留存)/],
    ["activation", /(activation|activate|激活)/],
    ["churn", /(churn|流失)/],
    ["conversion", /(conversion|convert|转化)/],
    ["engagement", /(engagement|engaged|参与)/],
    ["ads revenue", /(ads? revenue|\bads\b|广告)/],
    ["posts", /(\bposts?\b|posting|发帖)/],
    ["adoption", /(adoption|usage|使用|采用)/],
    ["renewal", /(renewal|renew|续约)/],
    ["expansion", /(expansion|expand|扩容)/],
    ["CAC", /(cac|customer acquisition cost)/]
  ];
  const found = candidates.find(([, pattern]) => pattern.test(q));
  return found ? found[0] : "target metric";
}

function extractPercentages(text) {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1]));
}

function getSelectedSkills() {
  return skillChains[state.caseType].map((key) => ({ key, ...skillLibrary[key] }));
}

function renderCoachNote(step) {
  const note = coachNotes[step];
  return `<aside class="coach-note"><span class="coach-title">Coach note</span><p><strong>Why:</strong> ${escapeHtml(note.why)}</p><p><strong>Common mistake:</strong> ${escapeHtml(note.mistake)}</p></aside>`;
}

function renderSkillCards(skills) {
  return skills
    .map(
      (skill) => `
        <div class="mini-card">
          <strong>${skill.name}</strong>
          <span>${skill.does}</span>
        </div>
      `
    )
    .join("");
}

function renderSkillDetails(skills) {
  return skills
    .map(
      (skill, index) => `${index + 1}. ${skill.name}
Source: ${skill.source}
When to use: ${skill.when}
What it does: ${skill.does}
Output: ${skill.output}`
    )
    .join("\n\n");
}

function addMessage(role, html) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const initials = role === "user" ? "YOU" : "AI";
  message.innerHTML = `
    <div class="avatar">${initials}</div>
    <div class="bubble">${html}</div>
  `;
  chatThread.appendChild(message);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSuggestions(items) {
  suggestions.innerHTML = items
    .map((item) => {
      const tone = item.primary ? "chip primary" : "chip";
      return `<button class="${tone}" type="button" data-action="${item.action}">${item.label}</button>`;
    })
    .join("");
}

function showWelcome() {
  chatThread.innerHTML = "";
  addMessage(
    "agent",
    `<span class="label">Start here</span>
    <p>Pick one of the four common question types below, or ask your own. I'll walk you through it step by step — clarify, structure, query sample data, and land a recommendation.</p>
    <div class="structure-grid">
      ${examples
        .map((example, index) => `<button class="mini-card example-button" type="button" data-example="${escapeHtml(example)}"><span class="case-tag">${exampleTags[index]}</span><span>${escapeHtml(example)}</span></button>`)
        .join("")}
    </div>
    ${renderCoachNote("ask")}`
  );
  setSuggestions([{ label: "Try the retention example", action: "example_activation", primary: true }]);
  state.stage = "start";
}

function startCase(question) {
  state.question = question;
  state.caseType = classifyQuestion(question);
  state.metric = detectMetric(question);
  state.clarification = "";
  state.dataContext = "";
  state.analysisResult = null;
  state.assumptions = [];

  addMessage("user", `<p>${escapeHtml(question)}</p>`);
  askClarifyingQuestions();
}

function askClarifyingQuestions() {
  state.stage = "clarify";
  const type = caseTypes[state.caseType];
  const skills = getSelectedSkills();
  addMessage(
    "agent",
    `<span class="label">${type.label}</span>
    <p>This is a <strong>${type.label}</strong> question. These are the skills I will lean on first:</p>
    <div class="structure-grid">
      ${renderSkillCards(skills.slice(0, 4))}
    </div>
    ${makeDetails("Full skill chain", renderSkillDetails(skills))}
    <p>Before solving anything, I would make sure we are answering the right question. I would ask:</p>
    <ol>
      ${getClarifyingQuestions().map((question) => `<li>${question}</li>`).join("")}
    </ol>
    <p>Reply with whatever you know. If you do not know, say <strong>assume reasonable defaults</strong>.</p>
    ${renderCoachNote("clarify")}`
  );
  setSuggestions([
    { label: "Assume reasonable defaults", action: "assume_defaults", primary: true },
    { label: "Generate structure now", action: "structure" }
  ]);
}

function getClarifyingQuestions() {
  if (state.caseType === "measure") {
    return [
      "What does the feature do, and what problem does it solve for the user?",
      "Who is it for: all users, new users, or a specific group such as heavy users?",
      "What is the business goal behind it: engagement, retention, or revenue?",
      "How long has it been live, and is it available to everyone or only some users?"
    ];
  }
  if (state.caseType === "launch") {
    return [
      "What is the goal of the change: more revenue, more engagement, or something else?",
      "What could it hurt? Which user experience or long-term metric are we worried about?",
      "Has it been tested yet, or are we designing the experiment from scratch?",
      "Is this a reversible change we can roll back, and how much traffic can we test on?"
    ];
  }
  if (state.caseType === "improve") {
    return [
      "What does \"more\" mean here: more people doing it at least once, or the same people doing it more often?",
      "What is the underlying goal: engagement, retention, or revenue?",
      "Which users are in scope: everyone, new users, or people who have never done it?",
      "Are there constraints such as a time frame, team size, or platform?"
    ];
  }
  return [
    `What exactly counts as ${state.metric}: who is in the denominator, what action counts, and over what time window?`,
    "When did it change, and did it happen suddenly (one day) or gradually (over weeks)?",
    "Did anything else change at the same time: a release, a tracking change, a marketing campaign, or a holiday?",
    "Is it everywhere, or concentrated in one platform, region, or user group?"
  ];
}

function getDefaultAssumptions() {
  if (state.caseType === "measure") {
    return "Assume reasonable defaults: the feature is live for all users for about two weeks, it targets existing users, and the goal is long-term engagement and retention.";
  }
  if (state.caseType === "launch") {
    return "Assume reasonable defaults: the goal is revenue, the main risk is a worse user experience that lowers engagement, nothing has been tested yet, and the change is easy to roll back.";
  }
  if (state.caseType === "improve") {
    return "Assume reasonable defaults: more people creating at least one item per week, the underlying goal is engagement, all active users are in scope, and we have one quarter.";
  }
  return "Assume reasonable defaults: standard metric definition, the change happened suddenly after a release, no known tracking change yet, and we do not know which segment is affected.";
}

function acceptClarification(text) {
  state.clarification = text;
  addMessage("user", `<p>${escapeHtml(text)}</p>`);
  showStructure();
}

function showStructure() {
  state.stage = "structure";
  const type = caseTypes[state.caseType];
  const skills = getSelectedSkills();
  addMessage(
    "agent",
    `<span class="label">Proposed structure</span>
    <p>Here is the structure I would use. It follows the <strong>${type.label}</strong> framework, adapted to this question.</p>
    <div class="structure-grid">
      ${getStructureCards().map(([title, body]) => `<div class="mini-card"><strong>${title}</strong><span>${body}</span></div>`).join("")}
    </div>
    <details class="detail-card" open>
      <summary>Why this structure</summary>
      <div class="detail-content">
        <p>${type.playbook}</p>
      </div>
    </details>
    ${makeDetails("Skills used in this structure", renderSkillDetails(skills))}
    <p>Does this structure fit the way you want to solve the case?</p>
    ${renderCoachNote("structure")}`
  );
  setSuggestions([
    { label: "Looks good, query the sample data", action: "run_analysis", primary: true },
    { label: "Give final answer with assumptions", action: "final" },
    { label: "Restart", action: "restart" }
  ]);
}

function getStructureCards() {
  if (state.caseType === "measure") {
    return [
      ["Goal", "Restate what the feature does, who it is for, and which business goal it serves."],
      ["Adoption", "What share of eligible users tried it at least once in their first 7 days?"],
      ["Engagement", "Among users who tried it, how deeply and how often do they use it each week?"],
      ["Retention", "Do users who adopt it come back more over 4 weeks than similar users who don't?"],
      ["Guardrail", "Make sure it isn't just stealing time from other parts of the product."],
      ["Fit check", "Confirm each metric is clearly defined and actually reflects this feature's goal."]
    ];
  }
  if (state.caseType === "launch") {
    return [
      ["Goal", "Clarify what the change is meant to achieve and what it could put at risk."],
      ["Hypothesis", "State the expected effect, the primary success metric, and the guardrail metrics."],
      ["Experiment design", "Randomization unit, control vs treatment, sample size, MDE, and duration."],
      ["Read results", "Check statistical significance and whether the effect is large enough to matter."],
      ["Trade-offs", "If metrics conflict, weigh the short-term win against the long-term cost."],
      ["Decision", "Launch, launch a smaller version, or don't launch — translated into business impact."]
    ];
  }
  if (state.caseType === "improve") {
    return [
      ["Goal", "Clarify whether we want more people doing it, or the same people doing it more."],
      ["User journey", "Aware of the feature -> start it -> complete it -> get value. Find the biggest drop-off."],
      ["Segments", "Never done it, used to do it but stopped, and doing it regularly need different ideas."],
      ["Ideas", "Generate a few ideas that remove friction at the weakest step for the biggest segment."],
      ["Prioritize", "Rank ideas by impact (users reached x expected lift) against cost to build."],
      ["Measure", "Define the primary metric and guardrail for testing the top idea."]
    ];
  }
  return [
    ["Clarify the metric", `Agree on how ${state.metric} is defined: who counts, what action, what time window.`],
    ["Time pattern", "Sudden drops usually mean a release, bug, or tracking change; gradual ones point to trends."],
    ["Internal vs external", "Internal: data pipeline, tracking, bugs, releases. External: seasonality, competitors, news events."],
    ["Related metrics", "Did other features or products move too? A shared drop suggests a common cause."],
    ["Segment", "Cut by platform, region, new vs existing users, and acquisition source to find where it lives."],
    ["Decompose & infer", "Break the metric into parts (retained + new + resurrected - churned) and separate mix shift from real change."]
  ];
}

function runInternalAnalysis() {
  state.stage = "analysis";
  state.analysisResult = buildAnalysisResult();
  const result = state.analysisResult;
  const skills = getSelectedSkills();
  addMessage(
    "agent",
    `<span class="label">Querying sample data</span>
    <p>Now I let the structure decide what to query. The data below comes from a simulated sample warehouse, so you can see what real evidence for each step looks like.</p>
    <div class="structure-grid">
      ${result.sources.map(([title, body]) => `<div class="mini-card"><strong>${title}</strong><span>${body}</span></div>`).join("")}
    </div>
    ${makeDetails("Skill-to-data mapping", renderSkillDataMapping(skills))}
    ${makeDetails("SQL used for this step", result.sql)}
    <p><strong>Result:</strong> ${result.result}</p>
    <p><strong>Conclusion:</strong> ${result.conclusion}</p>
    ${renderCoachNote("query")}`
  );
  setSuggestions([
    { label: "Explain how you got this", action: "reasoning", primary: true },
    { label: "Generate final answer", action: "final" },
    { label: "Show data needed if not connected", action: "data_needed" }
  ]);
}

function renderSkillDataMapping(skills) {
  return skills
    .map((skill) => {
      if (skill.key === "sql") {
        return `${skill.name}: writes the query against the sample warehouse (sample_warehouse.*).`;
      }
      if (skill.key === "inference") {
        return `${skill.name}: decides whether the result is mix shift, a real change, or not enough evidence.`;
      }
      if (skill.key === "segmentation") {
        return `${skill.name}: chooses cuts such as platform, region, new vs existing users, and acquisition source.`;
      }
      if (skill.key === "metricDesign") {
        return `${skill.name}: defines exactly which events and time windows each success and guardrail metric uses.`;
      }
      if (skill.key === "userJourney") {
        return `${skill.name}: pulls step-by-step funnel events to find where users drop off.`;
      }
      if (skill.key === "prioritization") {
        return `${skill.name}: sizes each segment so ideas can be ranked by reach and expected impact.`;
      }
      return `${skill.name}: ${skill.output}`;
    })
    .join("\n");
}

function showDataNeededFallback() {
  state.stage = "data";
  addMessage(
    "agent",
    `<span class="label">If you don't have the data</span>
    <p>In an interview, or when you can't query data yourself, ask for these fields. Asking for specific data shows you know what evidence would settle the question.</p>
    <ol>
      ${getDataRequests().map((request) => `<li>${request}</li>`).join("")}
    </ol>
    ${renderCoachNote("query")}`
  );
  setSuggestions([
    { label: "Use the sample warehouse", action: "run_analysis", primary: true },
    { label: "Final answer with assumptions", action: "final" }
  ]);
}

function getDataRequests() {
  if (state.caseType === "measure") {
    return [
      "Daily count of eligible users and users who used the feature at least once, since launch.",
      "Per-user feature usage: sessions per week and completion rate.",
      "4-week retention for adopters vs similar non-adopters (same signup week, platform, and prior activity).",
      "Usage of the rest of the product per user, before and after launch, to check for cannibalization."
    ];
  }
  if (state.caseType === "launch") {
    return [
      "Experiment assignment table: user, group (control or treatment), and assignment date.",
      "Primary metric per user during the test (for example revenue per user).",
      "Guardrail metrics per user: time spent, sessions, 7-day retention, and negative feedback such as hides or reports.",
      "Pre-experiment values of the same metrics, to check the groups were balanced."
    ];
  }
  if (state.caseType === "improve") {
    return [
      "Funnel events for each step of the journey: saw the entry point, started, completed.",
      "User segments: never did it, did it before but stopped, does it regularly — with counts.",
      "What happens after completion, such as feedback received, and whether that predicts doing it again.",
      "Any qualitative signal: survey answers or support tickets about why people stop."
    ];
  }
  return [
    `Daily ${state.metric} for the last 8–12 weeks, with release and tracking-change dates marked.`,
    `${state.metric} split by platform, app version, region, new vs existing users, and acquisition source.`,
    "Segment sizes before and after the change, to measure mix shift.",
    "Step-by-step funnel events for the flow most likely affected, before and after the change."
  ];
}

function buildAnalysisResult() {
  if (state.caseType === "measure") return buildMeasureAnalysisResult();
  if (state.caseType === "launch") return buildLaunchAnalysisResult();
  if (state.caseType === "improve") return buildImproveAnalysisResult();
  return buildDiagnoseAnalysisResult();
}

function getChangeNumbers() {
  const values = extractPercentages(`${state.question} ${state.clarification} ${state.dataContext}`);
  if (values.length < 2) {
    return { baseline: "the baseline", current: "the current level", delta: null, mix: null, real: null };
  }
  const delta = Math.round(Math.abs(values[1] - values[0]) * 10) / 10;
  const mix = Math.round(delta * 0.3 * 10) / 10;
  const real = Math.round((delta - mix) * 10) / 10;
  return { baseline: `${values[0]}%`, current: `${values[1]}%`, delta, mix, real };
}

function buildDiagnoseAnalysisResult() {
  const metric = state.metric;
  const numbers = getChangeNumbers();
  const split = numbers.delta
    ? `About ${numbers.mix} of the ${numbers.delta} points come from mix shift (a marketing push brought in more low-intent new users), and about ${numbers.real} points are a real decline within segments.`
    : "About 30% of the drop comes from mix shift (a marketing push brought in more low-intent new users), and about 70% is a real decline within segments.";
  return {
    sources: [
      ["Metric definitions", `${metric} definition, eligible users, and time window`],
      ["Event log", "sessions, key actions, and funnel steps by user and day"],
      ["Users table", "signup date, platform, app version, region, acquisition source"],
      ["Release log", "app releases, tracking changes, experiments, and campaigns"]
    ],
    sql: `-- Diagnose a change in ${metric}: where did it happen, and is it mix shift or real change?
with user_metric as (
  select
    u.user_id,
    u.signup_week,
    u.platform,
    u.region,
    case when u.signup_date >= current_date - interval '28 days' then 'new' else 'existing' end as tenure,
    u.acquisition_source,
    case when r.release_date is not null and u.first_seen_date >= r.release_date
      then 'after_release' else 'before_release' end as period,
    max(case when e.days_since_signup between 1 and 7 then 1 else 0 end) as retained_7d
  from sample_warehouse.users u
  left join sample_warehouse.events e
    on u.user_id = e.user_id
  left join sample_warehouse.releases r
    on r.release_name = 'redesign'
  where u.signup_week >= current_date - interval '12 weeks'
  group by 1, 2, 3, 4, 5, 6, 7
),
by_segment as (
  select
    platform,
    tenure,
    acquisition_source,
    avg(case when period = 'before_release' then retained_7d end) as before_rate,
    avg(case when period = 'after_release' then retained_7d end) as after_rate,
    count(case when period = 'before_release' then 1 end) as users_before,
    count(case when period = 'after_release' then 1 end) as users_after
  from user_metric
  group by 1, 2, 3
)
select *,
  after_rate - before_rate as within_segment_change,
  users_after * (after_rate - before_rate) as weighted_impact
from by_segment
order by abs(weighted_impact) desc;`,
    result: `The drop was sudden and started on the day of the release; tracking checks found no logging change. It is concentrated in new Android users: their ${metric} fell sharply, while iOS and existing users barely moved. ${split}`,
    conclusion: `The most likely cause is a usability problem in the redesigned first-time flow on Android, not a product-wide decline. Fix or roll back that flow first, then confirm ${metric} recovers for new Android users.`
  };
}

function buildMeasureAnalysisResult() {
  return {
    sources: [
      ["Event log", "feature opens, starts, completions, and timestamps"],
      ["Users table", "signup date, platform, prior activity level"],
      ["Sessions", "time spent and sessions per user across the whole product"],
      ["Release log", "feature launch date and rollout percentage"]
    ],
    sql: `-- Measure success of a new feature: adoption, engagement, retention, and a guardrail
with eligible as (
  select user_id, platform, signup_week
  from sample_warehouse.users
  where last_active_date >= (select launch_date from sample_warehouse.releases where release_name = 'new_feature')
),
feature_use as (
  select
    e.user_id,
    count(case when e.event_name = 'feature_start' then 1 end) as starts,
    count(case when e.event_name = 'feature_complete' then 1 end) as completes
  from sample_warehouse.events e
  where e.event_date >= current_date - interval '14 days'
  group by 1
)
select
  avg(case when f.starts > 0 then 1.0 else 0 end) as adoption_rate,
  sum(f.completes) * 1.0 / nullif(sum(f.starts), 0) as completion_rate,
  avg(case when f.starts > 0 then s.retained_week4 end) as adopter_week4_retention,
  avg(case when coalesce(f.starts, 0) = 0 then s.retained_week4 end) as non_adopter_week4_retention,
  avg(s.other_sessions_per_week_after) - avg(s.other_sessions_per_week_before) as guardrail_other_usage_change
from eligible u
left join feature_use f on u.user_id = f.user_id
left join sample_warehouse.user_weekly_summary s on u.user_id = s.user_id;`,
    result: "In the first two weeks, 18% of eligible weekly users tried the feature at least once, and 61% of starts were completed. Adopters had 46% week-4 retention vs 38% for similar non-adopters. The guardrail held: usage of the rest of the product changed by only -1% per user.",
    conclusion: "Early signals are healthy: real adoption, strong completion, and no sign of stealing usage from the core product. The retention gap is partly self-selection (engaged users try new things), so confirm it with a small holdout group before claiming the feature causes retention."
  };
}

function buildLaunchAnalysisResult() {
  return {
    sources: [
      ["Experiment assignments", "user, group, and assignment date for a 2-week test"],
      ["Revenue events", "impressions, clicks, and revenue per user"],
      ["Engagement events", "sessions, time spent, and 7-day retention"],
      ["Feedback events", "hides, reports, and negative signals"]
    ],
    sql: `-- Read an A/B test: primary metric plus guardrails, by group
with per_user as (
  select
    a.user_id,
    a.group_name,
    sum(r.revenue) as revenue,
    sum(g.minutes_spent) as minutes_spent,
    max(g.retained_7d) as retained_7d,
    count(case when f.event_name = 'hide_item' then 1 end) as hides
  from sample_warehouse.experiment_assignments a
  left join sample_warehouse.revenue_events r on a.user_id = r.user_id and r.event_date >= a.assigned_date
  left join sample_warehouse.engagement_daily g on a.user_id = g.user_id and g.event_date >= a.assigned_date
  left join sample_warehouse.feedback_events f on a.user_id = f.user_id and f.event_date >= a.assigned_date
  where a.experiment_name = 'feed_change_test'
  group by 1, 2
)
select
  group_name,
  count(*) as users,
  avg(revenue) as revenue_per_user,
  avg(minutes_spent) as minutes_per_user,
  avg(retained_7d) as retention_7d,
  avg(hides) as hides_per_user,
  stddev(revenue) as revenue_sd
from per_user
group by 1;`,
    result: "Revenue per user rose 14% (statistically significant). But time spent fell 3.2% (significant), hides per user rose 40%, and 7-day retention dipped 0.6 points (not yet significant after two weeks, but trending down).",
    conclusion: "The results conflict: a clear short-term revenue win against signs of long-term damage to engagement, which is what future revenue depends on. Don't launch the full change; test a smaller version and run longer to see whether the engagement loss grows."
  };
}

function buildImproveAnalysisResult() {
  return {
    sources: [
      ["Funnel events", "saw entry point, opened composer, started, published"],
      ["Users table", "signup date, platform, activity level"],
      ["Feedback events", "replies, likes, and views on a user's first item"],
      ["Segments", "never did it, did it before but stopped, does it regularly"]
    ],
    sql: `-- Improve a behavior: find the leakiest journey step and size each segment
with journey as (
  select
    user_id,
    max(case when event_name = 'entry_point_seen' then 1 else 0 end) as aware,
    max(case when event_name = 'composer_opened' then 1 else 0 end) as started,
    max(case when event_name = 'item_published' then 1 else 0 end) as completed
  from sample_warehouse.events
  where event_date >= current_date - interval '28 days'
  group by 1
),
segments as (
  select
    user_id,
    case
      when lifetime_items = 0 then 'never'
      when items_last_28d = 0 then 'lapsed'
      else 'active'
    end as creator_segment
  from sample_warehouse.user_summary
)
select
  s.creator_segment,
  count(*) as users,
  avg(j.aware) as aware_rate,
  avg(case when j.aware = 1 then j.started end) as start_rate,
  avg(case when j.started = 1 then j.completed end) as complete_rate
from segments s
join journey j on s.user_id = j.user_id
group by 1
order by users desc;`,
    result: "70% of monthly users have never created anything, so that is the biggest segment. Most of them see the entry point, but of those who open the composer, 45% leave without publishing. Among people who did create, those who got no response in the first 24 hours were about half as likely to create again.",
    conclusion: "The biggest friction is the blank-page moment in the composer, and the second is no feedback after the first try. Start with low-cost composer help (prompts or templates) for never-creators, and make sure first items get seen."
  };
}

function acceptData(text) {
  state.dataContext = text;
  addMessage("user", `<p>${escapeHtml(text)}</p>`);
  showFinalAnswer();
}

function showFinalAnswer() {
  state.stage = "final";
  const answer = buildFinalAnswer();
  const result = state.analysisResult;
  addMessage(
    "agent",
    `<span class="label">Conclusion</span>
    ${answer.summary}
    ${result ? `<p><strong>Data-backed conclusion:</strong> ${result.conclusion}</p>` : ""}
    ${answer.cards}
    ${makeDetails("How I got this conclusion", buildReasoningExplanation())}
    ${makeDetails("SQL / analysis plan", result ? result.sql : answer.sql)}
    ${makeDetails("Experiment or validation plan", answer.experiment)}
    ${makeDetails("Concise talk track", answer.talkTrack)}
    ${renderCoachNote("conclusion")}`
  );
  setSuggestions([
    { label: "Try another case", action: "restart", primary: true },
    { label: "Ask for SQL detail", action: "sql" },
    { label: "Ask for final pitch", action: "pitch" }
  ]);
}

function buildReasoningExplanation() {
  const skills = getSelectedSkills();
  return `1. Clarify the question
I first identified this as a "${caseTypes[state.caseType].label}" question. The question type decides which framework to use, instead of forcing one generic framework onto everything.

2. Pick the skill chain
Selected skills:
${skills.map((skill) => `- ${skill.name}: ${skill.output}`).join("\n")}

3. Adapt the framework to this case
I kept the steps that matter for this question and skipped the ones that don't. A framework is a checklist so you don't miss anything, not a script to recite.

4. Let the structure decide the data
Each step of the structure points to a specific query: which table, which metric, which cut. Writing SQL comes after knowing what question it answers.

5. Analyze carefully
I looked beyond the overall average: cut by segment, checked whether the user mix changed, and checked whether the effect is large enough to matter, not just statistically significant.

6. End with a testable recommendation
I translated the finding into an action, its business impact, and a way to measure it, so the answer can actually be acted on.`;
}

function makeDetails(title, content) {
  return `
    <details class="detail-card">
      <summary>${title}</summary>
      <div class="detail-content"><pre${/SQL/.test(title) ? ' class="code"' : ""}>${escapeHtml(content)}</pre></div>
    </details>
  `;
}

function buildFinalAnswer() {
  if (state.caseType === "measure") return buildMeasureAnswer();
  if (state.caseType === "launch") return buildLaunchAnswer();
  if (state.caseType === "improve") return buildImproveAnswer();
  return buildDiagnoseAnswer();
}

function buildDiagnoseAnswer() {
  const numbers = getChangeNumbers();
  const delta = numbers.delta ? `-${numbers.delta} pts (${numbers.baseline} -> ${numbers.current})` : "Size not given yet";
  return {
    summary: `
      <p>I would treat this as a structured ${state.metric} investigation, not a dashboard scroll.</p>
      <p>The goal is to find out whether the move from ${numbers.baseline} to ${numbers.current} comes from a data problem, a change in who the users are (mix shift), or a real change in how users behave — and then fix the right thing.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Observed change</strong><span>${delta}</span></div>
        <div class="mini-card"><strong>Top hypothesis</strong><span>A release broke or slowed a key step for one segment (e.g. new users on one platform).</span></div>
        <div class="mini-card"><strong>Inference check</strong><span>Recompute ${state.metric} with the old user mix to separate mix shift from real change.</span></div>
        <div class="mini-card"><strong>Recommendation</strong><span>Fix or roll back the affected flow for that segment, then confirm the metric recovers.</span></div>
      </div>
    `,
    sql: `-- Analysis plan for diagnosing ${state.metric}
-- 1. Plot daily ${state.metric} for 12 weeks; mark releases and tracking changes.
-- 2. Validate tracking: event counts per platform and app version around the change date.
-- 3. Segment by platform, region, new vs existing users, acquisition source.
-- 4. Decompose: metric_change = mix_effect + within_segment_effect
select
  segment,
  share_before, share_after,
  rate_before, rate_after,
  (share_after - share_before) * rate_before as mix_effect,
  share_after * (rate_after - rate_before) as within_segment_effect
from sample_warehouse.segment_metric_summary
order by abs(within_segment_effect) desc;`,
    experiment: `Hypothesis: The new flow added friction for the affected segment. Restoring or fixing that step will bring ${state.metric} back toward the baseline.

Design: Randomize new users in the affected segment between the current flow and the fixed (or previous) flow.

Primary metric: ${state.metric} (using the agreed definition and time window).
Secondary metrics: completion rate of the affected step, sessions in the first week.
Guardrails: crash rate, signup completion, any metric the redesign was meant to improve.

Decision rule: Ship the fix if ${state.metric} improves by a meaningful amount with no guardrail getting worse.`,
    talkTrack: `First I would clarify how ${state.metric} is defined and when the change started. Because the drop was sudden, I would check internal causes first — tracking, bugs, and the release — before external ones like seasonality or competitors. Then I would segment by platform, region, and new vs existing users, and separate mix shift from real change. Here, most of the drop is a real decline among new users on one platform right after the release, so I would fix that flow and test it, using ${state.metric} as the primary metric with crash rate and signups as guardrails.`
  };
}

function buildMeasureAnswer() {
  return {
    summary: `
      <p>"Doing well" only means something once we tie it to the feature's goal.</p>
      <p>I would use three clearly defined success metrics — adoption, engagement, and retention — plus one guardrail to make sure the feature isn't just taking time away from the rest of the product.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Adoption</strong><span>% of eligible weekly users who start the feature at least once within 7 days.</span></div>
        <div class="mini-card"><strong>Engagement</strong><span>Completion rate per start, and uses per adopter per week.</span></div>
        <div class="mini-card"><strong>Retention</strong><span>Week-4 retention of adopters vs similar non-adopters (confirm with a holdout).</span></div>
        <div class="mini-card"><strong>Guardrail</strong><span>Usage of the rest of the product per user should not drop.</span></div>
      </div>
    `,
    sql: `-- Success metric definitions
-- adoption_rate   = users with >= 1 feature_start in 7 days / eligible weekly active users
-- completion_rate = feature_complete events / feature_start events
-- retention_gap   = week-4 retention (adopters) - week-4 retention (matched non-adopters)
-- guardrail       = change in other-feature sessions per user, before vs after launch
select adoption_rate, completion_rate, retention_gap, guardrail_other_usage_change
from sample_warehouse.feature_success_summary;`,
    experiment: `Validation: Keep a small random holdout (for example 5% of users) who don't see the feature for 4 weeks.

Primary metric: week-4 retention, holdout vs exposed users.
Secondary metrics: adoption rate, completion rate, uses per adopter per week.
Guardrail: sessions in the rest of the product per user.

Decision rule: Call the feature a success if exposed users retain meaningfully better than the holdout and the guardrail holds.`,
    talkTrack: `I would start by clarifying what the feature does, who it is for, and what goal it serves. Then I would pick three well-defined metrics: adoption — the share of eligible users who try it in a week; engagement — how often they complete it; and retention — whether adopters come back more. I would add one guardrail, usage of the rest of the product, to catch cannibalization. Because adopters self-select, I would confirm the retention effect with a small holdout before calling it a success.`
  };
}

function buildLaunchAnswer() {
  return {
    summary: `
      <p>This is a launch decision, so the answer should come from a well-designed experiment, not opinion.</p>
      <p>The key is to measure both the intended win (the primary metric) and what it might cost (guardrails), and to weigh short-term gains against long-term user experience.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Decision</strong><span>Don't launch the full change; test a smaller version for longer.</span></div>
        <div class="mini-card"><strong>Primary metric</strong><span>Revenue per user: +14%, significant.</span></div>
        <div class="mini-card"><strong>Guardrails</strong><span>Time spent -3.2% and hides +40%; retention trending down.</span></div>
        <div class="mini-card"><strong>Business impact</strong><span>Short-term revenue now vs fewer engaged users and less future revenue later.</span></div>
      </div>
    `,
    sql: `-- Experiment readout
-- lift = (treatment_mean - control_mean) / control_mean
-- check: p-value < 0.05 AND lift > practical threshold (e.g. +2% revenue, < -1% time spent)
select metric_name, control_mean, treatment_mean,
       (treatment_mean - control_mean) / control_mean as lift,
       p_value
from sample_warehouse.experiment_results
where experiment_name = 'feed_change_test';`,
    experiment: `Hypothesis: A moderate version of the change raises revenue without meaningfully hurting engagement.

Design: Randomize at the user level (so each person has a consistent experience). Control = current experience; treatments = 1.3x and 1.5x of the change.
Sample size: Size the test to detect a 1% change in time spent (MDE) with 80% power at 5% significance.
Duration: At least 4 weeks, covering full weekly cycles and letting novelty effects fade.

Primary metric: revenue per user.
Guardrails: time spent per user, 7-day retention, negative feedback (hides, reports).

Decision rule: Launch the largest version where revenue lift is significant and meaningful and no guardrail drops beyond its threshold.`,
    talkTrack: `I would clarify the goal — revenue — and what we're worried about — user experience. I would run a user-level A/B test with revenue per user as the primary metric and time spent, retention, and negative feedback as guardrails. In the results, revenue rose 14%, but time spent fell and hides rose sharply, so the metrics conflict. Since engagement drives future revenue, I would not launch the full change. Instead I would test smaller versions for at least four weeks and pick the one that grows revenue without hurting engagement.`
  };
}

function buildImproveAnswer() {
  return {
    summary: `
      <p>To improve a behavior, find where users get stuck and who gets stuck, then pick the cheapest idea with the biggest reach.</p>
      <p>Here the biggest group is people who have never done it, and the biggest friction is the blank-page moment right after they start.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Biggest segment</strong><span>~70% of monthly users have never done it.</span></div>
        <div class="mini-card"><strong>Biggest friction</strong><span>45% of people who start leave without finishing.</span></div>
        <div class="mini-card"><strong>Top idea</strong><span>Prompts or templates at the start step: high reach, low cost.</span></div>
        <div class="mini-card"><strong>Next ideas</strong><span>Make sure first attempts get feedback; auto-save drafts; rewards only if cheap ideas fail.</span></div>
      </div>
    `,
    sql: `-- Prioritization: impact x cost
-- impact = users_reached * expected_lift_in_goal_metric
-- idea                          reach     expected_lift   cost     priority
-- prompts / templates at start  high      medium          low      1
-- feedback on first attempt     medium    high            medium   2
-- auto-save drafts              medium    low             low      3
-- creator rewards program       high      medium          high     4
select creator_segment, users, aware_rate, start_rate, complete_rate
from sample_warehouse.journey_by_segment;`,
    experiment: `Hypothesis: Showing prompts or templates when someone opens the composer reduces the blank-page drop-off and gets more people to finish.

Design: Randomize users who have never created anything, at the user level: control = current composer; treatment = composer with prompts.
Duration: 2–4 weeks to cover weekly cycles.

Primary metric: % of weekly active users who publish at least one item.
Secondary metrics: start-to-finish rate, second item within 14 days.
Guardrails: quality signals (reports or hides per item), and time spent reading other people's content.

Decision rule: Launch if more people create and quality and reading time don't drop.`,
    talkTrack: `First I would clarify whether "more" means more people or more items per person, and what goal it serves. Then I would walk the user journey — seeing the entry point, starting, finishing — and segment users into never, lapsed, and active. The biggest opportunity is never-creators who start but give up on a blank page. I would rank ideas by impact against cost, start with prompts or templates because they are cheap and reach the most users, and test it with the share of weekly users who create something as the primary metric and content quality as the guardrail.`
  };
}

function handleAction(action) {
  if (action === "restart") {
    showWelcome();
    return;
  }
  if (action === "example_activation") {
    messageInput.value = examples[0];
    messageInput.focus();
    return;
  }
  if (action === "assume_defaults") {
    state.assumptions.push("reasonable defaults");
    acceptClarification(getDefaultAssumptions());
    return;
  }
  if (action === "structure") {
    showStructure();
    return;
  }
  if (action === "run_analysis") {
    runInternalAnalysis();
    return;
  }
  if (action === "data_needed") {
    showDataNeededFallback();
    return;
  }
  if (action === "reasoning") {
    addMessage(
      "agent",
      `<span class="label">Reasoning path</span>
      <p>The framework decided what to query, not the other way around.</p>
      ${makeDetails("Framework-to-data logic", buildReasoningExplanation())}`
    );
    setSuggestions([
      { label: "Generate final answer", action: "final", primary: true },
      { label: "Show data needed if not connected", action: "data_needed" }
    ]);
    return;
  }
  if (action === "partial_data") {
    acceptData("Partial data only: the overall metric over time, a split by platform and new vs existing users, and a few funnel steps.");
    return;
  }
  if (action === "final") {
    showFinalAnswer();
    return;
  }
  if (action === "sql") {
    const sql = state.analysisResult ? state.analysisResult.sql : buildFinalAnswer().sql;
    addMessage("agent", `<span class="label">SQL detail</span><p>This is the SQL behind the analysis, written against a simulated sample warehouse. Table and column names are illustrative — adapt them to your own data.</p>${makeDetails("SQL", sql)}`);
    return;
  }
  if (action === "pitch") {
    addMessage("agent", `<span class="label">Final pitch</span><p>Product Case Coach teaches people without a product background how to think systematically about product data questions. It sorts a question into one of four types — diagnose a metric change, measure success, launch or not, improve a product — then walks through clarifying, structuring, querying sample data, and concluding, with a coach note at every step explaining why it matters and what mistake to avoid.</p>`);
  }
}

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = "";

  if (state.stage === "start" || state.stage === "final") {
    startCase(text);
    return;
  }
  if (state.stage === "clarify") {
    acceptClarification(text);
    return;
  }
  if (state.stage === "structure") {
    addMessage("user", `<p>${escapeHtml(text)}</p>`);
    if (/data|query|run|good|yes|ok|looks|warehouse|database/i.test(text)) {
      runInternalAnalysis();
    } else {
      addMessage("agent", `<span class="label">Adjusted</span><p>I will keep the structure but bias the final answer toward your focus: ${escapeHtml(text)}.</p>`);
      runInternalAnalysis();
    }
    return;
  }
  if (state.stage === "data") {
    acceptData(text);
    return;
  }
  if (state.stage === "analysis") {
    addMessage("user", `<p>${escapeHtml(text)}</p>`);
    if (/final|answer|conclusion|yes|ok|good/i.test(text)) {
      showFinalAnswer();
    } else {
      addMessage("agent", `<span class="label">Next step</span><p>I can incorporate that as an additional constraint, then produce the final answer.</p>`);
      showFinalAnswer();
    }
  }
});

suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  handleAction(button.dataset.action);
});

chatThread.addEventListener("click", (event) => {
  const button = event.target.closest("[data-example]");
  if (!button) return;
  messageInput.value = button.dataset.example;
  messageInput.focus();
});

document.querySelector("#resetConversation").addEventListener("click", showWelcome);

showWelcome();
