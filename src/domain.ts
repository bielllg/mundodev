export const LANGUAGES = [
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "TypeScript",
  "Java",
  "Outro",
] as const;
export type Language = (typeof LANGUAGES)[number];
export const PRESETS = [
  "Prédio incrível! ❤️",
  "Adorei seus projetos! ⭐",
  "Mandou bem! 👏",
  "Passei para conhecer! 👋",
  "Parabéns pela evolução! 🎉",
];
export const STAGES = [
  "Casa inicial",
  "Casa evoluída",
  "Edifício temático",
  "Edifício avançado",
  "Edifício especial",
];
export const xpForLevel = (n: number) => 25 * (n - 1) * n;
export function levelForXp(xp: number) {
  return Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 25)) / 2);
}
export const stageForLevel = (n: number) =>
  n >= 35 ? 5 : n >= 20 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : 1;
export const spriteKey = (language: string, stage: number) =>
  stage < 3
    ? `house-${stage}`
    : `${LANGUAGES.includes(language as Language) ? language : "Outro"}-${stage}`;
export function dailyAward(observed: number, previous: number) {
  return (
    Math.max(
      0,
      Math.min(10, Math.max(0, Math.floor(observed))) - Math.min(10, previous),
    ) * 10
  );
}
export interface Profile {
  id: string;
  github_id: string;
  github_username: string;
  display_name: string;
  bio: string;
  primary_language: Language;
  current_xp: number;
  avatar_url: string;
  last_synced_at: string | null;
  wall_enabled: boolean;
}
export interface Lot {
  id: string;
  tile_x: number;
  tile_y: number;
  owner_id: string | null;
  chunk_x: number;
  chunk_y: number;
}
export interface Building {
  id: string;
  owner_id: string;
  lot_id: string;
}
export interface Resident extends Profile {
  lot: Lot;
  building_id: string;
}
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  version: number;
  updated_at: string;
}
export interface DoorMessage {
  id: string;
  building_id: string;
  sender_id: string;
  preset_message_id: number;
  created_at: string;
}
export interface Repository {
  name: string;
  description: string;
  url: string;
  language: string;
  stars: number;
}
export interface Evolution {
  id: string;
  previous_stage: number;
  new_stage: number;
  created_at: string;
  viewed_at: string | null;
}
export const CHUNK_SIZE = 12;
export function hash(x: number, y: number) {
  let h = Math.imul(x ^ 71391, 374761393) ^ Math.imul(y ^ 1207, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export function tileKind(x: number, y: number) {
  if (
    (mod(x, 12) === 0 && mod(y, 4) === 0 && mod(y, 12) !== 0) ||
    (mod(y, 12) === 0 && mod(x, 4) === 0 && mod(x, 12) !== 0)
  )
    return "bridge";
  if (mod(x, 12) === 0 || mod(y, 12) === 0) return "canal";
  if (mod(x, 4) === 0 || mod(y, 4) === 0) return "road";
  return "grass";
}
export function isLot(x: number, y: number) {
  return mod(x, 4) === 2 && mod(y, 4) === 2;
}
export function chunkTiles(cx: number, cy: number) {
  return Array.from({ length: 144 }, (_, i) => {
    const x = cx * 12 + (i % 12),
      y = cy * 12 + Math.floor(i / 12);
    return { x, y, kind: tileKind(x, y), seed: hash(x, y) };
  });
}
export const iso = (x: number, y: number) => ({
  x: (x - y) * 48,
  y: (x + y) * 24,
});
export const uniso = (x: number, y: number) => ({
  x: (x / 48 + y / 24) / 2,
  y: (y / 24 - x / 48) / 2,
});
export const NEIGHBORHOODS = [
  {
    name: "Praça dos Commits",
    description: "Encontros, ideias e um café entre commits.",
    x: 6,
    y: 6,
    icon: "☕",
  },
  {
    name: "Jardim do Código",
    description: "Onde boas ideias criam raízes.",
    x: 18,
    y: 6,
    icon: "🌱",
  },
  {
    name: "Distrito Criativo",
    description: "Pessoas criativas. Possibilidades infinitas.",
    x: 6,
    y: 18,
    icon: "🎨",
  },
  {
    name: "Porto Open Source",
    description: "Contribuições que atravessam fronteiras.",
    x: 18,
    y: 18,
    icon: "⚓",
  },
];
