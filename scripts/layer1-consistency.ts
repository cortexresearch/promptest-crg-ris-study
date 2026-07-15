import "dotenv/config";
import { writeFileSync } from "node:fs";
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

async function main() {
  const targetPrompts = promptSet.prompts.filter((p) => p.text.trim().length > 0);
  const results: Record<string, unknown>[] = [];

  for (const prompt of targetPrompts) {
    console.log(`\n=== ${prompt.id} (${prompt.tier}) ===`);
    const scores: number[] = [];
    const runs: unknown[] = [];

    for (let i = 0; i < RUNS_PER_PROMPT; i++) {
      try {
        const result = await judgePrompt("openrouter", apiKey!, prompt.text, MODEL);
        scores.push(result.overallScore);
        runs.push(result);
        console.log(`  run ${i + 1}: overallScore=${result.overallScore} grade=${result.grade}`);
      } catch (err) {
        console.error(`  run ${i + 1} FAILED:`, err instanceof Error ? err.message : err);
      }
      // small delay to avoid hammering rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = stddev(scores);
    console.log(`  mean=${mean.toFixed(2)} stddev=${sd.toFixed(2)} range=[${Math.min(...scores)}, ${Math.max(...scores)}]`);

    results.push({
      id: prompt.id,
      tier: prompt.tier,
      text: prompt.text,
      scores,
      mean,
      stddev: sd,
      min: Math.min(...scores),
      max: Math.max(...scores),
      runs,
    });
  }

  const outPath = new URL("../results/layer1-consistency.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify({ model: MODEL, runsPerPrompt: RUNS_PER_PROMPT, results }, null, 2));
  console.log(`\nSaved to ${outPath.pathname}`);
}

main();
