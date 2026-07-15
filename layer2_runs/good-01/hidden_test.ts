// CRG-RIS Layer 2 hidden acceptance test.
// Not shown to the agent during the run — used only to score the outcome afterward.
import { login } from "./src/login";

async function main() {
  const results: { name: string; pass: boolean; detail?: string }[] = [];

  // 1. Wrong password must return 401, not throw / 500
  try {
    const r = await login("user@example.com", "wrong-password");
    results.push({
      name: "wrong_password_returns_401",
      pass: r.status === 401 && r.body.error === "invalid_credentials",
      detail: JSON.stringify(r),
    });
  } catch (e) {
    results.push({
      name: "wrong_password_returns_401",
      pass: false,
      detail: `threw instead of returning 401: ${e instanceof Error ? e.message : e}`,
    });
  }

  // 2. Unknown user must still return 401 (regression guard — must not break existing path)
  try {
    const r = await login("nobody@example.com", "whatever");
    results.push({
      name: "unknown_user_returns_401",
      pass: r.status === 401,
      detail: JSON.stringify(r),
    });
  } catch (e) {
    results.push({
      name: "unknown_user_returns_401",
      pass: false,
      detail: `threw: ${e instanceof Error ? e.message : e}`,
    });
  }

  const allPass = results.every((r) => r.pass);
  console.log(JSON.stringify({ allPass, results }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main();
