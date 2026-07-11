const state = {
  stage: "start",
  question: "",
  caseType: "metric",
  metric: "target metric",
  clarification: "",
  dataContext: "",
  analysisResult: null,
  assumptions: []
};

const caseTypes = {
  metric: {
    label: "Metric Diagnosis",
    playbook: "Clarify metric -> QA data -> decompose lifecycle -> segment accounts -> infer cause -> design test"
  },
  feature: {
    label: "Launch / Feature Decision",
    playbook: "Clarify goal -> map personas -> model ROI -> assess risk -> design beta -> decide launch"
  },
  acquisition: {
    label: "Acquisition Efficiency",
    playbook: "Clarify goal -> define ICP -> compare funnel quality -> model LTV/CAC -> simulate budget -> decide scale"
  }
};

const skillLibrary = {
  clarify: {
    name: "Clarification Skill",
    source: "Emma Ding product case framework",
    when: "Always first, especially when the question is broad or ambiguous.",
    does: "Clarifies goal, scope, metric definition, time window, persona, and constraints before analysis.",
    output: "A small set of high-signal questions instead of a generic answer."
  },
  b2bLifecycle: {
    name: "B2B Lifecycle Skill",
    source: "B2B Product Sense framework",
    when: "Use for Plaud Team questions involving acquisition, onboarding, activation, usage, renewal, or expansion.",
    does: "Maps the issue across Lead -> Demo -> Trial -> Paid -> Onboarding -> Activation -> Usage -> Renewal -> Expansion.",
    output: "The likely lifecycle stage where the issue is happening."
  },
  metricDiagnosis: {
    name: "Metric Diagnosis Skill",
    source: "Handwritten metric drop workflow + Emma metric diagnosis",
    when: "Use when a metric drops, rises unexpectedly, or conflicts with another metric.",
    does: "Checks metric definition, time trend, data QA, internal/external causes, decomposition, segmentation, and counterfactuals.",
    output: "Ranked root-cause hypotheses and the analysis path to prove or disprove them."
  },
  segmentation: {
    name: "Segmentation Skill",
    source: "Emma user segmentation + B2B account segmentation",
    when: "Use when the cause may differ by account, channel, persona, plan, platform, geography, or cohort.",
    does: "Cuts the metric by channel, team size, vertical, admin role, platform, plan, new vs existing account, and cohort.",
    output: "The segment most responsible for the business impact."
  },
  inference: {
    name: "Inference Skill",
    source: "Handwritten inference analytics framework",
    when: "Use when descriptive metrics are not enough to know whether an action caused the movement.",
    does: "Separates mix shift from true within-segment change; uses cohort comparison, counterfactuals, and causal caveats.",
    output: "A defensible interpretation of what likely caused the change."
  },
  sql: {
    name: "SQL Generation Skill",
    source: "Technical analytics execution layer",
    when: "Use when the copilot needs evidence from Plaud warehouse or semantic metrics.",
    does: "Selects tables, joins account/event/revenue data, and writes a query aligned to the selected framework.",
    output: "SQL the data platform can run or adapt."
  },
  featureRoi: {
    name: "Feature ROI Skill",
    source: "B2B Product Sense ROI / launch-or-not framework",
    when: "Use for questions like should Plaud build, launch, price, or package a feature.",
    does: "Evaluates customer value, buyer value, cost, revenue lift, retention, expansion, risk, and opportunity cost.",
    output: "Build, beta, delay, or reject recommendation with proof plan."
  },
  acquisition: {
    name: "Acquisition Efficiency Skill",
    source: "B2B Product Sense acquisition framework",
    when: "Use for CAC, channel, lead quality, pipeline, payback, and growth-budget questions.",
    does: "Compares channel quality by ICP fit, funnel conversion, activated teams, retention, LTV/CAC, payback, and support load.",
    output: "Scale, narrow, cap, or pause channel recommendation."
  },
  experiment: {
    name: "Experiment Design Skill",
    source: "Emma launch-or-not + A/B testing framework",
    when: "Use when a recommendation needs proof before rollout.",
    does: "Defines hypothesis, unit of randomization, primary metric, guardrails, sample-size logic, readout, and decision rule.",
    output: "A validation plan that turns insight into action."
  },
  executiveSummary: {
    name: "Executive Summary Skill",
    source: "B2B stakeholder communication pattern",
    when: "Always at the end.",
    does: "Translates technical analysis into a concise conclusion for non-technical stakeholders.",
    output: "Plain-English answer, confidence, caveats, and next step."
  }
};

