import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { judgePrompt } from "../../src/judge";
import promptSet from "../data/prompt_set.json" with { type: "json" };

const RUNS_PER_PROMPT = 5;
const MODEL = "anthropic/claude-sonnet-5";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not set");
  process.exit(1);
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const resultsPath = new URL("../results/layer1-consistency.json", import.meta.url);
const existing = JSON.parse(readFileSync(resultsPath, "utf-8"));

async function main() {
  const targetPrompts = promptSet.prompts.filter((p) => p.text.trim().length > 0);

  for (const prompt of targetPrompts) {
    const existingEntry = existing.results.find((r: { id: string }) => r.id === prompt.id);
    const existingScores: number[] = existingEntry?.scores ?? [];
    const needed = RUNS_PER_PROMPT - existingScores.length;
    if (needed <= 0) {
      console.log(`\n=== ${prompt.id} (${prompt.tier}) === already complete (${existingScores.length}/${RUNS_PER_PROMPT}), skipping`);
      continue;
    }

    console.log(`\n=== ${prompt.id} (${prompt.tier}) === need ${needed} more run(s)`);
    const scores: number[] = [...existingScores];
    const runs: unknown[] = existingEntry?.runs ?? [];

    for (let i = 0; i < needed; i++) {
      try {
        const result = await judgePrompt("openrouter", apiKey!, prompt.text, MODEL);
        scores.push(result.overallScore);
        runs.push(result);
        console.log(`  run ${existingScores.length + i + 1}: overallScore=${result.overallScore} grade=${result.grade}`);
      } catch (err) {
        console.error(`  run ${existingScores.length + i + 1} FAILED:`, err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : NaN;
    const sd = scores.length ? stddev(scores) : NaN;
    console.log(`  mean=${mean.toFixed(2)} stddev=${sd.toFixed(2)} range=[${Math.min(...scores)}, ${Math.max(...scores)}]`);

    const updatedEntry = {
      id: prompt.id,
      tier: prompt.tier,
      text: prompt.text,
      scores,
      mean,
      stddev: sd,
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
      runs,
    };

    const idx = existing.results.findIndex((r: { id: string }) => r.id === prompt.id);
    if (idx >= 0) {
      existing.results[idx] = updatedEntry;
    } else {
      existing.results.push(updatedEntry);
    }

    // Save incrementally after each prompt so partial progress is never lost
    writeFileSync(resultsPath, JSON.stringify(existing, null, 2));
  }

  console.log(`\nSaved to ${resultsPath.pathname}`);
}

main();
