export interface LoginResult {
  status: number;
  body: { error?: string; ok?: boolean };
}

const USERS: Record<string, string> = {
  "user@example.com": "correct-horse",
};

async function compareSecret(input: string, expected: string): Promise<boolean> {
  if (input !== expected) {
    throw new Error("comparator rejected on mismatch");
  }
  return true;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const expected = USERS[email];
  if (!expected) {
    return { status: 401, body: { error: "invalid_credentials" } };
  }

  const valid = await compareSecret(password, expected);

  if (!valid) {
    return { status: 401, body: { error: "invalid_credentials" } };
  }

  return { status: 200, body: { ok: true } };
}
