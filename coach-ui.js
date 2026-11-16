// Sidebar / header progress UI. Reads app.js globals (state, caseTypes, coachNotes)
// and never writes to them.
(function () {
  const STEPS = [
    { key: "ask", name: "Ask", title: "Start with one concrete question" },
    { key: "clarify", name: "Clarify", title: "Agree on what the question means" },
    { key: "structure", name: "Structure", title: "Lay out a framework that fits" },
    { key: "query", name: "Query data", title: "Let the data narrow it down" },
    { key: "conclusion", name: "Conclusion", title: "Land the recommendation" }
  ];

  const STAGE_TO_STEP = {
    start: 0,
    clarify: 1,
    structure: 2,
    analysis: 3,
    data: 3,
    final: 4
  };

  const FALLBACK_WHY = {
    ask: "A good case starts from one concrete question about a metric or a decision.",
    clarify: "Clarify what the metric means, who the users are, and what the goal is.",
    structure: "Use a framework so you don't miss anything, but adapt it to the question.",
    query: "Three well-defined metrics beat five vague ones. Separate mix shift from real change.",
    conclusion: "End with a recommendation, the business impact, and how you'd test it."
  };

  const stepEls = Array.from(document.querySelectorAll("#caseSteps .step"));
  const dots = Array.from(document.querySelectorAll("#stepDots i"));
  const dotsLabel = document.querySelector("#stepDotsLabel");
  const caseCard = document.querySelector("#caseCard");
  const eyebrow = document.querySelector("#mainEyebrow");
  const mainTitle = document.querySelector("#mainTitle");
  const thread = document.querySelector("#chatThread");
  const reset = document.querySelector("#resetConversation");

  function getState() {
    return typeof state !== "undefined" ? state : null;
  }

  function whyFor(key) {
    if (typeof coachNotes !== "undefined" && coachNotes && coachNotes[key] && coachNotes[key].why) {
      return coachNotes[key].why;
    }
    return FALLBACK_WHY[key];
  }

  function escapeText(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function render() {
    const s = getState();
    const stage = s ? s.stage : "start";
    const active = STAGE_TO_STEP[stage] ?? 0;
    const pad = (i) => String(i + 1).padStart(2, "0");

    stepEls.forEach((el, i) => {
      const status = i < active ? "done" : i === active ? "active" : "pending";
      el.dataset.status = status;
      el.querySelector(".step-num").textContent = status === "done" ? "✓" : pad(i);
      el.querySelector(".step-why").textContent = status === "active" ? whyFor(STEPS[i].key) : "";
      if (status === "active") el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });

    dots.forEach((dot, i) => {
      dot.className = i < active ? "done" : i === active ? "active" : "";
    });
    dotsLabel.textContent = `${pad(active)} · ${STEPS[active].name}`;

    eyebrow.textContent = `Step ${pad(active)} of 05 · ${STEPS[active].name}`;
    mainTitle.textContent = STEPS[active].title;

    // The welcome message is tall; show it from the top rather than the bottom.
    if (stage === "start" && thread && thread.children.length <= 1) thread.scrollTop = 0;

    const hasCase = s && stage !== "start" && s.question;
    if (!hasCase) {
      caseCard.innerHTML = `<p class="case-empty">No case yet — pick an example <span aria-hidden="true">→</span></p>`;
      return;
    }
    const type =
      typeof caseTypes !== "undefined" && caseTypes && caseTypes[s.caseType]
        ? caseTypes[s.caseType].label
        : s.caseType;
    caseCard.innerHTML = `
      <dl class="case-meta">
        <div><dt>Case type</dt><dd>${escapeText(type)}</dd></div>
        <div><dt>Focus metric</dt><dd>${escapeText(s.metric || "target metric")}</dd></div>
      </dl>`;
  }

  if (thread) {
    new MutationObserver(render).observe(thread, { childList: true, subtree: true });
  }
  if (reset) {
    reset.addEventListener("click", () => setTimeout(render, 0));
  }
  render();
})();
