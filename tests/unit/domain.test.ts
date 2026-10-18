import { describe, it, expect } from "vitest";
import {
  dailyAward,
  levelForXp,
  xpForLevel,
  stageForLevel,
  spriteKey,
  chunkTiles,
  tileKind,
  iso,
  uniso,
  isLot,
} from "../../src/domain";
describe("progresso validado", () => {
  it("respeita limiares de XP e cinco estágios", () => {
    for (let level = 1; level <= 100; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      if (level > 1) expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
    expect([1, 4, 5, 9, 10, 19, 20, 34, 35].map(stageForLevel)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5,
    ]);
  });
  it("limita cada dia e não repete recompensas", () => {
    expect(dailyAward(200, 0)).toBe(100);
    expect(dailyAward(9, 9)).toBe(0);
    expect(dailyAward(4, 9)).toBe(0);
    expect(dailyAward(10, 9)).toBe(10);
    expect(dailyAward(-1, 0)).toBe(0);
  });
  it("usa a mesma casa inicial para todas as linguagens", () => {
    expect(spriteKey("Python", 1)).toBe(spriteKey("Rust", 1));
    expect(spriteKey("C++", 3)).toBe("Outro-3");
  });
});
describe("mundo determinístico", () => {
  it("regenera chunks de forma idêntica inclusive negativos", () => {
    expect(chunkTiles(-2, 3)).toEqual(chunkTiles(-2, 3));
    expect(chunkTiles(1, 3)).not.toEqual(chunkTiles(-2, 3));
    expect(chunkTiles(0, 0)).toHaveLength(144);
  });
  it("mantém vias nas bordas entre chunks", () => {
    for (let i = -24; i < 24; i++) {
      expect(tileKind(0, i)).toBe(
        i % 4 === 0 && i % 12 !== 0 ? "bridge" : "canal",
      );
      expect(tileKind(12, i)).toBe(
        i % 4 === 0 && i % 12 !== 0 ? "bridge" : "canal",
      );
      if (i % 12 !== 0) expect(tileKind(4, i)).toBe("road");
    }
    expect(isLot(-2, -2)).toBe(true);
  });
  it("converte coordenadas da câmera sem perder posição", () => {
    for (let x = -10; x < 10; x++)
      for (let y = -10; y < 10; y++) {
        const p = iso(x, y);
        expect(uniso(p.x, p.y)).toEqual({ x, y });
      }
  });
});
