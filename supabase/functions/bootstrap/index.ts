import {
  admin,
  authenticated,
  check,
  github,
  json,
  preflight,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const user = await authenticated(req);
    const identity = user.identities?.find((i) => i.provider === "github");
    if (!identity) throw Error("AUTH");
    const stable =
      identity.id ||
      identity.identity_data?.provider_id ||
      identity.identity_data?.sub;
    if (!/^\d+$/.test(String(stable))) throw Error("AUTH");
    const db = admin();
    const { data: existing } = await db
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) return json({ ok: true });
    const gh = await github(`user/${stable}`);
    if (String(gh.id) !== String(stable)) throw Error("AUTH");
    check(
      await db.rpc("bootstrap_profile", {
        target_user: user.id,
        stable_id: String(gh.id),
        username: gh.login,
        full_name: gh.name || gh.login,
        biography: gh.bio || "",
        avatar: gh.avatar_url || "",
      }),
    );
    return json({ ok: true });
  } catch (e) {
    const code = (e as Error).message;
    console.error("bootstrap", code);
    return json(
      {
        error:
          code === "AUTH"
            ? "Sessão expirada. Entre novamente."
            : "Não foi possível criar seu perfil. Tente novamente.",
      },
      code === "AUTH" ? 401 : 503,
    );
  }
});
