import { Texture, Rectangle } from "pixi.js";
import { hash, spriteKey, LANGUAGES } from "./domain";
type C = CanvasRenderingContext2D;
export const COLORS: Record<string, string> = {
  JavaScript: "#e5ba50",
  Python: "#659578",
  Rust: "#c97854",
  Go: "#91bed0",
  TypeScript: "#8c86c2",
  Java: "#dbc59d",
  Outro: "#9bb399",
};
export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function poly(c: C, points: number[], color: string, stroke?: string) {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
function rect(c: C, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function plant(c: C, x: number, y: number, seed: number, size = 12) {
  rect(c, x - 3, y, 6, 9, "#785d43");
  const shades = ["#345c45", "#4c7950", "#679454", "#88ad62"];
  for (let i = 0; i < 17; i++) {
    const r = hash(seed, i);
    rect(
      c,
      x + (r % size) - size / 2,
      y - 5 - ((r >>> 6) % size),
      4 + (r % 5),
      4 + (r % 5),
      shades[i % 4],
    );
  }
  for (let i = 0; i < 4; i++)
    rect(
      c,
      x - 6 + i * 4,
      y - 7 - (hash(seed, i) % 9),
      2,
      2,
      i % 2 ? "#efb25e" : "#e4a4af",
    );
}
export function buildingCanvas(language: string, stage: number) {
  const out = canvas(320, 390),
    c = out.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  const floors =
    stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : stage === 4 ? 4 : 5;
  const h = floors * 39,
    base = 324,
    top = base - h;
  const theme = stage < 3 ? "Outro" : language;
  const col = stage < 3 ? "#f2d8a6" : COLORS[theme] || COLORS.Outro;
  poly(c, [31, 327, 157, 264, 293, 326, 165, 383], "#35534a55");
  poly(c, [25, 320, 151, 258, 289, 320, 162, 382], "#b4a58a", "#827d71");
  poly(c, [25, 320, 162, 381, 162, 388, 25, 327], "#8a8978");
  poly(c, [162, 381, 289, 320, 289, 327, 162, 388], "#777e70");
  for (let i = 0; i < 12; i++) {
    const x = 50 + (i % 4) * 48,
      y = 319 + Math.floor(i / 4) * 15;
    rect(c, x, y, 18, 2, "#d1c4a7");
  }
  poly(
    c,
    [61, base - 16, 161, base + 33, 161, top + 33, 61, top - 16],
    col,
    "#766c58",
  );
  poly(
    c,
    [161, base + 33, 258, base - 16, 258, top - 16, 161, top + 33],
    theme === "Rust"
      ? "#a65c42"
      : theme === "TypeScript"
        ? "#666e9c"
        : "#c4bfaa",
    "#6b7065",
  );
  for (let f = 0; f < floors; f++) {
    const y = base - f * 39;
    poly(
      c,
      [
        58,
        y - 15,
        161,
        y + 35,
        261,
        y - 15,
        261,
        y - 21,
        161,
        y + 28,
        58,
        y - 22,
      ],
      "#dfd7bb",
      "#938b76",
    );
    for (let k = 0; k < 3; k++) {
      const x = 72 + k * 29,
        wy = y - 32 + (x - 61) * 0.49;
      poly(
        c,
        [x, wy - 22, x + 20, wy - 12, x + 20, wy + 10, x, wy],
        "#334a51",
        "#565c51",
      );
      poly(
        c,
        [x + 3, wy - 18, x + 17, wy - 11, x + 17, wy + 6, x + 3, wy - 1],
        k % 2 ? "#efc97e" : "#a3c4c5",
      );
      rect(c, x + 9, wy - 16, 2, 23, "#526970");
      const rx = 174 + k * 27,
        ry = y + 22 - (rx - 161) * 0.5;
      poly(
        c,
        [rx, ry - 26, rx + 18, ry - 35, rx + 18, ry - 9, rx, ry],
        "#425766",
        "#5a655d",
      );
      poly(
        c,
        [rx + 3, ry - 24, rx + 15, ry - 30, rx + 15, ry - 11, rx + 3, ry - 5],
        theme === "Rust" ? "#f5bf6f" : "#b4cecf",
      );
    }
    if (theme === "Rust")
      for (let j = 0; j < 7; j++)
        rect(c, 66 + j * 12, y - 16 + j * 6, 8, 2, "#9a583b");
  }
  poly(
    c,
    [57, top - 17, 160, top - 67, 262, top - 17, 160, top + 35],
    "#e1d9bb",
    "#766f5a",
  );
  poly(
    c,
    [64, top - 17, 160, top - 61, 255, top - 17, 160, top + 28],
    theme === "Rust" ? "#786e60" : "#96a18a",
  );
  if (stage <= 2 || theme === "Java") {
    poly(
      c,
      [52, top - 18, 113, top - 78, 218, top - 28, 161, top + 33],
      "#cc7751",
      "#88583d",
    );
    poly(
      c,
      [113, top - 78, 220, top - 30, 268, top - 20, 218, top - 28],
      "#e09466",
    );
    for (let i = 0; i < 8; i++) {
      c.strokeStyle = "#a85e45";
      c.beginPath();
      c.moveTo(61 + i * 12, top - 23 - i * 6);
      c.lineTo(166 + i * 7, top + 23 - i * 7);
      c.stroke();
    }
    rect(c, 202, top - 71, 17, 33, "#cfbc9e");
    rect(c, 199, top - 75, 22, 7, "#8c8576");
  } else {
    for (let i = 0; i < 8; i++) {
      plant(
        c,
        76 + i * 22,
        top - 13 + (i < 4 ? -i * 10 : (i - 7) * 10),
        i * 29 + stage,
        14,
      );
    }
    if (theme === "Python" || stage === 5) {
      poly(
        c,
        [
          133,
          top - 25,
          133,
          top - 67,
          187,
          top - 93,
          230,
          top - 68,
          230,
          top - 26,
          185,
          top - 3,
        ],
        "#577e7899",
        "#436257",
      );
      poly(
        c,
        [133, top - 67, 185, top - 112, 230, top - 68, 187, top - 43],
        "#a4c7b6",
        "#436257",
      );
      for (let i = 0; i < 3; i++) {
        rect(c, 145 + i * 25, top - 64, 2, 39, "#527565");
      }
    } else if (theme === "Rust") {
      for (let i = 0; i < 2; i++) {
        rect(c, 120 + i * 50, top - 94 - i * 9, 16, 65, "#b66c4f");
        rect(c, 116 + i * 50, top - 99 - i * 9, 24, 8, "#61534b");
      }
    } else {
      poly(
        c,
        [
          145,
          top - 34,
          145,
          top - 65,
          199,
          top - 91,
          240,
          top - 72,
          240,
          top - 40,
          199,
          top - 20,
        ],
        "#aec1bc",
        "#5a6a65",
      );
      poly(
        c,
        [145, top - 65, 199, top - 91, 240, top - 72, 187, top - 47],
        "#e9ddbd",
        "#7f8573",
      );
      for (let i = 0; i < 3; i++)
        rect(c, 153 + i * 15, top - 61 + i * 7, 9, 20, "#efcb83");
    }
  }
  // Welcoming entrance, awnings, planters and terrace rails.
  poly(
    c,
    [135, base + 20, 154, base + 29, 154, base - 8, 135, base - 17],
    "#72563d",
    "#b9a378",
  );
  poly(
    c,
    [139, base + 18, 150, base + 23, 150, base - 6, 139, base - 11],
    "#d4ad6b",
  );
  rect(c, 147, base + 7, 2, 3, "#f9db85");
  poly(
    c,
    [67, base - 52, 127, base - 23, 119, base - 10, 59, base - 39],
    stage < 3 ? "#e6bd6c" : col,
    "#88785b",
  );
  for (let i = 0; i < 4; i++) {
    plant(c, 47 + i * 16, base - 8 + i * 8, 77 + i * 3);
    plant(c, 185 + i * 20, base + 23 - i * 10, 51 + i * 7);
  }
  if (stage >= 3) {
    const label =
      theme === "JavaScript"
        ? "JS"
        : theme === "TypeScript"
          ? "TS"
          : theme === "Python"
            ? "Py"
            : theme === "Rust"
              ? "R"
              : theme === "Go"
                ? "Go"
                : theme === "Java"
                  ? "J"
                  : "</>";
    poly(
      c,
      [78, top + 17, 119, top + 37, 119, top + 81, 78, top + 61],
      col,
      "#f4d99b",
    );
    c.save();
    c.transform(1, 0.48, 0, 1, 0, 0);
    c.font = "bold 23px monospace";
    c.fillStyle = "#253a42";
    c.fillText(label, 83, top - 9);
    c.restore();
    for (let f = 1; f < floors; f++)
      for (let i = 0; i < 3; i++)
        plant(c, 172 + i * 29, base - f * 39 + 28 - i * 15, f * 31 + i, 10);
  }
  if (stage >= 3) {
    // Architectural silhouettes stay recognizable without the small language sign.
    if (theme === "JavaScript") {
      rect(c, 102, top - 68, 3, 45, "#8c7851");
      poly(
        c,
        [68, top - 67, 102, top - 87, 138, top - 68, 103, top - 49],
        "#f3cf67",
        "#ae9852",
      );
      for (let i = 0; i < 6; i++) {
        const x = 66 + i * 17,
          y = top - 8 + i * 8;
        rect(c, x, y - 13, 2, 23, "#4b6354");
      }
      poly(
        c,
        [66, top - 22, 160, top + 24, 160, top + 27, 66, top - 19],
        "#4b6354",
      );
    } else if (theme === "Python") {
      for (let k = 0; k < 3; k++)
        for (let f = 0; f < floors * 3; f++) {
          const x = 63 + k * 31 + (hash(f, k) % 6),
            y = top + f * 13 + k * 12;
          rect(c, x, y, 4, 7, ["#577a48", "#7a9a55", "#3e6a49"][f % 3]);
          if (f % 3 === 0) rect(c, x + 3, y + 4, 5, 3, "#99b369");
        }
      poly(
        c,
        [236, base - 18, 248, base - 24, 248, top + 2, 236, top + 8],
        "#90c9cc",
      );
      for (let f = 0; f < 12; f++)
        rect(c, 239, top + 10 + f * 10, 2, 5, "#d5e9d7");
    } else if (theme === "Rust") {
      for (let side = 0; side < 2; side++) {
        const x = side ? 247 : 68;
        rect(c, x, top + 12, 4, h - 22, "#725e50");
        rect(c, x - 3, top + 20, 10, 3, "#baa27c");
        rect(c, x - 3, base - 24, 10, 3, "#baa27c");
      }
      for (let f = 0; f < floors; f++) {
        const y = base - f * 39;
        poly(
          c,
          [175, y - 10, 175, y - 31, 184, y - 41, 193, y - 40, 193, y - 19],
          "#f1bd78",
          "#725e4b",
        );
      }
    } else if (theme === "TypeScript") {
      poly(
        c,
        [
          169,
          top + 29,
          169,
          top - 18,
          212,
          top - 39,
          255,
          top - 18,
          255,
          top + 27,
          211,
          top + 49,
        ],
        "#8a8bc4",
        "#565d8a",
      );
      poly(
        c,
        [169, top - 18, 211, top - 40, 255, top - 18, 211, top + 4],
        "#aaa9cf",
        "#686e99",
      );
      poly(
        c,
        [180, top + 2, 205, top + 14, 205, top + 37, 180, top + 25],
        "#c8dce1",
        "#5c6b8e",
      );
      poly(
        c,
        [216, top + 15, 246, top, 246, top + 20, 216, top + 35],
        "#a6c6d5",
        "#5c6b8e",
      );
    } else if (theme === "Go") {
      for (let f = 1; f < floors; f++) {
        const y = base - f * 39;
        poly(
          c,
          [
            58,
            y - 22,
            160,
            y + 28,
            261,
            y - 22,
            261,
            y - 17,
            160,
            y + 34,
            58,
            y - 16,
          ],
          "#c6e2df",
          "#718e92",
        );
      }
      poly(
        c,
        [73, top - 18, 115, top - 39, 158, top - 18, 115, top + 3],
        "#d7e6de",
        "#91b3ae",
      );
      poly(
        c,
        [79, top - 18, 115, top - 34, 151, top - 18, 115, top - 2],
        "#7fb8c4",
      );
    } else if (theme === "Java") {
      for (let i = 0; i < 3; i++) {
        const x = 77 + i * 26,
          y = base - 22 + (x - 61) * 0.49;
        rect(c, x, y - 52, 7, 58, "#ecdfbd");
        rect(c, x - 2, y - 55, 12, 5, "#c3b28d");
        rect(c, x - 3, y + 4, 14, 5, "#c3b28d");
      }
      poly(
        c,
        [68, base - 74, 112, base - 92, 156, base - 31, 112, base - 52],
        "#e8d7b0",
        "#a99978",
      );
    }
    for (let f = 1; f < floors; f++)
      for (let i = 0; i < 4; i++)
        plant(c, 67 + i * 22, base - f * 39 - 12 + i * 11, f * 19 + i, 9);
  }
  for (let i = 0; i < 2; i++) {
    const x = i ? 266 : 40,
      y = 310;
    rect(c, x, y - 38, 3, 42, "#42514c");
    rect(c, x - 4, y - 47, 11, 14, "#5b604a");
    rect(c, x - 2, y - 44, 7, 9, "#ffdf8c");
    rect(c, x - 6, y - 49, 15, 3, "#716448");
  }
  return out;
}
const textures = new Map<string, Texture>();
export function buildingTexture(language: string, stage: number) {
  const key = spriteKey(language, stage);
  if (!textures.has(key)) {
    // One reusable spritesheet for two common houses and all thematic stages.
    const entries = [
      { language: "Outro", stage: 1 },
      { language: "Outro", stage: 2 },
      ...LANGUAGES.flatMap((language) =>
        [3, 4, 5].map((stage) => ({ language, stage })),
      ),
    ];
    const atlas = canvas(1600, Math.ceil(entries.length / 5) * 390),
      ctx = atlas.getContext("2d")!;
    entries.forEach((entry, index) =>
      ctx.drawImage(
        buildingCanvas(entry.language, entry.stage),
        (index % 5) * 320,
        Math.floor(index / 5) * 390,
      ),
    );
    const source = Texture.from(atlas).source;
    source.scaleMode = "nearest";
    entries.forEach((entry, index) =>
      textures.set(
        spriteKey(entry.language, entry.stage),
        new Texture({
          source,
          frame: new Rectangle(
            (index % 5) * 320,
            Math.floor(index / 5) * 390,
            320,
            390,
          ),
        }),
      ),
    );
  }
  return textures.get(key)!;
}
export function tileTexture(kind: string, variant: number) {
  variant = variant % 4;
  const key = `${kind}-${variant % 4}`;
  if (textures.has(key)) return textures.get(key)!;
  const out = canvas(98, 64),
    c = out.getContext("2d")!;
  const col =
    kind === "canal"
      ? ["#6ba7ae", "#66a1ac", "#72aeb2", "#609ba7"][variant % 4]
      : kind === "road" || kind === "bridge"
        ? ["#d9cfb6", "#d6c9af", "#dfd4bc", "#ccbea4"][variant % 4]
        : ["#8ba66c", "#92ac72", "#9bb77a", "#8fa96f"][variant % 4];
  poly(c, [1, 25, 49, 1, 97, 25, 49, 49], col);
  poly(
    c,
    [1, 25, 49, 49, 49, 55, 1, 31],
    kind === "canal" ? "#507c89" : "#929879",
  );
  poly(
    c,
    [49, 49, 97, 25, 97, 31, 49, 55],
    kind === "canal" ? "#4a7b89" : "#858c70",
  );
  if (kind === "bridge") {
    poly(c, [1, 25, 49, 49, 49, 40, 1, 16], "#b4ab94", "#777f70");
    poly(c, [49, 1, 97, 25, 97, 16, 49, -8], "#d3c7a8", "#898d74");
    for (let i = 0; i < 4; i++) {
      rect(c, 4 + i * 12, 20 + i * 6, 2, 15, "#586d60");
      rect(c, 52 + i * 12, -4 + i * 6, 2, 15, "#586d60");
    }
  } else if (kind === "road") {
    for (let i = 0; i < 3; i++) {
      poly(
        c,
        [
          1 + i * 16,
          25 - i * 8,
          49 + i * 16,
          49 - i * 8,
          50 + i * 16,
          48 - i * 8,
          2 + i * 16,
          24 - i * 8,
        ],
        "#b9ad96",
      );
      poly(
        c,
        [
          17 + i * 16,
          17 + i * 8,
          65 + i * 16,
          41 - i * 8,
          64 + i * 16,
          40 - i * 8,
          16 + i * 16,
          16 + i * 8,
        ],
        "#e9dfc8",
      );
    }
  } else if (kind === "canal") {
    for (let i = 0; i < 12; i++) {
      const r = hash(variant, i);
      rect(
        c,
        21 + (r % 55),
        15 + ((r >>> 8) % 17),
        3 + (r % 7),
        1,
        i % 3 ? "#9dc9c5" : "#dae2ca",
      );
    }
  } else
    for (let i = 0; i < 14; i++) {
      const r = hash(i, variant);
      rect(
        c,
        25 + (r % 47),
        17 + ((r >>> 8) % 16),
        2,
        2,
        i % 3 ? "#7e9a60" : "#aec184",
      );
    }
  const t = Texture.from(out);
  t.source.scaleMode = "nearest";
  textures.set(key, t);
  return t;
}
export function propTexture(type: string) {
  if (textures.has(type)) return textures.get(type)!;
  const out = canvas(96, 120),
    c = out.getContext("2d")!;
  if (type === "tree") {
    poly(c, [16, 104, 48, 88, 81, 104, 48, 119], "#4d745755");
    rect(c, 45, 60, 7, 48, "#7c664c");
    poly(
      c,
      [
        16, 58, 23, 36, 35, 28, 37, 17, 57, 13, 65, 28, 78, 36, 83, 60, 76, 76,
        56, 86, 32, 78, 22, 69,
      ],
      "#476a46",
    );
    for (let i = 0; i < 140; i++) {
      const r = hash(i, 90);
      const x = 20 + (r % 56),
        y = 17 + ((r >>> 7) % 64);
      if (Math.abs(x - 48) + Math.abs(y - 47) * 0.65 < 34)
        rect(
          c,
          x,
          y,
          6,
          6,
          ["#416747", "#527d4e", "#6e9656", "#8aaa66"][i % 4],
        );
    }
  } else if (type === "lamp") {
    rect(c, 46, 50, 4, 61, "#4a5b52");
    rect(c, 40, 108, 16, 5, "#677565");
    rect(c, 37, 30, 22, 28, "#586252");
    rect(c, 41, 34, 14, 18, "#f7d995");
    rect(c, 36, 26, 24, 6, "#6b6c51");
    rect(c, 46, 20, 5, 7, "#6b6c51");
  } else if (type === "bench") {
    poly(c, [21, 88, 48, 75, 79, 90, 51, 104], "#9f7850", "#705d46");
    for (let i = 0; i < 3; i++)
      rect(c, 24 + i * 21, 83 + i * 2, 4, 29, "#55654f");
    poly(c, [21, 68, 78, 91, 78, 77, 21, 54], "#b28c5e", "#715f4a");
  } else if (type === "fountain") {
    poly(c, [12, 95, 48, 76, 86, 95, 49, 115], "#d2ccaf", "#7e9389");
    poly(c, [20, 94, 49, 82, 78, 95, 49, 108], "#6caab3");
    rect(c, 43, 58, 13, 36, "#c9cbb7");
    poly(c, [30, 59, 48, 49, 68, 59, 49, 70], "#ded8bb", "#8d9e8b");
    rect(c, 47, 29, 4, 30, "#b2dbd0");
    rect(c, 42, 39, 3, 24, "#b2dbd0");
    rect(c, 54, 41, 3, 22, "#b2dbd0");
  } else {
    for (let i = 0; i < 6; i++) plant(c, 19 + i * 12, 93, i * 18, 17);
  }
  const t = Texture.from(out);
  t.source.scaleMode = "nearest";
  textures.set(type, t);
  return t;
}