const skillChains = {
  metric: ["clarify", "metricDiagnosis", "b2bLifecycle", "segmentation", "inference", "sql", "experiment", "executiveSummary"],
  feature: ["clarify", "featureRoi", "b2bLifecycle", "sql", "experiment", "executiveSummary"],
  acquisition: ["clarify", "acquisition", "b2bLifecycle", "segmentation", "inference", "sql", "experiment", "executiveSummary"]
};

const examples = [
  "Plaud Team activation dropped from 42% to 29% after B2B launch. How should I investigate?",
  "Should Plaud build CRM integration for B2B sales teams?",
  "Paid search CAC is low but Plaud Team activation is weak. Should we increase budget?"
];

const chatThread = document.querySelector("#chatThread");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const suggestions = document.querySelector("#suggestions");

function classifyQuestion(question) {
  const q = question.toLowerCase();
  if (/(cac|channel|acquisition|lead|mql|pipeline|paid search|outbound|inbound|budget|spend|\u83b7\u5ba2|\u6e20\u9053|\u6295\u653e|\u9884\u7b97)/.test(q)) {
    return "acquisition";
  }
  if (/(should|build|launch|ship|feature|intent|emotion|sentiment|crm|pricing|roadmap|\u662f\u5426|\u8981\u4e0d\u8981|\u529f\u80fd|\u4e0a\u7ebf|\u53d1\u5e03)/.test(q)) {
    return "feature";
  }
  return "metric";
}

function detectMetric(question) {
  const q = question.toLowerCase();
  const candidates = [
    ["activation", /(activation|activate|\u6fc0\u6d3b)/],
    ["retention", /(retention|\u7559\u5b58)/],
    ["renewal", /(renewal|renew|\u7eed\u7ea6)/],
    ["churn", /(churn|\u6d41\u5931)/],
    ["conversion", /(conversion|convert|\u8f6c\u5316)/],
    ["adoption", /(adoption|usage|\u4f7f\u7528|\u91c7\u7528)/],
    ["expansion", /(expansion|expand|\u6269\u5bb9)/],
    ["CAC", /(cac|customer acquisition cost)/],
    ["NRR", /(nrr|net revenue retention)/]
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
    `<span class="label">Internal analytics copilot</span>
    <p>Ask one Plaud B2B product question in plain English. I will clarify the case, choose the right framework, write SQL when needed, simulate querying Plaud's internal warehouse, then explain the conclusion and reasoning.</p>
    <div class="structure-grid">
      ${examples
        .map((example) => `<button class="mini-card example-button" type="button" data-example="${escapeHtml(example)}"><strong>Example</strong><span>${example}</span></button>`)
        .join("")}
    </div>`
  );
  setSuggestions([{ label: "Use activation drop example", action: "example_activation", primary: true }]);
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
    <p>I classified this as <strong>${type.label}</strong>. I selected these skills first:</p>
    <div class="structure-grid">
      ${renderSkillCards(skills.slice(0, 4))}
    </div>
    ${makeDetails("Full skill chain", renderSkillDetails(skills))}
    <p>I would first clarify the problem before solving it. For this Plaud B2B case, I would ask:</p>
    <ol>
      ${getClarifyingQuestions().map((question) => `<li>${question}</li>`).join("")}
    </ol>
    <p>Reply with whatever you know. If you do not know, say <strong>assume reasonable defaults</strong>.</p>`
  );
  setSuggestions([
    { label: "Assume reasonable defaults", action: "assume_defaults", primary: true },
    { label: "Generate structure now", action: "structure" }
  ]);
}

function getClarifyingQuestions() {
  if (state.caseType === "feature") {
    return [
      "What business outcome should this feature improve: ARPA, retention, expansion, sales conversion, or differentiation?",
      "Who is the primary B2B persona: end user, admin, buyer, sales manager, IT, or compliance owner?",
      "What risk matters most: privacy, accuracy, trust, implementation cost, or opportunity cost?",
      "Should the answer optimize for beta validation, full launch, or roadmap prioritization?"
    ];
  }
  if (state.caseType === "acquisition") {
    return [
      "Are we optimizing cheap leads, paid accounts, activated teams, retained ARR, or payback period?",
      "Which channel, segment, or campaign are we discussing?",
      "Do we have downstream quality data: activation, retention, expansion, support load, and LTV/CAC?",
      "Is there a sales or customer-success capacity constraint?"
    ];
  }
  return [
    `What exactly counts as ${state.metric}: numerator, denominator, and account-level aggregation?`,
    "What time window are we comparing, and did the movement happen suddenly or gradually?",
    "Is the issue global, or concentrated in self-serve, sales-led, SMB, mid-market, a vertical, or a channel?",
    "Do we know whether tracking, product release timing, or customer mix changed?"
  ];
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
    <p>Here is the structure I would use. It is specific to Plaud B2B, but still interview-friendly.</p>
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
    <p>Does this structure fit the way you want to solve the case?</p>`
  );
  setSuggestions([
    { label: "Looks good, query Plaud data", action: "run_analysis", primary: true },
    { label: "Give final answer with assumptions", action: "final" },
    { label: "Restart", action: "restart" }
  ]);
}

