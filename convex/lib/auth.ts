declare const process: { env: Record<string, string | undefined> };

export function normalize(s: string): string {
  return s.trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
}

export function getAdminToken(): string | undefined {
  const raw = process.env.ADMIN_TOKEN;
  if (!raw) return undefined;
  const normalized = normalize(raw);
  return normalized || undefined;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function assertAdmin(token: string): void {
  const expected = getAdminToken();
  if (!expected || !constantTimeEqual(normalize(token), expected)) {
    throw new Error("Unauthorized");
  }
}
