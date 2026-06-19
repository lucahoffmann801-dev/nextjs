"use client";

import { useEffect, useRef, useState } from "react";

// ─── Config ────────────────────────────────────────────────────────────────────

const GRID = 10;
const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

interface ShipDef {
  id: string;
  name: string;
  emoji: string;
  size: number;
}

const SHIPS: ShipDef[] = [
  { id: "kreuzfahrer", name: "Kreuzfahrtschiff", emoji: "🛳️", size: 5 },
  { id: "fregatte",    name: "Fregatte",          emoji: "⚓",  size: 4 },
  { id: "schnellboot", name: "Schnellboot",        emoji: "🚤", size: 3 },
  { id: "segler",      name: "Segler",             emoji: "⛵",  size: 3 },
  { id: "fischerboot", name: "Fischerboot",        emoji: "🎣", size: 2 },
];

const TOTAL_CELLS = SHIPS.reduce((s, sh) => s + sh.size, 0); // 17

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ck(x: number, y: number): string { return `${x},${y}`; }

function getShipCells(x: number, y: number, size: number, dir: "H" | "V"): string[] | null {
  const cells: string[] = [];
  for (let i = 0; i < size; i++) {
    const cx = dir === "H" ? x + i : x;
    const cy = dir === "V" ? y + i : y;
    if (cx >= GRID || cy >= GRID) return null;
    cells.push(ck(cx, cy));
  }
  return cells;
}

function flatCells(ships: string[][]): Set<string> {
  return new Set(ships.flat());
}

function allSunk(ships: string[][], shots: Record<string, "hit" | "miss">): boolean {
  if (ships.length < SHIPS.length) return false;
  return ships.flat().every((c) => shots[c] === "hit");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = "Jan" | "Luca";
type MpRole = "idle" | "creating" | "waiting" | "waiting_ready" | "joining" | "active";

interface BattleState {
  phase: "placing" | "battle" | "done";
  janShips: string[][];
  lucaShips: string[][];
  janReady: boolean;
  lucaReady: boolean;
  janShots: Record<string, "hit" | "miss">;
  lucaShots: Record<string, "hit" | "miss">;
  turn: string;
  winner: string | null;
}

const INIT_STATE: BattleState = {
  phase: "placing",
  janShips: [], lucaShips: [],
  janReady: false, lucaReady: false,
  janShots: {}, lucaShots: {},
  turn: "Jan", winner: null,
};

interface GameSession {
  id: string;
  game: string;
  host: string;
  guest: string | null;
  status: string;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Multiplayer helpers ──────────────────────────────────────────────────────

function usePollSession(active: boolean, code: string) {
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    if (!active || !code) return;
    let cancelled = false;

    async function poll() {
      try {
        const r = await fetch(`/api/game/session/${code}`);
        if (r.ok && !cancelled) {
          const data = await r.json() as GameSession;
          setSession(data);
        }
      } catch { /* ignore */ }
    }

    void poll();
    const id = setInterval(() => void poll(), 1200);
    return () => { cancelled = true; clearInterval(id); };
  }, [active, code]);

  return session;
}

