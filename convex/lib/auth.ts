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

export function assertAdmin(token: string): void {
  const expected = getAdminToken();
  if (!expected || normalize(token) !== expected) throw new Error("Unauthorized");
}
