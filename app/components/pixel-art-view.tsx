"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────

const W = 16;
const H = 20;
const TOTAL = W * H; // 320 cells
const POLL_MS = 900;
const JAGD_DURATION = 60_000; // 60s
const JAGD_CELL_TIMEOUT = 4_000; // cell glows for 4s
const PLAYER_KEY = "pixel-player";

// Kreta palette (15 colors)
const PAL: string[] = [
  "#1a1008", // 0  dark/outline
  "#0b4e6e", // 1  deep sea
  "#1a91c1", // 2  sea blue
  "#6ecde8", // 3  light sea / sky
  "#b8e4f0", // 4  pale sky
  "#f7f2e8", // 5  sand / stone light
  "#e8c870", // 6  warm sand / gold
  "#e8a94a", // 7  sunset orange
  "#d4581a", // 8  terracotta
  "#7a2d0a", // 9  dark brown
  "#3a6b3a", // 10 dark green (olive)
  "#91bb6a", // 11 light green
  "#7c6f52", // 12 stone gray
  "#c4b49a", // 13 light stone
  "#ffffff", // 14 white
];
const EMPTY = "#f0f4f1"; // unpainted cell bg

// Player colors (how each player's active cell is highlighted)
const PLAYER_COLOR: Record<string, string> = { Jan: "#e8a94a", Luca: "#9de7dc" };

// ─── Pixel Art Images ─────────────────────────────────────────────────────────

// Each image = flat number[320], value = PAL index, -1 = empty/transparent bg

function buildFrangokastello(): number[] {
  const g = new Array<number>(TOTAL).fill(4); // pale sky
  // Clouds
  [3, 4, 5, 10, 11, 12].forEach((c) => { g[2 * W + c] = 14; g[3 * W + c] = 14; });
  [4, 5, 11].forEach((c) => { g[3 * W + c] = 5; }); // cloud highlights
  // Battlements row 6 (alternating dark/sky)
  for (let c = 1; c < 14; c += 2) g[6 * W + c] = 0;
  // Left + right towers rows 7-13
  for (let r = 7; r <= 13; r++) {
    [0, 15].forEach((c) => { g[r * W + c] = 0; });                      // tower outline
    [1, 14].forEach((c) => { g[r * W + c] = 12; });                     // tower body inner
    for (let c = 2; c <= 13; c++) g[r * W + c] = 12;                    // wall
  }
  // Windows
  [[9, 2], [10, 2], [9, 13], [10, 13]].forEach(([r, c]) => { g[r * W + c] = 5; });
  // Gate arch (top row dark, then open)
  [6, 7, 8, 9].forEach((c) => { g[9 * W + c] = 0; }); // arch top
  for (let r = 10; r <= 13; r++) [6, 7, 8, 9].forEach((c) => { g[r * W + c] = 9; }); // gate opening
  // Light stone lower half of castle
  for (let r = 11; r <= 13; r++) [2, 3, 4, 5, 10, 11, 12, 13].forEach((c) => { g[r * W + c] = 13; });
  // Sand
  for (let r = 14; r <= 15; r++) for (let c = 0; c < W; c++) g[r * W + c] = 6;
  [6, 7, 8, 9].forEach((c) => { g[14 * W + c] = 9; }); // gate shadow on sand
  // Sea
  for (let c = 0; c < W; c++) { g[16 * W + c] = 3; g[17 * W + c] = 2; g[18 * W + c] = 2; g[19 * W + c] = 1; }
  return g;
}

function buildSonnenuntergang(): number[] {
  const g = new Array<number>(TOTAL).fill(4);
  // Sky gradient
  for (let c = 0; c < W; c++) {
    g[2 * W + c] = 4; g[3 * W + c] = 7; g[4 * W + c] = 7; g[5 * W + c] = 8;
    g[6 * W + c] = 0; // silhouette horizon
    g[7 * W + c] = 3; g[8 * W + c] = 3;
    for (let r = 9; r <= 12; r++) g[r * W + c] = 2;
    for (let r = 13; r < H; r++) g[r * W + c] = 1;
  }
  // Sun disc rows 3-5, cols 6-9
  [3, 4, 5].forEach((r) => [6, 7, 8, 9].forEach((c) => { g[r * W + c] = 6; }));
  g[3 * W + 6] = 7; g[3 * W + 9] = 7; g[5 * W + 6] = 7; g[5 * W + 9] = 7; // sun edge
  // Sun reflection in sea
  for (let r = 7; r <= 12; r++) [7, 8].forEach((c) => { g[r * W + c] = r < 10 ? 6 : 7; });
  // Horizon silhouette cliffs
  [0, 1, 2, 13, 14, 15].forEach((c) => { g[6 * W + c] = 0; g[5 * W + c] = 12; });
  // Olive tree silhouettes on cliff
  [[4, 1], [4, 2], [3, 1], [4, 14], [4, 13], [3, 14]].forEach(([r, c]) => { g[r * W + c] = 0; });
  return g;
}

