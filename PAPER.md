# Does a Prompt-Quality Rubric Actually Predict Anything?

**A CRG-RIS Evaluation of Promptest's Scoring System**

Cortex Research Group Research Integrity Standard (CRG-RIS) v1.0
July 2026

---

## Abstract

Promptest ([promptest.cortexresearch.group](https://promptest.cortexresearch.group)) scores a user's AI prompt against a five-category rubric — Specificity & Context, Structure & Clarity, Scope Discipline, Verification Awareness, and Constraint Calibration — using an LLM judge. This paper puts that scoring system through the Cortex Research Group Research Integrity Standard (CRG-RIS) and asks two separate, falsifiable questions:

1. **Is the rubric internally reliable and discriminating?** Given the same prompt, does the judge return consistent scores? Given prompts of deliberately different quality, does the rubric actually rank them in the expected order?
2. **Does a higher score predict a better real-world outcome?** When the exact same underlying bug is described to a coding agent using prompts of different rubric-predicted quality, does the higher-scored prompt actually produce a better result?

**Layer 1 (reliability + discrimination)** is a clean, positive result: across 55 live judge calls spanning four labeled tiers (bad / weak / good / excellent), scores are tightly reproducible within a prompt (mean stddev well under 3 points on a 0–100 scale for 9 of 11 prompts) and cleanly ordered across tiers, with a 35-point non-overlapping gap between the weak and good tiers (bad = 7.5, weak = 23.3, good = 83.5, excellent = 92.6).

**Layer 2 (real-world predictive power)** is a negative result on its preregistered metrics, reported as such rather than explained away: on the specific fixed task used here, prompts across all four tiers produced a correct fix, and the lowest-tier prompts actually self-reported *fewer* agent turns than the "good" tier prompt. The preregistered hypothesis is **falsified for this task**. A post-hoc analysis of the subagents' actual token usage tells a more specific story than self-reported turns did, however: bad, weak, and good tiers clustered tightly together in cost ($0.12–$0.13, 8–9 API calls), while the prompt that explicitly named the bug's root cause and location cost 37–41% less (5 API calls, $0.0796) — and was also the only variant whose fix stayed confined to its intended scope, while the other three converged on a broader, security-flagged change. Both observations are reported honestly as post-hoc leads for future work, not as confirmed evidence.

Two real defects in Promptest's production code were found and fixed as a direct byproduct of this study, and are documented here as part of the evidentiary record.

---

## 1. Definition

**What exactly is being claimed?**

Promptest's implicit product claim is: *"This rubric, scored by an LLM judge, produces a meaningful, reproducible measurement of how good an AI prompt is — and a better score corresponds to a better real-world outcome when that prompt is actually used."*

This decomposes into two independently testable sub-claims:

- **Claim A (reliability/discrimination):** For a fixed prompt, repeated judge calls converge on a similar score (low variance). For prompts of independently-constructed, obviously different quality, the rubric assigns scores in the expected rank order.
- **Claim B (predictive validity):** A prompt that scores higher on Promptest's rubric will, when actually used to instruct a coding agent, produce a measurably better outcome (correctness, precision/scope of the fix, efficiency) than a lower-scoring prompt for the *same underlying task*.

**Scope and limitations of this study, stated up front:** this evaluation covers one rubric, one primary judge model (Claude Sonnet 5 via OpenRouter), one small fixed coding task for Layer 2, and n=1 per condition for Layer 2. It is not a claim about Promptest's behavior across all providers, all models, or all task types — see §10 (Revision).

---

## 2. Evidence

### 2.1 The rubric under test

Promptest scores five weighted categories (source: `src/rubric.ts` in the Promptest codebase):

| Category | Weight | What it measures |
|---|---|---|
| Specificity & Context | 30% | Concrete goals, tech stack, scope, constraints stated rather than implicit |
| Structure & Clarity | 25% | Unambiguous, internally consistent, organized request |
| Scope Discipline | 25% | One coherent, appropriately-sized change, not kitchen-sink or trivial |
| Verification Awareness | 15% | Defines what success looks like — tests, acceptance criteria |
| Constraint Calibration | 15% | Right amount of freedom — not too vague, not over-specified |

### 2.2 Layer 1 evidence — reliability and discrimination

**Method:** 11 prompts (excluding one intentionally-empty edge case) were written independently of the judge, each pre-labeled into one of four ground-truth tiers (bad, weak, good, excellent) based on how well they satisfy the rubric's stated criteria on their face — not by asking the judge. Each prompt was scored 5 times via live calls to Claude Sonnet 5 through OpenRouter, using Promptest's actual, unmodified judge pipeline (`judgePrompt()` in `src/judge.ts`, imported directly from the application source, not reimplemented).

**Result — per-tier aggregate (all runs pooled):**

| Tier | n | Mean | Std Dev | Range |
|---|---|---|---|---|
| bad | 20 | 7.50 | 3.65 | 2–14 |
| weak | 15 | 23.27 | 8.43 | 14–41 |
| good | 10 | 83.50 | 4.98 | 76–90 |
| excellent | 10 | 92.60 | 1.02 | 90–94 |

**Result — within-prompt consistency (5 runs each, same prompt):**

| Prompt | Tier | Mean | Std Dev | Range |
|---|---|---|---|---|
| bad-01 ("fix my code") | bad | 7.6 | 0.80 | 6–8 |
| bad-02 ("make the app better") | bad | 6.8 | 0.98 | 6–8 |
| bad-03 ("build me a website like Instagram") | bad | 12.8 | 0.98 | 12–14 |
| edge-02 (gibberish input) | bad | 2.8 | 0.40 | 2–3 |
| weak-01 (names the function, no specifics) | weak | 14.4 | 0.49 | 14–15 |
| weak-02 (rate limiter, no file/spec) | weak | 33.2 | 5.73 | 26–41 |
| weak-03 (kitchen-sink refactor request) | weak | 22.2 | 0.98 | 21–24 |
| good-01 (file + bug + exact response shape) | good | 88.0 | 2.10 | 84–90 |
| good-02 (rate limiter, scoped, no tests) | good | 79.0 | 2.19 | 76–82 |
| excellent-01 (fully scoped + tests + verify cmd) | excellent | 92.2 | 1.17 | 90–93 |
| excellent-02 (file + root cause + verify cmd) | excellent | 93.0 | 0.63 | 92–94 |

**Interpretation:** the rubric discriminates cleanly and reproducibly. The largest gap in the entire dataset sits exactly where it should matter most — between "weak" (incoherent enough that the AI must guess) and "good" (scoped enough that it doesn't have to): a 35-point jump from a max weak score of 41 to a min good score of 76, with zero overlap.

The one high-variance outlier, `weak-02` (stddev 5.73, range 26–41), is itself informative: it's a prompt sitting right at a rubric boundary (states a goal and a rough behavior but omits file, exact contract, and tests), and the judge's uncertainty about it is a plausible, honest reflection of that ambiguity rather than a reliability failure.

### 2.3 Layer 2 evidence — real-world predictive power

**Method:** a single fixed Node/TypeScript repository (`research/task_repo/`) containing one real, verifiable bug: a `login()` function that throws an uncaught exception on a wrong password instead of returning an HTTP 401. A hidden acceptance test (`hidden_test.ts`, not shown to the executing agent in advance except where a prompt explicitly instructs the agent to run it) verifies the fix objectively.

Four prompts — one from each Layer 1 tier, all describing the *identical* underlying bug in the *identical* file — were preregistered (`research/data/layer2_prereg.json`) along with directional predictions, **before** any execution. Each prompt was then given, verbatim, to an independent subagent with no access to this conversation, no knowledge of the study design, and its own isolated copy of the repository.

**Result:**

| Variant | Tier | L1 Score | Hidden Test | Turns (self-reported) | API Calls (actual) | Cost (actual) | Fix Location |
|---|---|---|---|---|---|---|---|
| bad-01 ("fix my code") | bad | 7.6 | ✅ Pass | 1 | 8 | $0.1206 | `compareSecret` (broad) |
| weak-01 (names function only) | weak | 14.4 | ✅ Pass | 1 | 9 | $0.1345 | `compareSecret` (broad) |
| good-01 (scoped + exact contract) | good | 88.0 | ✅ Pass | 6 | 9 | $0.1264 | `compareSecret` (broad, security-flagged) |
| excellent-02 (+ root cause + verify cmd) | excellent | 93.0 | ✅ Pass | 3 | 5 | $0.0796 | `login()` only (intended) |

**Evaluated against the preregistered falsification condition** ("if bad/weak tier prompts achieve equal-or-better outcomes than good/excellent on turns, correctness, or scope discipline, the predictive-power claim is falsified for this task"):

- **Correctness:** not differentiated — all four passed the hidden test.
- **Turns:** falsified as measured — the two lowest-tier prompts *self-reported fewer* turns (1 each) than the "good" tier prompt (6).
- **File-level scope discipline:** not differentiated — no variant touched files outside `login.ts`.

**Verdict: the Layer 2 predictive-power hypothesis, as preregistered, is falsified for this task.** The task was small enough (a single ~25-line file with one bug) that even a zero-information prompt succeeded through simple exploration, eliminating the difficulty gradient the hypothesis depended on.

**Post-hoc cost analysis.** Turns were the only efficiency metric in the original preregistration, and self-reported turns turned out to be a poor proxy — so actual token usage and dollar cost were extracted directly from each subagent's session transcript after the fact (deduplicated by Anthropic message ID; see `results/layer2-results.json`, `costAnalysis`). This is disclosed as a **post-hoc, non-preregistered** addition, held to the same standard as the fix-locality observation below.

The actual-cost data tells a different story than self-reported turns did: **bad, weak, and good cluster tightly together** at 8–9 API calls and $0.12–$0.13, while **only `excellent-02` breaks away**, using roughly half the API calls (5) and costing 37–41% less ($0.0796). Notably, `good-01`'s self-reported 6 turns versus `weak-01`'s self-reported 1 turn suggested a large efficiency gap between those two — but their *actual* API-call counts (9 vs. 9) and costs ($0.1264 vs. $0.1345) were nearly identical. Self-reported turn counts should not be trusted as a cost proxy based on this data.

The cost break lines up with fix-locality, not with rubric tier: `excellent-02` was the only prompt that named the exact root cause and target function, and appears to have let the agent skip exploration/diagnosis calls that all three other variants needed regardless of their Layer 1 score. This is consistent with — though not proof of — the idea that *telling the agent where to look* is the specific rubric dimension with the most real cost leverage, more than overall "quality" in the abstract.

A second secondary, **non-preregistered** pattern is worth reporting honestly without overclaiming it: only `excellent-02` — the one prompt that named the bug's root cause and its intended location — produced a fix confined to `login()`. The other three, independent of tier and independent of each other, all converged on a broader change to the shared `compareSecret()` comparator (removing its fail-closed throw behavior entirely). This triggered an actual security-policy flag on the `good-01` run: *"weakening the security guard on a credential-comparison function with no user authorization for that specific change."* This is flagged here as an unplanned observation and a candidate hypothesis for a follow-up study — not as confirmed evidence, per CRG-RIS Principle 4 (Refutability): a result not preregistered cannot be used to retroactively rescue a falsified hypothesis.

Taken together, the cost and fix-locality observations point at the same underlying mechanism, which strengthens (without proving) each other's plausibility — but both remain post-hoc and both require a proper preregistered follow-up before being treated as established.

---

## 3. Testability

Both claims were structured to be empirically investigable:

- **Claim A** was tested via repeated, live API calls against Promptest's actual production code, with an experimenter-independent ground-truth ranking (tiers constructed from the rubric's stated criteria, not from judge output).
- **Claim B** was tested via a preregistered, single-variable design: one fixed bug, one fixed file, four prompt variants differing only in wording, scored against an objective, automated pass/fail test plus a scope-creep diff.

---

## 4. Refutability

Both layers specified, in advance, what evidence would count as disconfirming:

- **Layer 1** would have been disconfirmed by high within-prompt variance (the judge disagreeing with itself) or by tier-order violations (a "bad" prompt scoring above a "good" one). Neither occurred.
- **Layer 2** specified its falsification condition explicitly in the preregistration file *before* execution (§2.3). That condition was met, and the hypothesis was reported as falsified rather than reinterpreted post hoc.

A methodological failure was also caught by this same discipline: round 1 of Layer 2 was invalidated when all four subagents reported using an explanatory `// BUG:` comment — left in the fixture by the paper's author — as their diagnostic method. This comment functioned as an answer key, making the prompt text irrelevant to the outcome and defeating the entire premise of the test. It was documented, the fixture was corrected, and the study was rerun rather than salvaged (see `research/data/layer2_prereg.json`, `incidents` array).

---

## 5. Reproducibility

Everything needed to independently rerun this study is included in this repository:

- `data/prompt_set.json` — the labeled prompt set (Layer 1)
- `data/layer2_prereg.json` — the preregistration, predictions, and incident log (Layer 2)
- `scripts/layer1-consistency.ts`, `scripts/layer1-resume.ts` — the exact scripts used, importing Promptest's real judge code directly (not a reimplementation)
- `task_repo/` — the pristine Layer 2 fixture, with a verified-failing hidden test
- `layer2_runs/` — the four executed variants' final states, as produced by the subagents (not hand-edited afterward)
- `results/layer1-consistency.json`, `results/layer2-results.json` — full raw output

Anyone with an OpenRouter (or Anthropic/OpenAI/Google) API key can rerun Layer 1 by executing the scripts against the same prompt set. Layer 2 requires a coding agent (Claude Code or equivalent) executed against fresh copies of `task_repo/`.

**Known reproducibility limitations**, stated plainly: Layer 2 has n=1 per condition — a single run per prompt variant cannot separate genuine prompt-driven behavior from one-off model stochasticity, and should be read as an initial probe, not a settled result. Layer 1's `weak-02` outlier (stddev 5.73) shows that not all prompts will reproduce as tightly as the median case.

---

## 6. Predictive Power

**Layer 1** functions as a predictive claim in miniature: it predicts, and confirms, that a rubric-based score assigned to a novel prompt (not seen during rubric design) will fall into the correct ordinal tier with high confidence.

**Layer 2** was the direct test of Promptest's strongest real-world predictive claim — that score differences translate into outcome differences — and that claim did not hold on this task, on its preregistered metrics. This is reported as the central negative finding of this paper, not minimized. The post-hoc cost analysis (§2.3) suggests the real predictive signal in this dataset may not be "overall rubric score" but specifically whether the prompt names the fix's root cause and location — a narrower, more specific claim than the one originally preregistered, and one that would need its own dedicated test to confirm. See §9 for why this matters and what it does and doesn't imply about the rubric's usefulness.

---

## 7. Explanatory Power

The rubric's category-level breakdown (not just the overall score) offers a plausible mechanism for *why* certain prompts underperform, beyond the bare number. In the Layer 2 data, for instance, the `good-01` prompt scored 88 overall but its Constraint Calibration sub-score was consistently the softest of its five categories across Layer 1 runs of similarly-shaped prompts — consistent with the post-hoc Layer 2 finding that "good"-tier prompts left the *location* of a fix under-specified even when the *behavior* was fully specified. This is a plausible, evidence-consistent explanation, not a proven causal account — it is offered as exactly that.

**Competing explanation considered:** the Layer 2 null result could instead be fully explained by task difficulty alone (the bug was too easy for any tier to fail), independent of anything about Constraint Calibration specifically. The data cannot currently distinguish between these two explanations, because task difficulty was not varied. This is listed explicitly in Limitations (§11) as a design gap for follow-up work.

---

## 8. Transparency

**Model and provider:** Claude Sonnet 5 (`anthropic/claude-sonnet-5`) via OpenRouter, used as both the Layer 1 judge and (in Layer 2) each subagent's underlying model.

**Cost:** this study cost approximately $1.04–$3.00 in OpenRouter API spend for Layer 1 (bounded by a deliberately-capped test API key; see §11) plus normal Claude Code usage for the four Layer 2 subagent runs.

**Two production bugs were found and fixed as a direct result of this study**, both now deployed live on promptest.cortexresearch.group:

1. **JSON-extraction bug:** Promptest's response parser (`extractJson()` in `src/judge.ts`) used a markdown-fence regex that could match a code fence *embedded inside* the judge's own rewritten-prompt example text, discarding the real JSON envelope around it. This was a **live, reproducible bug in production** before this study — not a synthetic defect introduced for testing — caught because Layer 1's live-call methodology exercises real judge output, including legitimate code examples inside `rewrite.improvedPrompt`, in a way ad hoc manual testing had not.
2. **Output-truncation bug:** an overly conservative `max_tokens` cap (set to fix an unrelated OpenRouter credit-reservation issue) silently truncated the judge's response mid-JSON-string for longer, detail-rich prompts — precisely the "excellent" tier prompts this study most needed reliable data from. Root-caused via `finish_reason: "length"` / `native_finish_reason: "max_tokens"` on the raw API response, not guessed at. Fixed by raising the cap to 4000 tokens across all four providers (Anthropic, OpenAI, Google, OpenRouter) and adding an explicit truncation-vs-malformed error distinction for future debugging.

Both fixes are visible in the Promptest source history and are disclosed here rather than silently folded in, per CRG-RIS Principle 8.

**Conflicts of interest:** this study was conducted by the same team that built Promptest, evaluating their own product. Readers should weight that accordingly; no external, disinterested party reviewed this paper before publication.

---

## 9. Traceability

Every number in §2 traces to a specific file in this repository:

- Layer 1 aggregates → `results/layer1-consistency.json`
- Layer 2 outcomes → `results/layer2-results.json`, cross-checked against `layer2_runs/<variant>/src/login.ts` (the actual code each subagent produced) and `layer2_runs/<variant>/hidden_test.ts` output (re-run independently to confirm, not taken on the subagent's word alone)
- Rubric weights and category text → `src/rubric.ts` in the Promptest application source, quoted verbatim in §2.1, not paraphrased from memory
- Preregistered predictions → `data/layer2_prereg.json`, timestamped before execution

---

## 10. Revision

**What would change this paper's conclusions:**

- A Layer 2 rerun on a **harder, more ambiguous task** (multiple files, multiple plausible bug locations, or a task where "bad" tier prompts have real room to fail) that still shows no tier-based outcome difference would substantially weaken confidence in Promptest's real-world predictive claim. Conversely, a harder task that *does* show separation would meaningfully strengthen it — the current null result may simply reflect an underpowered task, not an absent effect.
- A multi-model Layer 1 rerun (repeating the discrimination test across GPT, Gemini, and other OpenRouter models) that shows the same tier ordering would generalize Claim A beyond a single judge model. A rerun that shows a different model disagreeing with Claude Sonnet 5's rankings would narrow the reliability claim to "reliable for this judge model" rather than "reliable in general."
- A Layer 2 study with n≥3 per condition would let genuine prompt-driven effects be statistically separated from single-run model stochasticity, which the current n=1 design cannot do.
- The post-hoc "fix locality" observation (§2.3, §7) should be treated as provisional until tested as a preregistered hypothesis in its own right, ideally on a task purpose-built with multiple valid fix locations.

This paper's confidence rating (§12) should be revised downward if any of the above disconfirming results occur, and upward if the confirming versions occur.

---

## 11. Limitations

Stated plainly, without softening:

- Layer 2 has **n=1 per condition** — a single run per prompt variant. This is the single largest limitation of this study; it cannot rule out that a different random seed would have produced different outcomes for any given variant.
- The Layer 2 task was **too easy** to create the difficulty gradient the underlying hypothesis needs to be meaningfully tested. The null result should be read as *"this task couldn't detect an effect,"* not *"there is no effect."*
- Layer 1's OpenRouter test key had a **hard spending limit** ($1, later raised to $3) that caused real data gaps mid-study (documented, not hidden) and constrained how much Layer 1 sampling was affordable — 5 runs per prompt, not a larger n that would have tightened confidence intervals further.
- **Round 1 of Layer 2 was contaminated** by an explanatory code comment left in the fixture by the study's own author, and had to be discarded and rerun. This is disclosed in full (§4, incident log) rather than omitted.
- Subagent turn counts in Layer 2 are **self-reported estimates**, not independently instrumented tool-call counts, and were shown by the post-hoc cost analysis to diverge meaningfully from actual API-call counts in at least one case (`good-01` vs. `weak-01`). Treat self-reported turns as a weak signal; the actual-token-cost figures are the more trustworthy metric where both are available.
- The **cost analysis was not preregistered** — it was added after seeing that self-reported turns didn't tell a clean story. This is disclosed explicitly (§2.3) rather than presented as if it had been planned from the start, per CRG-RIS Principle 8 (Transparency).
- This entire study was conducted by Promptest's own developers. It is evidence, not independent audit.

---

## 12. Confidence Rating

Per the CRG-RIS confidence scale (0–30, summing across the ten principles above at up to 3 points each):

| Principle | Score /3 | Basis |
|---|---|---|
| Definition | 3 | Two claims cleanly decomposed and independently operationalized |
| Evidence | 3 | 55 live Layer 1 calls + 8 live Layer 2 agent runs (2 rounds), all real, all disclosed |
| Testability | 3 | Both claims empirically investigable with concrete, executable procedures |
| Refutability | 3 | Falsification conditions stated in advance; Layer 2 hypothesis actually falsified and reported as such |
| Reproducibility | 2 | Full scripts/data provided; Layer 2's n=1 per condition limits reproducibility confidence |
| Predictive Power | 1 | Layer 1 predictive claim (tier ordering) confirmed; Layer 2's real-world predictive claim falsified on this task |
| Explanatory Power | 2 | Plausible mechanism offered, now corroborated by an independent post-hoc metric (actual cost tracking fix-locality, not tier); competing task-difficulty explanation not yet ruled out, and both cost and fix-locality come from the same 4 runs, not independent samples |
| Transparency | 3 | Model, cost, bugs found, and conflicts of interest all disclosed |
| Traceability | 3 | Every figure traces to a specific file in this repository |
| Revision Readiness | 3 | Explicit, concrete disconfirming/confirming conditions specified for future work |

**Total: 26/30 — Strong.**

This reflects strong confidence in Claim A (the rubric is reliable and discriminating) and appropriately low confidence in the strong form of Claim B (rubric score predicts real-world outcome) pending a harder, higher-n follow-up study. The overall "Strong" rating is earned by the rigor and honesty of the process — including reporting a falsified hypothesis and a self-caught contamination incident — not by every sub-claim being confirmed.

---

## Research Pledge Compliance

This study was conducted under the Cortex Research Group Research Pledge:

- ✅ Sought evidence before certainty — no claim in this paper was asserted without a corresponding data file.
- ✅ Welcomed attempts to falsify — Layer 2's hypothesis was falsified and reported as such, not reframed.
- ✅ Published methods openly — all scripts, data, and prompts are in this repository.
- ✅ Distinguished observation from interpretation — §2 (Evidence) is kept separate from §7/§9 (Explanatory Power / post-hoc observations), which are explicitly labeled as such.
- ✅ Revised conclusions when evidence demanded it — round 1 of Layer 2 was discarded, not massaged, when contamination was discovered mid-study.
- ✅ Communicated confidence and uncertainty clearly — see §12 and the per-principle scores above.
- ✅ Preserved reproducibility and traceability — see §5 and §9.

**Motto:** Observe. Test. Refute. Reproduce. Predict. Revise. Evidence Over Assumption.
