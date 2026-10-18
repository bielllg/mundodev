import {
  admin,
  authenticated,
  check,
  github,
  gql,
  json,
  preflight,
} from "../_shared/http.ts";
const DAY = 86400000;
const date = (n: number) => new Date(n).toISOString().slice(0, 10);
interface Job {
  user_id: string;
  next_date: string;
  lease_id: string;
}
interface Repo {
  id: string;
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  languages: {
    edges: { size: number; node: { name: string } }[];
    pageInfo: { hasNextPage: boolean };
  };
}
async function metadata(
  db: ReturnType<typeof admin>,
  userId: string,
  nodeId: string,
  gh: Record<string, string>,
) {
  let after: string | null = null;
  const bytes: Record<string, number> = {},
    repos: Repo[] = [];
  do {
    const data = await gql(
      `query($id:ID!,$after:String){rateLimit{remaining} node(id:$id){...on User{repositories(first:100,after:$after,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){nodes{id name description url stargazerCount primaryLanguage{name} languages(first:100){edges{size node{name}}pageInfo{hasNextPage}}}pageInfo{hasNextPage endCursor}}}}}`,
      { id: nodeId, after },
    );
    const page = data.node?.repositories;
    if (!page) throw Error("GITHUB_ID");
    for (const r of page.nodes as Repo[]) {
      if (r.languages.pageInfo.hasNextPage) throw Error("LANGUAGE_PAGINATION");
      repos.push(r);
      for (const edge of r.languages.edges)
        bytes[edge.node.name] = (bytes[edge.node.name] || 0) + edge.size;
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  const predominant =
    Object.entries(bytes).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] || "Outro";
  check(
    await db
      .from("profiles")
      .update({
        github_username: gh.login,
        display_name: gh.name || gh.login,
        bio: gh.bio || "",
        avatar_url: gh.avatar_url || "",
        primary_language: predominant,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId),
  );
  // Replace cache transactionally, so failed requests retain the last valid snapshot.
  check(
    await db.rpc("replace_repositories", {
      target_user: userId,
      rows: repos
        .sort((a, b) => b.stargazerCount - a.stargazerCount)
        .slice(0, 6)
        .map((r) => ({
          github_repository_id: r.id,
          name: r.name,
          description: r.description || "",
          url: r.url,
          language: r.primaryLanguage?.name || "",
          stars: r.stargazerCount,
        })),
    }),
  );
}
async function commitCount(nodeId: string, day: string) {
  const data = await gql(
    `query($id:ID!,$from:DateTime!,$to:DateTime!){rateLimit{remaining} node(id:$id){... on User{contributionsCollection(from:$from,to:$to){totalCommitContributions commitContributionsByRepository(maxRepositories:100){repository{isPrivate} contributions(first:2){nodes{commitCount occurredAt}pageInfo{hasNextPage}}}}}}}`,
    { id: nodeId, from: day + "T00:00:00Z", to: day + "T23:59:59Z" },
  );
  const collection = data.node?.contributionsCollection;
  if (!collection) throw Error("GITHUB_ID");
  const groups = collection.commitContributionsByRepository as {
    repository: { isPrivate: boolean };
    contributions: {
      nodes: { commitCount: number; occurredAt: string }[];
      pageInfo: { hasNextPage: boolean };
    };
  }[];
  if (
    groups.length >= 100 ||
    groups.some((g) => g.contributions.pageInfo.hasNextPage)
  )
    throw Error("CONTRIBUTION_TRUNCATED");
  let count = 0;
  for (const g of groups)
    if (!g.repository.isPrivate)
      for (const contribution of g.contributions.nodes)
        if (contribution.occurredAt.slice(0, 10) === day) {
          if (
            !Number.isSafeInteger(contribution.commitCount) ||
            contribution.commitCount < 0
          )
            throw Error("CONTRIBUTION_INVALID");
          count += contribution.commitCount;
        }
  return count;
}
async function syncOne(
  db: ReturnType<typeof admin>,
  userId: string,
  manual: boolean,
) {
  const { data: lease, error } = await db.rpc("acquire_sync", {
    target_user: userId,
    manual,
  });
  if (error) throw Error("COOLDOWN");
  if (!lease) return { status: "already-running-or-not-due" };
  const job: Job = { user_id: userId, ...lease };
  let cursor = job.next_date;
  try {
    const { data: profile, error: pError } = await db
      .from("profiles")
      .select("github_id,created_at")
      .eq("id", userId)
      .single();
    if (pError) throw Error("DATABASE");
    const gh = await github(`user/${profile.github_id}`);
    if (String(gh.id) !== profile.github_id) throw Error("GITHUB_ID");
    const today = date(Date.now()),
      firstEligible = date(Date.parse(profile.created_at.slice(0, 10)) + DAY);
    const start = cursor;
    let processed = 0;
    // Catch up bounded windows and revisit seven previous UTC days for delayed GitHub data.
    const overlapStart = date(
      Math.max(Date.parse(firstEligible), Date.parse(start) - 7 * DAY),
    );
    const days: string[] = [];
    for (
      let d = overlapStart;
      d < start && d < today;
      d = date(Date.parse(d) + DAY)
    )
      days.push(d);
    for (
      let d = start;
      d < today && processed < 21;
      d = date(Date.parse(d) + DAY)
    ) {
      days.push(d);
      processed++;
    }
    for (const day of days) {
      const observed = await commitCount(gh.node_id, day);
      check(
        await db.rpc("apply_commit_day", {
          target_user: userId,
          lease: job.lease_id,
          day,
          observed,
        }),
      );
      if (day >= cursor) cursor = date(Date.parse(day) + DAY);
    }
    await metadata(db, userId, gh.node_id, gh);
    check(
      await db.rpc("finish_sync", {
        target_user: userId,
        lease: job.lease_id,
        cursor_day: cursor,
        error_code: null,
      }),
    );
    return { status: "synced", processed: days.length };
  } catch (e) {
    const code = (e as Error).message;
    console.error("sync-user", userId, code);
    await db.rpc("finish_sync", {
      target_user: userId,
      lease: job.lease_id,
      cursor_day: cursor,
      error_code: code,
    });
    throw e;
  }
}
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const expected = Deno.env.get("SYNC_SECRET");
    const cron = !!expected && req.headers.get("x-sync-secret") === expected;
    const db = admin();
    if (!cron) {
      const user = await authenticated(req);
      return json(await syncOne(db, user.id, true));
    }
    const { data, error } = await db
      .from("github_sync_jobs")
      .select("user_id")
      .lte("retry_after", new Date().toISOString())
      .or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`)
      .order("retry_after")
      .limit(5);
    if (error) throw Error("DATABASE");
    // Sequential users bound concurrency and protect GitHub's secondary rate limits.
    const result = [];
    for (const job of data || []) {
      try {
        result.push(await syncOne(db, job.user_id, false));
      } catch (e) {
        result.push({ status: "failed" });
        if ((e as Error).message === "RATE_LIMIT") break;
      }
    }
    return json({ processed: result.length, result });
  } catch (e) {
    const code = (e as Error).message;
    console.error("sync-request", code);
    return json(
      {
        error:
          code === "AUTH"
            ? "Sessão expirada. Entre novamente."
            : code === "COOLDOWN"
              ? "Aguarde 24 horas entre atualizações manuais."
              : "GitHub indisponível. Seu progresso foi preservado.",
      },
      code === "AUTH" ? 401 : code === "COOLDOWN" ? 429 : 503,
    );
  }
});