function getStructureCards() {
  if (state.caseType === "feature") {
    return [
      ["Goal", "Clarify whether the feature should drive retention, expansion, ARPA, or strategic differentiation."],
      ["Personas", "Separate end user value from admin, buyer, IT, and compliance concerns."],
      ["ROI", "Estimate revenue upside, retention lift, expansion potential, model cost, support cost, and opportunity cost."],
      ["Risk", "Check privacy, trust, model accuracy, explainability, and workflow fit."],
      ["Validation", "Recommend beta, experiment, or customer discovery before broad launch."],
      ["Decision", "Ship, beta, delay, or reject with clear evidence thresholds."]
    ];
  }
  if (state.caseType === "acquisition") {
    return [
      ["Goal", "Clarify whether success means cheap leads or retained high-quality B2B revenue."],
      ["ICP", "Compare the channel against Plaud's ideal team account profile."],
      ["Funnel", "Measure Lead -> Demo -> Trial -> Paid -> Activated Team -> Retained Account."],
      ["Unit economics", "Use CAC, LTV/CAC, payback, sales effort, and support cost."],
      ["Quality", "Check activation, retention, expansion, and account health by segment."],
      ["Decision", "Scale, narrow targeting, cap spend, or pause."]
    ];
  }
  return [
    ["Goal", `Clarify why ${state.metric} matters for Plaud B2B business performance.`],
    ["Metric definition", "Define numerator, denominator, eligible population, and account aggregation."],
    ["Data QA", "Check tracking, dashboard logic, missing data, outliers, and product release timing."],
    ["Lifecycle", "Map the issue across signup, onboarding, activation, usage, renewal, and expansion."],
    ["Segmentation", "Cut by channel, team size, vertical, admin role, platform, and cohort."],
    ["Inference", "Separate mix shift from true within-segment performance change before recommending fixes."]
  ];
}

function runInternalAnalysis() {
  state.stage = "analysis";
  state.analysisResult = buildAnalysisResult();
  const result = state.analysisResult;
  const skills = getSelectedSkills();
  addMessage(
    "agent",
    `<span class="label">Running internal analysis</span>
    <p>I would use Plaud's internal platform instead of asking a non-technical teammate to gather raw data. The selected skills decide what to query and how to interpret it.</p>
    <div class="structure-grid">
      ${result.sources.map(([title, body]) => `<div class="mini-card"><strong>${title}</strong><span>${body}</span></div>`).join("")}
    </div>
    ${makeDetails("Skill-to-data mapping", renderSkillDataMapping(skills))}
    ${makeDetails("SQL generated by agent", result.sql)}
    <p><strong>Result:</strong> ${result.result}</p>
    <p><strong>Conclusion:</strong> ${result.conclusion}</p>`
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
        return `${skill.name}: writes the query against Plaud warehouse / semantic layer.`;
      }
      if (skill.key === "inference") {
        return `${skill.name}: interprets whether the result is mix shift, true performance change, or insufficient evidence.`;
      }
      if (skill.key === "segmentation") {
        return `${skill.name}: chooses account cuts such as channel, team size, vertical, admin role, platform, and cohort.`;
      }
      if (skill.key === "featureRoi") {
        return `${skill.name}: decides which usage, revenue, risk, and customer-value tables are needed.`;
      }
      if (skill.key === "acquisition") {
        return `${skill.name}: pulls CAC, funnel quality, LTV/CAC, payback, and downstream activation metrics.`;
      }
      return `${skill.name}: ${skill.output}`;
    })
    .join("\n");
}

