import { createClient } from "npm:@supabase/supabase-js@2";
export const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export const headers = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") || "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
  "Content-Type": "application/json",
};
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}
export function preflight(req: Request) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  return null;
}
export async function authenticated(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("AUTH");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH");
  return data.user;
}
export async function github(path: string, body?: unknown) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw Error("CONFIG");
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.github.com/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "DevCity",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (
      (r.status === 429 || r.status === 403) &&
      r.headers.get("x-ratelimit-remaining") === "0"
    )
      throw Error("RATE_LIMIT");
    if (r.status >= 500 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (!r.ok) throw Error(`GITHUB_${r.status}`);
    const data = await r.json();
    if (data.errors?.length) throw Error("GRAPHQL");
    if (data.data?.rateLimit?.remaining < 50) throw Error("RATE_LIMIT");
    return data;
  }
  throw Error("GITHUB_UNAVAILABLE");
}
export async function gql(query: string, variables: Record<string, unknown>) {
  const response = await github("graphql", { query, variables });
  return response.data;
}
export function check(result: { error: unknown }) {
  if (result.error) throw Error("DATABASE");
}