async function patchSession(code: string, body: Record<string, unknown>): Promise<GameSession> {
  const r = await fetch(`/api/game/session/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<GameSession>;
}

// ─── Small defense grid ────────────────────────────────────────────────────────
// Used for "own board" — shows my ships + opponent's incoming shots

function DefenseGrid({ ships, shots }: { ships: string[][], shots: Record<string, "hit" | "miss"> }) {
  const shipSet = flatCells(ships);
  const CELL = 24;

  return (
    <div style={{ display: "inline-block", userSelect: "none" }}>
      {/* Column labels */}
      <div style={{ display: "grid", gridTemplateColumns: `14px repeat(${GRID}, ${CELL}px)`, gap: "2px", marginBottom: 2 }}>
        <div />
        {COL_LABELS.map((l) => (
          <div key={l} style={{ textAlign: "center", fontSize: 8, fontWeight: 800, color: "#789087" }}>{l}</div>
        ))}
      </div>
      {Array.from({ length: GRID }, (_, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: `14px repeat(${GRID}, ${CELL}px)`, gap: "2px", marginBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#789087" }}>
            {row + 1}
          </div>
          {Array.from({ length: GRID }, (_, col) => {
            const key = ck(col, row);
            const hasShip = shipSet.has(key);
            const shot = shots[key];
            let bg = "#e7f4ee";
            if (hasShip) bg = "#125f68";
            if (shot === "miss") bg = "#b8d4cc";
            if (shot === "hit") bg = "#e8401a";
            return (
              <div
                key={key}
                style={{
                  width: CELL, height: CELL, backgroundColor: bg,
                  border: "1px solid #c8d8d0", borderRadius: 3,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9,
                }}
              >
                {shot === "hit" && "💥"}
                {shot === "miss" && "·"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SeeschlachtView({ onBack }: { onBack: () => void }) {
  // ── MP setup state ──
  const [mpRole, setMpRole] = useState<MpRole>("idle");
  const [role, setRole] = useState<"host" | "guest">("host");
  const [player, setPlayer] = useState<Player>("Jan");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinErr, setJoinErr] = useState("");

  // ── Placement state (local only) ──
  const [localShips, setLocalShips] = useState<(string[] | null)[]>(Array(SHIPS.length).fill(null));
  const [selShipIdx, setSelShipIdx] = useState<number | null>(0);
  const [dir, setDir] = useState<"H" | "V">("H");
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [errorCells, setErrorCells] = useState<string[]>([]);

  // ── Session polling ──
  const gameSession = usePollSession(mpRole === "active", code);
  const waitSession = usePollSession(mpRole === "waiting", code);

  // Host-side dedup
  const advRef = useRef<string>("");

  // Parse battle state
  const bs: BattleState = { ...INIT_STATE, ...(gameSession?.state as Partial<BattleState> ?? {}) };

  const myShips  = player === "Jan" ? bs.janShips  : bs.lucaShips;
  const oppShips = player === "Jan" ? bs.lucaShips : bs.janShips;
  const myShots  = player === "Jan" ? bs.janShots  : bs.lucaShots;
  const oppShots = player === "Jan" ? bs.lucaShots : bs.janShots;
  const myReady  = player === "Jan" ? bs.janReady  : bs.lucaReady;

  // ── Host effects ──

  // Detect guest joining (host waiting state)
  useEffect(() => {
    if (mpRole === "waiting" && waitSession?.guest) {
      setMpRole("waiting_ready");
    }
  }, [mpRole, waitSession]);

  // placing → battle transition
  useEffect(() => {
    if (!gameSession || role !== "host" || bs.phase !== "placing") return;
    if (!bs.janReady || !bs.lucaReady) return;
    const key = `battle_${gameSession.updated_at}`;
    if (advRef.current === key) return;
    advRef.current = key;
    void patchSession(code, { state: { ...bs, phase: "battle", turn: "Jan" } });
  }, [gameSession, role, code, bs]);

  // win detection
  useEffect(() => {
    if (!gameSession || role !== "host" || bs.phase !== "battle") return;
    const janWon  = allSunk(bs.lucaShips, bs.janShots);
    const lucaWon = allSunk(bs.janShips, bs.lucaShots);
    if (!janWon && !lucaWon) return;
    const winner = janWon ? "Jan" : "Luca";
    const key = `done_${winner}_${gameSession.updated_at}`;
    if (advRef.current === key) return;
    advRef.current = key;
    void patchSession(code, { state: { ...bs, phase: "done", winner } });
  }, [gameSession, role, code, bs]);

  // ── Setup handlers ──

  async function handleCreate() {
    setMpRole("creating");
    try {
      const r = await fetch("/api/game/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "seeschlacht", host: player }),
      });
      const s = await r.json() as GameSession;
      await patchSession(s.id, { state: INIT_STATE });
      setCode(s.id);
      setRole("host");
      setMpRole("waiting");
    } catch { setMpRole("idle"); }
  }

  async function handleJoin() {
    setJoinErr("");
    setMpRole("joining");
    const upper = joinInput.trim().toUpperCase();
    if (upper.length !== 6) { setMpRole("idle"); setJoinErr("Bitte 6-stelligen Code eingeben."); return; }
    try {
      const res = await fetch(`/api/game/session/${upper}`);
      if (!res.ok) { setMpRole("idle"); setJoinErr("Session nicht gefunden."); return; }
      const s = await res.json() as GameSession;
      if (s.guest) { setMpRole("idle"); setJoinErr("Session ist bereits voll."); return; }
      const guestPlayer: Player = s.host === "Jan" ? "Luca" : "Jan";
      await patchSession(upper, { guest: guestPlayer });
      setCode(upper);
      setPlayer(guestPlayer);
      setRole("guest");
      setMpRole("active");
    } catch { setMpRole("idle"); setJoinErr("Verbindungsfehler."); }
  }

  function handleStartHost() {
    void patchSession(code, { status: "playing", state: INIT_STATE });
    setMpRole("active");
  }

  // ── Placement ──

  const placedSet = new Set(localShips.filter(Boolean).flat() as string[]);

  function previewFor(cellKey: string): { cells: string[]; valid: boolean } {
    if (selShipIdx === null) return { cells: [], valid: true };
    const ship = SHIPS[selShipIdx];
    if (!ship) return { cells: [], valid: true };
    const [x, y] = cellKey.split(",").map(Number) as [number, number];
    const cells = getShipCells(x, y, ship.size, dir);
    if (!cells) return { cells: [], valid: false };
    const valid = cells.every((c) => !placedSet.has(c));
    return { cells, valid };
  }

  function handleCellTap(x: number, y: number) {
    if (selShipIdx === null || myReady) return;
    const ship = SHIPS[selShipIdx];
    if (!ship) return;
    const cells = getShipCells(x, y, ship.size, dir);
    if (!cells || !cells.every((c) => !placedSet.has(c))) {
      // flash error
      const errCells = cells ?? [];
      setErrorCells(errCells);
      setTimeout(() => setErrorCells([]), 500);
      return;
    }
    const newShips = [...localShips];
    newShips[selShipIdx] = cells;
    setLocalShips(newShips);
    setHoverCell(null);
    // auto-advance to next unplaced ship
    const nextIdx = newShips.findIndex((s, i) => i !== selShipIdx && !s);
    setSelShipIdx(nextIdx >= 0 ? nextIdx : null);
  }

  async function handleReady() {
    const placed = localShips.filter(Boolean) as string[][];
    if (placed.length < SHIPS.length) return;
    const shipKey  = player === "Jan" ? "janShips"  : "lucaShips";
    const readyKey = player === "Jan" ? "janReady"  : "lucaReady";
    await patchSession(code, { state: { ...bs, [shipKey]: placed, [readyKey]: true } });
  }

  // ── Battle ──

  const isMyTurn = bs.phase === "battle" && bs.turn === player;
  const myHits    = Object.values(myShots).filter((v) => v === "hit").length;
  const oppHitsOnMe = Object.values(oppShots).filter((v) => v === "hit").length;

  async function handleShoot(x: number, y: number) {
    if (!isMyTurn) return;
    const key = ck(x, y);
    if (myShots[key]) return;
    const oppFlat = flatCells(oppShips);
    const isHit = oppFlat.has(key);
    const newShots = { ...myShots, [key]: isHit ? ("hit" as const) : ("miss" as const) };
    const shotKey  = player === "Jan" ? "janShots" : "lucaShots";
    const nextTurn = isHit ? player : (player === "Jan" ? "Luca" : "Jan");
    await patchSession(code, { state: { ...bs, [shotKey]: newShots, turn: nextTurn } });
  }

  // ─── RENDER: SETUP ────────────────────────────────────────────────────────────

  if (mpRole !== "active") {
    return (
      <div className="grid gap-5 overflow-x-clip">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b1e35,#1a4a6b_55%,#125f68)] p-5 text-white shadow-[0_20px_55px_rgba(11,30,53,0.3)]">
          <div aria-hidden="true" className="absolute -right-4 -top-4 text-[90px] opacity-15">⚓</div>
          <button
            className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur transition hover:bg-white/20"
            onClick={onBack}
            type="button"
          >
            ← Spiele
          </button>
          <p className="relative z-10 mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">Kreta Seeschlacht</p>
          <h2 className="relative z-10 mt-1 text-3xl font-black leading-none">Schiffe versenken</h2>
          <p className="relative z-10 mt-2 text-sm font-semibold text-white/75">
            Platziere deine Flotte. Versenke die des Gegners. Kretische Seemannsehre.
          </p>
        </section>

        {/* Idle: player pick + create/join */}
        {mpRole === "idle" && (
          <>
            <div className="ios-glass-card rounded-[24px] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#789087]">Wer bist du?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["Jan", "Luca"] as Player[]).map((p) => (
                  <button
                    key={p}
                    className={[
                      "min-h-12 rounded-[14px] text-base font-black transition active:scale-[0.97]",
                      player === p ? "bg-[#125f68] text-white" : "bg-[#eff6f2] text-[#0e302e]",
                    ].join(" ")}
                    onClick={() => setPlayer(p)}
                    type="button"
                  >
                    {p === "Jan" ? "🎸" : "🎹"} {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-sheen min-h-14 rounded-[20px] bg-[#125f68] text-base font-black text-white shadow-[0_8px_25px_rgba(18,95,104,0.3)] transition active:scale-[0.97]"
              onClick={() => void handleCreate()}
              type="button"
            >
              🚢 Neue Session erstellen
            </button>

            <div className="flex gap-2">
              <input
                className="min-h-12 flex-1 rounded-[14px] border border-[#cfe0d7] bg-white px-4 font-mono text-lg font-black uppercase tracking-[0.22em] text-[#0e302e] outline-none focus:border-[#125f68]"
                maxLength={6}
                placeholder="CODE"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                type="text"
              />
              <button
                className="btn-sheen min-h-12 rounded-[14px] bg-[#f0a23a] px-5 font-black text-[#0e302e] transition active:scale-[0.97]"
                onClick={() => void handleJoin()}
                type="button"
              >
                Beitreten
              </button>
            </div>
            {joinErr && <p className="text-sm font-semibold text-red-500">{joinErr}</p>}
          </>
        )}

        {/* Creating spinner */}
        {mpRole === "creating" && (
          <p className="text-center font-bold text-[#789087]">Session wird erstellt …</p>
        )}

        {/* Waiting for guest */}
        {(mpRole === "waiting" || mpRole === "waiting_ready") && (
          <div className="ios-glass-card rounded-[24px] p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#789087]">Dein Code</p>
            <p className="mt-2 font-mono text-5xl font-black tracking-[0.25em] text-[#0e302e]">{code}</p>

            {mpRole === "waiting" && (
              <>
                <p className="mt-4 text-sm font-semibold text-[#789087]">
                  Schick diesen Code an {player === "Jan" ? "Luca" : "Jan"} und warte auf Beitritt …
                </p>
                <div className="mt-3 flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-[#125f68]"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </>
            )}

            {mpRole === "waiting_ready" && (
              <>
                <p className="mt-3 rounded-[12px] bg-[#e7f4ee] py-2 text-sm font-black text-[#125f68]">
                  {waitSession?.guest ?? (player === "Jan" ? "Luca" : "Jan")} ist beigetreten! ⚓
                </p>
                <button
                  className="btn-sheen mt-4 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white"
                  onClick={handleStartHost}
                  type="button"
                >
                  Spiel starten →
                </button>
              </>
            )}
          </div>
        )}

        {/* Joining spinner */}
        {mpRole === "joining" && (
          <p className="text-center font-bold text-[#789087]">Trete bei …</p>
        )}
      </div>
    );
  }

  // ─── RENDER: DONE ─────────────────────────────────────────────────────────────

  if (bs.phase === "done") {
    const won = bs.winner === player;
    return (
      <div className="grid gap-5 overflow-x-clip">
        <div
          className={[
            "rounded-[28px] p-8 text-center text-white",
            won
              ? "bg-[linear-gradient(135deg,#0b4e6e,#125f68)]"
              : "bg-[linear-gradient(135deg,#5a1818,#a03020)]",
          ].join(" ")}
        >
          <p className="text-6xl">{won ? "🏆" : "⚓"}</p>
          <p className="mt-3 text-3xl font-black">{won ? "Gewonnen!" : "Versenkt!"}</p>
          <p className="mt-2 text-sm font-semibold text-white/80">
            {bs.winner} hat alle {TOTAL_CELLS} Schiffszellen versenkt.
          </p>
        </div>

        {/* Auflösung: gegnerische Flotte */}
        <div className="ios-glass-card overflow-x-auto rounded-[24px] p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">
            Gegnerische Flotte — Auflösung
          </p>
          <div className="overflow-x-auto">
            <DefenseGrid ships={oppShips} shots={myShots} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SHIPS.map((ship, i) => {
              const shipCells2 = oppShips[i] ?? [];
              const sunk = shipCells2.every((c) => myShots[c] === "hit");
              return (
                <span
                  key={ship.id}
                  className={["rounded-full px-2.5 py-1 text-xs font-black", sunk ? "bg-[#e8401a] text-white" : "bg-[#eff6f2] text-[#789087]"].join(" ")}
                >
                  {ship.emoji} {ship.name} {sunk ? "💥" : "✓"}
                </span>
              );
            })}
          </div>
        </div>

        <button
          className="min-h-12 rounded-[20px] bg-[#eff6f2] font-black text-[#125f68] transition active:scale-[0.97]"
          onClick={() => {
            setMpRole("idle");
            setLocalShips(Array(SHIPS.length).fill(null));
            setSelShipIdx(0);
            setCode("");
          }}
          type="button"
        >
          ← Neu spielen
        </button>
      </div>
    );
  }

  // ─── RENDER: PLACING ──────────────────────────────────────────────────────────

  if (bs.phase === "placing") {
    const CELL = 30;
    const preview = hoverCell ? previewFor(hoverCell) : { cells: [], valid: true };
    const allPlaced = localShips.every(Boolean);

    return (
      <div className="grid gap-4 overflow-x-clip">
        {/* Header */}
        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b1e35,#1a4a6b_55%,#125f68)] p-4 text-white">
          <button
            className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur"
            onClick={onBack}
            type="button"
          >
            ← Spiele
          </button>
          <p className="relative z-10 mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#9de7dc]">
            Phase 1 — Platzierung
          </p>
          <h2 className="relative z-10 mt-1 text-xl font-black">
            {myReady
              ? `⏳ Warte auf ${player === "Jan" ? "Luca" : "Jan"}…`
              : "Platziere deine Flotte"}
          </h2>
          {!myReady && (
            <p className="relative z-10 mt-1 text-sm text-white/70">
              Schiff antippen → Raster antippen → H/V wechseln mit dem Button
            </p>
          )}
        </section>

        {!myReady && (
          <>
            {/* Ship selector + direction toggle */}
            <div className="flex flex-wrap gap-2">
              {SHIPS.map((ship, i) => {
                const placed = !!localShips[i];
                return (
                  <button
                    key={ship.id}
                    className={[
                      "flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-sm font-black transition active:scale-[0.95]",
                      placed
                        ? "bg-[#e7f4ee] text-[#125f68]"
                        : selShipIdx === i
                          ? "bg-[#125f68] text-white ring-2 ring-[#9de7dc] ring-offset-1"
                          : "bg-[#eff6f2] text-[#0e302e]",
                    ].join(" ")}
                    onClick={() => !placed && setSelShipIdx(i === selShipIdx ? null : i)}
                    type="button"
                  >
                    <span>{ship.emoji}</span>
                    <span className="hidden sm:inline">{ship.name}</span>
                    <span className="text-xs opacity-60">({ship.size})</span>
                    {placed && <span className="ml-0.5">✓</span>}
                  </button>
                );
              })}

              <button
                className="rounded-[12px] bg-[#0e302e] px-3 py-2 text-sm font-black text-[#9de7dc] transition active:scale-[0.95]"
                onClick={() => setDir((d) => (d === "H" ? "V" : "H"))}
                type="button"
              >
                {dir === "H" ? "↔ H" : "↕ V"}
              </button>
            </div>

            {/* Placement grid */}
            <div className="ios-glass-card overflow-x-auto rounded-[20px] p-3">
              <div style={{ display: "inline-block", userSelect: "none" }}>
                {/* Column labels */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `16px repeat(${GRID}, ${CELL}px)`,
                    gap: "2px",
                    marginBottom: 2,
                  }}
                >
                  <div />
                  {COL_LABELS.map((l) => (
                    <div key={l} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#789087" }}>{l}</div>
                  ))}
                </div>
                {/* Rows */}
                {Array.from({ length: GRID }, (_, row) => (
                  <div
                    key={row}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `16px repeat(${GRID}, ${CELL}px)`,
                      gap: "2px",
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color: "#789087", height: CELL,
                      }}
                    >
                      {row + 1}
                    </div>
                    {Array.from({ length: GRID }, (_, col) => {
                      const key = ck(col, row);
                      const hasShip = placedSet.has(key);
                      const isPreview = preview.cells.includes(key);
                      const isError = errorCells.includes(key);
                      let bg = "#e7f4ee";
                      if (hasShip) bg = "#125f68";
                      if (isPreview) bg = preview.valid ? "#9de7dc" : "#fca5a5";
                      if (isError) bg = "#ef4444";

                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={-1}
                          style={{
                            width: CELL, height: CELL,
                            backgroundColor: bg,
                            border: selShipIdx !== null && !hasShip ? "1px solid #9de7dc" : "1px solid #c8d8d0",
                            borderRadius: 4,
                            cursor: selShipIdx !== null ? "pointer" : "default",
                            transition: "background-color 0.1s",
                          }}
                          onClick={() => handleCellTap(col, row)}
                          onPointerEnter={() => setHoverCell(key)}
                          onPointerLeave={() => setHoverCell(null)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleCellTap(col, row); }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Ship legend */}
            <div className="ios-glass-card rounded-[20px] p-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {SHIPS.map((ship, i) => (
                  <div
                    key={ship.id}
                    className={[
                      "flex items-center gap-2 text-xs font-bold",
                      localShips[i] ? "text-[#125f68]" : "text-[#789087]",
                    ].join(" ")}
                  >
                    <span>{ship.emoji}</span>
                    <span className="hidden sm:inline">{ship.name}</span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: ship.size }, (_, j) => (
                        <span
                          key={j}
                          style={{
                            width: 10, height: 10, borderRadius: 2,
                            backgroundColor: localShips[i] ? "#125f68" : "#cfe0d7",
                            display: "inline-block",
                          }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {allPlaced && (
              <button
                className="btn-sheen min-h-14 w-full rounded-[20px] bg-[#125f68] text-base font-black text-white shadow-[0_8px_25px_rgba(18,95,104,0.3)] transition active:scale-[0.97]"
                onClick={() => void handleReady()}
                type="button"
              >
                ⚓ Flotte bereit! Angriff starten →
              </button>
            )}
          </>
        )}

        {myReady && (
          <div className="ios-glass-card rounded-[24px] p-8 text-center">
            <p className="text-4xl">⚓</p>
            <p className="mt-3 text-xl font-black text-[#0e302e]">Bereit!</p>
            <p className="mt-2 text-sm font-semibold text-[#789087]">
              Warte auf {player === "Jan" ? "Luca" : "Jan"} …
            </p>
            <div className="mt-4 flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-[#125f68]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: BATTLE ───────────────────────────────────────────────────────────

  const ATKCELL = 32;

  // Use session state ships (set at ready time). Fallback to localShips for own board.
  const ownShips = myShips.length === SHIPS.length
    ? myShips
    : (localShips.filter(Boolean) as string[][]);

  return (
    <div className="grid gap-4 overflow-x-clip">
      {/* Status header */}
      <section
        className={[
          "relative overflow-hidden rounded-[28px] p-4 text-white",
          isMyTurn
            ? "bg-[linear-gradient(135deg,#0b4e6e,#125f68)]"
            : "bg-[linear-gradient(135deg,#0e302e,#243a30)]",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur"
            onClick={onBack}
            type="button"
          >
            ← Spiele
          </button>
          <div
            className={[
              "rounded-full px-3 py-1 text-xs font-black",
              isMyTurn ? "bg-[#ffe1a8] text-[#0e302e]" : "bg-white/20 text-white",
            ].join(" ")}
          >
            {isMyTurn ? "⚡ Dein Zug!" : `⏳ ${bs.turn} zielt …`}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-black">
          <span>🎯 Treffer: <span className="text-[#ffe1a8]">{myHits} / {TOTAL_CELLS}</span></span>
          <span>💥 Gegen mich: <span className="text-white/70">{oppHitsOnMe} / {TOTAL_CELLS}</span></span>
        </div>
      </section>

      {/* Own board — small */}
      <div className="ios-glass-card rounded-[20px] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">
          Dein Meer
        </p>
        <div className="overflow-x-auto">
          <DefenseGrid ships={ownShips} shots={oppShots} />
        </div>
      </div>

      {/* Attack board — large */}
      <div className="ios-glass-card rounded-[20px] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">
          {isMyTurn ? "⚡ Angriff — tippe zum Schießen!" : "⏳ Gegner zielt …"}
        </p>
        <div className="overflow-x-auto">
          <div style={{ display: "inline-block", userSelect: "none" }}>
            {/* Column labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `16px repeat(${GRID}, ${ATKCELL}px)`,
                gap: "2px",
                marginBottom: 2,
              }}
            >
              <div />
              {COL_LABELS.map((l) => (
                <div key={l} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#789087" }}>{l}</div>
              ))}
            </div>
            {Array.from({ length: GRID }, (_, row) => (
              <div
                key={row}
                style={{
                  display: "grid",
                  gridTemplateColumns: `16px repeat(${GRID}, ${ATKCELL}px)`,
                  gap: "2px",
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: "#789087", height: ATKCELL,
                  }}
                >
                  {row + 1}
                </div>
                {Array.from({ length: GRID }, (_, col) => {
                  const key = ck(col, row);
                  const shot = myShots[key];
                  const canShoot = isMyTurn && !shot;
                  let bg = isMyTurn ? "#d4eae3" : "#e7f4ee";
                  if (shot === "miss") bg = "#b8d4cc";
                  if (shot === "hit") bg = "#e8401a";
                  return (
                    <button
                      key={key}
                      type="button"
                      style={{
                        width: ATKCELL, height: ATKCELL,
                        backgroundColor: bg,
                        border: canShoot ? "1px solid #9de7dc" : "1px solid #c8d8d0",
                        borderRadius: 4,
                        cursor: canShoot ? "pointer" : "default",
                        fontSize: 14,
                        transition: "background-color 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onClick={() => { if (isMyTurn) void handleShoot(col, row); }}
                      disabled={!canShoot}
                    >
                      {shot === "hit" && "💥"}
                      {shot === "miss" && "·"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {isMyTurn && (
          <p className="mt-2 text-xs font-semibold text-[#9de7dc]">
            💡 Treffer = nochmal schießen!
          </p>
        )}
      </div>
    </div>
  );
}