function showDataNeededFallback() {
  state.stage = "data";
  addMessage(
    "agent",
    `<span class="label">If warehouse access is missing</span>
    <p>If I cannot query Plaud's internal data directly, I would ask the data owner for these fields. This is the fallback path, not the ideal user experience.</p>
    <ol>
      ${getDataRequests().map((request) => `<li>${request}</li>`).join("")}
    </ol>`
  );
  setSuggestions([
    { label: "Use mock Plaud warehouse", action: "run_analysis", primary: true },
    { label: "Final answer with assumptions", action: "final" }
  ]);
}

function getDataRequests() {
  if (state.caseType === "feature") {
    return [
      "How many target B2B accounts would use the feature weekly?",
      "What buyer value would it unlock: revenue lift, retention, coaching, compliance, or time saved?",
      "What are the major implementation and trust risks?",
      "Can we run a beta with opt-in teams and compare usage, satisfaction, expansion intent, and risk tickets?"
    ];
  }
  if (state.caseType === "acquisition") {
    return [
      "CAC and paid team conversion by channel and segment.",
      "Activation, week 4 retention, expansion, and support tickets by channel cohort.",
      "Sales touch rate and CSM workload by channel.",
      "Predicted LTV/CAC and payback by vertical, company size, and plan."
    ];
  }
  return [
    `${state.metric} by cohort before and after the change.`,
    `${state.metric} by acquisition channel, team size, vertical, admin role, plan, and platform.`,
    "Event funnel: signup, admin setup, seat invites, device binding, first recording, first AI summary, and week 4 usage.",
    "Any product launches, tracking changes, pricing changes, or campaign changes in the same window."
  ];
}

function buildAnalysisResult() {
  if (state.caseType === "feature") return buildFeatureAnalysisResult();
  if (state.caseType === "acquisition") return buildAcquisitionAnalysisResult();
  return buildMetricAnalysisResult();
}

function buildMetricAnalysisResult() {
  const metric = state.metric;
  return {
    sources: [
      ["Metric layer", `activation, retention, NRR, expansion definitions from Plaud semantic metrics`],
      ["Event warehouse", "workspace signup, device binding, seat invites, recordings, AI summaries"],
      ["Account data", "company size, vertical, source, plan, admin role, region"],
      ["Experiment log", "recent launches, onboarding changes, pricing tests, campaign changes"]
    ],
    sql: `-- Agent-generated SQL for Plaud B2B ${metric} diagnosis
with workspace_funnel as (
  select
    w.workspace_id,
    w.signup_week,
    w.acquisition_channel,
    w.company_size,
    w.vertical,
    w.plan_type,
    w.admin_role,
    max(e.event_name = 'device_bound') as device_bound,
    count_if(e.event_name = 'seat_invited') as invited_seats,
    count_if(e.event_name = 'summary_created' and e.days_since_signup <= 7) as summaries_7d,
    count_if(e.event_name = 'summary_created' and e.days_since_signup between 22 and 28) as summaries_w4
  from plaud_warehouse.workspaces w
  left join plaud_warehouse.workspace_events e
    on w.workspace_id = e.workspace_id
  where w.signup_week >= current_date - interval '12 weeks'
  group by 1,2,3,4,5,6,7
),
metric_by_segment as (
  select
    acquisition_channel,
    company_size,
    vertical,
    admin_role,
    avg(case when signup_week < current_date - interval '4 weeks'
      then (invited_seats >= 2 and device_bound and summaries_7d >= 3)::int end) as baseline_activation,
    avg(case when signup_week >= current_date - interval '4 weeks'
      then (invited_seats >= 2 and device_bound and summaries_7d >= 3)::int end) as current_activation,
    count(*) as workspaces
  from workspace_funnel
  group by 1,2,3,4
)
select *,
  current_activation - baseline_activation as within_segment_delta,
  workspaces * (current_activation - baseline_activation) as weighted_impact
from metric_by_segment
order by abs(weighted_impact) desc;`,
    result:
      "The drop is concentrated in self-serve SMB teams from paid search. Roughly 8 points are explained by signup mix shift, while about 5 points remain as a true within-segment activation decline.",
    conclusion:
      "The likely root cause is onboarding/team-value friction, not a global product failure. Prioritize an admin-led onboarding intervention before changing broad GTM strategy."
  };
}

