import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002";
async function asUser<T>(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.identities(user_id uuid,provider text,provider_id text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const file of [
    "202610180001_city.sql",
    "202610180002_repository_cache.sql",
  ]) {
    let source = readFileSync(`supabase/migrations/${file}`, "utf8");
    source = source.replace("create extension if not exists pgcrypto;", "");
    await db.exec(source);
  }
  await db.query("insert into auth.users values ($1),($2)", [A, B]);
  await db.query(
    "insert into auth.identities values($1,'github','111'),($2,'github','222')",
    [A, B],
  );
  await db.query(
    "select public.bootstrap_profile($1,'111','alpha','Alpha','','')",
    [A],
  );
  await db.query(
    "select public.bootstrap_profile($1,'222','beta','Beta','','')",
    [B],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("permissões reais no PostgreSQL embarcado", () => {
  it("mantém a exclusividade com duas solicitações concorrentes", async () => {
    const C = "00000000-0000-4000-8000-000000000003",
      D = "00000000-0000-4000-8000-000000000004";
    for (const [id, stable] of [
      [C, "333"],
      [D, "444"],
    ]) {
      await db.query("insert into auth.users values($1)", [id]);
      await db.query("insert into auth.identities values($1,'github',$2)", [
        id,
        stable,
      ]);
      await db.query("select bootstrap_profile($1,$2,$2,$2,'','')", [
        id,
        stable,
      ]);
    }
    const reserve = (id: string) =>
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          id,
        ]);
        await tx.query("select claim_lot('10:10')");
      });
    const outcomes = await Promise.allSettled([reserve(C), reserve(D)]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (await db.query("select * from buildings where lot_id='10:10'")).rows,
    ).toHaveLength(1);
  });
  it("isola notas entre contas e bloqueia falsificação de proprietário", async () => {
    const n = await asUser<{ id: string }>(
      A,
      "insert into notes(user_id,title) values($1,'privada A') returning id",
      [A],
    );
    const id = n.rows[0].id;
    expect(
      (await asUser(B, "select * from notes where id=$1", [id])).rows,
    ).toHaveLength(0);
    await expect(
      asUser(B, "select save_note($1,1,'invadida','','Ideias')", [id]),
    ).rejects.toThrow(/acesso negado/);
    await expect(
      asUser(B, "insert into notes(user_id,title) values($1,'falsa')", [A]),
    ).rejects.toThrow();
    expect(
      (await asUser(B, "delete from notes where id=$1 returning id", [id]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await asUser(A, "select title from notes where id=$1", [id])).rows,
    ).toHaveLength(1);
  });
  it("detecta edição simultânea por versão", async () => {
    const { rows } = await asUser<{ id: string }>(
      A,
      "insert into notes(user_id,title) values($1,'versão') returning id",
      [A],
    );
    await asUser(A, "select save_note($1,1,'primeira','','Ideias')", [
      rows[0].id,
    ]);
    await expect(
      asUser(A, "select save_note($1,1,'perdida','','Ideias')", [rows[0].id]),
    ).rejects.toThrow(/Conflito/);
  });
  it("nega XP, snapshots, perfis e RPCs administrativas ao navegador", async () => {
    await expect(
      asUser(A, "update profiles set current_xp=999999 where id=$1", [A]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(A, "update lots set owner_id=$1", [A])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asUser(
        A,
        "select apply_commit_day($1,gen_random_uuid(),current_date-1,10)",
        [A],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(A, "select * from github_sync_jobs")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("reserva lote atomicamente e impede dupla propriedade", async () => {
    await asUser(A, "select claim_lot('2:2')");
    await expect(asUser(B, "select claim_lot('2:2')")).rejects.toThrow(
      /ocupado/,
    );
    await expect(asUser(A, "select claim_lot('2:6')")).rejects.toThrow(
      /já possui/,
    );
    await asUser(B, "select claim_lot('2:6')");
    expect(
      (
        await db.query("select * from buildings where owner_id in ($1,$2)", [
          A,
          B,
        ])
      ).rows,
    ).toHaveLength(2);
  });
  it("mural aceita apenas presets, limita repetição e respeita bloqueios", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from buildings where owner_id=$1",
      [B],
    );
    const building = rows[0].id;
    await asUser(A, "select send_door_message($1,0::smallint)", [building]);
    await expect(
      asUser(A, "select send_door_message($1,0::smallint)", [building]),
    ).rejects.toThrow(/Limite/);
    await expect(
      asUser(A, "select send_door_message($1,90::smallint)", [building]),
    ).rejects.toThrow(/inválido/);
    await asUser(
      B,
      "insert into blocked_users(owner_id,blocked_user_id) values($1,$2)",
      [B, A],
    );
    await expect(
      asUser(A, "select send_door_message($1,1::smallint)", [building]),
    ).rejects.toThrow(/indisponível/);
    await expect(
      asUser(
        A,
        "insert into door_messages(building_id,sender_id,preset_message_id) values($1,$2,0)",
        [building, A],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("mantém ID, XP e terreno ao renomear uma conta GitHub", async () => {
    await db.query(
      "select bootstrap_profile($1,'111','alpha-renomeado','Alpha','','')",
      [A],
    );
    const p = await db.query<{ github_username: string; owner_id: string }>(
      "select github_username,l.owner_id from profiles p join lots l on l.owner_id=p.id where p.id=$1",
      [A],
    );
    expect(p.rows[0]).toEqual({
      github_username: "alpha-renomeado",
      owner_id: A,
    });
    expect(
      (await asUser(A, "select * from search_residents('alpha-renomeado')"))
        .rows,
    ).toHaveLength(1);
  });
  it("aplica XP com idempotência, limite UTC e evolução transacional", async () => {
    await db.query(
      "update profiles set created_at=now()-interval '10 days',current_xp=450 where id=$1",
      [A],
    );
    await db.query(
      "update github_sync_jobs set next_date=current_date-9 where user_id=$1",
      [A],
    );
    const { rows } = await db.query<{ lease: { lease_id: string } }>(
      "select acquire_sync($1,false) as lease",
      [A],
    );
    const lease = rows[0].lease.lease_id;
    const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const award = async (n: number) =>
      db.query<{ gain: number }>(
        "select apply_commit_day($1,$2,$3::date,$4) as gain",
        [A, lease, day, n],
      );
    expect((await award(8)).rows[0].gain).toBe(80);
    expect((await award(8)).rows[0].gain).toBe(0);
    expect((await award(3)).rows[0].gain).toBe(0);
    expect((await award(99)).rows[0].gain).toBe(20);
    expect(
      (
        await db.query<{ current_xp: number }>(
          "select current_xp from profiles where id=$1",
          [A],
        )
      ).rows[0].current_xp,
    ).toBe(550);
    expect(
      (
        await db.query(
          "select * from building_evolution_events where user_id=$1",
          [A],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select apply_commit_day($1,$2,current_date,4)", [A, lease]),
    ).rejects.toThrow(/inválido/);
    await expect(
      db.query(
        "select apply_commit_day($1,$2,(now()-interval '10 days')::date,4)",
        [A, lease],
      ),
    ).rejects.toThrow(/inválido/);
    expect(
      (
        await db.query<{ lease: unknown }>(
          "select acquire_sync($1,false) as lease",
          [A],
        )
      ).rows[0].lease,
    ).toBeNull();
  });
  it("expande a cidade sem mover terrenos existentes", async () => {
    const before = (
      await db.query<{ id: string; tile_x: number; tile_y: number }>(
        "select id,tile_x,tile_y from lots order by id",
      )
    ).rows;
    const free = (
      await db.query<{ id: string }>(
        "select id from lots where owner_id is null order by id",
      )
    ).rows;
    for (let i = 0; i < free.length; i++) {
      const id = crypto.randomUUID(),
        stable = String(5000 + i);
      await db.query("insert into auth.users values($1)", [id]);
      await db.query("insert into auth.identities values($1,'github',$2)", [
        id,
        stable,
      ]);
      await db.query("select bootstrap_profile($1,$2,$2,$2,'','')", [
        id,
        stable,
      ]);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.query("select claim_lot($1)", [free[i].id]);
    }
    expect(
      (await db.query("select * from city_chunks")).rows.length,
    ).toBeGreaterThan(4);
    for (const lot of before)
      expect(
        (
          await db.query("select id,tile_x,tile_y from lots where id=$1", [
            lot.id,
          ])
        ).rows[0],
      ).toEqual(lot);
    expect(
      (await db.query("select * from lots where owner_id=$1", [A])).rows,
    ).toHaveLength(1);
  });
});