function buildKriKri(): number[] {
  const g = new Array<number>(TOTAL).fill(4); // sky
  // Rocky terrain background rows 10-19
  for (let r = 10; r < H; r++) for (let c = 0; c < W; c++) g[r * W + c] = r < 15 ? 12 : 13;
  // Green ground strip
  for (let c = 0; c < W; c++) { g[14 * W + c] = 11; g[15 * W + c] = 10; }
  // Soil bottom
  for (let r = 16; r < H; r++) for (let c = 0; c < W; c++) g[r * W + c] = 9;
  // Distant mountain / hill
  [3, 4, 5, 6, 7].forEach((c) => { g[8 * W + c] = 12; g[9 * W + c] = 12; });
  [2, 8].forEach((c) => { g[9 * W + c] = 12; });
  // Olive tree left
  for (let r = 5; r <= 9; r++) for (let c = 0; c <= 2; c++) g[r * W + c] = 10;
  [10, 11, 12, 13].forEach((r) => { g[r * W + 1] = 9; }); // trunk
  g[9 * W + 0] = 11; g[9 * W + 2] = 11; // lighter leaf tips
  // Olive tree right
  for (let r = 5; r <= 9; r++) for (let c = 13; c <= 15; c++) g[r * W + c] = 10;
  [10, 11, 12, 13].forEach((r) => { g[r * W + 14] = 9; });
  g[9 * W + 13] = 11; g[9 * W + 15] = 11;
  // Goat body (white): rows 9-13, cols 5-11
  for (let r = 9; r <= 13; r++) for (let c = 5; c <= 11; c++) g[r * W + c] = 14;
  // Goat belly lighter
  for (let c = 6; c <= 10; c++) { g[11 * W + c] = 5; g[12 * W + c] = 5; }
  // Goat head: rows 7-9, cols 10-13
  for (let r = 7; r <= 9; r++) for (let c = 10; c <= 13; c++) g[r * W + c] = 14;
  // Beard
  g[9 * W + 11] = 5; g[10 * W + 11] = 5;
  // Eye
  g[8 * W + 12] = 0;
  // Ear
  g[7 * W + 14] = 13;
  // Horns: curved, cols 9-14, rows 4-7
  [[4, 10], [5, 9], [6, 9], [4, 13], [5, 14], [6, 14]].forEach(([r, c]) => { g[r * W + c] = 9; });
  [[5, 10], [6, 10], [5, 13], [6, 13]].forEach(([r, c]) => { g[r * W + c] = 12; });
  // Legs (thin, dark)
  [5, 6, 9, 10].forEach((c) => { for (let r = 13; r <= 15; r++) g[r * W + c] = 0; });
  // Hooves
  [5, 6, 9, 10].forEach((c) => { g[15 * W + c] = 9; });
  // Tail
  g[9 * W + 4] = 5; g[8 * W + 4] = 13;
  return g;
}

