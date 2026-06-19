"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────

const W = 16;
const H = 20;
const TOTAL = W * H;
const POLL_MS = 900;

// Kreta-inspired palette
const PALETTE = [
  "#1a1008", // Umriss/Dunkel
  "#0B4E6E", // Tiefes Meer
  "#1A91C1", // Ägäis
  "#6ECDE8", // Helles Wasser
  "#B8E4F0", // Himmel hell
  "#F7F2E8", // Sand/Weiß
  "#E8C870", // Sand dunkel / Gold
  "#E8A94A", // Sonnenuntergang
  "#D4581A", // Terracotta
  "#8B2500", // Dunkelrot
  "#3A6B3A", // Olivengrün
  "#91BB6A", // Hellgrün / Kräuter
  "#7C6F52", // Stein / Fels
  "#C4B49A", // Heller Stein
  "#FFFFFF", // Weiß
  "#FF0000", // Radierer-Platzhalter (used as eraser flag, not drawn)
] as const;

// Eraser is index 15 (shown differently)
const ERASER_IDX = 15;
const EMPTY_COLOR = "#F8F9F5"; // canvas background when empty

// Template outlines (pixel positions as "x,y" → suggested color index)
// Each template gives a grid of hints shown as faint dots
const TEMPLATES: Record<string, { label: string; emoji: string; hint: string; outline: Record<string, number> }> = {
  frei: {
    label: "Frei malen",
    emoji: "🎨",
    hint: "Leere Leinwand — macht einfach was!",
    outline: {},
  },
  krikri: {
    label: "Kri-Kri Ziege",
    emoji: "🐐",
    hint: "Die wilde Bergziege Kretas",
    outline: (() => {
      // Simplified goat outline for 16×20
      const o: Record<string, number> = {};
      // Body
      [
        [5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
        [5,11],[11,11],[5,12],[11,12],[5,13],[11,13],
        [5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],
        // Neck
        [8,8],[9,8],[8,9],[9,9],
        // Head
        [7,6],[8,6],[9,6],[10,6],[7,7],[10,7],
        // Horns
        [7,4],[8,5],[10,5],[11,4],
        // Legs
        [6,15],[6,16],[6,17],[10,15],[10,16],[10,17],
        [7,15],[7,16],[7,17],[9,15],[9,16],[9,17],
        // Eye
        [8,7],
        // Tail
        [12,11],[13,10],
      ].forEach(([x, y]) => { o[`${x},${y}`] = 0; });
      return o;
    })(),
  },
  frangokastello: {
    label: "Frangokastello",
    emoji: "🏰",
    hint: "Das venezianische Kastell am Meer",
    outline: (() => {
      const o: Record<string, number> = {};
      // Sky
      for (let x = 0; x < 16; x++) for (let y = 0; y < 7; y++) o[`${x},${y}`] = 4;
      // Sea
      for (let x = 0; x < 16; x++) for (let y = 16; y < 20; y++) o[`${x},${y}`] = 3;
      // Sand
      for (let x = 0; x < 16; x++) for (let y = 14; y < 16; y++) o[`${x},${y}`] = 6;
      // Castle wall
      [
        [3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],
        [3,9],[12,9],[3,10],[12,10],[3,11],[12,11],[3,12],[12,12],[3,13],[12,13],
        // Battlements
        [3,7],[5,7],[7,7],[9,7],[11,7],
        // Gate
        [7,12],[8,12],[7,13],[8,13],
        // Towers
        [2,8],[2,9],[2,10],[13,8],[13,9],[13,10],
        [2,6],[3,6],[13,6],[12,6],
      ].forEach(([x, y]) => { o[`${x},${y}`] = 0; });
      return o;
    })(),
  },
  sonnenuntergang: {
    label: "Kreta Sunset",
    emoji: "🌅",
    hint: "Sonnenuntergang über dem Meer",
    outline: (() => {
      const o: Record<string, number> = {};
      // Deep sea
      for (let x = 0; x < 16; x++) for (let y = 14; y < 20; y++) o[`${x},${y}`] = 1;
      // Sea mid
      for (let x = 0; x < 16; x++) for (let y = 11; y < 14; y++) o[`${x},${y}`] = 2;
      // Horizon glow
      for (let x = 0; x < 16; x++) for (let y = 9; y < 11; y++) o[`${x},${y}`] = 7;
      // Sky pink-orange
      for (let x = 0; x < 16; x++) for (let y = 5; y < 9; y++) o[`${x},${y}`] = 8;
      // Sky upper
      for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) o[`${x},${y}`] = 4;
      // Sun
      [[7,9],[8,9],[9,9],[7,8],[8,8],[9,8],[8,7]].forEach(([x, y]) => { o[`${x},${y}`] = 6; });
      // Silhouette cliffs
      [[0,10],[1,10],[1,9],[2,9],[2,8],[3,8],[13,9],[14,9],[14,8],[15,8],[15,9]].forEach(([x, y]) => { o[`${x},${y}`] = 0; });
      return o;
    })(),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PixelState {
  cells: Record<string, string>;
  width: number;
  height: number;
  template: string;
}

interface PixelSession {
  id: string;
  state: PixelState;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function PixelArtView({ onBack }: { onBack: () => void }) {
  const [cells, setCells] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState<string>("frei");
  const [colorIdx, setColorIdx] = useState<number>(0);
  const [isPainting, setIsPainting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");
  const [showPalette, setShowPalette] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Record<string, string> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paintedRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);

  // ── Load initial state ──
  useEffect(() => {
    fetchPixel()
      .then((s) => {
        setCells(s.state.cells ?? {});
        setTemplate(s.state.template ?? "frei");
        setLastSync(s.updated_at);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Polling ──
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(async () => {
      if (isSyncingRef.current) return;
      try {
        const s = await fetchPixel();
        if (s.updated_at !== lastSync) {
          setCells(s.state.cells ?? {});
          setTemplate(s.state.template ?? "frei");
          setLastSync(s.updated_at);
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [loading, lastSync]);

  // ── Flush pending changes to server ──
  const flush = useCallback(async () => {
    if (!pendingRef.current) return;
    isSyncingRef.current = true;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    paintedRef.current.clear();
    try {
      const s = await patchPixel({ cells: snapshot, width: W, height: H, template });
      setLastSync(s.updated_at);
    } finally {
      isSyncingRef.current = false;
    }
  }, [template]);

  const scheduledFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => void flush(), 400);
  }, [flush]);

  // ── Paint logic ──
  const paintCell = useCallback((x: number, y: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const key = `${x},${y}`;
    if (paintedRef.current.has(key)) return; // already painted in this stroke
    paintedRef.current.add(key);

    setCells((prev) => {
      const isEraser = colorIdx === ERASER_IDX;
      const newCells = { ...prev };
      if (isEraser) {
        delete newCells[key];
      } else {
        newCells[key] = PALETTE[colorIdx] as string;
      }
      pendingRef.current = newCells;
      return newCells;
    });
    scheduledFlush();
  }, [colorIdx, scheduledFlush]);

  const pointToCell = (e: React.PointerEvent | PointerEvent): [number, number] | null => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor((e.clientX - rect.left) / (rect.width / W));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / H));
    return [x, y];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPainting(true);
    paintedRef.current.clear();
    const cell = pointToCell(e);
    if (cell) paintCell(cell[0], cell[1]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPainting) return;
    const cell = pointToCell(e);
    if (cell) paintCell(cell[0], cell[1]);
  };

  const handlePointerUp = () => {
    setIsPainting(false);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    void flush();
  };

  // ── Template apply ──
  const applyTemplate = async (key: string) => {
    const tmpl = TEMPLATES[key];
    if (!tmpl) return;
    const newCells: Record<string, string> = {};
    Object.entries(tmpl.outline).forEach(([pos, idx]) => {
      newCells[pos] = PALETTE[idx] as string;
    });
    setCells(newCells);
    setTemplate(key);
    setShowTemplates(false);
    const s = await patchPixel({ cells: newCells, width: W, height: H, template: key });
    setLastSync(s.updated_at);
  };

  // ── Clear canvas ──
  const clearCanvas = async () => {
    const empty: Record<string, string> = {};
    setCells(empty);
    const s = await patchPixel({ cells: empty, width: W, height: H, template: "frei" });
    setLastSync(s.updated_at);
    setTemplate("frei");
  };

  // ── Progress ──
  const painted = Object.keys(cells).length;
  const pct = Math.round((painted / TOTAL) * 100);

  // ── Celebrate ──
  useEffect(() => {
    if (pct >= 80 && !celebrating) setCelebrating(true);
  }, [pct, celebrating]);

  // ── Render grid cells ──
  const currentTemplate = TEMPLATES[template] ?? TEMPLATES.frei!;
  const isEraser = colorIdx === ERASER_IDX;
  const currentColor = isEraser ? null : (PALETTE[colorIdx] as string);

  if (loading) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Spiele</button>
        </div>
        <div className="ios-glass-card flex min-h-[300px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Leinwand wird geladen …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 overflow-x-clip">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b3435,#116b70_55%,#9de7dc)] p-5 text-white shadow-[0_20px_55px_rgba(14,48,46,0.22)]">
        <div aria-hidden="true" className="absolute -right-5 -top-6 text-[110px] opacity-15">🎨</div>
        <button className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur" onClick={onBack} type="button">← Spiele</button>
        <p className="relative z-10 mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">Kreta Pixel Art</p>
        <h2 className="relative z-10 mt-1 text-3xl font-black leading-none">Gemeinsam malen</h2>
        <p className="relative z-10 mt-2 text-sm font-semibold text-white/75">Beide sehen dieselbe Leinwand live. Kein Druck, kein Zug — einfach malen.</p>
        {/* Progress */}
        <div className="relative z-10 mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#ffe1a8] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-black tabular-nums text-white/80">{painted}/{TOTAL}</span>
        </div>
      </section>

      {/* Celebration banner */}
      {celebrating && pct >= 80 && (
        <div className="flex items-center gap-3 rounded-[18px] bg-[#fff1d8] px-4 py-3">
          <span className="text-xl">🎉</span>
          <p className="flex-1 text-sm font-black text-[#7a4b00]">Fast fertig! Noch {TOTAL - painted} Pixel…</p>
          <button className="rounded-full bg-[#e8a94a] px-3 py-1 text-xs font-black text-[#0e302e]" onClick={() => setCelebrating(false)} type="button">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Color picker toggle */}
        <button
          className="flex min-h-11 flex-1 items-center gap-2 rounded-[14px] bg-[#eff6f2] px-3 transition active:scale-[0.97]"
          onClick={() => { setShowPalette((v) => !v); setShowTemplates(false); }}
          type="button"
        >
          <div className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: isEraser ? "#F8F9F5" : currentColor ?? "#F8F9F5" }} />
          <span className="text-xs font-black text-[#0e302e]">{isEraser ? "Radierer" : "Farbe"}</span>
          <span className="ml-auto text-xs text-[#789087]">{showPalette ? "▲" : "▼"}</span>
        </button>

        {/* Template button */}
        <button
          className="flex min-h-11 items-center gap-1.5 rounded-[14px] bg-[#eff6f2] px-3 transition active:scale-[0.97]"
          onClick={() => { setShowTemplates((v) => !v); setShowPalette(false); }}
          type="button"
        >
          <span className="text-base">{currentTemplate.emoji}</span>
          <span className="text-xs font-black text-[#0e302e]">Vorlage</span>
        </button>

        {/* Clear */}
        <button
          className="min-h-11 rounded-[14px] bg-[#fee2e2] px-3 text-sm font-black text-[#8b1a1a] transition active:scale-[0.97]"
          onClick={() => void clearCanvas()}
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Palette drawer */}
      {showPalette && (
        <div className="rounded-[20px] bg-[#eff6f2] p-3">
          <div className="grid grid-cols-8 gap-2">
            {(PALETTE.slice(0, ERASER_IDX) as unknown as string[]).map((hex, i) => (
              <button
                key={hex}
                className="aspect-square w-full rounded-[8px] transition active:scale-[0.9]"
                style={{
                  backgroundColor: hex,
                  border: colorIdx === i ? "3px solid #125f68" : "2px solid rgba(0,0,0,0.08)",
                }}
                onClick={() => { setColorIdx(i); setShowPalette(false); }}
                type="button"
                aria-label={hex}
              />
            ))}
            {/* Eraser */}
            <button
              className="aspect-square w-full rounded-[8px] transition active:scale-[0.9]"
              style={{
                backgroundColor: "#F8F9F5",
                border: isEraser ? "3px solid #125f68" : "2px solid rgba(0,0,0,0.08)",
                backgroundImage: "repeating-linear-gradient(45deg,#ddd 0,#ddd 1px,transparent 0,transparent 50%)",
                backgroundSize: "6px 6px",
              }}
              onClick={() => { setColorIdx(ERASER_IDX); setShowPalette(false); }}
              type="button"
              aria-label="Radierer"
            />
          </div>
        </div>
      )}

      {/* Template drawer */}
      {showTemplates && (
        <div className="rounded-[20px] bg-[#eff6f2] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">Vorlage wählen</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                className={[
                  "flex flex-col items-center gap-1 rounded-[14px] p-3 text-center transition active:scale-[0.97]",
                  template === key ? "bg-[#125f68] text-white" : "bg-white/70 text-[#0e302e]",
                ].join(" ")}
                onClick={() => void applyTemplate(key)}
                type="button"
              >
                <span className="text-2xl">{tmpl.emoji}</span>
                <span className="text-xs font-black leading-tight">{tmpl.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="ios-glass-card rounded-[20px] p-3">
        <div
          ref={gridRef}
          className="touch-none select-none overflow-hidden rounded-[12px]"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${W}, 1fr)`,
            width: "100%",
            aspectRatio: `${W} / ${H}`,
            backgroundColor: "#D9E6E0",
            gap: "1px",
            cursor: isEraser ? "cell" : "crosshair",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {Array.from({ length: TOTAL }, (_, i) => {
            const x = i % W;
            const y = Math.floor(i / W);
            const key = `${x},${y}`;
            const painted = cells[key];
            const suggestion = currentTemplate.outline[key];
            const bg = painted ?? (suggestion !== undefined ? ((PALETTE[suggestion as number] ?? "#9de7dc") + "40") : EMPTY_COLOR);
            return (
              <div
                key={key}
                style={{ backgroundColor: bg }}
                data-key={key}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="rounded-[16px] bg-[#eff6f2] px-4 py-3">
        <p className="text-xs font-semibold leading-5 text-[#789087]">
          ✦ Beide sehen Pixel-Updates alle ~{POLL_MS / 1000}s live. Farbe wählen, antippen und wischen — los geht&apos;s!
        </p>
      </div>
    </div>
  );
}
