# Does a Prompt-Quality Rubric Actually Predict Anything?

A CRG-RIS evaluation of [Promptest](https://promptest.cortexresearch.group)'s prompt-scoring rubric — tested against the Cortex Research Group Research Integrity Standard (CRG-RIS) v1.0.

**Read the full paper: [PAPER.md](./PAPER.md)**

## Summary

Promptest scores AI prompts against a five-category rubric using an LLM judge. This study asks two separate, falsifiable questions:

1. **Is the rubric reliable and discriminating?** → **Yes.** 55 live judge calls across four labeled quality tiers (bad/weak/good/excellent) show tight within-prompt consistency and a clean, non-overlapping score separation between tiers (bad = 7.5, weak = 23.3, good = 83.5, excellent = 92.6, mean scores on a 0–100 scale).
2. **Does a higher score predict a better real-world coding outcome?** → **Falsified on its preregistered metrics, for this task.** Four prompts spanning all four tiers were given, verbatim, to independent coding agents against the identical underlying bug. All four produced a correct fix; the lowest-tier prompts self-reported *fewer* turns than the "good"-tier prompt. The preregistered hypothesis did not hold, and is reported as falsified rather than reinterpreted.

**But actual dollar cost told a different, more specific story than self-reported turns did.** A post-hoc analysis of real token usage (extracted from each agent's session transcript, not self-reported) shows bad/weak/good tiers clustered tightly together at $0.12–$0.13, while only the prompt that named the bug's exact root cause and location cost 37–41% less ($0.0796) — using roughly half the API calls. That prompt was also the only one whose fix stayed confined to the intended function; the other three, regardless of tier, independently converged on a broader change that tripped an actual security-policy flag. Both findings are disclosed as post-hoc, non-preregistered observations, not confirmed evidence — see [PAPER.md §2.3](./PAPER.md#23-layer-2-evidence--real-world-predictive-power).

Two real production bugs in Promptest were found and fixed as a direct byproduct of this study (documented in [PAPER.md §8](./PAPER.md#8-transparency)).

This is not a favorable-results-only writeup. The negative result is the headline finding of Layer 2, and a mid-study contamination incident (an answer-key comment accidentally left in the test fixture) is documented in full rather than omitted.

## Repository contents

| Path | What it is |
|---|---|
| [`PAPER.md`](./PAPER.md) | The full study, structured against all ten CRG-RIS principles |
| `data/prompt_set.json` | The 12 labeled prompts used in Layer 1 (reliability/discrimination) |
| `data/layer2_prereg.json` | Layer 2 preregistration — predictions recorded **before** execution, plus the full incident log |
| `results/layer1-consistency.json` | Raw Layer 1 output — every judge call, every score |
| `results/layer2-results.json` | Final Layer 2 scoring, fix analysis, and evaluation against the preregistered falsification condition |
| `scripts/` | The exact scripts used for Layer 1, importing Promptest's real judge pipeline directly (not a reimplementation) |
| `task_repo/` | The pristine Layer 2 bug fixture, with a verified-failing acceptance test |
| `layer2_runs/` | The four executed Layer 2 variants, exactly as produced by the coding agents (not edited afterward) |

## Reproducing this study

**Layer 1** requires Promptest's application source (the `scripts/` here import `judgePrompt` directly from it) and an API key for the judge provider used (OpenRouter, in this study). This repo is the evidentiary record of that run, not a standalone harness — see [promptest.cortexresearch.group](https://promptest.cortexresearch.group) for the product itself.

**Layer 2** requires a coding agent (this study used Claude Code) run against fresh copies of `task_repo/`, one per prompt variant, in isolation from each other and from any knowledge of this study's design — see [`data/layer2_prereg.json`](./data/layer2_prereg.json) for the exact preregistered protocol.

## License

Research content (paper, data, results) is shared for transparency and independent scrutiny. No warranty of any kind.