function buildOktopus(): number[] {
  const g = new Array<number>(TOTAL).fill(1); // deep sea
  // Sea gradient top
  for (let c = 0; c < W; c++) { g[0 * W + c] = 3; g[1 * W + c] = 3; g[2 * W + c] = 2; g[3 * W + c] = 2; }
  // Sandy floor
  for (let r = 16; r < H; r++) for (let c = 0; c < W; c++) g[r * W + c] = 6;
  // Rocks
  [[14, 1], [14, 2], [14, 12], [14, 13], [15, 0], [15, 14], [15, 15], [16, 1], [16, 13]].forEach(([r, c]) => { g[r * W + c] = 12; });
  // Sea anemone/coral left
  [[12, 2], [11, 2], [11, 1], [10, 1], [12, 3], [11, 3]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Seaweed right
  [[12, 13], [11, 13], [10, 13], [10, 14], [11, 14], [9, 13]].forEach(([r, c]) => { g[r * W + c] = 10; });
  [[11, 12], [10, 12], [9, 12]].forEach(([r, c]) => { g[r * W + c] = 11; });
  // Octopus mantle (head): rows 3-8, cols 5-10
  for (let r = 3; r <= 8; r++) for (let c = 5; c <= 10; c++) {
    if ((r === 3 && (c === 5 || c === 10)) || (r === 8 && (c === 5 || c === 10))) continue; // round corners
    g[r * W + c] = 8;
  }
  // Mantle spots
  [[5, 6], [5, 9], [6, 7], [6, 8], [4, 7]].forEach(([r, c]) => { g[r * W + c] = 9; });
  // Eyes (white ring + black pupil)
  [[6, 6], [6, 9]].forEach(([r, c]) => { g[r * W + c] = 14; });
  [[6, 6], [6, 9]].forEach(([r, c]) => { g[r * W + c] = 0; }); // black pupil
  // Tentacles (8 arms, curling and spreading)
  // Arm 1: left curl
  [[9, 4], [10, 3], [11, 4], [12, 5]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 2: down-left
  [[9, 5], [10, 5], [11, 5], [12, 4], [13, 3]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 3: straight down left
  [[9, 6], [10, 6], [11, 7], [12, 7], [13, 6], [14, 5]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 4: down center-left
  [[9, 7], [10, 8], [11, 8], [12, 9], [13, 9], [14, 10]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 5: down center-right
  [[9, 8], [10, 7], [11, 6], [12, 6], [13, 7]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 6: down right
  [[9, 9], [10, 9], [11, 10], [12, 11], [13, 12]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 7: right curl
  [[9, 10], [10, 11], [11, 11], [12, 10], [13, 10]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Arm 8: far right
  [[9, 11], [10, 12], [11, 13], [12, 13], [13, 14]].forEach(([r, c]) => { g[r * W + c] = 8; });
  // Suction cups (lighter spots on tentacles)
  [[10, 4], [11, 6], [12, 8], [10, 11], [11, 9]].forEach(([r, c]) => { g[r * W + c] = 9; });
  return g;
}

interface ImageDef { name: string; emoji: string; hint: string; data: number[]; }

const IMAGES: Record<string, ImageDef> = {
  frangokastello: { name: "Frangokastello", emoji: "🏰", hint: "Das venezianische Kastell am Meer", data: buildFrangokastello() },
  sonnenuntergang: { name: "Kreta Sunset", emoji: "🌅", hint: "Sonnenuntergang über dem Ägäischen Meer", data: buildSonnenuntergang() },
  krikri: { name: "Kri-Kri Ziege", emoji: "🐐", hint: "Die wilde Bergziege Kretas", data: buildKriKri() },
  oktopus: { name: "Oktopus", emoji: "🐙", hint: "Unterwasserwelt vor Kretas Küste", data: buildOktopus() },
};

// Free-mode template outlines (separate from full images)
interface TemplateDef { label: string; emoji: string; outline: Record<string, number>; }
const TEMPLATES: Record<string, TemplateDef> = {
  frei: { label: "Frei", emoji: "✨", outline: {} },
  frangokastello: { label: "Burg", emoji: "🏰", outline: Object.fromEntries(buildFrangokastello().flatMap((v, i) => v !== 4 ? [[`${i % W},${Math.floor(i / W)}`, v] as [string, number]] : [])) },
  krikri: { label: "Kri-Kri", emoji: "🐐", outline: Object.fromEntries(buildKriKri().flatMap((v, i) => v !== 4 ? [[`${i % W},${Math.floor(i / W)}`, v] as [string, number]] : [])) },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type GameMode = "free" | "geheimbild" | "jagd" | "zahlen" | "spiegel";
type Player = "Jan" | "Luca";

interface PixelState {
  mode: GameMode;
  cells: Record<string, string>;
  imageKey: string;
  template: string;
  // Jagd mode
  jagdCell: string | null;
  jagdAt: number;
  jagdScores: Record<string, number>;
  jagdPhase: string; // "idle" | "playing" | "done"
  jagdTimerStart: number;
  jagdHost: string;
  width: number;
  height: number;
}

interface PixelSession {
  id: string;
  state: PixelState;
  updated_at: string;
}

const DEFAULT_STATE: PixelState = {
  mode: "free", cells: {}, imageKey: "frangokastello", template: "frei",
  jagdCell: null, jagdAt: 0, jagdScores: { Jan: 0, Luca: 0 }, jagdPhase: "idle",
  jagdTimerStart: 0, jagdHost: "", width: W, height: H,
};

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchPixel(): Promise<PixelSession> {
  const res = await fetch("/api/pixel", { cache: "no-store" });
  return res.json() as Promise<PixelSession>;
}
async function patchPixel(state: PixelState): Promise<PixelSession> {
  const res = await fetch("/api/pixel", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  return res.json() as Promise<PixelSession>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(x: number, y: number) { return `${x},${y}`; }
function randomEmptyCell(cells: Record<string, string>): string | null {
  const empty: string[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = cellKey(x, y);
    if (!cells[k]) empty.push(k);
  }
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)]!;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PixelArtView({ onBack }: { onBack: () => void }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<PixelState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");
  const [colorIdx, setColorIdx] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showImageSelect, setShowImageSelect] = useState(false);
  const [jagdNow, setJagdNow] = useState(Date.now());

  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PixelState | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paintedRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const jagdAdvKey = useRef<string>("");

  // Load player identity
  useEffect(() => {
    const saved = localStorage.getItem(PLAYER_KEY) as Player | null;
    if (saved === "Jan" || saved === "Luca") setPlayer(saved);
  }, []);

  const choosePlayer = (p: Player) => {
    localStorage.setItem(PLAYER_KEY, p);
    setPlayer(p);
  };

  // Load state
  useEffect(() => {
    fetchPixel()
      .then((s) => {
        setGameState({ ...DEFAULT_STATE, ...s.state });
        setLastSync(s.updated_at);
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll
  useEffect(() => {
    if (loading) return;
    const iv = setInterval(async () => {
      if (isSyncingRef.current || pendingRef.current) return;
      try {
        const s = await fetchPixel();
        if (s.updated_at !== lastSync) {
          setGameState({ ...DEFAULT_STATE, ...s.state });
          setLastSync(s.updated_at);
        }
      } catch { /* ignore */ }
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [loading, lastSync]);

  // Jagd: local clock tick + host logic
  useEffect(() => {
    if (gameState.jagdPhase !== "playing") return;
    const iv = setInterval(() => setJagdNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [gameState.jagdPhase]);

  const jagdElapsed = gameState.jagdTimerStart > 0 ? jagdNow - gameState.jagdTimerStart : 0;
  const jagdRemaining = Math.max(0, JAGD_DURATION - jagdElapsed);

  // Host drives Jagd timer + cell rotation
  useEffect(() => {
    if (gameState.jagdPhase !== "playing" || gameState.jagdHost !== player) return;
    const now = Date.now();
    // Timer done → end game
    if (jagdRemaining <= 0) {
      const advKey = `done_${gameState.jagdTimerStart}`;
      if (jagdAdvKey.current === advKey) return;
      jagdAdvKey.current = advKey;
      void patchPixel({ ...gameState, jagdPhase: "done" }).then((s) => {
        setGameState({ ...DEFAULT_STATE, ...s.state }); setLastSync(s.updated_at);
      });
      return;
    }
    // Cell timed out → pick new cell
    if (gameState.jagdAt > 0 && now - gameState.jagdAt > JAGD_CELL_TIMEOUT) {
      const advKey = `cell_${gameState.jagdAt}`;
      if (jagdAdvKey.current === advKey) return;
      jagdAdvKey.current = advKey;
      const next = randomEmptyCell(gameState.cells);
      void patchPixel({ ...gameState, jagdCell: next, jagdAt: Date.now() }).then((s) => {
        setGameState({ ...DEFAULT_STATE, ...s.state }); setLastSync(s.updated_at);
      });
    }
  }, [jagdNow, gameState, player, jagdRemaining]);

  // ── Patch helper ──
  const applyPatch = useCallback(async (newState: PixelState) => {
    isSyncingRef.current = true;
    try {
      const s = await patchPixel(newState);
      setGameState({ ...DEFAULT_STATE, ...s.state });
      setLastSync(s.updated_at);
    } finally { isSyncingRef.current = false; }
  }, []);

  const scheduledFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      if (!pendingRef.current) return;
      const snap = pendingRef.current;
      pendingRef.current = null;
      paintedRef.current.clear();
      void applyPatch(snap);
    }, 350);
  }, [applyPatch]);

  // ── Paint logic ──
  const doPaint = useCallback((x: number, y: number, state: PixelState): PixelState => {
    if (x < 0 || x >= W || y < 0 || y >= H) return state;
    const key = cellKey(x, y);
    if (paintedRef.current.has(key)) return state;
    paintedRef.current.add(key);

    const newCells = { ...state.cells };

    if (state.mode === "geheimbild" || state.mode === "zahlen") {
      // Reveal mode: fill with correct image color
      const img = IMAGES[state.imageKey];
      if (!img) return state;
      const palIdx = img.data[y * W + x] ?? -1;
      if (palIdx < 0 || palIdx >= PAL.length) return state;
      newCells[key] = PAL[palIdx]!;
      return { ...state, cells: newCells };
    }

    if (state.mode === "jagd") {
      // Only allow tapping the active glowing cell
      if (state.jagdCell !== key || !player) return state;
      newCells[key] = PLAYER_COLOR[player] ?? "#9de7dc";
      const newScores = { ...state.jagdScores, [player]: (state.jagdScores[player] ?? 0) + 1 };
      const nextCell = randomEmptyCell(newCells);
      return { ...state, cells: newCells, jagdScores: newScores, jagdCell: nextCell, jagdAt: Date.now() };
    }

    if (isErasing) {
      delete newCells[key];
      if (state.mode === "spiegel") delete newCells[cellKey(W - 1 - x, y)];
      return { ...state, cells: newCells };
    }

    const color = PAL[colorIdx] ?? PAL[0]!;
    newCells[key] = color;
    if (state.mode === "spiegel") newCells[cellKey(W - 1 - x, y)] = color;
    return { ...state, cells: newCells };
  }, [colorIdx, isErasing, player]);

  const paintCell = useCallback((x: number, y: number) => {
    setGameState((prev) => {
      const next = doPaint(x, y, prev);
      pendingRef.current = next;
      return next;
    });
    scheduledFlush();
  }, [doPaint, scheduledFlush]);

  const pointToCell = (e: React.PointerEvent): [number, number] | null => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return [
      Math.floor((e.clientX - rect.left) / (rect.width / W)),
      Math.floor((e.clientY - rect.top) / (rect.height / H)),
    ];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPainting(true);
    paintedRef.current.clear();
    const c = pointToCell(e);
    if (c) paintCell(c[0], c[1]);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPainting) return;
    const c = pointToCell(e);
    if (c) paintCell(c[0], c[1]);
  };
  const handlePointerUp = () => {
    setIsPainting(false);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    if (!pendingRef.current) return;
    const snap = pendingRef.current; pendingRef.current = null;
    paintedRef.current.clear();
    void applyPatch(snap);
  };

  // ── Mode actions ──
  const switchMode = async (mode: GameMode) => {
    setShowModeSelect(false);
    const ns: PixelState = {
      ...gameState, mode, cells: {},
      jagdCell: null, jagdAt: 0, jagdScores: { Jan: 0, Luca: 0 },
      jagdPhase: mode === "jagd" ? "idle" : "idle",
      jagdTimerStart: 0, jagdHost: player ?? "",
    };
    await applyPatch(ns);
  };

  const startJagd = async () => {
    await applyPatch({
      ...gameState, cells: {}, jagdPhase: "playing", jagdTimerStart: Date.now(),
      jagdScores: { Jan: 0, Luca: 0 }, jagdHost: player ?? "",
      jagdCell: randomEmptyCell({}), jagdAt: Date.now(),
    });
  };

  const clearCanvas = async () => {
    await applyPatch({ ...gameState, cells: {} });
  };

  const selectImage = async (key: string) => {
    setShowImageSelect(false);
    await applyPatch({ ...gameState, cells: {}, imageKey: key });
  };

  // ── Stats ──
  const paintedCount = Object.keys(gameState.cells).length;
  const pct = Math.round((paintedCount / TOTAL) * 100);
  const img = IMAGES[gameState.imageKey];

  // ─── Render ───────────────────────────────────────────────────────────────

  // Player pick screen
  if (!player) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <button className="min-h-10 self-start rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Spiele</button>
        <div className="ios-glass-card rounded-[28px] p-6 text-center">
          <p className="text-4xl">🎨</p>
          <p className="mt-3 text-xl font-black text-[#0e302e]">Wer malst du?</p>
          <p className="mt-1 text-sm font-semibold text-[#789087]">Wird auf diesem Gerät gespeichert.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["Jan", "Luca"] as Player[]).map((p) => (
              <button key={p} className="btn-sheen min-h-14 rounded-[18px] bg-[#125f68] text-xl font-black text-white transition active:scale-[0.97]" onClick={() => choosePlayer(p)} type="button">
                {p === "Jan" ? "🎸" : "🎹"} {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <button className="min-h-10 self-start rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Spiele</button>
        <div className="ios-glass-card flex min-h-[300px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Leinwand wird geladen …</p>
        </div>
      </div>
    );
  }

  const MODE_DEFS: { id: GameMode; emoji: string; title: string; desc: string; color: string }[] = [
    { id: "free",       emoji: "🎨", title: "Freies Malen",  desc: "Gemeinsam ein Bild aufbauen — keine Regeln, kein Ziel.",                    color: "#125f68" },
    { id: "spiegel",    emoji: "🪞", title: "Spiegelwand",   desc: "Was du malst, spiegelt sich automatisch. Hypnotisch schöne Symmetrie.",     color: "#4a1070" },
    { id: "geheimbild", emoji: "🕵️", title: "Geheimbild",    desc: "Ein verstecktes Kreta-Bild. Tippen zum Aufdecken. Gemeinsam enthüllen.",    color: "#0e302e" },
    { id: "zahlen",     emoji: "🔢", title: "Zahlen-Bild",   desc: "Malen nach Zahlen. Tippen — die App wählt die richtige Farbe automatisch.", color: "#7a2d0a" },
    { id: "jagd",       emoji: "⚡", title: "Pixel-Jagd",    desc: "60 Sekunden. Leuchtende Pixel auftappen — schneller als der andere!",       color: "#8b1a1a" },
  ];

  const currentModeDef = MODE_DEFS.find((m) => m.id === gameState.mode)!;

  // ── Compute cell render data ──
  const renderCells = () => {
    const cells = gameState.cells;
    const mode = gameState.mode;
    const imgData = img?.data;
    const activeJagdCell = gameState.jagdCell;

    return Array.from({ length: TOTAL }, (_, i) => {
      const x = i % W; const y = Math.floor(i / W);
      const key = cellKey(x, y);
      const painted = cells[key];

      if (mode === "jagd") {
        if (key === activeJagdCell) {
          // Glowing cell
          const alive = gameState.jagdAt > 0 && Date.now() - gameState.jagdAt < JAGD_CELL_TIMEOUT;
          return alive ? "#ffe1a8" : EMPTY; // yellow glow, or faded
        }
        return painted ?? EMPTY;
      }

      if (mode === "geheimbild") {
        if (painted) return painted;
        return "#d0ddd5"; // covered cell
      }

      if (mode === "zahlen") {
        if (painted) return painted;
        return "#eff6f2"; // light uncovered
      }

      // free / spiegel: show paint + template hint
      if (painted) return painted;
      if (mode === "free" && gameState.template !== "frei") {
        const tmpl = TEMPLATES[gameState.template];
        if (tmpl?.outline[key] !== undefined) {
          const hint = PAL[tmpl.outline[key]!];
          return hint ? hint + "35" : EMPTY;
        }
      }
      return EMPTY;
    });
  };

  const cellColors = renderCells();

  // ── Zahlen numbers overlay ──
  const getZahlenNumber = (key: string): string | null => {
    if (gameState.mode !== "zahlen" || gameState.cells[key]) return null;
    const [xs, ys] = key.split(",");
    const x = parseInt(xs!); const y = parseInt(ys!);
    if (!img) return null;
    const idx = img.data[y * W + x] ?? -1;
    return idx >= 0 && idx < PAL.length ? String(idx + 1) : null;
  };

  const showNumbers = gameState.mode === "zahlen";
  const showCover = gameState.mode === "geheimbild";

  return (
    <div className="grid gap-4 overflow-x-clip">

      {/* ── Header ── */}
      <section
        className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_55px_rgba(0,0,0,0.2)]"
        style={{ background: `linear-gradient(135deg, ${currentModeDef.color}, ${currentModeDef.color}cc 60%, #9de7dc44)` }}
      >
        <div aria-hidden="true" className="absolute -right-4 -top-4 text-[100px] opacity-15">{currentModeDef.emoji}</div>
        <div className="relative z-10 flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur" onClick={onBack} type="button">← Spiele</button>
          <button
            className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black backdrop-blur"
            onClick={() => setShowModeSelect((v) => !v)}
            type="button"
          >
            {currentModeDef.emoji} {currentModeDef.title} <span className="opacity-60">▾</span>
          </button>
          {/* Player badge */}
          <button
            className="ml-auto rounded-full bg-white/20 px-3 py-1.5 text-xs font-black"
            onClick={() => { localStorage.removeItem(PLAYER_KEY); setPlayer(null); }}
            type="button"
          >
            {player === "Jan" ? "🎸" : "🎹"} {player}
          </button>
        </div>
        <p className="relative z-10 mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/70">Kreta Pixel Art</p>
        <h2 className="relative z-10 mt-1 text-2xl font-black leading-none">{currentModeDef.title}</h2>
        <p className="relative z-10 mt-1.5 text-sm font-semibold text-white/75">{currentModeDef.desc}</p>

        {/* Progress / Jagd scores */}
        {gameState.mode !== "jagd" ? (
          <div className="relative z-10 mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#ffe1a8] transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black tabular-nums text-white/80">{paintedCount}/{TOTAL}</span>
          </div>
        ) : (
          gameState.jagdPhase === "playing" && (
            <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                {(["Jan", "Luca"] as Player[]).map((p) => (
                  <div key={p} className={["rounded-[10px] px-3 py-1.5 text-xs font-black", p === player ? "bg-white/30" : "bg-white/15"].join(" ")}>
                    {p === "Jan" ? "🎸" : "🎹"} {p}: {gameState.jagdScores[p] ?? 0}
                  </div>
                ))}
              </div>
              <div className="ml-auto rounded-[10px] bg-white/15 px-3 py-1.5 text-sm font-black tabular-nums">
                {Math.ceil(jagdRemaining / 1000)}s
              </div>
            </div>
          )
        )}
      </section>

      {/* ── Mode selector dropdown ── */}
      {showModeSelect && (
        <div className="grid gap-2 rounded-[20px] bg-[#0e302e] p-3">
          {MODE_DEFS.map((m) => (
            <button
              key={m.id}
              className={["flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition active:scale-[0.98]",
                gameState.mode === m.id ? "bg-[#9de7dc]/20 text-[#9de7dc]" : "bg-white/8 text-white"].join(" ")}
              onClick={() => void switchMode(m.id)}
              type="button"
            >
              <span className="text-xl">{m.emoji}</span>
              <div>
                <p className="text-sm font-black">{m.title}</p>
                <p className="text-xs text-white/60">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Jagd start/done screen ── */}
      {gameState.mode === "jagd" && gameState.jagdPhase !== "playing" && (
        <div className="ios-glass-card rounded-[24px] p-6 text-center">
          {gameState.jagdPhase === "done" ? (
            <>
              <p className="text-4xl">🏁</p>
              <p className="mt-3 text-xl font-black text-[#0e302e]">Zeit abgelaufen!</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["Jan", "Luca"] as Player[]).map((p) => {
                  const score = gameState.jagdScores[p] ?? 0;
                  const other = gameState.jagdScores[p === "Jan" ? "Luca" : "Jan"] ?? 0;
                  return (
                    <div key={p} className={["rounded-[16px] p-4 text-center", score > other ? "bg-[#e7f4ee]" : "bg-[#f5f5f5]"].join(" ")}>
                      <p className="text-2xl">{p === "Jan" ? "🎸" : "🎹"}</p>
                      <p className="mt-1 text-sm font-black text-[#0e302e]">{p}</p>
                      <p className="text-3xl font-black text-[#125f68]">{score}</p>
                      {score > other && <p className="text-xs font-black text-[#125f68]">🏆 Gewonnen!</p>}
                    </div>
                  );
                })}
              </div>
              <button className="btn-sheen mt-4 min-h-12 w-full rounded-[16px] bg-[#125f68] text-sm font-black text-white" onClick={() => void switchMode("jagd")} type="button">
                Nochmal 🔁
              </button>
            </>
          ) : (
            <>
              <p className="text-4xl">⚡</p>
              <p className="mt-3 text-xl font-black text-[#0e302e]">Pixel-Jagd</p>
              <p className="mt-2 text-sm font-semibold text-[#789087]">60 Sekunden. Ein Pixel leuchtet auf — wer zuerst tippt bekommt den Punkt und seine Farbe!</p>
              <button className="btn-sheen mt-5 min-h-14 w-full rounded-[18px] bg-[#125f68] text-lg font-black text-white shadow-[0_8px_25px_rgba(18,95,104,0.3)]" onClick={() => void startJagd()} type="button">
                Jagd starten ⚡
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Image selector (for geheimbild / zahlen) ── */}
      {(gameState.mode === "geheimbild" || gameState.mode === "zahlen") && (
        <div className="flex items-center gap-2">
          <button
            className="flex min-h-10 flex-1 items-center gap-2 rounded-[14px] bg-[#eff6f2] px-3 transition active:scale-[0.97]"
            onClick={() => setShowImageSelect((v) => !v)}
            type="button"
          >
            <span className="text-lg">{img?.emoji ?? "🖼️"}</span>
            <span className="text-xs font-black text-[#0e302e]">{img?.name ?? "Bild wählen"}</span>
            <span className="ml-auto text-xs text-[#789087]">{showImageSelect ? "▲" : "▼"}</span>
          </button>
          <button className="min-h-10 rounded-[14px] bg-[#fee2e2] px-3 text-sm font-black text-[#8b1a1a] transition active:scale-[0.97]" onClick={() => void clearCanvas()} type="button">✕</button>
        </div>
      )}
      {showImageSelect && (
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-[#eff6f2] p-3">
          {Object.entries(IMAGES).map(([key, def]) => (
            <button
              key={key}
              className={["flex flex-col items-center gap-1 rounded-[14px] p-3 transition active:scale-[0.97]",
                gameState.imageKey === key ? "bg-[#125f68] text-white" : "bg-white/80 text-[#0e302e]"].join(" ")}
              onClick={() => void selectImage(key)}
              type="button"
            >
              <span className="text-2xl">{def.emoji}</span>
              <span className="text-xs font-black">{def.name}</span>
              <span className="text-[10px] opacity-60">{def.hint}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Palette (free / spiegel) ── */}
      {(gameState.mode === "free" || gameState.mode === "spiegel") && (
        <div className="flex items-center gap-2">
          <button
            className="flex min-h-10 flex-1 items-center gap-2 rounded-[14px] bg-[#eff6f2] px-3 transition active:scale-[0.97]"
            onClick={() => setShowPalette((v) => !v)}
            type="button"
          >
            <div
              className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: isErasing ? EMPTY : (PAL[colorIdx] ?? "#000") }}
            />
            <span className="text-xs font-black text-[#0e302e]">{isErasing ? "Radierer" : "Farbe"}</span>
            <span className="ml-auto text-xs text-[#789087]">{showPalette ? "▲" : "▼"}</span>
          </button>
          {/* Eraser toggle */}
          <button
            className={["min-h-10 rounded-[14px] px-3 text-sm font-black transition active:scale-[0.97]", isErasing ? "bg-[#125f68] text-white" : "bg-[#eff6f2] text-[#0e302e]"].join(" ")}
            onClick={() => setIsErasing((v) => !v)}
            type="button"
          >
            ⌫
          </button>
          <button className="min-h-10 rounded-[14px] bg-[#fee2e2] px-3 text-sm font-black text-[#8b1a1a] transition active:scale-[0.97]" onClick={() => void clearCanvas()} type="button">✕</button>
        </div>
      )}
      {showPalette && (
        <div className="rounded-[20px] bg-[#eff6f2] p-3">
          <div className="grid grid-cols-8 gap-2">
            {PAL.map((hex, i) => (
              <button
                key={hex}
                className="aspect-square w-full rounded-[8px] transition active:scale-[0.88]"
                style={{ backgroundColor: hex, border: colorIdx === i && !isErasing ? "3px solid #125f68" : "2px solid rgba(0,0,0,0.1)" }}
                onClick={() => { setColorIdx(i); setIsErasing(false); setShowPalette(false); }}
                type="button"
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Canvas (hidden during jagd idle/done) ── */}
      {!(gameState.mode === "jagd" && gameState.jagdPhase !== "playing") && (
        <div className="ios-glass-card rounded-[20px] p-3">
          {/* Geheimbild header */}
          {gameState.mode === "geheimbild" && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{img?.emoji}</span>
              <p className="text-sm font-black text-[#0e302e]">{pct}% aufgedeckt</p>
              {pct === 100 && <span className="rounded-full bg-[#e7f4ee] px-2 py-0.5 text-xs font-black text-[#125f68]">🎉 Fertig!</span>}
            </div>
          )}

          <div
            ref={gridRef}
            className="touch-none select-none overflow-hidden rounded-[10px]"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${W}, 1fr)`,
              width: "100%",
              aspectRatio: `${W} / ${H}`,
              backgroundColor: "#c8d8d0",
              gap: "1px",
              cursor: isErasing ? "cell" : "crosshair",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {cellColors.map((bg, i) => {
              const x = i % W; const y = Math.floor(i / W);
              const key = cellKey(x, y);
              const isJagdActive = gameState.mode === "jagd" && gameState.jagdCell === key;
              const num = showNumbers ? getZahlenNumber(key) : null;
              const isCovered = showCover && !gameState.cells[key];

              return (
                <div
                  key={key}
                  className={isJagdActive ? "animate-pulse" : ""}
                  style={{
                    backgroundColor: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outline: isJagdActive ? "2px solid #fbbf24" : "none",
                  }}
                >
                  {num && (
                    <span style={{ fontSize: "5px", fontWeight: 900, color: "#7c6f52", lineHeight: 1 }}>
                      {num}
                    </span>
                  )}
                  {isCovered && (
                    <span style={{ fontSize: "5px", fontWeight: 900, color: "#a0b0a8", lineHeight: 1 }}>?</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Jagd active: big tap target hint ── */}
      {gameState.mode === "jagd" && gameState.jagdPhase === "playing" && gameState.jagdCell && (
        <div className="rounded-[16px] bg-[#fff1d8] px-4 py-3 text-center">
          <p className="text-sm font-black text-[#7a4b00]">⚡ Tipp den leuchtenden Pixel!</p>
          <p className="text-xs text-[#7a4b00]/70">
            {gameState.jagdHost === player ? "Du treibst den Timer." : "Warte auf das Aufleuchten …"}
          </p>
        </div>
      )}

      {/* ── Bottom hint ── */}
      <div className="rounded-[16px] bg-[#eff6f2] px-4 py-2.5">
        <p className="text-xs font-semibold leading-5 text-[#789087]">
          {gameState.mode === "free" && "✦ Gemeinsam malen — beide sehen live was der andere tippt (~1s)."}
          {gameState.mode === "spiegel" && "✦ Alles was du malst, spiegelt automatisch auf die andere Seite!"}
          {gameState.mode === "geheimbild" && `✦ Tippe auf beliebige Felder um das Bild aufzudecken. ${img?.hint ?? ""}`}
          {gameState.mode === "zahlen" && "✦ Die Zahlen zeigen die Farbe. Antippen — die App füllt automatisch aus."}
          {gameState.mode === "jagd" && `✦ Jan: ${gameState.jagdScores.Jan ?? 0} Pkt · Luca: ${gameState.jagdScores.Luca ?? 0} Pkt`}
        </p>
      </div>
    </div>
  );
}