function buildFeatureAnalysisResult() {
  return {
    sources: [
      ["Usage warehouse", "meeting volume, summary review, sharing, team workspace behavior"],
      ["Revenue data", "plan tier, ARPA, expansion, renewal, paid seats"],
      ["Voice of customer", "sales calls, support tickets, CSM notes, win/loss reasons"],
      ["Risk logs", "privacy tickets, AI correction feedback, enterprise security objections"]
    ],
    sql: `-- Agent-generated feature opportunity query
select
  vertical,
  company_size,
  plan_type,
  count(distinct workspace_id) as active_workspaces,
  avg(meetings_per_week) as meetings_per_week,
  avg(shared_summaries_per_week) as shared_summaries_per_week,
  avg(admin_review_rate) as admin_review_rate,
  avg(expansion_signal_60d) as expansion_signal_60d,
  avg(ai_correction_rate) as ai_correction_rate
from plaud_warehouse.b2b_workspace_health
where meetings_per_week >= 5
group by 1,2,3
order by expansion_signal_60d desc, active_workspaces desc;`,
    result:
      "Sales and customer-facing teams show the highest meeting volume, admin review behavior, and expansion signals. Trust risk is meaningful because AI correction and privacy-ticket rates are higher in regulated verticals.",
    conclusion:
      "Build only as a controlled B2B beta. Package the feature around manager coaching and account-risk insight, with opt-in controls and clear AI confidence labels."
  };
}

