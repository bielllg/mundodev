import { describe, it, expect } from "vitest";
import { normalizeRegion } from "../../src/api";
import type { Lot, Profile } from "../../src/domain";
describe("contrato de dados da cidade", () => {
  it("aceita relações únicas do PostgREST como objeto e como array", () => {
    const lot: Lot = {
      id: "2:2",
      tile_x: 2,
      tile_y: 2,
      owner_id: "user-a",
      chunk_x: 0,
      chunk_y: 0,
    };
    const profile: Profile = {
      id: "user-a",
      github_id: "123",
      github_username: "alice",
      display_name: "Alice",
      bio: "",
      primary_language: "Python",
      current_xp: 0,
      avatar_url: "",
      wall_enabled: true,
      last_synced_at: null,
    };
    for (const buildings of [{ id: "building-a" }, [{ id: "building-a" }]]) {
      const result = normalizeRegion([
        { ...lot, profiles: profile, buildings },
      ]);
      expect(result.residents[0].building_id).toBe("building-a");
      expect(result.residents[0].lot).toEqual(lot);
    }
    expect(
      normalizeRegion([{ ...lot, profiles: profile, buildings: null }])
        .residents,
    ).toEqual([]);
  });
});
