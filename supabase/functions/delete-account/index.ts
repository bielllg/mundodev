import { admin, authenticated, json, preflight } from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const user = await authenticated(req);
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error) throw Error("DELETE");
    return json({ ok: true });
  } catch (e) {
    const code = (e as Error).message;
    console.error("delete-account", code);
    return json(
      {
        error:
          code === "AUTH"
            ? "Sessão expirada. Entre novamente."
            : "Não foi possível excluir a conta.",
      },
      code === "AUTH" ? 401 : 500,
    );
  }
});