function buildAcquisitionAnalysisResult() {
  return {
    sources: [
      ["Marketing data", "channel, campaign, spend, MQL, SQL, demo, paid team"],
      ["Product data", "activation, seat invite, device binding, summaries, retention"],
      ["Revenue data", "ACV, expansion, refunds, predicted LTV"],
      ["CS data", "onboarding tickets, support load, implementation time"]
    ],
    sql: `-- Agent-generated channel quality query
select
  acquisition_channel,
  vertical,
  company_size,
  sum(spend) / nullif(count(distinct paid_workspace_id), 0) as cac,
  avg(activated_7d) as activation_rate,
  avg(retained_week4) as week4_retention,
  avg(expanded_60d) as expansion_rate,
  avg(predicted_ltv) / nullif(avg(cac), 0) as ltv_cac,
  avg(support_tickets_30d) as support_load
from plaud_warehouse.channel_quality
where signup_date >= current_date - interval '90 days'
group by 1,2,3
order by ltv_cac desc, activation_rate desc;`,
    result:
      "Paid search has lower CAC but weaker activation and higher support load. Consulting and sales-team subsegments retain well; generic SMB traffic does not.",
    conclusion:
      "Do not scale the channel broadly. Narrow targeting to high-fit ICP segments and use quality-adjusted CAC, not raw CAC, as the decision metric."
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
    ${makeDetails("Concise talk track", answer.talkTrack)}`
  );
  setSuggestions([
    { label: "Try another case", action: "restart", primary: true },
    { label: "Ask for SQL detail", action: "sql" },
    { label: "Ask for final pitch", action: "pitch" }
  ]);
}

function buildReasoningExplanation() {
  const skills = getSelectedSkills();
  return `1. Clarify the business question
I first classified the request as ${caseTypes[state.caseType].label}. That determines which framework to use instead of blindly applying one generic framework.

2. Select the skill chain
Selected skills:
${skills.map((skill) => `- ${skill.name}: ${skill.output}`).join("\n")}

3. Apply the Plaud B2B product framework
I separated end-user behavior, admin workflow, buyer value, account retention, and revenue impact. This matters because B2B product questions are account-level, not just individual-user questions.

4. Query the internal platform
I would use Plaud's metric layer, event warehouse, account/revenue data, and experiment logs. The agent writes SQL only when needed and hides that complexity from non-technical users.

5. Analyze and infer
For metric problems, I separate data quality issues, customer mix shift, and true within-segment performance changes. For feature and acquisition questions, I connect usage, revenue, risk, and validation.

6. Recommend a testable action
I do not stop at insight. I translate the conclusion into an experiment, beta, or GTM decision with success metrics and guardrails.`;
}

function makeDetails(title, content) {
  return `
    <details class="detail-card">
      <summary>${title}</summary>
      <div class="detail-content"><pre>${escapeHtml(content)}</pre></div>
    </details>
  `;
}

function buildFinalAnswer() {
  if (state.caseType === "feature") {
    return buildFeatureAnswer();
  }
  if (state.caseType === "acquisition") {
    return buildAcquisitionAnswer();
  }
  return buildMetricAnswer();
}

function buildMetricAnswer() {
  const values = extractPercentages(`${state.question} ${state.clarification} ${state.dataContext}`);
  const baseline = values[0] ? `${values[0]}%` : "baseline";
  const current = values[1] ? `${values[1]}%` : "current";
  const delta = values.length >= 2 ? `${Math.round((values[1] - values[0]) * 10) / 10} pts` : "unknown";
  return {
    summary: `
      <p>I would frame this as a Plaud B2B ${state.metric} investigation, not a generic dashboard review.</p>
      <p>The goal is to determine whether the movement from ${baseline} to ${current} is caused by data quality, customer mix, lifecycle friction, or a true product performance decline.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Observed change</strong><span>${delta}</span></div>
        <div class="mini-card"><strong>Top hypothesis</strong><span>Self-serve or lower-fit teams are failing during onboarding or first team value.</span></div>
        <div class="mini-card"><strong>Inference check</strong><span>Compare observed rate to counterfactual rate under prior segment mix.</span></div>
        <div class="mini-card"><strong>Recommendation</strong><span>Do not change GTM broadly until we isolate the segment and lifecycle break.</span></div>
      </div>
    `,
    sql: `-- Root-cause plan for Plaud B2B ${state.metric}
with cohort_metrics as (
  select
    workspace_id,
    cohort_week,
    acquisition_channel,
    company_size,
    vertical,
    admin_role,
    plan_type,
    platform,
    metric_numerator,
    metric_denominator,
    metric_numerator * 1.0 / nullif(metric_denominator, 0) as metric_value
  from plaud_b2b.account_metric_daily
  where cohort_week >= current_date - interval '12 weeks'
),
segment_compare as (
  select
    acquisition_channel,
    company_size,
    vertical,
    admin_role,
    avg(case when cohort_week < current_date - interval '4 weeks' then metric_value end) as baseline_rate,
    avg(case when cohort_week >= current_date - interval '4 weeks' then metric_value end) as current_rate,
    count(*) as accounts
  from cohort_metrics
  group by 1,2,3,4
)
select *,
  current_rate - baseline_rate as within_segment_delta,
  accounts * (current_rate - baseline_rate) as weighted_impact
from segment_compare
order by abs(weighted_impact) desc;`,
    experiment: `Hypothesis: If the main lifecycle friction is onboarding or first team value, targeted admin guidance should improve ${state.metric}.

Design: Randomize eligible new B2B workspaces into current experience vs guided admin checklist / team value proof.

Primary metric: ${state.metric}.
Secondary metrics: seat activation, summaries per active seat, week 4 retention.
Guardrails: signup completion, support tickets, privacy complaints, refund rate.

Decision rule: Launch only if the lift is statistically and practically meaningful with no guardrail degradation.`,
    talkTrack: `I would start by clarifying the metric definition and affected segment. Then I would check data quality and product launch timing. After that, I would segment by channel, company size, vertical, admin role, and plan. The key inference step is to separate mix shift from true within-segment decline. If the issue is concentrated in self-serve teams, I would test an admin onboarding intervention with ${state.metric} as the primary metric and week 4 retention as a guardrail.`
  };
}

function buildFeatureAnswer() {
  return {
    summary: `
      <p>I would treat this as a launch decision, not a yes/no product taste question.</p>
      <p>For Plaud B2B, the feature should be evaluated by buyer value, team workflow fit, monetization potential, trust risk, and measurable account impact.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Decision</strong><span>Beta before broad launch.</span></div>
        <div class="mini-card"><strong>Buyer value</strong><span>Must connect to sales coaching, customer risk, compliance, or measurable productivity.</span></div>
        <div class="mini-card"><strong>Risk</strong><span>Privacy, model accuracy, explainability, and user trust.</span></div>
        <div class="mini-card"><strong>Monetization</strong><span>Potential premium B2B intelligence module if beta proves value.</span></div>
      </div>
    `,
    sql: `# Feature ROI model
benefit = incremental_arpa + expansion_lift + churn_reduction + sales_cycle_savings
cost = engineering_cost + model_cost + support_cost + trust_compliance_cost + opportunity_cost
roi = (benefit - cost) / cost

# Validate with beta:
# usage per account, admin satisfaction, expansion intent, correction rate, opt-out rate, privacy tickets`,
    experiment: `Run a 6-week opt-in B2B beta with a small set of target teams.

Primary metric: weekly active teams using the feature.
Secondary metrics: admin satisfaction, expansion intent, workflow completion, sales/customer success value.
Guardrails: opt-out rate, correction rate, privacy tickets, support load.

Decision rule: Package for paid B2B only if usage and buyer value are strong while trust risks remain low.`,
    talkTrack: `I would not launch purely because the feature sounds strategic. I would map personas first: end users, admins, buyers, IT, and compliance. Then I would define the value hypothesis and risk threshold. My recommendation would be a controlled beta, with clear metrics for usage, buyer value, expansion intent, and trust guardrails.`
  };
}

