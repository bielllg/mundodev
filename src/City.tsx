import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Application, Container, Sprite, Graphics, Text } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { buildingTexture, tileTexture, propTexture } from "./art";
import {
  chunkTiles,
  hash,
  iso,
  uniso,
  mod,
  levelForXp,
  stageForLevel,
  type Resident,
  type Lot,
  NEIGHBORHOODS,
} from "./domain";
export interface CityHandle {
  go: (x: number, y: number) => void;
  zoom: (factor: number) => void;
}
export interface EvolutionScene {
  lot: Lot;
  previousStage: number;
  newStage: number;
  eventIds: string[];
}
interface Props {
  residents: Resident[];
  lots: Lot[];
  onSelect: (id: string) => void;
  onLot: (lot: Lot) => void;
  onRegion: (bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }) => void;
  onNeighborhood?: (name: string) => void;
  low: boolean;
  evolution?: EvolutionScene;
  onEvolutionDone?: (ids: string[]) => void;
}
export const City = forwardRef<CityHandle, Props>(function City(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  const engine = useRef<{
    app: Application;
    view: Viewport;
    refresh: () => void;
  } | null>(null);
  const [error, setError] = useState("");
  const [tip, setTip] = useState<{ name: string; detail: string } | null>(null);
  const cameraFrame = useRef(0);
  const pendingCamera = useRef<{ x: number; y: number } | null>(null);
  const evolutionStage = useRef<{ lotId: string; stage: number } | null>(null);
  const [ready, setReady] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      go(x, y) {
        setTip(null);
        const e = engine.current;
        if (!e) {
          pendingCamera.current = { x, y };
          return;
        }
        if (e) {
          const p = iso(x, y);
          cancelAnimationFrame(cameraFrame.current);
          const start = e.view.center.clone(),
            begin = performance.now();
          const reduced = matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          const move = (now: number) => {
            if (engine.current !== e) return;
            const t = reduced ? 1 : Math.min(1, (now - begin) / 340),
              ease = 1 - (1 - t) ** 3;
            e.view.moveCenter(
              start.x + (p.x - start.x) * ease,
              start.y + (p.y - 55 - start.y) * ease,
            );
            e.refresh();
            if (t < 1) cameraFrame.current = requestAnimationFrame(move);
          };
          cameraFrame.current = requestAnimationFrame(move);
        }
      },
      zoom(factor) {
        setTip(null);
        const e = engine.current;
        if (e) {
          e.view.setZoom(
            Math.max(0.35, Math.min(1.8, e.view.scale.x * factor)),
            true,
          );
          e.refresh();
        }
      },
    }),
    [],
  );
  useEffect(() => {
    let disposed = false;
    let destroy = () => {};
    async function setup() {
      const app = new Application();
      await app.init({
        resizeTo: host.current!,
        background: "#91b8b6",
        antialias: false,
        resolution: Math.min(devicePixelRatio, 2),
        autoDensity: true,
        autoStart: false,
        preference: "webgl",
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      host.current!.appendChild(app.canvas);
      app.canvas.setAttribute(
        "aria-label",
        "Cidade isométrica: arraste para navegar, use a roda ou os controles para ampliar",
      );
      const view = new Viewport({
        screenWidth: host.current!.clientWidth,
        screenHeight: host.current!.clientHeight,
        worldWidth: 100000,
        worldHeight: 100000,
        events: app.renderer.events,
        noTicker: true,
      });
      app.stage.addChild(view);
      view.drag().pinch().wheel().clampZoom({ minScale: 0.35, maxScale: 1.8 });
      view.setZoom(innerWidth < 700 ? 0.65 : 0.93);
      view.moveCenter(0, 510);
      const ground = new Container(),
        objects = new Container();
      objects.sortableChildren = true;
      view.addChild(ground, objects);
      const chunks = new Map<
        string,
        { ground: Container; props: Container[] }
      >();
      let live: Container[] = [];
      let lastRegion = "";
      let lastNeighborhood = "";
      let frame = 0;
      let dragging = false;
      let lastLow = current.current.low;
      const refresh = () => {
        if (disposed) return;
        // noTicker: update hitArea explicitly so negative world coordinates remain draggable.
        view.update(0);
        if (lastLow !== current.current.low) {
          for (const c of chunks.values()) {
            c.ground.destroy({ children: true });
            c.props.forEach((p) => p.destroy({ children: true }));
          }
          chunks.clear();
          lastLow = current.current.low;
        }
        const bounds = view.getVisibleBounds();
        const center = uniso(view.center.x, view.center.y),
          neighborhood =
            NEIGHBORHOODS[
              mod(Math.floor(center.x / 12), 2) +
                mod(Math.floor(center.y / 12), 2) * 2
            ].name;
        if (neighborhood !== lastNeighborhood) {
          lastNeighborhood = neighborhood;
          current.current.onNeighborhood?.(neighborhood);
        }
        const corners = [
          uniso(bounds.x, bounds.y - 350),
          uniso(bounds.right, bounds.y - 350),
          uniso(bounds.x, bounds.bottom + 200),
          uniso(bounds.right, bounds.bottom + 200),
        ];
        const minX = Math.floor(Math.min(...corners.map((p) => p.x)) / 12) - 1,
          maxX = Math.ceil(Math.max(...corners.map((p) => p.x)) / 12) + 1,
          minY = Math.floor(Math.min(...corners.map((p) => p.y)) / 12) - 1,
          maxY = Math.ceil(Math.max(...corners.map((p) => p.y)) / 12) + 1;
        const wanted = new Set<string>();
        for (let cx = minX; cx <= maxX; cx++)
          for (let cy = minY; cy <= maxY; cy++) {
            const key = `${cx},${cy}`;
            wanted.add(key);
            if (chunks.has(key)) continue;
            const g = new Container(),
              p = new Container();
            ground.addChild(g);
            for (const tile of chunkTiles(cx, cy)) {
              const pos = iso(tile.x, tile.y),
                s = new Sprite(tileTexture(tile.kind, tile.seed));
              s.position.set(pos.x - 49, pos.y - 25);
              g.addChild(s);
              if (
                tile.kind === "grass" &&
                mod(tile.x, 4) === 1 &&
                mod(tile.y, 4) === 1
              ) {
                const prop = new Sprite(
                  propTexture(tile.seed % 5 === 0 ? "bench" : "tree"),
                );
                prop.anchor.set(0.5, 1);
                prop.position.set(pos.x, pos.y + 18);
                prop.zIndex = pos.y;
                p.addChild(prop);
              }
              if (
                !current.current.low &&
                tile.kind === "grass" &&
                mod(tile.x, 4) === 3 &&
                mod(tile.y, 4) === 1
              ) {
                const flowers = new Sprite(propTexture("flowers"));
                flowers.anchor.set(0.5, 1);
                flowers.position.set(pos.x, pos.y + 22);
                flowers.scale.set(0.85);
                flowers.zIndex = pos.y + 20;
                p.addChild(flowers);
              }
              if (
                !current.current.low &&
                tile.kind === "grass" &&
                mod(tile.x, 4) === 1 &&
                mod(tile.y, 4) === 3
              ) {
                const tree = new Sprite(propTexture("tree"));
                tree.anchor.set(0.5, 1);
                tree.scale.set(0.85);
                tree.position.set(pos.x, pos.y + 16);
                tree.zIndex = pos.y + 16;
                p.addChild(tree);
              }
              if (tile.kind === "road" && mod(tile.x + tile.y, 4) === 0) {
                const lamp = new Sprite(propTexture("lamp"));
                lamp.anchor.set(0.5, 1);
                lamp.scale.set(0.55);
                lamp.position.set(pos.x + 24, pos.y + 9);
                lamp.zIndex = pos.y;
                p.addChild(lamp);
              }
              if (
                tile.kind === "grass" &&
                mod(tile.x, 12) === 5 &&
                mod(tile.y, 12) === 5
              ) {
                const fountain = new Sprite(propTexture("fountain"));
                fountain.anchor.set(0.5, 1);
                fountain.position.set(pos.x, pos.y + 20);
                fountain.zIndex = pos.y;
                p.addChild(fountain);
              }
            }
            const props = [...p.children] as Container[];
            for (const prop of props) {
              p.removeChild(prop);
              objects.addChild(prop);
            }
            p.destroy();
            chunks.set(key, { ground: g, props });
          }
        for (const [key, c] of chunks)
          if (!wanted.has(key)) {
            c.ground.destroy({ children: true });
            c.props.forEach((p) => p.destroy({ children: true }));
            chunks.delete(key);
          }
        for (const c of live) c.destroy({ children: true });
        live = [];
        const occupied = new Set(
          current.current.residents.map((r) => r.lot.id),
        );
        const add = (lot: Lot, resident?: Resident) => {
          const pos = iso(lot.tile_x, lot.tile_y);
          if (
            pos.x < bounds.x - 220 ||
            pos.x > bounds.right + 220 ||
            pos.y < bounds.y - 100 ||
            pos.y > bounds.bottom + 400
          )
            return;
          const wrap = new Container();
          wrap.position.set(pos.x, pos.y);
          wrap.zIndex = pos.y + 80;
          wrap.eventMode = "static";
          wrap.cursor = "pointer";
          if (resident) {
            const s = new Sprite(
              buildingTexture(
                resident.primary_language,
                evolutionStage.current?.lotId === lot.id
                  ? evolutionStage.current.stage
                  : stageForLevel(levelForXp(resident.current_xp)),
              ),
            );
            s.anchor.set(0.5, 1);
            s.position.set(0, 95);
            s.scale.set(0.9);
            wrap.addChild(s);
            wrap.on("pointerover", () =>
              setTip({
                name: resident.github_username,
                detail: `${resident.primary_language} · Nível ${levelForXp(resident.current_xp)}`,
              }),
            );
            wrap.on("pointerout", () => setTip(null));
          } else {
            const marker = new Graphics()
              .poly([-78, 0, 0, -39, 78, 0, 0, 39])
              .fill({ color: 0xc3d89c, alpha: 0.6 })
              .stroke({ color: 0xf6e8b8, width: 2 });
            wrap.addChild(marker);
            const label = new Text({
              text: "+",
              style: {
                fontFamily: "Pixelify Sans",
                fontSize: 32,
                fill: "#fdf2cc",
              },
            });
            label.anchor.set(0.5);
            label.y = -9;
            wrap.addChild(label);
            wrap.on("pointerover", () =>
              setTip({
                name: "Um lugar para começar",
                detail: `Terreno livre · ${lot.tile_x}, ${lot.tile_y}`,
              }),
            );
            wrap.on("pointerout", () => setTip(null));
          }
          wrap.on("pointertap", () => {
            if (dragging) return;
            if (resident) current.current.onSelect(resident.id);
            else current.current.onLot(lot);
          });
          objects.addChild(wrap);
          live.push(wrap);
        };
        for (const r of current.current.residents) add(r.lot, r);
        for (const lot of current.current.lots)
          if (!occupied.has(lot.id)) add(lot);
        // Every prop uses global isometric depth, independently of its source chunk.
        for (const c of chunks.values())
          for (const prop of c.props) {
            prop.visible =
              prop.x > bounds.x - 120 &&
              prop.x < bounds.right + 120 &&
              prop.y > bounds.y - 60 &&
              prop.y < bounds.bottom + 160;
          }

        const region = `${minX}:${maxX}:${minY}:${maxY}`;
        if (region !== lastRegion) {
          lastRegion = region;
          current.current.onRegion({ minX, maxX, minY, maxY });
        }
        app.render();
      };
      const down = () => {
        dragging = false;
        cancelAnimationFrame(cameraFrame.current);
      };
      const moved = () => {
        dragging = true;
        setTip(null);
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            refresh();
          });
      };
      app.canvas.addEventListener("pointerdown", down);
      app.canvas.addEventListener('pointerleave',()=>setTip(null));
      view.on("moved", moved);
      view.on("zoomed", moved);
      const observer = new ResizeObserver(() => {
        view.resize(host.current!.clientWidth, host.current!.clientHeight);
        refresh();
      });
      observer.observe(host.current!);
      engine.current = { app, view, refresh };
      if (pendingCamera.current) {
        const point = iso(pendingCamera.current.x, pendingCamera.current.y);
        view.moveCenter(point.x, point.y - 55);
        pendingCamera.current = null;
      }
      setReady(true);
      refresh();
      destroy = () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(cameraFrame.current);
        observer.disconnect();
        engine.current = null;
        app.destroy(true, { children: true });
      };
    }
    setup().catch(() =>
      setError(
        "A cidade não pôde iniciar. Verifique se a aceleração gráfica está ativada e recarregue.",
      ),
    );
    return () => {
      disposed = true;
      destroy();
    };
  }, []);
  useEffect(() => {
    engine.current?.refresh();
  }, [props.residents, props.lots, props.low]);
  useEffect(() => {
    if (!props.evolution || !engine.current || !ready) return;
    const scene = props.evolution;
    const { app, view } = engine.current,
      p = iso(scene.lot.tile_x, scene.lot.tile_y);
    view.moveCenter(p.x, p.y - 80);
    const g = new Graphics();
    g.position.set(p.x, p.y);
    view.addChild(g);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const t = (now - start) / 2000;
      g.clear();
      const stage = t < 0.45 ? scene.previousStage : scene.newStage;
      if (evolutionStage.current?.stage !== stage) {
        evolutionStage.current = { lotId: scene.lot.id, stage };
        engine.current?.refresh();
      }
      if (t >= 1 || reduced) {
        g.destroy();
        evolutionStage.current = null;
        engine.current?.refresh();
        current.current.onEvolutionDone?.(scene.eventIds);
        return;
      }
      for (let x = -110; x <= 110; x += 55) {
        g.rect(x, -220, 3, 300).fill(0x9c7c50);
        for (let y = -200; y <= 60; y += 50) g.rect(x, y, 55, 3).fill(0xc7a773);
      }
      for (let i = 0; i < 25; i++) {
        const h = hash(i, 7),
          x = (h % 240) - 120,
          y = 60 - (((h % 80) + t * 110) % 230);
        g.rect(x, y, 5, 5).fill({ color: 0xf7dc9c, alpha: 1 - t });
      }
      app.render();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      evolutionStage.current = null;
      if (!g.destroyed) g.destroy();
    };
  }, [props.evolution, ready]);
  return (
    <div ref={host} className="city-canvas">
      {error && (
        <div className="canvas-error">
          {error}
          <button onClick={() => location.reload()}>Tentar novamente</button>
        </div>
      )}
      {tip && (
        <div className="map-tooltip">
          <strong>{tip.name}</strong>
          <span>{tip.detail}</span>
        </div>
      )}
    </div>
  );
});
