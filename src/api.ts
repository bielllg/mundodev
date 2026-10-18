import { createClient, type Session } from "@supabase/supabase-js";
import {
  type Profile,
  type Resident,
  type Lot,
  type Note,
  type DoorMessage,
  type Repository,
  type Evolution,
  LANGUAGES,
  PRESETS,
} from "./domain";
export const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
export const isDemo = !supabase;
const DEMO_KEY = "devcity-demo-v1";
interface Demo {
  lots: Lot[];
  profiles: Profile[];
  notes: Note[];
  messages: DoorMessage[];
}
function initialDemo(): Demo {
  const names = [
    "devluna",
    "mari.codes",
    "brunodev",
    "rafaelbuilds",
    "ana.dev",
    "camilacodes",
    "lucas.rs",
    "sofiaweb",
    "pedrogo",
    "bia.design",
    "matheusjs",
    "juliana.py",
    "henrique",
    "carol.ts",
    "felipejava",
    "gabicode",
    "thiago",
    "leticia",
    "diego",
    "alice",
  ];
  const lots: Lot[] = [],
    profiles: Profile[] = [];
  for (let cx = 0; cx < 2; cx++)
    for (let cy = 0; cy < 2; cy++)
      for (let x = 2; x < 12; x += 4)
        for (let y = 2; y < 12; y += 4) {
          const i = lots.length;
          const owner = i < names.length ? `demo-${i}` : null;
          lots.push({
            id: `${cx * 12 + x}:${cy * 12 + y}`,
            tile_x: cx * 12 + x,
            tile_y: cy * 12 + y,
            chunk_x: cx,
            chunk_y: cy,
            owner_id: owner,
          });
          if (owner)
            profiles.push({
              id: owner,
              github_id: `ficticio-${i}`,
              github_username: names[i],
              display_name: names[i],
              bio:
                i === 0
                  ? "Construindo ferramentas, conexões e um futuro mais aberto."
                  : "Transformando ideias em código. Uma contribuição de cada vez.",
              primary_language: LANGUAGES[i % 7],
              current_xp:
                i === 0 ? 3300 : i % 5 === 0 ? 0 : 1200 + ((i * 2371) % 35000),
              avatar_url: "",
              last_synced_at: null,
              wall_enabled: true,
            });
        }
  return { lots, profiles, notes: [], messages: [] };
}
function readDemo(): Demo {
  try {
    return (
      JSON.parse(localStorage.getItem(DEMO_KEY) || "null") || initialDemo()
    );
  } catch {
    return initialDemo();
  }
}
function saveDemo(d: Demo) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(d));
}
export const demoProfile = () => readDemo().profiles[0];
export interface Region {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
const regionCache = new Map<
  string,
  { expires: number; data: { residents: Resident[]; lots: Lot[] } }
>();
export function invalidateRegionCache() {
  regionCache.clear();
}
export async function loadRegion(b: Region) {
  const key = JSON.stringify(b),
    cached = regionCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await queryRegion(b);
  regionCache.set(key, { expires: Date.now() + 15000, data });
  if (regionCache.size > 12)
    regionCache.delete(regionCache.keys().next().value!);
  return data;
}
async function queryRegion(
  b: Region,
): Promise<{ residents: Resident[]; lots: Lot[] }> {
  if (!supabase) {
    const d = readDemo();
    const lots = d.lots.filter(
      (l) =>
        l.chunk_x >= b.minX &&
        l.chunk_x <= b.maxX &&
        l.chunk_y >= b.minY &&
        l.chunk_y <= b.maxY,
    );
    return {
      lots,
      residents: lots
        .filter((l) => l.owner_id)
        .map((l) => ({
          ...d.profiles.find((p) => p.id === l.owner_id)!,
          lot: l,
          building_id: `building-${l.owner_id}`,
        })),
    };
  }
  const { data, error } = await supabase
    .from("lots")
    .select("*,profiles!lots_owner_id_fkey(*),buildings(id)")
    .gte("chunk_x", b.minX)
    .lte("chunk_x", b.maxX)
    .gte("chunk_y", b.minY)
    .lte("chunk_y", b.maxY);
  if (error) throw error;
  return normalizeRegion(data);
}
export function normalizeRegion(
  rows: (Lot & {
    profiles: Profile | null;
    buildings: { id: string } | { id: string }[] | null;
  })[],
) {
  const lots: Lot[] = rows.map(
    ({ id, tile_x, tile_y, owner_id, chunk_x, chunk_y }) => ({
      id,
      tile_x,
      tile_y,
      owner_id,
      chunk_x,
      chunk_y,
    }),
  );
  const residents: Resident[] = rows.flatMap((row, index) => {
    const building = Array.isArray(row.buildings)
      ? row.buildings[0]
      : row.buildings;
    return row.profiles && building
      ? [{ ...row.profiles, lot: lots[index], building_id: building.id }]
      : [];
  });
  return { lots, residents };
}
export async function getProfile(id: string) {
  if (!supabase) return readDemo().profiles.find((p) => p.id === id) || null;
  let result = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    const initialized = await supabase.functions.invoke("bootstrap");
    if (initialized.error)
      throw Error(
        "Não foi possível criar o perfil. Verifique sua sessão e tente entrar novamente.",
      );
    result = await supabase.from("profiles").select("*").eq("id", id).single();
    if (result.error) throw result.error;
  }
  return result.data as Profile | null;
}
export async function findResidents(q: string): Promise<Resident[]> {
  if (!supabase) {
    const d = readDemo();
    return d.profiles
      .filter((p) => p.github_username.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 20)
      .map((p) => ({
        ...p,
        lot: d.lots.find((l) => l.owner_id === p.id)!,
        building_id: `building-${p.id}`,
      }));
  }
  const { data, error } = await supabase.rpc("search_residents", {
    query_text: q,
  });
  if (error) throw error;
  return data as Resident[];
}
export async function residentById(id: string): Promise<Resident | null> {
  if (!supabase) {
    const d = readDemo(),
      p = d.profiles.find((p) => p.id === id),
      lot = d.lots.find((l) => l.owner_id === id);
    return p && lot ? { ...p, lot, building_id: `building-${id}` } : null;
  }
  const { data, error } = await supabase.rpc("resident_by_id", {
    profile_id: id,
  });
  if (error) throw error;
  return data as Resident | null;
}
export async function claimLot(id: string, userId: string) {
  invalidateRegionCache();
  if (!supabase) {
    const d = readDemo();
    if (d.lots.some((l) => l.owner_id === userId))
      throw Error("Você já tem um terreno permanente.");
    const l = d.lots.find((l) => l.id === id);
    if (!l || l.owner_id)
      throw Error("Este terreno já foi ocupado. Escolha outro.");
    l.owner_id = userId;
    saveDemo(d);
    return;
  }
  const { error } = await supabase.rpc("claim_lot", { target_lot: id });
  if (error) throw error;
  invalidateRegionCache();
}
export async function listNotes(userId: string): Promise<Note[]> {
  if (!supabase) return readDemo().notes.filter((n) => n.user_id === userId);
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function createNote(userId: string) {
  const n = {
    id: crypto.randomUUID(),
    user_id: userId,
    title: "Nova ideia",
    content: "",
    category: "Ideias",
    version: 1,
    updated_at: new Date().toISOString(),
  };
  if (!supabase) {
    const d = readDemo();
    d.notes.unshift(n);
    saveDemo(d);
    return n;
  }
  const { data, error } = await supabase
    .from("notes")
    .insert(n)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}
export async function saveNote(note: Note): Promise<Note> {
  if (!supabase) {
    const d = readDemo(),
      index = d.notes.findIndex(
        (n) => n.id === note.id && n.user_id === note.user_id,
      );
    if (index < 0) throw Error("Nota não encontrada.");
    if (d.notes[index].version !== note.version)
      throw Error(
        "Conflito: esta nota mudou em outra aba. Recarregue as notas antes de editar.",
      );
    const next = {
      ...note,
      version: note.version + 1,
      updated_at: new Date().toISOString(),
    };
    d.notes[index] = next;
    saveDemo(d);
    return next;
  }
  const { data, error } = await supabase.rpc("save_note", {
    note_id: note.id,
    expected_version: note.version,
    new_title: note.title,
    new_content: note.content,
    new_category: note.category,
  });
  if (error) throw error;
  return data as Note;
}
export async function deleteNote(id: string, userId: string) {
  if (!supabase) {
    const d = readDemo();
    d.notes = d.notes.filter((n) => n.id !== id || n.user_id !== userId);
    saveDemo(d);
    return;
  }
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
export async function repositories(userId: string): Promise<Repository[]> {
  if (!supabase)
    return [
      {
        name: "cidade-aberta",
        description: "Projeto fictício de uma comunidade que constrói junto.",
        url: "https://github.com",
        language: "TypeScript",
        stars: 128,
      },
      {
        name: "pequenas-ideias",
        description: "Exemplo de repositório no modo de demonstração.",
        url: "https://github.com",
        language: "JavaScript",
        stars: 42,
      },
    ];
  const { data, error } = await supabase
    .from("repository_cache")
    .select("name,description,url,language,stars")
    .eq("user_id", userId)
    .order("stars", { ascending: false })
    .limit(6);
  if (error) throw error;
  return data;
}
export async function listMessages(
  buildingId: string,
  page = 0,
): Promise<DoorMessage[]> {
  if (!supabase)
    return readDemo()
      .messages.filter((m) => m.building_id === buildingId)
      .slice(page * 10, page * 10 + 10);
  const { data, error } = await supabase
    .from("door_messages")
    .select("*")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false })
    .range(page * 10, page * 10 + 9);
  if (error) throw error;
  return data;
}
export async function sendMessage(
  buildingId: string,
  preset: number,
  userId: string,
) {
  if (!PRESETS[preset]) throw Error("Recado inválido.");
  if (!supabase) {
    const d = readDemo(),
      today = new Date().toISOString().slice(0, 10),
      sent = d.messages.filter(
        (m) => m.sender_id === userId && m.created_at.startsWith(today),
      );
    if (
      sent.length >= 10 ||
      sent.filter((m) => m.building_id === buildingId).length >= 3 ||
      sent.some(
        (m) => m.building_id === buildingId && m.preset_message_id === preset,
      )
    )
      throw Error("Limite de recados atingido. Volte amanhã.");
    d.messages.unshift({
      id: crypto.randomUUID(),
      sender_id: userId,
      building_id: buildingId,
      preset_message_id: preset,
      created_at: new Date().toISOString(),
    });
    saveDemo(d);
    return;
  }
  const { error } = await supabase.rpc("send_door_message", {
    target_building: buildingId,
    preset_id: preset,
  });
  if (error) throw error;
}
export async function removeMessage(id: string) {
  if (!supabase) {
    const d = readDemo();
    d.messages = d.messages.filter((m) => m.id !== id);
    saveDemo(d);
    return;
  }
  const { error } = await supabase.from("door_messages").delete().eq("id", id);
  if (error) throw error;
}
export async function blockUser(id: string, owner: string) {
  if (!supabase) {
    const d = readDemo();
    d.messages = d.messages.filter(
      (m) => !(m.sender_id === id && m.building_id === `building-${owner}`),
    );
    saveDemo(d);
    return;
  }
  const { error } = await supabase
    .from("blocked_users")
    .insert({ owner_id: owner, blocked_user_id: id });
  if (error) throw error;
}
export async function toggleWall(enabled: boolean) {
  invalidateRegionCache();
  if (!supabase) {
    const d = readDemo();
    d.profiles[0].wall_enabled = enabled;
    saveDemo(d);
    return;
  }
  const { error } = await supabase.rpc("set_wall_enabled", { enabled });
  if (error) throw error;
  invalidateRegionCache();
}
export async function evolutions(): Promise<Evolution[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("building_evolution_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
export async function markEvolution(id: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("ack_evolution", { event_id: id });
  if (error) throw error;
}
export async function syncGitHub() {
  invalidateRegionCache();
  if (!supabase)
    throw Error("Demonstração: não há consulta ao GitHub nem XP real.");
  const { error } = await supabase.functions.invoke("sync-github", {
    body: { manual: true },
  });
  if (error) throw error;
  invalidateRegionCache();
}
export async function deleteAccount() {
  invalidateRegionCache();
  if (!supabase) {
    localStorage.removeItem(DEMO_KEY);
    return;
  }
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) throw error;
}
export async function login() {
  if (!supabase)
    throw Error(
      "Configure o Supabase e o OAuth GitHub para entrar com uma conta real.",
    );
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { scopes: "read:user", redirectTo: location.origin + "/cidade" },
  });
  if (error) throw error;
}
export async function logout() {
  if (supabase) await supabase.auth.signOut();
}
export type { Session };