function buildAcquisitionAnswer() {
  return {
    summary: `
      <p>I would not scale a B2B channel just because CAC is low.</p>
      <p>The right question is whether the channel creates retained, activated, expandable Plaud Team accounts with healthy payback.</p>
    `,
    cards: `
      <div class="structure-grid">
        <div class="mini-card"><strong>Core metric</strong><span>Quality-adjusted CAC, not raw CAC.</span></div>
        <div class="mini-card"><strong>Risk</strong><span>Cheap leads may create weak activation, high support load, and low retention.</span></div>
        <div class="mini-card"><strong>Analysis</strong><span>Compare channel cohorts through activation, retention, expansion, and payback.</span></div>
        <div class="mini-card"><strong>Decision</strong><span>Scale, narrow, cap, or pause by ICP segment.</span></div>
      </div>
    `,
    sql: `select
  acquisition_channel,
  vertical,
  company_size,
  count(distinct workspace_id) as paid_teams,
  avg(cac) as avg_cac,
  avg(activated_7d) as activation_rate,
  avg(retained_week4) as week4_retention,
  avg(expanded_60d) as expansion_rate,
  avg(predicted_ltv) / nullif(avg(cac), 0) as ltv_cac
from plaud_b2b.channel_quality
where signup_date >= current_date - interval '90 days'
group by 1,2,3
order by ltv_cac desc, paid_teams desc;`,
    experiment: `Run an incremental budget test.

Control: broad low-CAC targeting.
Treatment: ICP-filtered targeting with stricter qualification.

Primary metric: activated retained teams per dollar.
Secondary metrics: demo-to-paid, week 4 retention, sales workload, predicted LTV/CAC.
Guardrails: lead volume, customer success capacity, support tickets.

Decision rule: Scale only if quality-adjusted CAC and payback improve.`,
    talkTrack: `I would separate acquisition volume from customer quality. In B2B, a low CAC channel can still be bad if it attracts accounts that never activate, retain, or expand. I would compare cohorts by downstream quality and use quality-adjusted CAC as the decision metric.`
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
    acceptClarification("Assume reasonable defaults: account-level metric, recent cohorts, likely self-serve and sales-led split, and no confirmed tracking issue yet.");
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
      <p>I used the case framework to decide what to query, not the other way around.</p>
      ${makeDetails("Framework-to-data logic", buildReasoningExplanation())}`
    );
    setSuggestions([
      { label: "Generate final answer", action: "final", primary: true },
      { label: "Show data needed if not connected", action: "data_needed" }
    ]);
    return;
  }
  if (action === "partial_data") {
    acceptData("Partial data only: cohort, channel, company size, activation or retention rate, and a few event funnel steps.");
    return;
  }
  if (action === "final") {
    showFinalAnswer();
    return;
  }
  if (action === "sql") {
    const sql = state.analysisResult ? state.analysisResult.sql : buildFinalAnswer().sql;
    addMessage("agent", `<span class="label">SQL detail</span><p>This is the SQL the agent would generate against Plaud's internal warehouse or semantic layer.</p>${makeDetails("Generated SQL", sql)}`);
    return;
  }
  if (action === "pitch") {
    addMessage("agent", `<span class="label">Final pitch</span><p>This agent helps Plaud employees ask product and growth questions in plain English. It chooses the right B2B framework, queries Plaud's internal data, writes SQL when needed, analyzes the result, and explains the reasoning behind a decision-ready recommendation.</p>`);
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
