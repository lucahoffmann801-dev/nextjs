"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PixelArtView from "./pixel-art-view";
import SoundscapeView from "./soundscape-view";
import SeeschlachtView from "./seeschlacht-view";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameId = "krikri" | "trivia" | "distance" | "chaos" | "mindmatch" | "pixel" | "soundscape" | "seeschlacht";
type Player = "Jan" | "Luca";
type AppScreen = "lobby" | GameId;

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

// ─── Multiplayer hook ─────────────────────────────────────────────────────────

function useMpSession(active: boolean, code: string) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !code) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/game/session/${code}`);
        if (!res.ok) { setError("Session nicht gefunden."); return; }
        const data = await res.json() as GameSession;
        if (!cancelled) { setSession(data); setError(null); }
      } catch {
        if (!cancelled) setError("Verbindungsfehler.");
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [active, code]);

  return { session, error };
}

async function patchSession(code: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/game/session/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<GameSession>;
}

async function createSession(game: string, host: Player): Promise<GameSession> {
  const res = await fetch("/api/game/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game, host }),
  });
  return res.json() as Promise<GameSession>;
}

// ─── MpSetup – shared lobby component ────────────────────────────────────────

type MpRole = "idle" | "creating" | "waiting_guest" | "joining" | "ready_guest" | "active";

interface MpSetupProps {
  game: GameId;
  onStart: (code: string, role: "host" | "guest", player: Player) => void;
}

function MpSetup({ game, onStart }: MpSetupProps) {
  const [role, setRole] = useState<MpRole>("idle");
  const [player, setPlayer] = useState<Player>("Jan");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinErr, setJoinErr] = useState("");
  const { session } = useMpSession(role === "waiting_guest" || role === "ready_guest", code);

  // host: detect guest joined
  useEffect(() => {
    if (role === "waiting_guest" && session?.guest) setRole("ready_guest");
  }, [role, session]);

  async function handleCreate() {
    setRole("creating");
    try {
      const s = await createSession(game, player);
      setCode(s.id);
      setRole("waiting_guest");
    } catch {
      setRole("idle");
    }
  }

  async function handleJoin() {
    setJoinErr("");
    const upper = joinInput.trim().toUpperCase();
    if (upper.length !== 6) { setJoinErr("Bitte 6-stelligen Code eingeben."); return; }
    try {
      const res = await fetch(`/api/game/session/${upper}`);
      if (!res.ok) { setJoinErr("Session nicht gefunden."); return; }
      const s = await res.json() as GameSession;
      if (s.guest) { setJoinErr("Session ist bereits voll."); return; }
      if (s.host === player) { setJoinErr(`${player} ist bereits Host dieser Session.`); return; }
      // join as guest with the actually selected player, not the inverse
      await patchSession(upper, { guest: player });
      setCode(upper);
      setRole("active");
      onStart(upper, "guest", player);
    } catch {
      setJoinErr("Verbindungsfehler.");
    }
  }

  function handleStartHost() {
    void patchSession(code, { status: "playing" });
    onStart(code, "host", player);
  }

  if (role === "idle") {
    return (
      <div className="grid gap-4">
        <div className="rounded-[20px] bg-[#eff6f2] p-4">
          <p className="text-sm font-black text-[#0e302e]">Du bist …</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["Jan", "Luca"] as Player[]).map((p) => (
              <button
                key={p}
                className={[
                  "rounded-[14px] py-2.5 text-base font-black transition",
                  player === p ? "bg-[#125f68] text-white" : "bg-white text-[#125f68]",
                ].join(" ")}
                onClick={() => setPlayer(p)}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-sheen min-h-12 rounded-[18px] bg-[#125f68] px-5 font-black text-white"
          onClick={handleCreate}
          type="button"
        >
          Neue Session erstellen (Host)
        </button>

        <div className="flex items-center gap-2">
          <input
            className="min-h-12 flex-1 rounded-[14px] border border-[#cfe0d7] bg-white px-4 font-mono text-lg font-black uppercase tracking-[0.18em] text-[#0e302e] outline-none focus:border-[#125f68]"
            maxLength={6}
            placeholder="CODE"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            type="text"
          />
          <button
            className="btn-sheen min-h-12 rounded-[18px] bg-[#f0a23a] px-5 font-black text-[#0e302e]"
            onClick={handleJoin}
            type="button"
          >
            Beitreten
          </button>
        </div>
        {joinErr && <p className="text-sm font-semibold text-red-500">{joinErr}</p>}
      </div>
    );
  }

  if (role === "creating") {
    return <p className="text-center font-bold text-[#789087]">Session wird erstellt …</p>;
  }

  if (role === "waiting_guest" || role === "ready_guest") {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#789087]">Dein Code</p>
        <p className="font-mono text-5xl font-black tracking-[0.22em] text-[#0e302e]">{code}</p>
        {role === "waiting_guest" ? (
          <p className="text-sm font-semibold text-[#789087]">Warte auf {player === "Jan" ? "Luca" : "Jan"} …</p>
        ) : (
          <>
            <p className="rounded-[14px] bg-[#e7f4ee] py-2 text-sm font-black text-[#125f68]">
              {session?.guest} ist beigetreten!
            </p>
            <button
              className="btn-sheen min-h-12 rounded-[18px] bg-[#125f68] px-5 font-black text-white"
              onClick={handleStartHost}
              type="button"
            >
              Spiel starten
            </button>
          </>
        )}
      </div>
    );
  }

  return null;
}

// ─── KRI-KRI BLITZ ────────────────────────────────────────────────────────────

type KriPhase = "intro" | "ready" | "waiting" | "signal" | "result" | "complete";
type KriMode = "training" | "duel";

const waitingLines = [
  "Das Kri-Kri schleicht noch hinter dem Felsen …",
  "Nicht zu früh. Die Ziege beobachtet euch.",
  "Wind, Zikaden, Spannung. Noch warten …",
  "Der Berg ruft. Aber noch nicht tippen.",
];
const falseStartPenalty = 1000;
const bestTimeKey = "kreta-kri-kri-best-time";

function avg(ms: number[]) {
  if (!ms.length) return 0;
  return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
}
function scoreLabel(ms: number) {
  if (ms < 230) return "Kri-Kri-Legende";
  if (ms < 320) return "Bergziegen-Reflex";
  if (ms < 450) return "Solider Strand-Sprint";
  return "Noch ein Frappé, dann klappt's";
}

function KriKriGame({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<KriMode>("training");
  const [phase, setPhase] = useState<KriPhase>("intro");
  const [player, setPlayer] = useState<Player>("Jan");
  const [results, setResults] = useState<{ player: Player; ms: number; fs: boolean }[]>([]);
  const [waitLine, setWaitLine] = useState(waitingLines[0]);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const signalAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const s = parseInt(localStorage.getItem(bestTimeKey) ?? "", 10);
      if (isFinite(s) && s > 0) setBestTime(s);
    }, 0);
    return () => { clearTimeout(t); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const playerResults = results.filter((r) => r.player === player);
  const janMs = results.filter((r) => r.player === "Jan" && !r.fs).map((r) => r.ms);
  const lucaMs = results.filter((r) => r.player === "Luca" && !r.fs).map((r) => r.ms);
  const targetRounds = mode === "training" ? 5 : 3;
  const currentRound = phase === "result"
    ? Math.max(1, playerResults.length)
    : Math.min(targetRounds, playerResults.length + 1);
  const latest = results.at(-1);

  function clearTimer() { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }

  function startGame(m: KriMode) {
    clearTimer(); setMode(m); setPlayer("Jan"); setResults([]); setPhase("ready");
  }

  function armRound() {
    clearTimer();
    setWaitLine(waitingLines[Math.floor(Math.random() * waitingLines.length)]);
    setPhase("waiting");
    const delay = 1100 + Math.floor(Math.random() * 2300);
    timer.current = setTimeout(() => {
      signalAt.current = performance.now();
      timer.current = null;
      setPhase("signal");
      navigator.vibrate?.(35);
    }, delay);
  }

  function record(ms: number, fs: boolean) {
    const rounded = Math.max(1, Math.round(ms));
    setResults((r) => [...r, { player, ms: rounded, fs }]);
    if (!fs && (bestTime === null || rounded < bestTime)) {
      setBestTime(rounded);
      localStorage.setItem(bestTimeKey, String(rounded));
    }
    setPhase("result");
  }

  function tap() {
    if (phase === "ready") { armRound(); return; }
    if (phase === "waiting") { clearTimer(); record(falseStartPenalty, true); return; }
    if (phase === "signal") record(performance.now() - signalAt.current, false);
  }

  function advance() {
    const done = results.filter((r) => r.player === player).length;
    if (done < targetRounds) { setPhase("ready"); return; }
    if (mode === "duel" && player === "Jan") { setPlayer("Luca"); setPhase("ready"); return; }
    setPhase("complete");
  }

  const duelWinner = phase === "complete" && mode === "duel"
    ? avg(janMs) === avg(lucaMs) ? "Unentschieden"
    : avg(janMs) < avg(lucaMs) ? "Jan" : "Luca"
    : null;

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">
          ← Games
        </button>
        <span className="text-xl font-black text-[#0e302e]">Kri-Kri Blitz 🐐</span>
      </div>

      {phase === "intro" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <button className="ios-glass-card card-interactive rounded-[24px] p-5 text-left" onClick={() => startGame("training")} type="button">
            <span className="text-3xl">⚡</span>
            <span className="mt-4 block text-xl font-black text-[#0e302e]">Training</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-[#5b6f68]">5 Runden. Jag deinen Rekord.</span>
            {bestTime && <span className="mt-4 inline-flex rounded-full bg-[#e7f4ee] px-3 py-1.5 text-xs font-black text-[#125f68]">Rekord: {bestTime} ms</span>}
          </button>
          <button className="ios-glass-card card-interactive rounded-[24px] p-5 text-left" onClick={() => startGame("duel")} type="button">
            <span className="text-3xl">🏁</span>
            <span className="mt-4 block text-xl font-black text-[#0e302e]">Jan vs. Luca</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-[#5b6f68]">3 Blitze pro Person auf diesem Gerät.</span>
            <span className="mt-4 inline-flex rounded-full bg-[#fff1d8] px-3 py-1.5 text-xs font-black text-[#7a4b00]">Kurzmatch</span>
          </button>
        </section>
      ) : (
        <section className="ios-glass-card overflow-hidden rounded-[28px] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#789087]">{mode === "training" ? "Training" : "Jan vs. Luca"}</p>
              <h3 className="mt-1 text-2xl font-black text-[#0e302e]">
                {phase === "complete" ? "Match beendet" : `${player} · Runde ${currentRound}/${targetRounds}`}
              </h3>
            </div>
            <button className="min-h-10 rounded-full bg-[#eff6f2] px-4 text-sm font-black text-[#125f68]" onClick={() => { clearTimer(); setPhase("intro"); }} type="button">
              Modus wechseln
            </button>
          </div>

          {phase === "complete" ? (
            <div className="mt-6 grid gap-4">
              <div className="rounded-[24px] bg-[#0e5558] p-6 text-center text-white">
                <p className="text-5xl">{mode === "duel" ? "🏆" : "🐐"}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#9de7dc]">{mode === "duel" ? "Champion" : "Training done"}</p>
                <p className="mt-2 text-3xl font-black">{mode === "duel" ? duelWinner : scoreLabel(avg(results.filter((r) => !r.fs).map((r) => r.ms)))}</p>
                {mode === "duel" ? (
                  <p className="mt-3 font-bold text-white/78">Jan {avg(janMs)} ms · Luca {avg(lucaMs)} ms</p>
                ) : (
                  <p className="mt-3 font-bold text-white/78">Ø {avg(results.filter((r) => !r.fs).map((r) => r.ms))} ms · Rekord {bestTime ?? "–"} ms</p>
                )}
              </div>
              <button className="btn-sheen min-h-14 rounded-[18px] bg-[#f0a23a] px-5 text-base font-black text-[#0e302e]" onClick={() => startGame(mode)} type="button">Revanche</button>
            </div>
          ) : (
            <>
              <button
                aria-live="polite"
                className={["mt-6 grid min-h-[300px] w-full place-items-center overflow-hidden rounded-[28px] border-2 p-6 text-center transition active:scale-[0.99]",
                  phase === "signal" ? "border-[#ffc65c] bg-[#f0a23a] text-[#0e302e] shadow-[0_0_0_10px_rgba(240,162,58,0.16)]"
                  : phase === "waiting" ? "border-[#164f52] bg-[#0d3e3f] text-white"
                  : "border-[#cfe0d7] bg-[#eff6f2] text-[#0e302e]"].join(" ")}
                onClick={tap}
                type="button"
              >
                <span>
                  <span className="block text-7xl sm:text-8xl">{phase === "signal" ? "🐐" : phase === "waiting" ? "⛰️" : phase === "result" ? "⚡" : "👆"}</span>
                  <span className="mt-5 block text-3xl font-black">
                    {phase === "signal" ? "JETZT!" : phase === "waiting" ? "Warten …" : phase === "result" ? (latest?.fs ? "Zu früh!" : `${latest?.ms} ms`) : "Bereit?"}
                  </span>
                  <span className="mx-auto mt-3 block max-w-md text-sm font-bold leading-6 opacity-75">
                    {phase === "waiting" ? waitLine : phase === "signal" ? "Tippen! Das Kri-Kri ist da." : phase === "result" ? (latest?.fs ? `${falseStartPenalty} ms Strafzeit. Die Ziege lacht.` : scoreLabel(latest?.ms ?? 0)) : "Tippe zum Starten."}
                  </span>
                </span>
              </button>
              {phase === "result" && (
                <button className="btn-sheen mt-4 min-h-14 w-full rounded-[18px] bg-[#125f68] px-5 text-base font-black text-white" onClick={advance} type="button">
                  {playerResults.length >= targetRounds ? (mode === "duel" && player === "Jan" ? "Handy an Luca" : "Ergebnis") : "Nächster Blitz"}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ─── TRIVIA ───────────────────────────────────────────────────────────────────

const triviaQ = [
  { q: "Wann starten Jan und Luca ihre Kreta-Reise?", opts: ["28. Juni", "30. Juni", "1. Juli", "5. Juli"], c: 2, cat: "✈️" },
  { q: "Wie viele Tage sind Jan und Luca auf Kreta?", opts: ["5 Tage", "7 Tage", "9 Tage", "12 Tage"], c: 2, cat: "📅" },
  { q: "Wo liegt ihr Hotel (Basis)?", opts: ["Chania", "Frangokastello", "Rethymno", "Heraklion"], c: 1, cat: "🏠" },
  { q: "In welcher Region liegt Frangokastello?", opts: ["Apokoronas", "Sfakia", "Selino", "Amari"], c: 1, cat: "🗺️" },
  { q: "Was ist das Kri-Kri?", opts: ["Eine kretische Fischart", "Eine wilde Bergziege", "Ein Strandabschnitt", "Ein kretisches Gericht"], c: 1, cat: "🐐" },
  { q: "Welcher Fluss fließt durch die Samaria-Schlucht?", opts: ["Geropotamos", "Almyros", "Tarraios", "Agia Irini"], c: 2, cat: "⛰️" },
  { q: "Wie lang ist die Samaria-Schlucht?", opts: ["8 km", "12 km", "16 km", "22 km"], c: 2, cat: "🥾" },
  { q: "Welches ist das bekannteste Gericht der kretischen Küche?", opts: ["Moussaka", "Dakos", "Spanakopita", "Souvlaki"], c: 1, cat: "🍽️" },
  { q: "Wo liegt der Elafonisi-Strand mit rosa Sand?", opts: ["Nordost-Kreta", "Südwest-Kreta", "Zentral-Kreta", "Ostküste"], c: 1, cat: "🏖️" },
  { q: "In welcher Stadt liegt das Archäologische Nationalmuseum Kretas?", opts: ["Chania", "Rethymno", "Heraklion", "Agios Nikolaos"], c: 2, cat: "🏛️" },
  { q: "Wie heißt der höchste Berg Kretas?", opts: ["Lefka Ori", "Idi (Psiloritis)", "Dikti", "Asterousia"], c: 1, cat: "🏔️" },
  { q: "Welche Zivilisation baute den Palast von Knossos?", opts: ["Mykener", "Minoer", "Dorier", "Römer"], c: 1, cat: "🏛️" },
  { q: "Aus welcher Pflanze wird Raki (Tsikoudia) destilliert?", opts: ["Weintrauben-Trester", "Feigen", "Johannisbrot", "Oliven"], c: 0, cat: "🥃" },
  { q: "Wie viele Einwohner hat Kreta ca.?", opts: ["300.000", "500.000", "650.000", "1 Million"], c: 2, cat: "📊" },
  { q: "Welcher Maler wurde auf Kreta geboren?", opts: ["Picasso", "El Greco", "Modigliani", "Dali"], c: 1, cat: "🎨" },
];

type TriviaScreen = "menu" | "solo_play" | "mp_setup" | "mp_play" | "results";

interface TriviaState {
  qIndex: number;
  scores: Record<string, number>;
  answers: (number | null)[];
  finished: boolean;
}

function TriviaGame({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<TriviaScreen>("menu");
  const [mpCode, setMpCode] = useState("");
  const [mpRole, setMpRole] = useState<"host" | "guest">("host");
  const [mpPlayer, setMpPlayer] = useState<Player>("Jan");
  const [soloScore, setSoloScore] = useState(0);
  const [soloQ, setSoloQ] = useState(0);
  const [soloAns, setSoloAns] = useState<(number | null)[]>(Array(triviaQ.length).fill(null));
  const [soloFinished, setSoloFinished] = useState(false);
  const { session } = useMpSession(screen === "mp_play", mpCode);

  // Solo
  function startSolo() {
    setSoloScore(0); setSoloQ(0);
    setSoloAns(Array(triviaQ.length).fill(null));
    setSoloFinished(false);
    setScreen("solo_play");
  }

  function answerSolo(idx: number) {
    if (soloAns[soloQ] !== null) return;
    const correct = idx === triviaQ[soloQ].c;
    const newAns = [...soloAns]; newAns[soloQ] = idx;
    setSoloAns(newAns);
    if (correct) setSoloScore((s) => s + 1);
    setTimeout(() => {
      if (soloQ + 1 >= triviaQ.length) { setSoloFinished(true); }
      else setSoloQ((q) => q + 1);
    }, 900);
  }

  // Multiplayer
  function handleMpStart(code: string, role: "host" | "guest", player: Player) {
    setMpCode(code); setMpRole(role); setMpPlayer(player); setScreen("mp_play");
    // init state
    void patchSession(code, { state: { qIndex: 0, scores: { Jan: 0, Luca: 0 }, answers: [], finished: false } });
  }

  const mpState: TriviaState | null = session?.state && Object.keys(session.state).length
    ? session.state as unknown as TriviaState : null;

  async function answerMp(idx: number) {
    if (!mpState || !session) return;
    if ((mpState.answers[mpState.qIndex] ?? null) !== null) return;
    const correct = idx === triviaQ[mpState.qIndex].c;
    const newScores = { ...mpState.scores, [mpPlayer]: (mpState.scores[mpPlayer] ?? 0) + (correct ? 1 : 0) };
    const newAnswers = [...(mpState.answers ?? [])];
    newAnswers[mpState.qIndex] = idx;
    const isLast = mpState.qIndex + 1 >= triviaQ.length;
    await patchSession(session.id, {
      state: { ...mpState, scores: newScores, answers: newAnswers, qIndex: isLast ? mpState.qIndex : mpState.qIndex, finished: isLast },
    });
  }

  async function nextMpQ() {
    if (!mpState || !session) return;
    await patchSession(session.id, { state: { ...mpState, qIndex: mpState.qIndex + 1, answers: [] } });
  }

  // ── Render solo ──
  if (screen === "solo_play") {
    const q = triviaQ[soloQ];
    const chosen = soloAns[soloQ];
    if (soloFinished) {
      const pct = Math.round((soloScore / triviaQ.length) * 100);
      return (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
            <span className="text-xl font-black text-[#0e302e]">Kreta Trivia 🏛️</span>
          </div>
          <div className="ios-glass-card rounded-[28px] p-6 text-center">
            <p className="text-5xl">{pct >= 80 ? "🏆" : pct >= 60 ? "🌊" : "🐐"}</p>
            <p className="mt-3 text-3xl font-black text-[#0e302e]">{soloScore}/{triviaQ.length}</p>
            <p className="mt-1 text-sm font-semibold text-[#789087]">{pct >= 80 ? "Kreta-Experte!" : pct >= 60 ? "Solides Inselwissen" : "Mehr Raki trinken hilft"}</p>
            <button className="btn-sheen mt-6 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={startSolo} type="button">Nochmal</button>
            <button className="mt-3 min-h-10 w-full rounded-[18px] bg-[#eff6f2] font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">Zurück</button>
          </div>
        </div>
      );
    }
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">← Trivia</button>
          <span className="font-black text-[#789087]">{soloQ + 1}/{triviaQ.length}</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-sm font-black text-[#789087]">{q.cat} Frage {soloQ + 1}</p>
          <p className="mt-2 text-xl font-black leading-snug text-[#0e302e]">{q.q}</p>
          <div className="mt-5 grid gap-2">
            {q.opts.map((opt, i) => {
              const picked = chosen === i;
              const correct = i === q.c;
              const revealed = chosen !== null;
              return (
                <button
                  key={opt}
                  className={["min-h-12 rounded-[14px] px-4 py-2.5 text-left text-sm font-black transition",
                    revealed ? (correct ? "bg-[#125f68] text-white" : picked ? "bg-red-400 text-white" : "bg-[#eff6f2] text-[#789087]") : "bg-[#eff6f2] text-[#0e302e] active:scale-[0.98]"].join(" ")}
                  onClick={() => answerSolo(i)}
                  type="button"
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#d7e3dc]">
            <div className="h-full rounded-full bg-[#125f68] transition-all" style={{ width: `${((soloQ + 1) / triviaQ.length) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Render MP play ──
  if (screen === "mp_play") {
    if (!mpState) return <div className="text-center py-10 font-bold text-[#789087]">Warte auf Spielstart …</div>;
    if (mpState.finished) {
      const jan = mpState.scores.Jan ?? 0;
      const luca = mpState.scores.Luca ?? 0;
      const winner = jan === luca ? "Unentschieden" : jan > luca ? "Jan" : "Luca";
      return (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
            <span className="text-xl font-black text-[#0e302e]">Kreta Trivia 🏛️</span>
          </div>
          <div className="ios-glass-card rounded-[28px] p-6 text-center">
            <p className="text-5xl">🏆</p>
            <p className="mt-3 text-3xl font-black text-[#0e302e]">{winner}</p>
            <p className="mt-2 text-sm font-semibold text-[#789087]">Jan {jan} · Luca {luca} Punkte</p>
            <button className="mt-6 min-h-10 w-full rounded-[18px] bg-[#eff6f2] font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">Zurück</button>
          </div>
        </div>
      );
    }
    const q = triviaQ[mpState.qIndex];
    const chosen = mpState.answers?.[mpState.qIndex] ?? null;
    const isHost = mpRole === "host";
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <span className="font-black text-[#789087]">Frage {mpState.qIndex + 1}/{triviaQ.length}</span>
          <span className="text-sm font-black text-[#125f68]">Jan {mpState.scores.Jan ?? 0} · Luca {mpState.scores.Luca ?? 0}</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-sm font-black text-[#789087]">{q.cat}</p>
          <p className="mt-2 text-xl font-black leading-snug text-[#0e302e]">{q.q}</p>
          <div className="mt-5 grid gap-2">
            {q.opts.map((opt, i) => {
              const picked = chosen === i;
              const correct = i === q.c;
              const revealed = chosen !== null;
              return (
                <button key={opt}
                  className={["min-h-12 rounded-[14px] px-4 py-2.5 text-left text-sm font-black transition",
                    revealed ? (correct ? "bg-[#125f68] text-white" : picked ? "bg-red-400 text-white" : "bg-[#eff6f2] text-[#789087]") : "bg-[#eff6f2] text-[#0e302e] active:scale-[0.98]"].join(" ")}
                  onClick={() => void answerMp(i)}
                  type="button"
                >{opt}</button>
              );
            })}
          </div>
          {chosen !== null && isHost && mpState.qIndex + 1 < triviaQ.length && (
            <button className="btn-sheen mt-4 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={() => void nextMpQ()} type="button">Nächste Frage</button>
          )}
          {chosen !== null && !isHost && <p className="mt-4 text-center text-sm font-semibold text-[#789087]">Warte auf Host …</p>}
        </div>
      </div>
    );
  }

  // ── Render MP setup ──
  if (screen === "mp_setup") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">← Zurück</button>
          <span className="text-xl font-black text-[#0e302e]">Multiplayer Setup</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <MpSetup game="trivia" onStart={handleMpStart} />
        </div>
      </div>
    );
  }

  // ── Render menu ──
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
        <span className="text-xl font-black text-[#0e302e]">Kreta Trivia 🏛️</span>
      </div>
      <div className="ios-glass-card rounded-[28px] p-5">
        <p className="text-sm font-semibold leading-6 text-[#5b6f68]">15 Fragen über Kreta, Knossos, Dakos und Jan & Lucas Reise. Wer kennt die Insel besser?</p>
        <div className="mt-4 grid gap-3">
          <button className="btn-sheen min-h-12 rounded-[18px] bg-[#125f68] font-black text-white" onClick={startSolo} type="button">Solo spielen</button>
          <button className="min-h-12 rounded-[18px] bg-[#f0a23a] font-black text-[#0e302e]" onClick={() => setScreen("mp_setup")} type="button">Multiplayer (2 Handys)</button>
        </div>
      </div>
    </div>
  );
}

// ─── DISTANCE GAME ────────────────────────────────────────────────────────────

const HOTEL = { lat: 35.1829, lng: 24.2326, name: "Frangokastello" };

const places = [
  { name: "Chora Sfakion", lat: 35.1962, lng: 24.1408 },
  { name: "Loutro", lat: 35.1985, lng: 24.0796 },
  { name: "Agia Roumeli", lat: 35.2287, lng: 23.9665 },
  { name: "Plakias", lat: 35.1878, lng: 24.4011 },
  { name: "Rethymno", lat: 35.3682, lng: 24.4736 },
  { name: "Chania", lat: 35.5138, lng: 24.0180 },
  { name: "Heraklion", lat: 35.3387, lng: 25.1442 },
  { name: "Elafonisi", lat: 35.2657, lng: 23.5375 },
  { name: "Balos Lagune", lat: 35.6008, lng: 23.5667 },
  { name: "Samaria-Schlucht (Eingang)", lat: 35.2958, lng: 23.9692 },
  { name: "Knossos", lat: 35.2983, lng: 25.1628 },
  { name: "Spinalonga", lat: 35.2997, lng: 25.7342 },
  { name: "Vai Palmenstrand", lat: 35.2497, lng: 26.2497 },
  { name: "Matala", lat: 34.9955, lng: 24.7482 },
  { name: "Agios Nikolaos", lat: 35.1892, lng: 25.7164 },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type DistScreen = "menu" | "solo_play" | "mp_setup" | "mp_play" | "results";

interface DistState {
  placeIndex: number;
  guesses: Record<string, number | null>;
  scores: Record<string, number>;
  finished: boolean;
}

function DistanceGame({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<DistScreen>("menu");
  const [mpCode, setMpCode] = useState("");
  const [mpRole, setMpRole] = useState<"host" | "guest">("host");
  const [mpPlayer, setMpPlayer] = useState<Player>("Jan");
  const [soloIdx, setSoloIdx] = useState(0);
  const [soloGuess, setSoloGuess] = useState("");
  const [soloRevealed, setSoloRevealed] = useState(false);
  const [soloScore, setSoloScore] = useState(0);
  const [soloFinished, setSoloFinished] = useState(false);
  const [mpGuessInput, setMpGuessInput] = useState("");
  const { session } = useMpSession(screen === "mp_play", mpCode);

  const mpState: DistState | null = session?.state && Object.keys(session.state).length ? session.state as unknown as DistState : null;

  function startSolo() {
    setSoloIdx(0); setSoloGuess(""); setSoloRevealed(false); setSoloScore(0); setSoloFinished(false);
    setScreen("solo_play");
  }

  function handleMpStart(code: string, role: "host" | "guest", player: Player) {
    setMpCode(code); setMpRole(role); setMpPlayer(player); setMpGuessInput(""); setScreen("mp_play");
    void patchSession(code, { state: { placeIndex: 0, guesses: {}, scores: { Jan: 0, Luca: 0 }, finished: false } });
  }

  function soloSubmit() {
    const g = parseInt(soloGuess, 10);
    if (isNaN(g)) return;
    const actual = haversine(HOTEL.lat, HOTEL.lng, places[soloIdx].lat, places[soloIdx].lng);
    const diff = Math.abs(g - actual);
    const pts = diff <= 10 ? 3 : diff <= 30 ? 2 : diff <= 80 ? 1 : 0;
    setSoloScore((s) => s + pts);
    setSoloRevealed(true);
  }

  function soloNext() {
    if (soloIdx + 1 >= places.length) { setSoloFinished(true); }
    else { setSoloIdx((i) => i + 1); setSoloGuess(""); setSoloRevealed(false); }
  }

  async function mpSubmitGuess() {
    if (!mpState || !session) return;
    const g = parseInt(mpGuessInput, 10);
    if (isNaN(g)) return;
    const actual = haversine(HOTEL.lat, HOTEL.lng, places[mpState.placeIndex].lat, places[mpState.placeIndex].lng);
    const diff = Math.abs(g - actual);
    const pts = diff <= 10 ? 3 : diff <= 30 ? 2 : diff <= 80 ? 1 : 0;
    const newScores = { ...mpState.scores, [mpPlayer]: (mpState.scores[mpPlayer] ?? 0) + pts };
    const newGuesses = { ...mpState.guesses, [mpPlayer]: g };
    const bothGuessed = Object.keys(newGuesses).length >= 2;
    await patchSession(session.id, { state: { ...mpState, guesses: newGuesses, scores: newScores, finished: bothGuessed && mpState.placeIndex + 1 >= places.length } });
  }

  async function mpNext() {
    if (!mpState || !session) return;
    await patchSession(session.id, { state: { ...mpState, placeIndex: mpState.placeIndex + 1, guesses: {} } });
    setMpGuessInput("");
  }

  const scoreEmoji = (s: number, total: number) => {
    const pct = (s / (total * 3)) * 100;
    return pct >= 70 ? "🗺️" : pct >= 40 ? "🧭" : "😅";
  };

  if (screen === "solo_play") {
    if (soloFinished) {
      return (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
            <span className="text-xl font-black text-[#0e302e]">Insel-Kompass 🧭</span>
          </div>
          <div className="ios-glass-card rounded-[28px] p-6 text-center">
            <p className="text-5xl">{scoreEmoji(soloScore, places.length)}</p>
            <p className="mt-3 text-3xl font-black text-[#0e302e]">{soloScore}/{places.length * 3} Punkte</p>
            <p className="mt-1 text-sm font-semibold text-[#789087]">Max. 3 Punkte pro Ort (±10 km = 3, ±30 km = 2, ±80 km = 1)</p>
            <button className="btn-sheen mt-6 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={startSolo} type="button">Nochmal</button>
            <button className="mt-3 min-h-10 w-full rounded-[18px] bg-[#eff6f2] font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">Zurück</button>
          </div>
        </div>
      );
    }
    const place = places[soloIdx];
    const actual = haversine(HOTEL.lat, HOTEL.lng, place.lat, place.lng);
    const g = parseInt(soloGuess, 10);
    const diff = soloRevealed && !isNaN(g) ? Math.abs(g - actual) : null;
    const pts = diff !== null ? (diff <= 10 ? 3 : diff <= 30 ? 2 : diff <= 80 ? 1 : 0) : null;
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">← Kompass</button>
            <span className="font-black text-[#789087]">{soloIdx + 1}/{places.length}</span>
          </div>
          <span className="font-black text-[#125f68]">{soloScore} Pkt.</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#789087]">Wie weit ist es von {HOTEL.name} nach …</p>
          <p className="mt-2 text-2xl font-black text-[#0e302e]">{place.name}</p>
          <div className="mt-4 flex gap-2">
            <input
              className="min-h-12 flex-1 rounded-[14px] border border-[#cfe0d7] bg-white px-4 text-lg font-black text-[#0e302e] outline-none focus:border-[#125f68] disabled:opacity-60"
              disabled={soloRevealed}
              min="0"
              placeholder="km eingeben"
              type="number"
              value={soloGuess}
              onChange={(e) => setSoloGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") soloSubmit(); }}
            />
            {!soloRevealed && <button className="btn-sheen min-h-12 rounded-[14px] bg-[#125f68] px-5 font-black text-white" onClick={soloSubmit} type="button">Rate!</button>}
          </div>
          {soloRevealed && (
            <div className={["mt-4 rounded-[18px] p-4 text-center", pts === 3 ? "bg-[#125f68] text-white" : pts === 2 ? "bg-[#e7f4ee] text-[#0e302e]" : pts === 1 ? "bg-[#fff1d8] text-[#7a4b00]" : "bg-red-50 text-red-700"].join(" ")}>
              <p className="text-2xl font-black">{actual} km</p>
              <p className="text-sm font-semibold">Deine Schätzung: {soloGuess} km · Differenz: {diff} km</p>
              <p className="mt-1 font-black">{pts === 3 ? "3 Punkte 🎯" : pts === 2 ? "2 Punkte 👍" : pts === 1 ? "1 Punkt 🤏" : "0 Punkte 💀"}</p>
              <button className="mt-3 min-h-10 w-full rounded-[14px] bg-white/30 font-black" onClick={soloNext} type="button">
                {soloIdx + 1 >= places.length ? "Ergebnis" : "Weiter"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "mp_play") {
    if (!mpState) return <div className="text-center py-10 font-bold text-[#789087]">Warte auf Spielstart …</div>;
    if (mpState.finished) {
      const jan = mpState.scores.Jan ?? 0;
      const luca = mpState.scores.Luca ?? 0;
      const winner = jan === luca ? "Unentschieden" : jan > luca ? "Jan" : "Luca";
      return (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
            <span className="text-xl font-black text-[#0e302e]">Insel-Kompass 🧭</span>
          </div>
          <div className="ios-glass-card rounded-[28px] p-6 text-center">
            <p className="text-5xl">🗺️</p>
            <p className="mt-3 text-3xl font-black text-[#0e302e]">{winner}</p>
            <p className="mt-1 text-sm font-semibold text-[#789087]">Jan {jan} · Luca {luca} Punkte</p>
            <button className="mt-6 min-h-10 w-full rounded-[18px] bg-[#eff6f2] font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">Zurück</button>
          </div>
        </div>
      );
    }
    const place = places[mpState.placeIndex];
    const actual = haversine(HOTEL.lat, HOTEL.lng, place.lat, place.lng);
    const myGuess = mpState.guesses?.[mpPlayer] ?? null;
    const bothGuessed = myGuess !== null && Object.keys(mpState.guesses ?? {}).length >= 2;
    const otherPlayer: Player = mpPlayer === "Jan" ? "Luca" : "Jan";
    const otherGuess = mpState.guesses?.[otherPlayer] ?? null;
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <span className="font-black text-[#789087]">{mpState.placeIndex + 1}/{places.length}</span>
          <span className="text-sm font-black text-[#125f68]">Jan {mpState.scores.Jan ?? 0} · Luca {mpState.scores.Luca ?? 0}</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#789087]">Wie weit von {HOTEL.name} nach …</p>
          <p className="mt-2 text-2xl font-black text-[#0e302e]">{place.name}</p>
          <div className="mt-4 flex gap-2">
            <input
              className="min-h-12 flex-1 rounded-[14px] border border-[#cfe0d7] bg-white px-4 text-lg font-black text-[#0e302e] outline-none focus:border-[#125f68] disabled:opacity-60"
              disabled={myGuess !== null}
              min="0"
              placeholder="km"
              type="number"
              value={mpGuessInput}
              onChange={(e) => setMpGuessInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void mpSubmitGuess(); }}
            />
            {myGuess === null && <button className="btn-sheen min-h-12 rounded-[14px] bg-[#125f68] px-5 font-black text-white" onClick={() => void mpSubmitGuess()} type="button">Rate!</button>}
          </div>
          {myGuess !== null && !bothGuessed && (
            <p className="mt-3 text-center text-sm font-semibold text-[#789087]">Du: {myGuess} km · Warte auf {otherPlayer} …</p>
          )}
          {bothGuessed && (
            <div className="mt-4 rounded-[18px] bg-[#0e5558] p-4 text-center text-white">
              <p className="text-2xl font-black">{actual} km</p>
              <p className="text-sm font-semibold mt-1">Jan: {mpState.guesses.Jan ?? "–"} km · Luca: {mpState.guesses.Luca ?? "–"} km</p>
              {mpRole === "host" && mpState.placeIndex + 1 < places.length && (
                <button className="mt-3 min-h-10 w-full rounded-[14px] bg-white/20 font-black" onClick={() => void mpNext()} type="button">Weiter</button>
              )}
              {mpRole === "guest" && <p className="mt-2 text-sm font-semibold text-white/70">Host wählt weiter …</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "mp_setup") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={() => setScreen("menu")} type="button">← Zurück</button>
          <span className="text-xl font-black text-[#0e302e]">Multiplayer Setup</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <MpSetup game="distance" onStart={handleMpStart} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Games</button>
        <span className="text-xl font-black text-[#0e302e]">Insel-Kompass 🧭</span>
      </div>
      <div className="ios-glass-card rounded-[28px] p-5">
        <p className="text-sm font-semibold leading-6 text-[#5b6f68]">Wie weit ist {HOTEL.name} von 15 kretischen Orten entfernt? Rate die Distanz in km – je näher dran, desto mehr Punkte.</p>
        <div className="mt-2 rounded-[14px] bg-[#eff6f2] p-3 text-xs font-semibold text-[#789087]">
          ±10 km = 3 Pkt. · ±30 km = 2 Pkt. · ±80 km = 1 Pkt.
        </div>
        <div className="mt-4 grid gap-3">
          <button className="btn-sheen min-h-12 rounded-[18px] bg-[#125f68] font-black text-white" onClick={startSolo} type="button">Solo spielen</button>
          <button className="min-h-12 rounded-[18px] bg-[#f0a23a] font-black text-[#0e302e]" onClick={() => setScreen("mp_setup")} type="button">Multiplayer (2 Handys)</button>
        </div>
      </div>
    </div>
  );
}

// ─── MIND MATCH ──────────────────────────────────────────────────────────────

interface MMQuestion {
  text: string;
  a: string;
  b: string;
  emoji: string;
}

const MM_QUESTIONS: MMQuestion[] = [
  // ── Kreta: Essen & Trinken ──────────────────────────────────────────────────
  { text: "Was ist besser?", a: "Frappé", b: "Raki", emoji: "☕" },
  { text: "Was ist kretischer?", a: "Dakos", b: "Gyros", emoji: "🫒" },
  { text: "Erster Griff nach der Landung?", a: "💧 Wasser", b: "🍺 Bier", emoji: "✈️" },
  { text: "Oktopus essen?", a: "Ja, sofort", b: "Nein, danke", emoji: "🐙" },
  { text: "Abendessen wann?", a: "19 Uhr — Hunger hat Grenzen", b: "21+ Uhr — so macht man das hier", emoji: "🍽️" },
  { text: "Olivenöl?", a: "🫒 Auf alles kippen — so macht man das", b: "💧 Maßvoll — das ist auch Fett", emoji: "🫒" },
  { text: "Bestes Kreta-Frühstück?", a: "🥚 Omelett mit Oliven & Kräutern", b: "☕ Kaffee zuerst — Essen später", emoji: "🌅" },
  { text: "Frisches Brot mit …?", a: "🧄 Knoblauch & Öl", b: "🍅 Tomate direkt draufreiben", emoji: "🍞" },
  { text: "Kreta-Dessert?", a: "🍯 Loukoumades (Honig-Donuts)", b: "🍨 Aprikosen-Eis am Strand", emoji: "🍯" },
  { text: "Meeresfrüchte?", a: "🦐 Garnelen — immer", b: "🐙 Oktopus — wenn er am Seil hängt", emoji: "🌊" },
  { text: "Bestes Kreta-Getränk?", a: "🍷 Weißwein direkt am Hafen", b: "☕ Griechischer Kaffee um 14 Uhr", emoji: "🍷" },
  { text: "Pool oder Meer?", a: "🏊 Pool", b: "🌊 Meer", emoji: "💦" },
  // ── Kreta: Aktivitäten & Stimmung ──────────────────────────────────────────
  { text: "Lieber an die …", a: "🏖️ Strand", b: "⛰️ Berge", emoji: "🌊" },
  { text: "Urlaubs-Modus?", a: "🦥 Liegen & Dösen", b: "🦁 Alles erkunden", emoji: "😎" },
  { text: "Wandern ohne Handy?", a: "Ja gerne, endlich", b: "Nein, unmöglich", emoji: "🥾" },
  { text: "Knossos oder Strand?", a: "🏛️ Knossos", b: "🏖️ Strand", emoji: "🗺️" },
  { text: "Abends am Meer?", a: "🌅 Sonnenuntergang gucken", b: "🍷 Wein trinken", emoji: "🌙" },
  { text: "Urlaubslektüre?", a: "📖 Buch mitgenommen", b: "📱 Reels gucken reicht", emoji: "🌴" },
  { text: "Souvenirs kaufen?", a: "Ja, für alle", b: "Nein, Fotos sind Erinnerung genug", emoji: "🛍️" },
  { text: "Das erste Mal ins Meer?", a: "💨 Sofort rein — wozu warten", b: "🦶 Langsam reintasten — kalt!", emoji: "🏊" },
  { text: "Urlaubstag-Tempo?", a: "⚡ Früh aufstehen, viel erleben", b: "🐢 Langsam aufwachen, sehen was kommt", emoji: "⏰" },
  { text: "Was bringt mehr?", a: "🗺️ Täglich einen neuen Ort erkunden", b: "🏖️ Einen Lieblingsplatz immer wieder", emoji: "🏝️" },
  { text: "Urlaubs-Ritual?", a: "📖 Morgens Kaffee & ein Notizbuch", b: "📵 Handy weg und einfach da sein", emoji: "☕" },
  // ── Kreta: Orte & Natur ─────────────────────────────────────────────────────
  { text: "Bestes Kreta-Tier?", a: "🐐 Kri-Kri", b: "🐢 Meeresschildkröte", emoji: "🦎" },
  { text: "Heraklion oder Chania?", a: "🏛️ Heraklion — Knossos & Lebendigkeit", b: "🏰 Chania — venezianischer Hafen", emoji: "🌆" },
  { text: "Schönste Kreta-Bucht?", a: "💎 Geheimtipp ohne Touristen", b: "🏖️ Belebter Strand mit Sunbeds", emoji: "🗺️" },
  { text: "Schlucht oder Küste?", a: "🏔️ Samaria-Schlucht — epic", b: "🌊 Loutro per Boot — magisch", emoji: "🚶" },
  { text: "Kretische Natur?", a: "🌺 Wildblumen & Macchia", b: "🦎 Eidechsen & Zikaden", emoji: "🏕️" },
  { text: "Bestes Licht auf Kreta?", a: "🌅 Sonnenaufgang über dem Meer", b: "🌄 Abendrot über den Bergen", emoji: "☀️" },
  { text: "Kreta 1600 v. Chr. oder heute?", a: "🏛️ Minoa — tauche in die Ursprünge", b: "📱 Heute — WLAN und Klimaanlage", emoji: "⏳" },
  // ── Jan & Luca — wer ist wer ────────────────────────────────────────────────
  { text: "Wer schläft morgen länger?", a: "Jan", b: "Luca", emoji: "😴" },
  { text: "Wer navigiert besser?", a: "Jan", b: "Luca", emoji: "🧭" },
  { text: "Wer isst mutiger?", a: "Jan", b: "Luca", emoji: "🐟" },
  { text: "Wer macht mehr Fotos?", a: "Jan", b: "Luca", emoji: "📸" },
  { text: "Wer würde zuerst bei 40°C wandern gehen?", a: "Jan", b: "Luca", emoji: "🥵" },
  { text: "Wer käme eher ohne WLAN aus?", a: "Jan", b: "Luca", emoji: "📵" },
  { text: "Wer lacht zuerst wenn der andere stürzt?", a: "Jan", b: "Luca", emoji: "🤣" },
  { text: "Wer spricht mehr mit Einheimischen?", a: "Jan", b: "Luca", emoji: "💬" },
  { text: "Wer würde lieber als Einheimischer auf Kreta leben?", a: "Jan", b: "Luca", emoji: "🏡" },
  { text: "Wer kauft das überflüssigste Souvenir?", a: "Jan", b: "Luca", emoji: "🪄" },
  { text: "Wer dreht am Ende die Reise-Playlist?", a: "Jan", b: "Luca", emoji: "🎵" },
  { text: "Wer ist der unfreiwillige Komiker der Reise?", a: "Jan", b: "Luca", emoji: "🎭" },
  { text: "Wer sagt zuerst »Ich bin satt«?", a: "Jan", b: "Luca", emoji: "🍽️" },
  { text: "Wer bleibt länger im Wasser?", a: "Jan", b: "Luca", emoji: "🏊" },
  { text: "Wer findet den versteckten Weg?", a: "Jan", b: "Luca", emoji: "🗺️" },
  { text: "Wer zögert länger vor der unbekannten Speise?", a: "Jan", b: "Luca", emoji: "🤔" },
  { text: "Wer reagiert cooler, wenn was schiefläuft?", a: "Jan", b: "Luca", emoji: "😎" },
  { text: "Wer schreibt später einen Song über Kreta?", a: "Jan", b: "Luca", emoji: "🎵" },
  { text: "Wer trinkt mehr Kaffee pro Tag?", a: "Jan", b: "Luca", emoji: "☕" },
  { text: "Wer wacht auf und will sofort losziehen?", a: "Jan", b: "Luca", emoji: "🌅" },
  { text: "Wer lernt zuerst 3 griechische Wörter?", a: "Jan", b: "Luca", emoji: "🇬🇷" },
  { text: "Wer bringt mehr Energie für Tagesausflüge?", a: "Jan", b: "Luca", emoji: "⚡" },
  { text: "Wer würde einen Straßenhund adoptieren?", a: "Jan", b: "Luca", emoji: "🐕" },
  // ── Tiefe Fragen & Absurdes ─────────────────────────────────────────────────
  { text: "Besser: Zeitreise zu den Minoern oder Unterwasserpalast entdecken?", a: "⏳ Minoer", b: "🌊 Unterwasserpalast", emoji: "🏛️" },
  { text: "Welche Gefahr ist auf Kreta realer?", a: "🦟 Mücken", b: "🌞 Sonnenstich", emoji: "⚠️" },
  { text: "Das ehrlichere Reise-Fazit nach Tag 1?", a: "»Hier bleib ich für immer«", b: "»Schön, aber wann ist Frühstück?«", emoji: "🌅" },
  { text: "Wenn Jan ein Kreta-Tier wäre …", a: "🐐 Kri-Kri (eigenständig, wählerisch)", b: "🦎 Eidechse (ruhig, beobachtend)", emoji: "🤔" },
  { text: "Wenn Luca ein Kreta-Gericht wäre …", a: "🍢 Souvlaki (direkt, immer gut)", b: "🥗 Dakos (komplex, regional)", emoji: "🤔" },
  { text: "Bester Kreta-Moment?", a: "🤫 Stille Sekunde am Meer", b: "🎉 Gemeinsam lachen über was Dummes", emoji: "✨" },
  { text: "Das Ende der Reise bringt vor allem …", a: "😌 Erholung (endlich)", b: "😢 Wehmut (schon vorbei)", emoji: "🏠" },
  { text: "Kreta-Philosophie?", a: "»Siga siga« — langsam, langsam", b: "»Noch ein Ort, bevor es dunkel wird«", emoji: "🐌" },
  { text: "Die ehrlichste Urlaubskategorie?", a: "🍽️ Ich esse mich durch", b: "😴 Ich schlafe mich durch", emoji: "😇" },
  { text: "Wer von beiden ist Kreta?", a: "Jan — ruhig, beständig, tief", b: "Luca — lebendig, warm, überraschend", emoji: "🏝️" },
  { text: "Wenn Kreta ein Musikstil wäre?", a: "🎸 Langsamer Blues am Meer", b: "🪗 Traditionelles Fest mit Lyra", emoji: "🎵" },
  { text: "Wenn du ein Kreta-Dorf wärst …", a: "🏔️ Kleines Bergdorf — ruhig, versteckt", b: "⚓ Fischerdorf am Hafen — lebendig", emoji: "🏡" },
  { text: "Was trifft mehr?", a: "🌊 Das Meer — grenzenlos und frei", b: "🏛️ Die Ruinen — Geschichte überall", emoji: "✨" },
  { text: "Lieber für einen Tag …?", a: "🐐 Kri-Kri in den Bergen herumstreifen", b: "🐠 Mittelmeerfisch unter Wasser leben", emoji: "🤩" },
  { text: "Wenn ihr auf Kreta strandete?", a: "🏕️ Abenteuer — ich baue eine Hütte", b: "🛟 Panik — wie komme ich nach Hause?", emoji: "🏝️" },
  { text: "Magischer Moment auf Reisen?", a: "🌙 Nachts allein am Wasser stehen", b: "🤝 Zufällig mit Einheimischen feiern", emoji: "✨" },
  { text: "Wenn das Meer ein Gefühl wäre?", a: "🫂 Umarmung — warm und sicher", b: "🌀 Abenteuer — unruhig und weit", emoji: "🌊" },
  { text: "Erinnerungen festhalten wie?", a: "📸 Fotos — die Momente halten", b: "🧠 Im Kopf — Fotos ruinieren Momente", emoji: "💭" },
  { text: "Bestes Urlaubsgefühl?", a: "😮 Das erste Mal ankommen & staunen", b: "🥺 Der letzte Abend — alles festhalten", emoji: "✨" },
  { text: "Auf Kreta wohnen für immer?", a: "🏖️ Ja sofort — wann kann ich einziehen?", b: "🤔 Schön zum Besuchen, aber …", emoji: "🏠" },
  { text: "Kreta ohne andere Touristen?", a: "👤 Ja — das echte, stille Kreta", b: "🎉 Nein — das bunte Treiben gehört dazu", emoji: "🏝️" },
  { text: "Jan und Luca als Kreta-Gericht?", a: "🥗 Horiatiki — frisch, klar, ehrlich", b: "🍲 Stifado — komplex, langsam, warm", emoji: "🍽️" },
];

const MM_ROUNDS = 10;
const MM_TIMER = 12; // seconds to tap

interface MMState {
  round: number;
  questions: number[];
  phase: "tapping" | "reveal" | "done";
  taps: Record<string, "a" | "b">;
  matches: number;
  timerStart: number;
}

function MindMatchGame({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<"menu" | "mp_setup" | "play">("menu");
  const [mpCode, setMpCode] = useState("");
  const [mpRole, setMpRole] = useState<"host" | "guest">("host");
  const [mpPlayer, setMpPlayer] = useState<Player>("Jan");
  const [timeLeft, setTimeLeft] = useState(MM_TIMER);
  const advancedKey = useRef("");
  const { session } = useMpSession(screen === "play", mpCode);

  const mpState: MMState | null =
    session?.state && Object.keys(session.state).length
      ? (session.state as unknown as MMState)
      : null;

  // Timer
  useEffect(() => {
    if (!mpState || mpState.phase !== "tapping") return;
    const start = mpState.timerStart;
    function tick() { setTimeLeft(Math.max(0, Math.ceil(MM_TIMER - (Date.now() - start) / 1000))); }
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpState?.round, mpState?.phase, mpState?.timerStart]);

  // Host: auto-advance
  useEffect(() => {
    if (!mpState || !session || mpRole !== "host") return;
    const key = `${mpState.round}:${mpState.phase}`;
    if (advancedKey.current === key) return;

    if (mpState.phase === "tapping") {
      const both = Object.keys(mpState.taps).length >= 2;
      const elapsed = (Date.now() - mpState.timerStart) / 1000;
      if (both || elapsed >= MM_TIMER) {
        advancedKey.current = key;
        const tapA = mpState.taps.Jan;
        const tapB = mpState.taps.Luca;
        const matched = tapA && tapB && tapA === tapB ? 1 : 0;
        void patchSession(session.id, {
          state: { ...mpState, phase: "reveal", matches: (mpState.matches ?? 0) + matched },
        });
      }
    }
  }, [mpState, session, mpRole]);

  function handleMpStart(code: string, role: "host" | "guest", player: Player) {
    setMpCode(code); setMpRole(role); setMpPlayer(player);
    setScreen("play");
    if (role === "host") {
      const idxs = [...Array(MM_QUESTIONS.length).keys()];
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j]!, idxs[i]!];
      }
      void patchSession(code, {
        state: {
          round: 0,
          questions: idxs.slice(0, MM_ROUNDS),
          phase: "tapping",
          taps: {},
          matches: 0,
          timerStart: Date.now(),
        } as MMState,
      });
    }
  }

  async function tap(choice: "a" | "b") {
    if (!mpState || !session || mpState.taps[mpPlayer]) return;
    await patchSession(session.id, {
      state: { ...mpState, taps: { ...mpState.taps, [mpPlayer]: choice } },
    });
  }

  async function nextRound() {
    if (!mpState || !session || mpRole !== "host") return;
    const next = mpState.round + 1;
    if (next >= MM_ROUNDS) {
      await patchSession(session.id, { state: { ...mpState, phase: "done" } });
    } else {
      await patchSession(session.id, {
        state: { ...mpState, round: next, phase: "tapping", taps: {}, timerStart: Date.now() },
      });
    }
  }

  const backBtn = (label: string, fn: () => void) => (
    <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={fn} type="button">{label}</button>
  );

  // ── menu ──
  if (screen === "menu") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Games", onBack)}<span className="text-xl font-black text-[#0e302e]">Mind Match 🧠</span></div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-sm font-semibold leading-6 text-[#5b6f68]">
            Eine Frage erscheint. Beide tippen gleichzeitig A oder B — ohne zu reden.
            Ihr bekommt gemeinsam einen Punkt wenn ihr übereinstimmt. Kein Gewinner, kein Verlierer.
            Nur: wie gut kennt ihr euch?
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            {["🧠 35+ Fragen", "⏱ 12 Sek.", "🤝 Kooperativ", "📱 2 Handys"].map((t) => (
              <span key={t} className="rounded-full bg-[#eff6f2] px-3 py-1.5 text-[#125f68]">{t}</span>
            ))}
          </div>
          <button className="btn-sheen mt-5 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={() => setScreen("mp_setup")} type="button">
            Match starten 🧠
          </button>
        </div>
      </div>
    );
  }

  // ── mp_setup ──
  if (screen === "mp_setup") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Zurück", () => setScreen("menu"))}<span className="text-xl font-black text-[#0e302e]">Multiplayer Setup</span></div>
        <div className="ios-glass-card rounded-[28px] p-5"><MpSetup game="mindmatch" onStart={handleMpStart} /></div>
      </div>
    );
  }

  // ── play: loading ──
  if (!mpState) {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Games", onBack)}</div>
        <div className="ios-glass-card flex min-h-[200px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Warte auf Spielstart …</p>
        </div>
      </div>
    );
  }

  const q = MM_QUESTIONS[mpState.questions[mpState.round] ?? 0]!;
  const roundLabel = `${mpState.round + 1} / ${MM_ROUNDS}`;
  const myTap = mpState.taps[mpPlayer];
  const otherPlayer: Player = mpPlayer === "Jan" ? "Luca" : "Jan";
  const otherTap = mpState.taps[otherPlayer];
  const pct = timeLeft / MM_TIMER;

  // ── done ──
  if (mpState.phase === "done") {
    const m = mpState.matches;
    const emoji = m >= 8 ? "🧠" : m >= 5 ? "💙" : m >= 3 ? "😄" : "🤷";
    const msg = m >= 8 ? "Ihr seid ein Geist." : m >= 5 ? "Ihr kennt euch gut." : m >= 3 ? "Solide! Mehr Raki hilft." : "Ihr seid Mysterien füreinander.";
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Games", onBack)}</div>
        <div className="ios-glass-card rounded-[28px] p-6 text-center">
          <p className="text-6xl">{emoji}</p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[#789087]">Übereinstimmung</p>
          <p className="mt-2 text-5xl font-black text-[#0e302e]">{m}<span className="text-2xl text-[#789087]">/{MM_ROUNDS}</span></p>
          <p className="mt-2 font-semibold text-[#5b6f68]">{msg}</p>
          <button className="btn-sheen mt-6 min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={() => setScreen("menu")} type="button">Nochmal</button>
        </div>
      </div>
    );
  }

  // ── tapping ──
  if (mpState.phase === "tapping") {
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">{backBtn("← Games", onBack)}<span className="font-black text-[#789087]">Runde {roundLabel}</span></div>
          <span className={["rounded-full px-3 py-1 text-sm font-black tabular-nums", pct < 0.3 ? "bg-[#fee2e2] text-[#e8344a]" : "bg-[#eff6f2] text-[#125f68]"].join(" ")}>{timeLeft}s</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#d7e3dc]">
          <div className={["h-full rounded-full transition-all duration-300", pct < 0.3 ? "bg-[#e8344a]" : "bg-[#125f68]"].join(" ")} style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="ios-glass-card rounded-[28px] p-5 text-center">
          <span className="text-4xl">{q.emoji}</span>
          <p className="mt-3 text-xl font-black leading-snug text-[#0e302e]">{q.text}</p>
          <p className="mt-1 text-xs font-semibold text-[#789087]">Nicht reden — einfach tippen!</p>
        </div>
        {!myTap ? (
          <div className="grid grid-cols-2 gap-3">
            {(["a", "b"] as const).map((choice) => (
              <button
                key={choice}
                className="ios-glass-card card-interactive min-h-[120px] rounded-[24px] p-5 text-center active:scale-[0.97]"
                onClick={() => void tap(choice)}
                type="button"
              >
                <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#789087]">Option {choice.toUpperCase()}</span>
                <span className="mt-3 block text-xl font-black leading-snug text-[#0e302e]">{choice === "a" ? q.a : q.b}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ios-glass-card rounded-[28px] p-5 text-center">
            <p className="text-2xl">{myTap === "a" ? q.a : q.b}</p>
            <p className="mt-2 text-sm font-semibold text-[#789087]">
              {otherTap ? "✓ Beide getippt — gleich Auflösung …" : `⏳ Warte auf ${otherPlayer} …`}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── reveal ──
  if (mpState.phase === "reveal") {
    const janTap = mpState.taps.Jan;
    const lucaTap = mpState.taps.Luca;
    const matched = janTap && lucaTap && janTap === lucaTap;
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">{backBtn("← Games", onBack)}<span className="font-black text-[#789087]">Runde {roundLabel}</span></div>
          <span className="font-black text-[#125f68]">{mpState.matches} Match{mpState.matches !== 1 ? "es" : ""}</span>
        </div>
        <div className={["rounded-[28px] p-5 text-center", matched ? "bg-[#0e5558] text-white" : "ios-glass-card"].join(" ")}>
          <p className="text-4xl">{matched ? "✅" : "❌"}</p>
          <p className="mt-2 text-2xl font-black">{matched ? "Match!" : "Kein Match"}</p>
          <p className={["mt-1 text-sm font-semibold", matched ? "text-white/70" : "text-[#789087]"].join(" ")}>
            {q.text}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["Jan", "Luca"] as Player[]).map((p) => {
            const t = mpState.taps[p];
            const answer = t === "a" ? q.a : t === "b" ? q.b : "–";
            return (
              <div key={p} className="ios-glass-card rounded-[24px] p-4 text-center">
                <p className="text-xs font-black text-[#789087]">{p}</p>
                <p className="mt-2 text-lg font-black text-[#0e302e]">{answer}</p>
                <p className="text-xs font-semibold text-[#789087]">({t?.toUpperCase() ?? "–"})</p>
              </div>
            );
          })}
        </div>
        {mpRole === "host" ? (
          <button className="btn-sheen min-h-12 w-full rounded-[18px] bg-[#125f68] font-black text-white" onClick={() => void nextRound()} type="button">
            {mpState.round + 1 >= MM_ROUNDS ? "Ergebnis →" : "Nächste Frage →"}
          </button>
        ) : (
          <p className="text-center text-sm font-semibold text-[#789087]">Warte auf Host …</p>
        )}
      </div>
    );
  }

  return null;
}

// ─── IMPROV CHAOS ────────────────────────────────────────────────────────────

interface ChaosScenario {
  text: string;
  options: [string, string, string, string, string, string];
}

const CHAOS_SCENARIOS: ChaosScenario[] = [
  // ── Strand & Meer ──
  {
    text: "Jan fällt beim Schnorcheln auf eine schlafende Meeresschildkröte. Seine Entschuldigung an das Tier?",
    options: [
      "Tut mir leid, ich dachte du wärst ein Stein mit Lebenslauf.",
      "Ich zahl dir einen Frappé, versprochen.",
      "Ich schwöre, ich bin auch nur zufällig hier gelandet.",
      "Das war keine Absicht, das war Physik.",
      "Willst du mit auf einen Kaffee? Ich lade ein.",
      "Ehrlich, du bist tarnfähiger als mein GPS.",
    ],
  },
  {
    text: "Luca hat Olivenöl statt Sonnencreme aufgetragen. Er sieht jetzt aus wie…",
    options: [
      "eine wandelnde Dakos-Platte.",
      "ein Grillhähnchen kurz vor dem Drehspieß.",
      "ein Fischer, der versehentlich in die Fritteuse gefallen ist.",
      "ein Speckstreifen mit Selbstbewusstsein.",
      "die glänzendste Person auf ganz Kreta.",
      "ein Salatdressing mit Beinen.",
    ],
  },
  {
    text: "Ein Kri-Kri klaut Jan direkt das Sandwich aus der Hand. Jans epische Reaktion?",
    options: [
      "Er verhandelt sofort um Rückgabe, auf Deutsch, ganz seriös.",
      "Er ruft 'Das war mein letztes Sandwich, du Verräter!'",
      "Er filmt es für Instagram, statt zu protestieren.",
      "Er erklärt lautstark, dass er jetzt Vegetarier wird.",
      "Er rennt der Ziege einen halben Berg hinterher.",
      "Er applaudiert der Frechheit und gibt ihr einen Namen.",
    ],
  },
  {
    text: "Das Meer hat 28°C, aber Jan behauptet, es sei 'viel zu kalt'. Lucas Diagnose:",
    options: [
      "Jan ist eigentlich ein Reptil mit Wärmebedürfnis.",
      "Klassischer Fall von 'norddeutschen Frostgenen'.",
      "Jan will einfach nicht ins Wasser, Ausreden sind sein Talent.",
      "Sein Körper ist noch auf Ostsee-Modus eingestellt.",
      "Er hat schlicht Angst vor Quallen und nennt es 'kalt'.",
      "Medizinisch gesehen: Jan übertreibt, wie immer.",
    ],
  },
  {
    text: "Luca findet beim Schnorcheln etwas Seltsames am Meeresgrund. Es ist…",
    options: [
      "ein versunkener Flip-Flop mit eigener Geschichte.",
      "eine leere Raki-Flasche von 1987.",
      "ein Kri-Kri-Skelett, das dort definitiv nicht hingehört.",
      "Jans verlorene Sonnenbrille von letztem Jahr.",
      "ein antikes Fragment, das garantiert kein antikes Fragment ist.",
      "eine Nachricht in einer Flasche von einem anderen Touristen.",
    ],
  },
  {
    text: "Jan versucht cool aus dem Meer zu laufen wie in einem Film. Was geht schief?",
    options: [
      "Er tritt auf einen Seeigel und die Coolness ist sofort vorbei.",
      "Die Welle zieht ihm die Badehose runter.",
      "Er stolpert über einen unsichtbaren Stein und fliegt der Länge nach.",
      "Sein Bauch macht die Zeitlupe kaputt.",
      "Er läuft eleganter rückwärts als vorwärts – wortwörtlich.",
      "Ein Kri-Kri schaut zu und lacht als Erstes.",
    ],
  },
  {
    text: "Eine Qualle hat Luca am Fuß erwischt. Jans medizinischer Rat:",
    options: [
      "'Wir googeln das jetzt gemeinsam mit 2% Akku.'",
      "'Pinkel drauf, das hab ich mal im Internet gelesen.'",
      "'Sonnencreme drauf, das hilft garantiert gegen alles.'",
      "'Wir fragen den Kellner, der weiß bestimmt was.'",
      "'Ignorieren und weiterschwimmen, klassische Jan-Medizin.'",
      "'Ich hab Essig im Rucksack, für den Salat eigentlich.'",
    ],
  },
  {
    text: "Jan baut eine Sandburg. Luca beschreibt sie in seiner Tripadvisor-Rezension:",
    options: [
      "'Architektonisch gewagt, strukturell fragwürdig. 3 Sterne.'",
      "'Sieht aus wie Knossos nach einem Erdbeben. 5 Sterne für Ambition.'",
      "'Erste Burg mit eigenem Frappé-Burggraben. Innovativ.'",
      "'Stabilität: 0. Herzblut: 10 von 10.'",
      "'Von der Flut in 4 Minuten zerstört. Wie das echte Knossos.'",
      "'Beeindruckend für jemanden ohne Bauplan und ohne Eimer.'",
    ],
  },
  {
    text: "Jan will unbedingt ein Kri-Kri-Selfie machen und rennt einer Ziege am Klippenrand nach. Was passiert?",
    options: [
      "Die Ziege posiert perfekt, Jan fällt fast von der Klippe.",
      "Er bekommt das beste Foto seines Lebens – von hinten fliehend.",
      "Die Ziege schaut gelangweilt, das Selfie wird zum Meme.",
      "Er verliert dabei seinen Hut und seine Würde.",
      "Luca filmt lieber, statt zu helfen.",
      "Am Ende folgt ihm die Ziege freiwillig – als Fan.",
    ],
  },
  {
    text: "Luca will unbedingt eine Runde Beachvolleyball spielen, findet aber nur zwei 70-jährige Rentner als Gegner. Wie läuft's?",
    options: [
      "Er verliert 21:3, hochkonzentriert und stilvoll gedemütigt.",
      "Die Rentner spielen seit 40 Jahren jeden Sommer hier – hoffnungslos.",
      "Jan kommentiert am Rand lauter als jeder Sportreporter.",
      "Luca zieht sich einen Muskel und gewinnt trotzdem Respekt.",
      "Er bekommt am Ende einen Rentner-Trainingsplan angeboten.",
      "Es endet in einem gemeinsamen Frappé, alle sind Freunde.",
    ],
  },
  {
    text: "Der Strandliegen-Verleiher verlangt für zwei Liegen den Preis eines kleinen Hotelzimmers. Jans Verhandlungsstrategie?",
    options: [
      "Er tut so, als würde er kein Griechisch verstehen – tut er auch nicht.",
      "Er bietet einen Tausch: Foto mit ihm gegen Rabatt.",
      "Er zieht theatralisch ab und setzt sich demonstrativ auf den Sand.",
      "Er zahlt sofort und beschwert sich danach zwei Stunden lang.",
      "Er fragt, ob Ziegen-Gesellschaft im Preis inbegriffen ist.",
      "Er handelt den Preis um genau einen Euro runter – Sieg!",
    ],
  },
  // ── Essen & Trinken ──
  {
    text: "Der Kellner bringt schon den 5. unbestellten Raki. Jans Geheimtaktik?",
    options: [
      "Er nippt nur symbolisch und schiebt den Rest zu Luca.",
      "Er nennt es 'kulturelle Pflicht' und trinkt tapfer weiter.",
      "Er versteckt zwei Gläser hinter dem Salzstreuer.",
      "Er fragt höflich nach einem sechsten, aus Prinzip.",
      "Er gießt heimlich einen ins Blumenbeet.",
      "Er erklärt dem Kellner, er sei 'schon betrunken genug für Urlaub'.",
    ],
  },
  {
    text: "Luca bestellt auf Griechisch, bekommt aber etwas völlig Unerwartetes. Was ist auf dem Teller?",
    options: [
      "Ein ganzer gegrillter Fisch mit Kopf, Augenkontakt inklusive.",
      "Drei Portionen Tzatziki und nichts anderes.",
      "Ein Berg Pommes, obwohl er Fisch bestellt hat.",
      "Ein Dessert, obwohl er nach der Rechnung gefragt hat.",
      "Etwas absolut Unbekanntes, das trotzdem gut schmeckt.",
      "Genau das, was er bestellt hat – zur allgemeinen Überraschung.",
    ],
  },
  {
    text: "Das Restaurant hat nur noch eine Portion Dakos. Wie lösen Jan und Luca den Konflikt?",
    options: [
      "Millimetergenaue Halbierung mit dem Lineal aus Lucas Rucksack.",
      "Schnick-Schnack-Schnut, best of three.",
      "Jan gibt nach, weil Luca 'trauriger guckt'.",
      "Beide bestellen sich stattdessen je eine zweite Portion.",
      "Der Kellner entscheidet einfach willkürlich – Ende der Diskussion.",
      "Sie einigen sich auf 'einer isst, einer fotografiert'.",
    ],
  },
  {
    text: "Der Frappé ist so stark, dass Jan 4 Stunden lang…",
    options: [
      "über den perfekten Sonnenuntergangs-Winkel philosophiert.",
      "erklärt, warum Deutschland den Kaffee falsch macht.",
      "nicht mehr blinzelt, aber ununterbrochen redet.",
      "einen komplett neuen Reiseplan für morgen entwirft.",
      "Luca Fakten über Kri-Kri-Ziegen vorliest.",
      "wach ist, obwohl er eigentlich schlafen wollte.",
    ],
  },
  {
    text: "Luca isst versehentlich einen rohen Oktopustentakel. Seine 5-Sterne-Bewertung: 'Köstlich, weil…'",
    options: [
      "'…er sich gewehrt hat und ich trotzdem gewonnen habe.'",
      "'…Textur ist Geschmackssache, aber Mut zählt auch.'",
      "'…ich jetzt offiziell ein Kreta-Local bin.'",
      "'…es schlimmer aussah, als es schmeckte.'",
      "'…Jan hätte sich nie getraut.'",
      "'…manche Dinge muss man einfach einmal im Leben tun.'",
    ],
  },
  {
    text: "Der Wirt schenkt selbstgebrannten Raki ein. Das Glas dampft. Jan sagt:",
    options: [
      "'Das ist kein Getränk, das ist eine Herausforderung.'",
      "'Ich glaube, das ist illegal in mindestens drei Ländern.'",
      "'Prost – falls ich morgen noch lebe.'",
      "'Meine Kehle hat gerade um Asyl gebeten.'",
      "'Endlich ein Getränk mit Charakter.'",
      "'Luca, du bist zuerst dran.'",
    ],
  },
  {
    text: "Eine Ziege sitzt in der Taverna am Nebentisch und bestellt sich…",
    options: [
      "die Speisekarte selbst, gleich zum Verzehr.",
      "einen Frappé, schwarz, ohne Zucker.",
      "Jans halb gegessenes Brot, ohne zu fragen.",
      "die Tischdecke als Vorspeise.",
      "einen Platz mit Meerblick, wie alle anderen auch.",
      "nichts – sie wartet einfach auf Resteessen.",
    ],
  },
  {
    text: "Jan versucht 'Rechnung bitte' auf Griechisch. Was kommt raus?",
    options: [
      "Etwas, das eher wie eine Bestellung für Nachtisch klingt.",
      "Ein Satz, den der Kellner höflich, aber verwirrt beantwortet.",
      "Zufällig korrektes Griechisch – zum ersten Mal überhaupt.",
      "Ein Mix aus Englisch, Deutsch und Verzweiflung.",
      "Etwas, das eine Ziege zum Lachen bringt, ehrlich.",
      "'Logariasmo', laut und mit viel zu viel Selbstvertrauen.",
    ],
  },
  {
    text: "Luca erklärt dem Wirt seine Allergien auf Griechisch. Das Ergebnis:",
    options: [
      "Er bekommt trotzdem Nüsse, aus Höflichkeit obendrauf.",
      "Der Wirt versteht 'Allergie' als 'besonders viel bitte'.",
      "Es funktioniert überraschend gut, Applaus von Jan.",
      "Er bekommt ein Gericht ganz ohne alles – nur Brot.",
      "Am Ende bestellt Jan lieber gleich für ihn mit.",
      "Der Wirt bringt sicherheitshalber alles auf einmal, ohne Allergene, gemischt.",
    ],
  },
  {
    text: "Der Gyros schmeckt so gut, dass Jan eine Liebeserklärung schreibt. Sie geht:",
    options: [
      "'Liebes Gyros, du hast mein Herz und meinen Magen erobert.'",
      "'Ich werde nie wieder Döner zuhause genauso lieben.'",
      "'Du bist der Grund, warum ich diesen Urlaub nie vergesse.'",
      "'Kreta, ich bleibe – wegen dir, Gyros.'",
      "'Luca, teile das hier nicht, das ist nur für mich.'",
      "'Du hast mich verändert. Zum Besseren. Und Fettigeren.'",
    ],
  },
  {
    text: "Jan will unbedingt 'authentisch' essen und landet in einer Taverna, die eigentlich nur für Einheimische ist. Was passiert?",
    options: [
      "Er wird sofort als Tourist entlarvt, bekommt aber trotzdem das beste Essen seines Lebens.",
      "Der Wirt serviert ihm etwas, das nicht auf der Karte steht – aus Mitleid.",
      "Er versteht kein Wort, nickt aber bei allem enthusiastisch.",
      "Am Ende wird er von der ganzen Taverna adoptiert.",
      "Er bekommt einen Ehrenplatz, weil er als Erster 'Yamas' richtig ausspricht.",
      "Luca bleibt draußen und fotografiert die Szene durchs Fenster.",
    ],
  },
  {
    text: "Luca probiert zum ersten Mal Raki-Sorbet als Nachtisch. Seine Gesichtsentgleisung wird zum Insider-Witz der Reise.",
    options: [
      "Sein Gesicht macht drei verschiedene Emotionen in zwei Sekunden.",
      "Er lobt es laut, während seine Augen tränen.",
      "Jan filmt in Zeitlupe, für die Ewigkeit.",
      "Er bestellt sofort noch eins, aus reinem Trotz.",
      "Er erklärt, das sei 'ein Erlebnis, kein Dessert'.",
      "Die Ziege am Nebentisch guckt mitfühlender als jeder Mensch.",
    ],
  },
  {
    text: "Jan entdeckt, dass 'Choriatiki' einfach griechischer Salat heißt – nach drei Tagen, in denen er ihn ständig bestellt hat, ohne es zu wissen.",
    options: [
      "Er ist erleichtert und peinlich berührt gleichzeitig.",
      "Er bestellt ihn trotzdem weiter, aber jetzt mit Absicht.",
      "Er erklärt es Luca so, als hätte er es schon immer gewusst.",
      "Er beschließt, ab jetzt jedes Wort vorher zu googeln.",
      "Luca lacht fünf Minuten ohne Unterbrechung.",
      "Er nennt sich fortan 'Choriatiki-Experte'.",
    ],
  },
  // ── Transport & Navigation ──
  {
    text: "Das Mietauto hat keine Klimaanlage, 43°C. Die Jahrhunderterfindung von Jan und Luca?",
    options: [
      "Eine improvisierte Kühlung aus nassen T-Shirts vor dem Gebläse.",
      "Fenster runter, Kopf raus, wie ein Hund – Würde optional.",
      "Ein Eiswürfel-Vorrat, strategisch auf dem Armaturenbrett verteilt.",
      "Abwechselndes Anhalten an jedem schattigen Fleck der Insel.",
      "Die 'Panik-Fächer-Technik' mit Landkarten aus dem Handschuhfach.",
      "Einfach akzeptieren und schwitzend weiterfahren, stoisch wie Philosophen.",
    ],
  },
  {
    text: "Jan navigiert, Luca fährt. Eine Schafherde blockiert komplett die Straße. Jans Lösung?",
    options: [
      "Aussteigen und die Schafe höflich um Erlaubnis bitten.",
      "Hupen im Morsecode, in der Hoffnung auf Verständigung.",
      "Warten, Fotos machen, das Beste aus der Situation machen.",
      "Ein Schaf zum neuen Reisebegleiter erklären.",
      "Rückwärts fahren und die Route komplett neu planen.",
      "Aussteigen und die Herde wie ein Hirte dirigieren – erfolglos.",
    ],
  },
  {
    text: "Die letzte Fähre ist ohne sie abgefahren. Ihr epischer Notfallplan für die Nacht in Sfakia?",
    options: [
      "Am Strand schlafen und es 'Abenteuer' statt 'Panne' nennen.",
      "Ein Fischer wird spontan zum neuen besten Freund und Gastgeber.",
      "Sie mieten das letzte freie Zimmer im Dorf, teuer, aber egal.",
      "Sie campen improvisiert mit dem Autositz als Bett.",
      "Sie verhandeln mit dem Kapitän der nächsten Fähre um einen Sonderplatz.",
      "Sie beschließen, Sfakia gefällt ihnen sowieso besser als geplant.",
    ],
  },
  {
    text: "Luca parkt das Auto auf sehr kreative Weise. Jan beschreibt den Parkvorgang:",
    options: [
      "'Das war weniger Parken, mehr eine Verhandlung mit dem Bordstein.'",
      "'Picasso hätte das nicht besser hingekriegt.'",
      "'Drei Versuche, ein Ergebnis, null Erklärung.'",
      "'Technisch gesehen steht das Auto. Ästhetisch gesehen: eine Katastrophe.'",
      "'Ich hab aufgehört zu zählen, wie viele Grad das Auto zur Straße steht.'",
      "'Das nennt man wohl freies Parken – im wörtlichsten Sinne.'",
    ],
  },
  {
    text: "Jans Mietrad hat keine Bremsen mehr. Was schreit er bergab?",
    options: [
      "'ICH HAB KEINEN PLAN, ABER VIEL TEMPO!'",
      "'LUCA, RUF WEN AN, ICH WEISS NICHT WEN!'",
      "'DAS IST JETZT MEIN LEBEN, NICHT MEHR MEIN URLAUB!'",
      "'BREMSEN SIND SOWIESO ÜBERBEWERTET!'",
      "'ICH GLAUB, ICH HAB GERADE EINEN NEUEN REKORD AUFGESTELLT!'",
      "'WENN ICH DAS ÜBERLEBE, WILL ICH POMMES!'",
    ],
  },
  {
    text: "Jan und Luca sind seit 2 Stunden auf einer Straße, die laut Maps gar nicht existiert. Luca sagt:",
    options: [
      "'Vielleicht sind wir gerade die Ersten, die diese Straße entdecken.'",
      "'Ich glaube, Maps hat aufgegeben, bevor wir es getan haben.'",
      "'Offiziell verloren, unoffiziell auf Abenteuer.'",
      "'Das Handy zeigt jetzt einfach nur noch ein Fragezeichen.'",
      "'Wir sind jetzt Kartografen, ob wir wollen oder nicht.'",
      "'Ich schlage vor, wir nennen diese Straße nach uns.'",
    ],
  },
  {
    text: "Das Mietmoped stirbt genau auf dem Gipfelpass. Jan und Luca verhandeln mit…",
    options: [
      "einem vorbeifahrenden Schäfer, der zufällig Werkzeug dabei hat.",
      "dem Moped selbst, per Anschreien und Anflehen.",
      "Google Translate, das leider auch keine Ahnung von Mopeds hat.",
      "ihrem letzten Handyakku, um Hilfe zu rufen.",
      "einem Reisebus voller Touristen, die alle mitfilmen.",
      "der Schwerkraft, die leider nicht auf ihrer Seite steht.",
    ],
  },
  {
    text: "Das Navi führt Jan und Luca über einen Feldweg, der eigentlich für Traktoren gedacht ist. Ihr Auto hat Tiefgang wie ein Sportwagen.",
    options: [
      "Sie fahren trotzdem weiter, aus reinem Optimismus.",
      "Sie steigen aus und schieben das Auto den Rest des Wegs.",
      "Ein Bauer beobachtet sie amüsiert von Weitem, ohne zu helfen.",
      "Jan besteht darauf, dass 'das Navi schon wissen wird, was es tut'.",
      "Sie erreichen ihr Ziel – mit einem Kratzer als Souvenir.",
      "Luca schwört, nie wieder blind dem Navi zu vertrauen.",
    ],
  },
  {
    text: "Der Bus nach Chania kommt eine Stunde zu spät, ohne Ankündigung, ohne Erklärung. Wie reagieren Jan und Luca?",
    options: [
      "Sie akzeptieren es mit stoischer Gelassenheit – 'Kreta-Zeit' halt.",
      "Jan zählt jede Minute laut mit, aus Prinzip.",
      "Luca nutzt die Zeit für ein spontanes Nickerchen im Schatten.",
      "Sie freunden sich mit drei anderen wartenden Touristen an.",
      "Jan versucht, den Busfahrer telepathisch herzurufen.",
      "Sie beschließen, notfalls zu Fuß zu gehen – bis der Bus kommt.",
    ],
  },
  {
    text: "Auf dem Roller-Verleih fragt der Vermieter, ob sie Erfahrung haben. Jans ehrliche Antwort wäre 'nein', seine tatsächliche Antwort ist…",
    options: [
      "'Klar, total erfahren' – mit sehr wackliger Stimme.",
      "Ein zu selbstbewusstes Nicken, das niemanden überzeugt.",
      "'Luca fährt eigentlich besser als ich' – Verantwortung abgeschoben.",
      "Eine lange Pause, gefolgt von 'wie schwer kann das sein'.",
      "'Ich hab mal ein Fahrrad gehabt' – als Qualifikation.",
      "Ein überzeugtes 'Ja', während er den Helm falsch aufsetzt.",
    ],
  },
  // ── Hotel & Alltag ──
  {
    text: "Die Klimaanlage klingt wie ein sterbender Esel auf einem Schiff. Lucas Einschlaf-Trick?",
    options: [
      "Kopfhörer, laute Musik, und die Hoffnung auf Erschöpfung.",
      "Er redet sich ein, es sei 'entspannendes Meeresrauschen'.",
      "Er zählt die Geräusche wie Schafe, bis er einschläft.",
      "Er schläft im Bad, dort ist es leiser.",
      "Er nennt die Klimaanlage 'Esel' und macht Frieden mit ihr.",
      "Er schaltet sie einfach aus und schwitzt mit Würde.",
    ],
  },
  {
    text: "Jan entdeckt eine Eidechse im Badezimmer und benennt sie sofort. Name und Lebensgeschichte?",
    options: [
      "'Dimitri', ein pensionierter Fliesenleger im Unruhestand.",
      "'Frappé', weil sie so schnell und nervös wirkt.",
      "'Kostas', der heimliche Hotelmanager seit drei Generationen.",
      "'Eddy', der eigentlich lieber am Strand wäre als hier.",
      "'Zoe', die philosophische Beobachterin des Badezimmers.",
      "'Niko', der jede Nacht Jans Zahnbürste bewacht.",
    ],
  },
  {
    text: "Das Hotel-Bett ist so hart, dass Jan morgens…",
    options: [
      "sich fühlt wie nach einer Nacht auf dem Steinboden von Knossos.",
      "aufsteht und erstmal überprüft, ob alle Knochen noch da sind.",
      "beschließt, das nächste Bett wird gebucht, nicht gehofft.",
      "Luca fragt, ob er auch 'wie ein Brett' geschlafen hat.",
      "eine neue Yogaübung entwickelt, nur um wieder gerade zu stehen.",
      "sich vornimmt, ab jetzt am Boden zu schlafen, freiwillig.",
    ],
  },
  {
    text: "Die Dusche hat zwei Temperaturen: Magma und Antarktis. Luca entwickelt eine Technik:",
    options: [
      "Blitzschnelles Rein-Waschen-Raus, bevor sich was ändert.",
      "Den Hahn im Zehntelgrad-Bereich mit chirurgischer Präzision drehen.",
      "Duschen mit Badeschlappen an, für den Notfall-Sprung raus.",
      "Kalt duschen und es 'Wellness' nennen.",
      "Die Tür offen lassen für schnelle Flucht bei Magma-Stufe.",
      "Ein Gebet vor jedem Wasserhahn-Dreh.",
    ],
  },
  {
    text: "Der Vermieter kommt morgens unangekündigt vorbei. Jan ist noch im Schlaf. Luca erklärt:",
    options: [
      "'Er ist... kulturell noch nicht angekommen, aber körperlich schon.'",
      "'Das ist normal, er braucht Frappé-Infusion vor jedem Kontakt.'",
      "'Ignorieren Sie das Schnarchen, das ist sein Urlaubsmodus.'",
      "'Er testet gerade, wie hart das Bett wirklich ist. Wissenschaftlich.'",
      "'Geben Sie ihm zehn Minuten, dann ist er ein Mensch.'",
      "'Er übt für den Winterschlaf, den er nie hatte.'",
    ],
  },
  {
    text: "Das WLAN funktioniert nur, wenn man auf dem Balkon steht, mit einem Bein auf der Balustrade und dem Handy in Richtung Meer hält. Jans Reaktion?",
    options: [
      "Er hält diese Pose zwanzig Minuten lang, aus Prinzip.",
      "Er erklärt es als 'digitale Meditation'.",
      "Er filmt ein Tutorial für zukünftige Hotelgäste.",
      "Er gibt auf und lebt eine Stunde offline – panisch.",
      "Er nennt es 'das teuerste Balancespiel seines Lebens'.",
      "Luca macht ein Foto davon, ohne zu helfen.",
    ],
  },
  {
    text: "Das Zimmermädchen faltet jeden Morgen Jans wild verstreute Klamotten zu perfekten Quadraten. Jan ist beeindruckt und beschämt gleichzeitig.",
    options: [
      "Er versucht es nachzumachen und scheitert kläglich.",
      "Er lässt absichtlich mehr Chaos liegen, aus Neugier.",
      "Er schreibt eine Dankesnotiz auf Griechisch – mit Google Translate.",
      "Er beschließt, zuhause nie wieder aufzuräumen, das macht ja eh jemand.",
      "Er nennt sie insgeheim 'die Meisterin des Chaos-Managements'.",
      "Er versteckt Trinkgeld in jeder gefalteten Ecke.",
    ],
  },
  {
    text: "Der Fahrstuhl im Hotel hat eine Kapazität von 'zwei Personen', aber Jan und Luca plus Gepäck sind eindeutig mehr Masse als das.",
    options: [
      "Sie quetschen sich trotzdem hinein, Würde inklusive.",
      "Jan opfert sich und nimmt die Treppe, mit theatralischem Seufzen.",
      "Sie schicken erst das Gepäck hoch, dann sich selbst.",
      "Der Fahrstuhl bleibt stecken, natürlich genau zwischen zwei Stockwerken.",
      "Sie einigen sich auf zwei Fahrten – nach zehn Minuten Diskussion.",
      "Luca fragt sich laut, ob der Fahrstuhl auch schon Urlaub hat.",
    ],
  },
  // ── Kulturelles ──
  {
    text: "Jan lernt Griechisch und sagt dem alten Mann im Café versehentlich etwas über Ziegen. Der Mann:",
    options: [
      "lacht drei Minuten und erzählt es der ganzen Taverna weiter.",
      "nickt ernst, als wäre es die normalste Aussage der Welt.",
      "korrigiert ihn geduldig – und lacht dann doch.",
      "bestellt ihm aus Respekt einen Raki.",
      "erklärt Jan, dass er jetzt 'Ziegenversteher' genannt wird.",
      "winkt Luca herbei, um die Geschichte auch zu hören.",
    ],
  },
  {
    text: "Luca kauft das kretischste Souvenir der Welt. Es ist…",
    options: [
      "eine Miniatur-Ziege mit Sonnenbrille.",
      "ein T-Shirt mit einem Spruch, den er nicht ganz übersetzen kann.",
      "Olivenöl in einer Flasche, größer als sein Koffer.",
      "ein handgeschnitzter Holzlöffel, für Zwecke, die unklar bleiben.",
      "eine Postkarte, die er sich selbst nach Hause schickt.",
      "ein Magnet mit Knossos, obwohl er nie dort war.",
    ],
  },
  {
    text: "Beim Knossos-Besuch behauptet Jan, er sei in einem früheren Leben… gewesen.",
    options: [
      "ein minoischer Stierläufer mit Bühnenangst.",
      "der Palastarchitekt, der den Grundriss absichtlich verkompliziert hat.",
      "eine der Fresken – deshalb die ständige Pose.",
      "König Minos' persönlicher Frappé-Zubereiter.",
      "das Labyrinth selbst, deshalb verläuft er sich immer.",
      "ein Tourist von vor 3000 Jahren – auch damals verlaufen.",
    ],
  },
  {
    text: "Der Reiseführer erklärt die Minoer. Lucas Frage ist so absurd, dass die Gruppe…",
    options: [
      "erst verwirrt schaut, dann in Gelächter ausbricht.",
      "applaudiert, weil niemand traute, dasselbe zu fragen.",
      "den Reiseführer bittet, die Frage nochmal zu wiederholen.",
      "Fotos von Lucas Gesicht macht statt von den Ruinen.",
      "eine Diskussion beginnt, die 20 Minuten dauert.",
      "Jan bittet, so zu tun, als kenne er Luca nicht.",
    ],
  },
  {
    text: "Jan macht ein Selfie vor dem venezianischen Hafen. Der perfekte Instagram-Caption?",
    options: [
      "'Venedig hat's cool, aber Kreta hat's cooler. 🇬🇷'",
      "'400 Jahre Geschichte, 4 Sekunden Selfie-Timing.'",
      "'Ich und mein neuer Lieblingshafen, keine Fragen.'",
      "'POV: Ich lebe eigentlich hier, glaub mir einfach.'",
      "'Weniger Gondel, mehr Frappé. Bessere Wahl.'",
      "'Filter unnötig, Kreta liefert von selbst.'",
    ],
  },
  {
    text: "Luca betritt eine Kirche aus Versehen in Badeshorts. Die Reaktion der Ortsbewohner:",
    options: [
      "Ein wortloser, aber deutlicher Blick, der alles sagt.",
      "Jemand reicht ihm freundlich, aber bestimmt, ein Tuch.",
      "Ein leises Kopfschütteln, gefolgt von einem Lächeln.",
      "Kompletter Respekt für den Mut, trotz Fehlgriff.",
      "Ein älterer Herr erklärt geduldig die Kleiderordnung.",
      "Er wird höflich, aber zügig zur Tür begleitet.",
    ],
  },
  {
    text: "Bei einem Dorffest werden Jan und Luca spontan zum Tanzen aufgefordert – ein traditioneller kretischer Kreis-Tanz, den keiner von beiden kennt.",
    options: [
      "Jan improvisiert mit Bewegungen, die eher an Turnen erinnern.",
      "Luca folgt einfach dem Bewegungsmuster des Nachbarn, meistens falsch.",
      "Beide werden am Ende trotzdem gefeiert wie Profis.",
      "Ein Kind erklärt ihnen die Schritte besser als jeder Erwachsene.",
      "Sie landen versehentlich in der falschen Richtung – als einzige.",
      "Am Ende bekommen sie Applaus, einfach für die Anstrengung.",
    ],
  },
  {
    text: "Jan versucht, die kretische Lyra zu spielen, nachdem ihm ein Musiker sie kurz in die Hand gedrückt hat.",
    options: [
      "Das Ergebnis klingt wie eine Katze, die eine Treppe runterfällt.",
      "Der Musiker nimmt sie ihm sanft, aber schnell wieder ab.",
      "Jan behauptet danach, 'musikalisch begabt, nur untrainiert' zu sein.",
      "Luca filmt es heimlich für die Ewigkeit.",
      "Ein Kind lacht lauter als alle Erwachsenen zusammen.",
      "Jan verlangt eine zweite Chance – wird höflich abgelehnt.",
    ],
  },
  {
    text: "Ein Ortsansässiger erklärt Jan und Luca den Unterschied zwischen 'echtem' und 'Touristen'-Tzatziki. Die Erklärung dauert 20 Minuten.",
    options: [
      "Sie verstehen am Ende weniger als am Anfang.",
      "Jan nickt die ganze Zeit, ohne wirklich zu folgen.",
      "Luca stellt eine Rückfrage, die alles noch komplizierter macht.",
      "Sie bekommen zum Abschluss eine kleine Extraportion – als Belohnung.",
      "Der Mann erklärt es ein zweites Mal, mit noch mehr Leidenschaft.",
      "Sie beschließen, ab jetzt einfach alles 'echt' zu nennen.",
    ],
  },
  // ── Sport & Abenteuer ──
  {
    text: "Samaria-Schlucht, km 13, 39°C. Jan will aufgeben. Lucas Motivationsrede?",
    options: [
      "'Denk an den Frappé, der am Ende wartet.'",
      "'Wir sind schon zu weit, um jetzt aufzugeben. Physisch und mental.'",
      "'Eine Ziege hat das grad geschafft. Wir schaffen das auch.'",
      "'Noch drei Kilometer, dann Meer, Bier, Ruhm.'",
      "'Ich trag dich notfalls, aber lieber gehst du selbst.'",
      "'Stell dir vor, wie das auf Instagram aussieht – motiviert dich das nicht?'",
    ],
  },
  {
    text: "Luca will von einer 7-Meter-Klippe springen. Sein innerer Monolog kurz vor dem Absprung?",
    options: [
      "'Das war eine schlechte Idee, aber jetzt gibt's kein Zurück.'",
      "'Jan filmt das bestimmt, also muss es gut aussehen.'",
      "'Warum hab ich zugestimmt, warum, WARUM.'",
      "'Nach diesem Sprung bin ich offiziell mutig. Endlich.'",
      "'Ich hätte vorher checken sollen, wie tief das Wasser ist.'",
      "'Drei, zwei, eins – zu spät für Zweifel.'",
    ],
  },
  {
    text: "Jan und Luca mieten Kajaks. Nach 10 Minuten dreht sich Jans Kajak nur noch im Kreis. Luca erklärt:",
    options: [
      "'Du paddelst nur auf einer Seite, das ist keine Physik, das ist du.'",
      "'Das Kajak macht, was du ihm sagst – und du sagst 'Kreis'.'",
      "'Ich glaub, du hast das Paddel falsch rum.'",
      "'Das ist keine Panne, das ist ein Kunststil.'",
      "'Vielleicht will das Kajak einfach zurück zum Strand.'",
      "'Ehrlich, das ist die lustigste Sache, die ich heute gesehen habe.'",
    ],
  },
  {
    text: "Luca versucht Windsurfen. Das Segel ist dreimal so groß wie er. Was schreit er zu Jan?",
    options: [
      "'DAS SEGEL FÄHRT MICH, NICHT ANDERSRUM!'",
      "'ICH HAB KEINE KONTROLLE UND DAS IST OFFENSICHTLICH!'",
      "'MACH EIN FOTO, DAS IST HISTORISCH, AUF JEDEN FALL PEINLICH!'",
      "'ICH GLAUB, DAS SEGEL HAT EINEN EIGENEN WILLEN!'",
      "'HILFE, ABER AUCH: DAS IST IRGENDWIE LUSTIG!'",
      "'ICH KOMM ZURÜCK, IRGENDWANN, IRGENDWIE!'",
    ],
  },
  {
    text: "Jan beschließt bei der Begegnung mit echten Kri-Kri-Bergziegen, eine davon…",
    options: [
      "zum inoffiziellen Wandermaskottchen zu ernennen.",
      "mit dem letzten Stück Brot zu bestechen, für ein Foto.",
      "als 'ruhiger und entschlossener als ich' zu bezeichnen.",
      "zu fragen, ob sie den Weg besser kennt als Google Maps.",
      "in Gedanken zu adoptieren, für den Rest der Reise.",
      "als neuen persönlichen Helden zu erklären.",
    ],
  },
  {
    text: "Jan und Luca versuchen sich an Stand-up-Paddling. Nach fünf Minuten liegen beide öfter im Wasser als auf dem Board.",
    options: [
      "Sie erklären es zu 'freiwilligem Schwimmtraining'.",
      "Jan behauptet, das Gleichgewicht sei 'einfach nicht heute'.",
      "Ein vorbeifahrendes Boot applaudiert ironisch.",
      "Luca findet endlich seinen Rhythmus – nach dem zehnten Sturz.",
      "Sie beschließen, dass Sitzen auf dem Board auch eine Technik ist.",
      "Am Ende sind sie stolzer auf das Scheitern als auf jeden Erfolg.",
    ],
  },
  {
    text: "Beim Klettern an einer Felswand entdeckt Jan auf halber Höhe, dass er Höhenangst hat – zum ersten Mal in seinem Leben.",
    options: [
      "Er klammert sich fest und verkündet, 'hier oben zu wohnen'.",
      "Luca motiviert ihn mit Versprechen auf Essen unten am Boden.",
      "Er entwickelt spontan eine neue Klettertechnik: gar nicht bewegen.",
      "Er schafft es runter, rückwärts, mit geschlossenen Augen.",
      "Er erklärt danach, das sei 'nur ein kurzer Moment der Reflexion' gewesen.",
      "Er schwört, nie wieder – bis zur nächsten Felswand.",
    ],
  },
  {
    text: "Luca will unbedingt tauchen gehen, hat aber noch nie einen Tauchkurs gemacht. Der Instructor erklärt alles auf Englisch mit starkem Akzent.",
    options: [
      "Luca versteht die Hälfte und nickt bei allem.",
      "Er unterschreibt Formulare, ohne genau zu wissen, was drinsteht.",
      "Er fragt Jan zur Übersetzung – der versteht es auch nicht.",
      "Am Ende taucht er trotzdem, überraschend erfolgreich.",
      "Er kommt mit einem Fisch-Foto zurück, das aussieht wie ein Fleck.",
      "Er erklärt sich danach zum 'zertifizierten Autodidakten'.",
    ],
  },
  {
    text: "Jan will einen Berg besteigen, 'nur zum Sonnenaufgang', unterschätzt aber komplett, wie früh das bedeutet aufzustehen.",
    options: [
      "Er kommt eine Stunde zu spät zum Treffpunkt – verschlafen.",
      "Er besteht darauf, es sei 'trotzdem der Sonnenaufgang' gewesen.",
      "Luca macht das Foto ohne ihn, aus Prinzip.",
      "Sie erreichen den Gipfel gerade rechtzeitig für den Mittag.",
      "Jan nennt es fortan 'den Sonnenmittagsaufgang'.",
      "Er schwört beim nächsten Mal, drei Wecker zu stellen – glaubt keiner.",
    ],
  },
  // ── Zu zweit ──
  {
    text: "Jan und Luca streiten 45 Minuten darüber, wo sie Mittag essen. Die finale Einigung heißt:",
    options: [
      "Münzwurf, weil rationale Argumente versagt haben.",
      "Beide gehen getrennt essen und treffen sich danach wieder.",
      "Der erste Ort, den beide gleichzeitig sehen – egal welcher.",
      "Das Restaurant mit dem lautesten Werbeschild gewinnt.",
      "Sie fragen einen völlig Fremden nach seiner Meinung.",
      "Sie einigen sich auf 'irgendwas mit Fleisch', endlich Frieden.",
    ],
  },
  {
    text: "Es gibt nur eine gute Strandliege. Jan und Luca einigen sich auf System:",
    options: [
      "Wechsel alle 30 Minuten, mit Handy-Timer überwacht.",
      "Wer zuerst aufwacht, darf sie – ehrenwörtlich.",
      "Beide teilen sich die Liege, unbequem, aber gerecht.",
      "Schere-Stein-Papier, best of five, sehr ernst genommen.",
      "Der, der mehr Sonnenbrand hat, bekommt Vorrang.",
      "Sie kaufen sich eine zweite Liege, Problem gelöst.",
    ],
  },
  {
    text: "Luca schläft bis 12. Jan hat seitdem: 3 Wanderungen, 2 Frühstücke, und…",
    options: [
      "einen kompletten neuen Reiseplan für die nächsten drei Tage.",
      "eine tiefe Freundschaft mit dem Hotelbesitzer geschlossen.",
      "das gesamte Dorf zu Fuß erkundet, allein.",
      "genug Fotos gemacht für ein ganzes Fotobuch.",
      "sich bereits gelangweilt und wieder zurückgeschlafen.",
      "eine Liste von Dingen erstellt, die Luca verpasst hat.",
    ],
  },
  {
    text: "Jan fotografiert ALLES. Tag 1: 847 Fotos. 340 davon zeigen ausschließlich…",
    options: [
      "seinen eigenen Schatten in verschiedenen Lichtverhältnissen.",
      "das Essen, bevor es kalt oder gegessen wird.",
      "Luca, der genervt in die Kamera schaut.",
      "denselben Sonnenuntergang aus fast identischem Winkel.",
      "Kri-Kri-Ziegen, aus jeder erdenklichen Entfernung.",
      "sein eigenes Gesicht, aus Versehen, weil er die Kamera falsch hielt.",
    ],
  },
  {
    text: "Lucas Sonnenbrand ist so spektakulär, dass Jan ihn beschreibt als…",
    options: [
      "einen wandelnden Feuermelder.",
      "die menschliche Version einer Ampel auf Rot.",
      "'lebendes Warnschild für zu wenig Sonnencreme'.",
      "eine Hommage an die griechische Flagge, nur ohne Blau.",
      "die schmerzhafteste Art, braun zu werden.",
      "'ein Kunstwerk aus schlechten Entscheidungen'.",
    ],
  },
  {
    text: "Jan und Luca bei 40°C auf der Dachterrasse. Jans Lebensweisheit Nr. 3:",
    options: [
      "'Schwitzen ist einfach Weinen aus jeder Pore, positiv gesehen.'",
      "'Wenn man nicht mehr schwitzen kann, ist man eins mit der Hitze.'",
      "'Eiswürfel sind das neue Gold dieser Reise.'",
      "'Schatten ist ein Luxusgut, das man verdienen muss.'",
      "'Kreta zeigt dir, dass du eigentlich flüssig bist.'",
      "'Die Hitze lehrt Geduld. Oder zumindest Stillstand.'",
    ],
  },
  {
    text: "Luca hat das Tagesbudget für Tag 1 bereits aufgebraucht. Sein Alibi?",
    options: [
      "'Das war Investition, nicht Ausgabe. Für die Erfahrung.'",
      "'Ich hab für uns beide vorgesorgt, quasi.'",
      "'Das Budget war eher eine grobe Richtlinie, oder?'",
      "'Ich kalkuliere einfach in Urlaubs-Zeit, nicht in Euro.'",
      "'Frag mich morgen, heute will ich das nicht wissen.'",
      "'Souvenirs zählen doch nicht wirklich als Ausgabe, oder?'",
    ],
  },
  {
    text: "Jan will um 5:30 für den Sonnenaufgang aufstehen. Lucas Gegenvorschlag?",
    options: [
      "'Wir schauen ihn uns auf Fotos an, im Bett, um 10.'",
      "'Ich komme mit, aber nur im Schlafanzug.'",
      "'Wie wär's mit dem Sonnenuntergang stattdessen? Gleiche Sonne, bessere Zeit.'",
      "'Ich schließe die Augen und stell mir das vor. Das reicht.'",
      "'Nur wenn du mir versprichst, danach nochmal zu schlafen.'",
      "'Lass uns kompromittieren: 8 Uhr und ein später Sonnenaufgang.'",
    ],
  },
  {
    text: "Luca vermisst sein Handtuch. Drei Stunden später stellt sich raus: Es war die ganze Zeit…",
    options: [
      "in seinem eigenen Rucksack, ganz unten.",
      "um seinen Kopf gewickelt, als improvisierter Sonnenschutz.",
      "im Auto, unter dem Beifahrersitz.",
      "bei Jan, der es 'nur ausgeliehen' hatte.",
      "als Tischdecke bei ihrem Picknick benutzt.",
      "auf der Leine, wo er es selbst aufgehängt hatte.",
    ],
  },
  {
    text: "Jan kauft ein lokales Mitbringsel für seine Familie. Zuhause angekommen ist es…",
    options: [
      "kaputt, weil er es im Koffer falsch verstaut hat.",
      "genau das, was sein Vater seit Jahren sammelt – reiner Zufall.",
      "eigentlich für ihn selbst, nicht für die Familie – ehrlich gesagt.",
      "größer als erwartet und passt in keinen Schrank.",
      "ein völliges Missverständnis der eigentlichen Nutzung.",
      "der Grund für eine ganze Familienfeier-Anekdote.",
    ],
  },
  {
    text: "Jan und Luca machen ein 'ehrliches' Reise-Ranking: wer hat mehr genervt? Die Diskussion eskaliert liebevoll.",
    options: [
      "Beide geben zu, ungefähr gleich anstrengend gewesen zu sein.",
      "Jan bringt eine PowerPoint-artige Argumentation mit.",
      "Luca kontert mit konkreten Beispielen, aus dem Gedächtnis.",
      "Sie einigen sich auf ein Unentschieden, aus Höflichkeit.",
      "Es endet in Gelächter, weil beide Recht haben.",
      "Sie beschließen, das nächste Mal Punkte zu vergeben.",
    ],
  },
  {
    text: "Beim gemeinsamen Kofferpacken für die Heimreise passt plötzlich nichts mehr rein, was noch am Anfang locker Platz hatte.",
    options: [
      "Sie setzen sich abwechselnd auf den Koffer, mit Erfolg.",
      "Jan schlägt vor, einfach mehr Kleidung anzuziehen, statt zu packen.",
      "Luca opfert ein Souvenir für den Weltfrieden im Koffer.",
      "Sie verteilen Gewicht heimlich auf das Handgepäck des anderen.",
      "Am Ende bleibt trotzdem ein Schuh zurück – Opfer der Logistik.",
      "Sie schwören, beim nächsten Mal 'nur das Nötigste' zu packen.",
    ],
  },
  {
    text: "Jan und Luca vergleichen ihre Sonnenbrand-Grade wie Trophäen. Wer 'gewinnt', hat eigentlich verloren.",
    options: [
      "Jan zeigt stolz eine Handabdruck-Form auf dem Rücken.",
      "Luca kontert mit einem perfekten T-Shirt-Abdruck.",
      "Sie einigen sich, dass beide 'ziemlich dumm' waren.",
      "Ein Fremder am Nebentisch mischt sich mit noch schlimmerem Sonnenbrand ein.",
      "Sie beschließen, ab morgen wirklich Sonnencreme zu benutzen – versprochen.",
      "Es wird trotzdem als 'Urlaubserinnerung fürs Leben' verbucht.",
    ],
  },
  // ── Absurd & Wild ──
  {
    text: "Ein Kri-Kri wird das inoffizielle Maskottchen der Reise. Sein Name und sein größter Traum?",
    options: [
      "'Kostas' – Traum: einmal ein ganzes Sandwich für sich allein.",
      "'Sokrates' – Traum: die Menschheit über bessere Fluchtwege belehren.",
      "'Zorba' – Traum: einmal ohne Touristen frühstücken.",
      "'Nikos' – Traum: die höchste Klippe der Insel besteigen.",
      "'Frappé' – Traum: endlich verstehen, warum Menschen so viel fotografieren.",
      "'Alexis' – Traum: eine eigene Reality-Show über sein Leben.",
    ],
  },
  {
    text: "Das Dorf hat null Handyempfang. Jan nach 6 Stunden ohne Internet:",
    options: [
      "wirkt seltsam ruhig, fast schon glücklich.",
      "spricht plötzlich mehr mit echten Menschen.",
      "hat spontan ein Buch angefangen zu lesen.",
      "zittert leicht, aber hält tapfer durch.",
      "erklärt, er 'brauche das eh nicht', mehrfach, unaufgefordert.",
      "entdeckt, dass die Welt auch offline weitergeht.",
    ],
  },
  {
    text: "Ein griechischer Opa lädt Jan und Luca spontan zu seiner Hochzeit ein. Was passiert dann?",
    options: [
      "Sie tanzen die ganze Nacht, ohne die Schritte zu kennen.",
      "Sie werden offiziell zu Ehrengästen erklärt, aus Gastfreundschaft.",
      "Sie bekommen mehr Essen als der Bräutigam selbst.",
      "Sie lernen mehr Griechisch in einer Nacht als in der ganzen Reise.",
      "Sie werden fotografiert wie enge Familienmitglieder.",
      "Sie beschließen, jede Hochzeit auf Kreta zu crashen, ab jetzt.",
    ],
  },
  {
    text: "Jan findet raus, dass ein Frappé im Dorf nur 50 Cent kostet. Sein neuer Lebensplan:",
    options: [
      "Auswandern, sofort, ohne Rückflug.",
      "Jeden Tag mindestens fünf Frappés trinken, aus Prinzip.",
      "Ein Café eröffnen, nur um diesen Preis anzubieten.",
      "Nie wieder deutsche Kaffeepreise akzeptieren.",
      "Luca überreden, mit ihm ein neues Leben hier zu starten.",
      "Diesen Ort niemandem verraten, aus Selbstschutz.",
    ],
  },
  {
    text: "Luca lernt von einem Fischer, wie man Tintenfische fängt. Erster Versuch endet mit…",
    options: [
      "einem Tintenfisch, der ihn erfolgreich bespritzt.",
      "leeren Händen, aber viel neuem Respekt.",
      "einem Lachanfall des Fischers, gutmütig, aber ehrlich.",
      "Luca, der komplett nass und leicht beschämt zurückkommt.",
      "einer neuen Wertschätzung für gekaufte Tintenfische.",
      "einer zweiten Chance, die genauso schiefgeht.",
    ],
  },
  {
    text: "Mitternacht, Raki-Stunde 3. Jan und Luca gründen spontan eine GmbH. Name und Produkt?",
    options: [
      "'Kri-Kri Consulting' – Beratung für ziegenähnliches Zeitmanagement.",
      "'Frappé & Söhne' – Premium-Kaffee für gestresste Reisende.",
      "'Sfakia Solutions' – Notfallpläne für verpasste Fähren.",
      "'Dakos Dynamics' – die Zukunft des Frühstücks.",
      "'Raki Republic' – ein Getränk, ein Lebensgefühl.",
      "'Labyrinth Logistics' – wir finden, was Maps nicht findet.",
    ],
  },
  {
    text: "Jan und Luca erfinden ein neues kretisches Traditionsgericht. Hauptzutaten und Name?",
    options: [
      "'Jan-aki' – Dakos, Frappé-Sauce und zu viel Selbstvertrauen.",
      "'Luca-Moussaka' – dreimal so viel Käse wie erlaubt.",
      "'Kri-Kri-Bowl' – alles, was gerade im Kühlschrank war.",
      "'Sfakia-Style Chaos' – Zutaten, die eigentlich nicht zusammenpassen.",
      "'Raki-Risotto' – definitiv keine gute Idee, aber probiert.",
      "'Frangokastello-Feuer' – so scharf wie die Klippen hoch sind.",
    ],
  },
  {
    text: "Der Vermieter zeigt ihnen stolz das 'besondere Extra' der Wohnung. Es ist…",
    options: [
      "eine Hängematte mit direktem Meerblick, überraschend gut.",
      "eine Sammlung von 40 Jahren alten Postkarten an der Wand.",
      "ein Weinkeller, kleiner als ein Schrank, aber voll.",
      "ein handgemalter Wegweiser zum 'besten Strand, den keiner kennt'.",
      "eine Katze, die offiziell 'zur Wohnung gehört'.",
      "ein Buch mit handgeschriebenen Geheimtipps von 20 Jahren Gästen.",
    ],
  },
  {
    text: "Jan schreibt eine 5-Sterne-Bewertung für das Hotel. Erster Satz:",
    options: [
      "'Ich bin nie wieder derselbe Mensch, im positiven Sinne.'",
      "'Dieses Hotel hat mein Leben verändert, keine Übertreibung.'",
      "'Ich würde hierher zurückkommen, selbst wenn ich reich wäre und woanders hinkönnte.'",
      "'Das Bett war hart, aber mein Herz ist weich geworden.'",
      "'Ich habe hier mehr gelernt als in der Schule.'",
      "'Fünf Sterne sind zu wenig für diese Erfahrung.'",
    ],
  },
  {
    text: "Luca entdeckt, dass Jan heimlich jeden Abend… macht.",
    options: [
      "eine Liste der besten Momente des Tages schreibt.",
      "seine Fotos vom Tag sortiert, akribisch, nach Kategorien.",
      "mit seiner Mutter telefoniert und alles haarklein erzählt.",
      "heimlich einen zweiten Frappé bestellt, ohne zu teilen.",
      "ein Tagebuch führt, das er niemandem zeigen will.",
      "die Wettervorhersage für die nächsten fünf Tage checkt, aus Angst vor Regen.",
    ],
  },
  {
    text: "Ein Strandverkäufer bietet 'echte antike Münzen' an. Jan verhandelt. Am Ende hat er…",
    options: [
      "drei Münzen, die verdächtig nach Souvenirshop aussehen.",
      "einen neuen Freund, aber keine Münzen.",
      "den Preis auf ein Zehntel runtergehandelt – stolz wie nie.",
      "eine Münze und eine Geschichte, die garantiert erfunden ist.",
      "nichts gekauft, aber eine Stunde Verhandlungs-Comedy erlebt.",
      "sich selbst überzeugt, dass es 'für die Geschichte' war.",
    ],
  },
  {
    text: "Lucas Kreta-Urlaubsbuch: Titel und Klappentext in einem Satz.",
    options: [
      "'Frappé, Ziegen, Chaos' – eine Reise, die niemand geplant hat, aber jeder gebraucht hat.",
      "'Verlaufen mit Stil' – zwei Freunde, eine Insel, null Orientierung.",
      "'Zwischen Raki und Ruinen' – eine Geschichte über Freundschaft und schlechte Entscheidungen.",
      "'Sonnenbrand & Sinnkrisen' – Urlaub, wie er wirklich ist.",
      "'Kreta hat uns verändert' – nicht immer zum Besseren, aber immer lustig.",
      "'Zwei Deutsche, eine Insel, viel zu viel Käse' – eine wahre Geschichte.",
    ],
  },
  {
    text: "Tag 8. Jan und Luca canceln die Heimreise spontan. Der echte Grund:",
    options: [
      "Der Frappé zuhause schmeckt einfach nicht gleich.",
      "Sie haben sich verliebt – in die Insel, versteht sich.",
      "Es gibt noch drei Strände, die sie unbedingt sehen müssen.",
      "Sie haben Angst, dass der Alltag sie sofort wieder einholt.",
      "Ein Kri-Kri hat sie quasi adoptiert, Verantwortung ruft.",
      "Sie wollen einfach noch nicht erwachsen sein müssen.",
    ],
  },
  {
    text: "Das Kri-Kri-Maskottchen hat sich im Koffer versteckt. Zuhause angekommen…",
    options: [
      "hüpft es fröhlich durch die Wohnung, als wäre nichts.",
      "erklärt der Zoll es für 'nicht standardgemäßes Gepäck'.",
      "beschließen sie, es heimlich zu behalten.",
      "erschreckt es die ganze Nachbarschaft beim Auspacken.",
      "stellt sich raus: es war die ganze Zeit nur ein Plüschtier, zum Glück.",
      "verlangt es sofort nach griechischem Essen – Heimweh.",
    ],
  },
  {
    text: "Jan beschreibt den perfekten Kreta-Tag in einer WhatsApp an seine Mutter:",
    options: [
      "'Mama, ich hab heute nichts getan und es war perfekt.'",
      "'Mama, ich glaube, ich könnte hier für immer bleiben.'",
      "'Mama, ich hab drei Ziegen gesehen und bin jetzt ein anderer Mensch.'",
      "'Mama, das Essen hier ist besser als deins – sag's niemandem.'",
      "'Mama, ich vermisse dich, aber nicht die Regenwolken.'",
      "'Mama, schick mir mal Sonnencreme, im Ernst, sofort.'",
    ],
  },
  {
    text: "Luca hat heimlich ein Tagebuch geführt. Erster Eintrag: 'Tag 1. Jan hat schon wieder…'",
    options: [
      "…ein Foto von seinem Essen gemacht, bevor ich auch nur einen Bissen nehmen konnte.",
      "…behauptet, er sei 'kein Tourist mehr', nach zwei Stunden auf der Insel.",
      "…mit einer Ziege ein tieferes Gespräch geführt als mit mir.",
      "…die Klimaanlage im Auto auf 'arktisch' gestellt.",
      "…jemanden auf Griechisch angesprochen und komplett versagt.",
      "…gesagt, wir könnten das 'locker zu Fuß machen' – waren es 12 km.",
    ],
  },
  {
    text: "Jan versucht mit einer Meeresschildkröte zu kommunizieren. Was sagt er ihr?",
    options: [
      "'Du bist definitiv entspannter als ich je sein werde.'",
      "'Können wir tauschen? Du Urlaub, ich Meer.'",
      "'Ich respektiere dein Tempo. Ehrlich, sehr.'",
      "'Sag mal, hast du auch manchmal keine Lust auf gar nichts?'",
      "'Ich beneide dein Leben, kein Instagram, keine Deadlines.'",
      "'Du bist jetzt offiziell Teil unserer Reisegruppe.'",
    ],
  },
  {
    text: "Lucas Theorie, warum kretisches Brot so viel besser schmeckt als deutsches?",
    options: [
      "'Die Sonne backt hier praktisch mit.'",
      "'Weniger Regeln, mehr Liebe – das schmeckt man.'",
      "'Alles, was neben dem Meer wächst, schmeckt automatisch besser.'",
      "'Ich glaube, es liegt am Olivenöl. Immer am Olivenöl.'",
      "'Deutsches Brot hat einfach nie Urlaub gemacht.'",
      "'Vielleicht schmeckt einfach alles besser, wenn man glücklich ist.'",
    ],
  },
  {
    text: "Jan und Luca finden eine Flaschenpost am Strand. Die Botschaft lautet:",
    options: [
      "'Wenn du das liest: Trink mehr Frappé.'",
      "'Hilfe, ich bin ein gelangweilter Tourist von 2019.'",
      "'Geheimtipp: der beste Strand ist der, an dem gerade niemand ist.'",
      "'Falls verloren: das ist auch ok, Kreta findet dich.'",
      "'Für den Finder: du hast gerade Glück gehabt. Genieß den Tag.'",
      "'PS: Diese Flasche hat mehr Reiseerfahrung als du.'",
    ],
  },
  {
    text: "Der Wanderguide in der Samaria-Schlucht gibt ihnen Spitznamen. Jan heißt jetzt '...' weil...",
    options: [
      "'Der Frappé-Flüsterer' – weil er alle 20 Minuten einen braucht.",
      "'Langsam-Jan' – weil er jede Aussicht fotografieren muss.",
      "'Der Ziegenversteher' – nach dem Vorfall mit dem Kri-Kri.",
      "'Wasserflaschen-Vergesser' – aus offensichtlichen Gründen.",
      "'Der ewig Verlaufene' – auch auf markierten Wegen.",
      "'Sonnencreme-Sparfuchs' – zu seinem eigenen Nachteil.",
    ],
  },
  {
    text: "Luca behauptet, in Frangokastello ein Geist gesehen zu haben. Es sah aus wie…",
    options: [
      "ein Nebelfleck, der zufällig menschenähnlich war.",
      "ein Schatten, der garantiert nur ein Schatten war.",
      "einer der berühmten 'Drosoulites', ganz offiziell und ernst gemeint.",
      "eine optische Täuschung, die er trotzdem fest verteidigt.",
      "Jan, der sich einen Streich erlauben wollte – erfolgreich.",
      "nichts wirklich, aber die Geschichte wird immer besser erzählt.",
    ],
  },
  {
    text: "Jan kocht zum ersten Mal Dakos nach. Das Endergebnis wird von Luca beschrieben als…",
    options: [
      "'mutig, aber definitiv nicht kretisch.'",
      "'ein ehrlicher Versuch mit einem tragischen Ausgang.'",
      "'essbar, aber Griechenland würde weinen.'",
      "'überraschend gut – für Jans Verhältnisse.'",
      "'ein Grund, warum wir zurück nach Kreta müssen. Zum Essen. Nicht zum Kochen.'",
      "'Kunst. Abstrakte Kunst, aber Kunst.'",
    ],
  },
  {
    text: "Das Wlan-Passwort im Restaurant ist 40 Zeichen lang. Jan tippt es ab. Zweimal. Dann:",
    options: [
      "gibt er auf und akzeptiert das offline Leben, für heute.",
      "fragt er den Kellner, ob es wirklich so kompliziert sein muss.",
      "tippt Luca es fehlerfrei beim ersten Versuch – Triumph.",
      "beschließt er, das Passwort auswendig zu lernen, für die Zukunft.",
      "fotografiert er das Schild, um es später in Ruhe zu tippen.",
      "erklärt er das Restaurant zu 'digitalem Detox, ungewollt'.",
    ],
  },
  {
    text: "Luca kauft auf dem Markt etwas, ohne zu wissen was es ist. Zuhause stellt sich raus:",
    options: [
      "es ist ein Gewürz, das er nie wieder findet, natürlich.",
      "es ist essbar, aber niemand weiß genau, wie man es zubereitet.",
      "es ist eigentlich Tierfutter – peinlich, aber lustig.",
      "es schmeckt überraschend gut in fast allem.",
      "es war eigentlich nur Deko, kein Lebensmittel.",
      "es ist das beste, das er auf der ganzen Reise gekauft hat.",
    ],
  },
  {
    text: "Jan muss auf Kreta zum Arzt. Sein Griechisch reicht für die Diagnose: '…'",
    options: [
      "'Ich glaube, mein Fuß ist... existent, aber schmerzhaft.'",
      "'Sonne. Zu viel Sonne. Definitiv Sonne.'",
      "'Etwas mit Fuß, etwas mit Au, viel mit Panik.'",
      "'Ich zeig einfach auf die Stelle und hoffe auf das Beste.'",
      "'Kri-Kri-bezogener Unfall, kompliziert zu erklären.'",
      "'Ich brauche... helfen... bitte... danke.'",
    ],
  },
  {
    text: "Luca erklärt Jan zum ersten Mal, was 'Urlaub machen' für ihn bedeutet. Es klingt nach:",
    options: [
      "'Nichts tun, aber das sehr bewusst und mit Hingabe.'",
      "'Essen, schlafen, Meer, wiederholen.'",
      "'Verantwortung für zwei Wochen an der Grenze ablegen.'",
      "'Sich erlauben, planlos zu sein, ohne schlechtes Gewissen.'",
      "'Zeit, die sich anders anfühlt als zuhause – langsamer, wärmer.'",
      "'Einfach mal Jan sein lassen, wer er sein will.'",
    ],
  },
  // ── Wetter & Hitze ──
  {
    text: "Um 14 Uhr zeigt das Thermometer 41°C im Schatten. Jan behauptet trotzdem, 'es geht schon'. Was macht er wirklich?",
    options: [
      "Er steht komplett unbeweglich unter dem einzigen Baum weit und breit.",
      "Er zählt laut die Sekunden, bis die Klimaanlage im Auto wieder anspringt.",
      "Er trinkt Wasser wie ein Kamel vor der Durststrecke.",
      "Er behauptet, 'das ist wie Sauna, nur mit Aussicht'.",
      "Er sucht verzweifelt nach dem nächsten klimatisierten Supermarkt.",
      "Er liegt einfach flach auf dem Boden und wartet auf den Abend.",
    ],
  },
  {
    text: "Ein plötzlicher Wind fegt Jans Handtuch, Hut und Sonnenbrille gleichzeitig vom Strand. Seine Reaktion?",
    options: [
      "Er rennt allem gleichzeitig nach, erfolglos in alle Richtungen.",
      "Er akzeptiert den Verlust mit stoischer Ruhe und Würde.",
      "Luca fängt zufällig alles auf, wie ein Superheld.",
      "Er erklärt es zu 'Kretas Art, ihn zu erden'.",
      "Er verhandelt mit dem Wind, laut, aber erfolglos.",
      "Er nutzt die Chance für einen spontanen Sprint-Witz.",
    ],
  },
  {
    text: "Ein Gewitter zieht überraschend über die Insel, während Jan und Luca am entferntesten Strand liegen. Ihr Fluchtplan?",
    options: [
      "Sie rennen, als hätten sie noch nie zuvor gerannt.",
      "Sie warten es unter einem viel zu kleinen Sonnenschirm aus.",
      "Sie zählen die Sekunden zwischen Blitz und Donner, aus Nervosität.",
      "Sie erklären es zu 'romantisch' und bleiben trotzdem stehen.",
      "Sie rufen ein Taxi, das eine Stunde zu spät kommt.",
      "Sie nutzen die Chance für die dramatischste Foto-Session der Reise.",
    ],
  },
  {
    text: "Die Mittagssonne ist so stark, dass sogar die Kri-Kri-Ziegen komplett verschwunden sind. Luca fragt sich:",
    options: [
      "'Wenn selbst die Ziegen aufgeben, was machen wir hier eigentlich?'",
      "'Vielleicht wissen die Ziegen einfach mehr als wir.'",
      "'Ist das schon offiziell zu heiß für Lebewesen mit Fell?'",
      "'Sollten wir nicht auch einfach im Schatten verschwinden?'",
      "'Ich glaube, die Ziegen sind klüger als der durchschnittliche Tourist.'",
      "'Das ist der Beweis: Selbst die Insel macht jetzt Siesta.'",
    ],
  },
  {
    text: "Ein unerwarteter Regenschauer überrascht Jan und Luca mitten auf dem Markt. Alle Verkäufer bleiben völlig entspannt.",
    options: [
      "Jan und Luca suchen panisch Unterschlupf unter einer Markise.",
      "Sie beschließen, einfach nass zu werden – 'ist doch warm'.",
      "Ein Verkäufer bietet ihnen spontan einen Regenschirm zum Verkauf an.",
      "Sie nutzen die Pause, um endlich alle Marktstände zu vergleichen.",
      "Luca erklärt, deutscher Regen sei 'viel dramatischer' als dieser.",
      "Sie kaufen zwei Hüte, nur um sie fünf Minuten später wegzuwerfen.",
    ],
  },
  {
    text: "Die Nacht bleibt so heiß, dass weder Jan noch Luca schlafen können. Um 3 Uhr morgens beschließen sie:",
    options: [
      "sich draußen auf den Balkon zu legen, in der Hoffnung auf Brise.",
      "die restlichen Eiswürfel aus dem Minibar-Kühlschrank zu opfern.",
      "eine philosophische 3-Uhr-morgens-Diskussion über das Leben zu führen.",
      "sich gegenseitig mit nassen Handtüchern zu kühlen, wortlos.",
      "aufzugeben und stattdessen die Sterne zu zählen.",
      "einfach wach zu bleiben und den Sonnenaufgang direkt mitzunehmen.",
    ],
  },
  // ── Nachtleben & Raki ──
  {
    text: "In einer kleinen Bar spielt spontan eine Live-Band griechische Musik. Jan steht auf und tanzt – zum ersten Mal öffentlich in seinem Leben.",
    options: [
      "Seine Bewegungen erinnern eher an einen Roboter als an einen Tänzer.",
      "Die Band applaudiert ihm trotzdem, aus reiner Höflichkeit.",
      "Luca filmt heimlich, für 'zukünftige Verhandlungsmacht'.",
      "Ein Local zieht ihn beiseite und zeigt ihm die richtigen Schritte.",
      "Er tanzt mit voller Überzeugung, aber komplett falschem Rhythmus.",
      "Am Ende bekommt er tatsächlich Szenenapplaus, verdient oder nicht.",
    ],
  },
  {
    text: "Nach drei Raki wird Luca philosophisch und beginnt, den Sinn des Lebens zu erklären. Jan hört zu, komplett verwirrt.",
    options: [
      "Luca kommt zu dem Schluss: 'Alles ist eigentlich Frappé, wenn man's genau nimmt.'",
      "Er erklärt eine Theorie, die er am nächsten Tag komplett vergessen hat.",
      "Jan nickt einfach mit, ohne ein Wort zu verstehen.",
      "Luca beendet den Vortrag mit 'aber das erklär ich dir morgen genauer'.",
      "Er zieht Parallelen zwischen dem Leben und dem Straßenverkehr auf Kreta.",
      "Es endet mit der Erkenntnis: 'Wir sollten definitiv noch einen bestellen.'",
    ],
  },
  {
    text: "Eine Bar bietet 'die schärfste Ouzo-Challenge der Insel' an. Jan nimmt die Herausforderung an, obwohl niemand ihn gezwungen hat.",
    options: [
      "Sein Gesicht durchläuft fünf verschiedene Farbtöne in zehn Sekunden.",
      "Er behauptet danach, es sei 'völlig problemlos' gewesen – mit Tränen in den Augen.",
      "Die Bar schenkt ihm ein T-Shirt als Trophäe für den Mut.",
      "Luca lehnt dankend ab und lacht sich kaputt.",
      "Er braucht danach zwanzig Minuten, um wieder normal zu sprechen.",
      "Er verlangt sofort eine Revanche – aus reinem Trotz.",
    ],
  },
  {
    text: "In einer Strandbar läuft die ganze Nacht dieselbe Playlist im Loop. Nach vier Stunden können Jan und Luca jedes Lied mitsingen.",
    options: [
      "Sie erklären die Playlist zum 'offiziellen Soundtrack der Reise'.",
      "Jan kann keinen der Songtitel nennen, aber jede Melodie mitsummen.",
      "Sie beschließen, sich die Playlist für zuhause zu merken – vergeblich.",
      "Luca tanzt jetzt spontan bei jedem der Songs, ohne Ausnahme.",
      "Sie fragen den DJ, ob es noch mehr Lieder auf der Insel gibt.",
      "Am Ende ist es das Lied, das sie für immer an Kreta erinnern wird.",
    ],
  },
  {
    text: "Ein Einheimischer erklärt Jan und Luca die 'richtige' Art, Raki zu trinken – nicht in einem Zug, sondern in kleinen, respektvollen Schlucken.",
    options: [
      "Jan versucht es, scheitert aber sofort an der Selbstkontrolle.",
      "Luca schafft es überraschend gut, zur Überraschung aller.",
      "Der Einheimische seufzt, aber lächelt trotzdem nachsichtig.",
      "Sie beschließen, dass 'auf Kretisch trinken' eine eigene Kunstform ist.",
      "Am Ende bekommen sie beide trotzdem noch ein Glas, aus Sympathie.",
      "Jan erklärt, 'kleine Schlucke' seien 'nicht sein Naturell'.",
    ],
  },
  {
    text: "Beim nächtlichen Spaziergang am Hafen entdecken Jan und Luca ein Fest, zu dem sie nicht eingeladen waren – aber sofort mitfeiern dürfen.",
    options: [
      "Sie werden binnen Minuten wie alte Freunde behandelt.",
      "Jan versucht sofort, Griechisch zu sprechen, mit gemischtem Erfolg.",
      "Sie bekommen Essen, obwohl sie eigentlich nur vorbeikamen.",
      "Luca tanzt mit jemandes Großmutter, sehr erfolgreich.",
      "Sie bleiben bis zum Sonnenaufgang, ungeplant, aber glücklich.",
      "Sie beschließen, dass spontane Feste die besten Feste sind.",
    ],
  },
  // ── Tiere & Natur ──
  {
    text: "Eine Katze folgt Jan und Luca drei Straßen weit durchs Dorf, offensichtlich in der Hoffnung auf Essen.",
    options: [
      "Jan gibt ihr einen Namen und plant sofort eine Adoption.",
      "Luca erklärt, dass sie 'eindeutig schon einen Besitzer' hat – offensichtlich einen guten.",
      "Sie füttern sie heimlich mit Resten vom Mittagessen.",
      "Die Katze verschwindet, sobald das Essen alle ist – lehrreiche Lektion.",
      "Sie beschließen, sie 'Souvlaki' zu nennen, aus offensichtlichen Gründen.",
      "Jan macht mehr Fotos von ihr als vom gesamten restlichen Dorf.",
    ],
  },
  {
    text: "Am Wegrand entdecken Jan und Luca eine Herde wilder Ziegen, die aussehen, als würden sie über sie urteilen.",
    options: [
      "Jan fühlt sich beobachtet und leicht unter Druck gesetzt.",
      "Luca winkt ihnen freundlich zu, ohne Reaktion.",
      "Sie beschließen, dass Ziegen einfach 'die coolsten Wesen der Insel' sind.",
      "Eine Ziege folgt ihnen ein Stück, aus unklaren Gründen.",
      "Sie fühlen sich wie Eindringlinge in ziegeneigenem Territorium.",
      "Jan verspricht der Herde leise, 'nur kurz durchzugehen'.",
    ],
  },
  {
    text: "Ein riesiger, aber harmloser Käfer landet mitten auf Jans Frühstückstisch. Seine Reaktion ist völlig unverhältnismäßig.",
    options: [
      "Er springt so schnell auf, dass der Stuhl umfällt.",
      "Er erklärt den Käfer für 'Kretas größten Feind'.",
      "Luca findet den Käfer 'eigentlich ganz niedlich' – zur Verwirrung aller.",
      "Jan besteht darauf, den Tisch zu wechseln, sofort.",
      "Der Käfer bleibt völlig ungerührt sitzen, als würde ihm der Tisch gehören.",
      "Am Ende macht Jan trotzdem ein Foto – aus sicherer Entfernung.",
    ],
  },
  {
    text: "Beim Wandern entdecken Jan und Luca einen Bienenschwarm direkt über dem Wanderweg. Wie gehen sie vor?",
    options: [
      "Sie schleichen im Zeitlupentempo darunter durch, mit angehaltenem Atem.",
      "Jan schlägt einen kompletten Umweg vor, sicher ist sicher.",
      "Luca erklärt, Bienen seien 'freundlicher, als man denkt' – mutig, aber riskant.",
      "Sie warten zehn Minuten, in der Hoffnung, der Schwarm zieht weiter.",
      "Sie rennen einfach durch, mit geschlossenen Augen und viel Adrenalin.",
      "Sie beschließen, dass dieser Weg 'heute einfach nicht ihr Weg' ist.",
    ],
  },
  {
    text: "Ein Pelikan lässt sich seelenruhig neben Jan und Luca am Hafen nieder, offensichtlich an mehr Fisch interessiert als an ihnen.",
    options: [
      "Jan versucht, ein Gespräch mit ihm zu beginnen – erfolglos.",
      "Luca bewundert seine Gelassenheit und will 'genauso entspannt werden'.",
      "Sie füttern ihn heimlich, obwohl ein Schild das ausdrücklich verbietet.",
      "Der Pelikan ignoriert beide komplett und wartet auf den Fischer.",
      "Sie machen mehr Fotos von ihm als von der gesamten Hafenkulisse.",
      "Jan erklärt ihn zum 'entspanntesten Wesen, das er je getroffen hat'.",
    ],
  },
  {
    text: "Nachts am Strand entdecken Jan und Luca frische Schildkröten-Spuren im Sand – Zeichen einer möglichen Nestablage.",
    options: [
      "Sie flüstern automatisch, obwohl niemand sonst am Strand ist.",
      "Jan besteht darauf, komplett still und respektvoll zu bleiben.",
      "Sie beschließen spontan, sich über Meeresschildkröten-Schutz zu informieren.",
      "Luca ist gerührt, fast zu Tränen, von dieser stillen Naturbeobachtung.",
      "Sie halten Abstand und fühlen sich trotzdem wie Entdecker.",
      "Es wird zu einem der ruhigsten, ehrlichsten Momente der ganzen Reise.",
    ],
  },
  // ── Technik & Kommunikation ──
  {
    text: "Der Akku von Jans Handy ist bei 1%, und sie haben sich gerade komplett verlaufen. Sein letzter Plan?",
    options: [
      "Eine Notfall-Nachricht an Luca schicken, die nur halb ankommt.",
      "Den Flugmodus aktivieren, um 'Akku zu sparen' – zu spät dafür.",
      "Fremde nach dem Weg fragen, mit Händen und Füßen.",
      "Sich an den letzten bekannten Punkt auf der Karte zurückerinnern.",
      "Das Handy komplett ausschalten und sich auf sein Bauchgefühl verlassen.",
      "In Panik geraten, aber es niemandem zeigen.",
    ],
  },
  {
    text: "Luca versucht, ein Foto mit perfektem Sonnenuntergang zu machen, aber das Handy zeigt nur eine überbelichtete, weiße Fläche.",
    options: [
      "Er probiert 47 verschiedene Kamera-Einstellungen, erfolglos.",
      "Jan schlägt vor, 'einfach mit den Augen genießen' – wird ignoriert.",
      "Er macht trotzdem 30 Fotos, in der Hoffnung, eines wird gut.",
      "Er beschließt, das Foto sei 'künstlerisch abstrakt' gemeint.",
      "Er fragt einen Fremden, ob dessen Handy 'besser fotografiert'.",
      "Am Ende postet er es trotzdem, mit einem ironischen Kommentar.",
    ],
  },
  {
    text: "Ein Übersetzungs-App-Fehler führt dazu, dass Jan dem Kellner versehentlich etwas völlig Falsches sagt.",
    options: [
      "Der Kellner lacht so sehr, dass er sich setzen muss.",
      "Jan versucht, es zu erklären, macht es aber nur schlimmer.",
      "Der Fehler wird zum running Gag der gesamten Taverna.",
      "Luca übersetzt lieber selbst weiter, mit Händen und Mimik.",
      "Der Kellner bringt trotzdem das Richtige, aus Erfahrung mit Touristen.",
      "Jan gibt der App die Schuld – zu Recht, aber trotzdem lustig.",
    ],
  },
  {
    text: "Das Hotel-WLAN heißt 'PasswortIstDerName' – aber niemand weiß, welcher Name gemeint ist.",
    options: [
      "Sie probieren jeden Hotelnamen, jeden Ortsnamen, erfolglos.",
      "Jan fragt an der Rezeption und bekommt eine völlig andere Antwort.",
      "Luca versucht es mit dem eigenen Namen – natürlich falsch.",
      "Sie geben auf und leben zwei Stunden komplett offline.",
      "Am Ende ist es der Name des Vermieter-Hundes. Logisch, irgendwie.",
      "Sie beschließen, das WLAN-Passwort sei 'ein griechisches Rätsel'.",
    ],
  },
  {
    text: "Jan will unbedingt einen Video-Call mit seiner Familie machen, aber die Verbindung bricht alle zehn Sekunden ab.",
    options: [
      "Er erklärt in Bruchstücken, dass 'alles super' ist – zwischen Standbildern.",
      "Die Familie hört nur jedes dritte Wort und versteht trotzdem alles.",
      "Er versucht es an fünf verschiedenen Ecken der Wohnung.",
      "Luca hält das Handy hoch, wie eine Satellitenschüssel, für besseren Empfang.",
      "Am Ende schickt er lieber eine lange Sprachnachricht.",
      "Die Familie sieht ihn nur als Standbild mit offenem Mund – perfektes Foto.",
    ],
  },
  // ── Geld & Shopping ──
  {
    text: "Auf dem Markt handelt Jan hartnäckig um einen Preis, der eigentlich schon extrem günstig war.",
    options: [
      "Er gewinnt tatsächlich noch 20 Cent Rabatt, stolz wie ein König.",
      "Der Verkäufer lässt ihn gewinnen, aus Mitleid und Unterhaltungswert.",
      "Luca ist peinlich berührt und geht schon mal vor.",
      "Jan erklärt, 'es geht ums Prinzip, nicht um das Geld'.",
      "Er bekommt am Ende noch ein kleines Geschenk dazu, aus Sympathie.",
      "Der Verkäufer lacht und nennt ihn 'echten Verhandler'.",
    ],
  },
  {
    text: "Luca vergisst, dass Kreditkarten in kleinen Dörfern oft nicht funktionieren, und steht plötzlich ohne Bargeld da.",
    options: [
      "Er fragt Jan, ob er ihm 'ganz kurz' Geld leihen kann.",
      "Der Ladenbesitzer bietet an, es 'morgen zu bezahlen' – Vertrauen auf Kreta.",
      "Sie suchen zwanzig Minuten nach dem nächsten Geldautomaten.",
      "Luca bietet an, mit einem Souvenir zu bezahlen – wird abgelehnt.",
      "Sie beschließen, ab jetzt immer Bargeld zu tragen – bis zum nächsten Mal.",
      "Der Ladenbesitzer erklärt geduldig, dass 'das hier normal ist'.",
    ],
  },
  {
    text: "Jan kauft eine riesige Menge Olivenöl, obwohl klar ist, dass es nie in den Koffer passen wird.",
    options: [
      "Er versucht, es als Handgepäck zu deklarieren – Diskussion vorprogrammiert.",
      "Luca schlägt vor, es einfach vor Ort zu trinken, als Witz.",
      "Sie verpacken es in so viele Plastiktüten wie möglich, aus Sicherheit.",
      "Jan erklärt, das Öl sei 'eine Investition in bessere Küche zuhause'.",
      "Er verschenkt am Ende die Hälfte an den Vermieter, aus Platzgründen.",
      "Es wird zum schwersten und wichtigsten Gepäckstück der ganzen Reise.",
    ],
  },
  {
    text: "Beim Bezahlen im Restaurant stellt sich heraus, dass Jan und Luca beide dachten, der andere hätte die Rechnung übernommen.",
    options: [
      "Sie diskutieren freundlich, aber bestimmt, wer wirklich dran ist.",
      "Der Kellner wartet geduldig, während sie eine Excel-Tabelle im Kopf durchgehen.",
      "Sie einigen sich, künftig immer 50/50 zu teilen – Frieden gefunden.",
      "Jan zahlt widerwillig, mit einem Kommentar für die Geschichtsbücher.",
      "Sie beschließen, dass derjenige mit dem sonnigeren Gesicht zahlt – Luca verliert.",
      "Am Ende zahlen sie beide zusammen, einfach um die Diskussion zu beenden.",
    ],
  },
  {
    text: "Auf dem Souvenirmarkt entdeckt Luca ein Kri-Kri-Plüschtier in XXL-Größe, viel zu groß für jeden Koffer.",
    options: [
      "Er kauft es trotzdem, Konsequenzen später klären.",
      "Jan schlägt vor, es einfach als 'zweite Person' einzuchecken.",
      "Sie überlegen, es der Hotelkatze als Geschenk zu vermachen.",
      "Luca trägt es stolz durch das ganze restliche Dorf, wie eine Trophäe.",
      "Es wird zum inoffiziellen dritten Reisebegleiter für den restlichen Urlaub.",
      "Am Ende bleibt es tatsächlich auf Kreta – als Geschenk für den Vermieter.",
    ],
  },
  // ── Heimweh & Familie ──
  {
    text: "Jans Mutter schreibt jeden Tag mindestens fünf besorgte Nachrichten über Sonnenbrand, Essen und Verkehr.",
    options: [
      "Er antwortet mit einem Foto, das alles beruhigt – meistens.",
      "Er beschließt, präventiv jeden Abend ein Lebenszeichen zu senden.",
      "Luca findet es 'süß', wird aber selbst leicht nervös davon.",
      "Jan erklärt seiner Mutter geduldig, dass Kreta 'ziemlich sicher' ist.",
      "Er antwortet mit einem einzigen Wort: 'Alles gut', wissend, dass es nicht reicht.",
      "Am Ende schickt seine Mutter noch mehr Nachrichten, aus Liebe.",
    ],
  },
  {
    text: "Beim Anblick eines Familienrestaurants voller griechischer Großfamilien wird Luca leicht nostalgisch.",
    options: [
      "Er erklärt, wie wichtig ihm große, laute Familientreffen eigentlich sind.",
      "Jan fragt vorsichtig nach, ob alles okay ist – ungewohnt ernst.",
      "Sie beschließen, öfter mit der eigenen Familie zu telefonieren.",
      "Luca schwört, beim nächsten Familienfest 'präsenter' zu sein.",
      "Sie bestellen extra viel Essen, 'wie bei einer echten Familie'.",
      "Es wird zu einem der ruhigen, ehrlichen Momente der Reise.",
    ],
  },
  {
    text: "Jan vermisst überraschend deutsches Brot – nach nur vier Tagen auf Kreta.",
    options: [
      "Er erklärt es zu 'kulturellem Heimweh', ganz ernst gemeint.",
      "Luca findet das absurd, angesichts des ganzen guten Essens hier.",
      "Er sucht tatsächlich in einem Supermarkt nach etwas Ähnlichem.",
      "Er beschließt, sich zuhause nie wieder über Brot zu beschweren.",
      "Er vermisst konkret die Kruste – 'die hier ist einfach anders'.",
      "Luca verspricht, ihm bei der Heimkehr ein ganzes Brot zu kaufen.",
    ],
  },
  {
    text: "Ein Videoanruf mit der Familie endet abrupt, weil Jan vor Rührung kurz die Fassung verliert – wegen einer einfachen Frage nach dem Urlaub.",
    options: [
      "Er erklärt es schnell mit 'Sonnenstich', um abzulenken.",
      "Luca gibt ihm diskret einen Moment für sich.",
      "Er ruft eine Stunde später zurück, gefasster, aber immer noch berührt.",
      "Er erklärt später, dass Kreta ihn 'einfach mehr berührt hat, als erwartet'.",
      "Die Familie merkt es trotzdem und fragt liebevoll nach.",
      "Es wird zu einem der ehrlichsten, unerwarteten Momente der Reise.",
    ],
  },
  {
    text: "Luca kauft ein Geschenk, das eindeutig mehr für ihn selbst als für seine Familie gedacht ist.",
    options: [
      "Er rechtfertigt es mit 'ich teste es nur vorher, aus Qualitätssicherung'.",
      "Jan durchschaut ihn sofort und macht sich lustig darüber.",
      "Er kauft am Ende ein zweites, echtes Geschenk, aus schlechtem Gewissen.",
      "Er behält beide – eins für sich, eins 'für später vielleicht'.",
      "Er verspricht, es wirklich, wirklich zu verschenken – glaubt keiner.",
      "Es wird zum running Gag für den Rest der Reise.",
    ],
  },
];

const CHAOS_ROUNDS = 10;
const WRITING_SECS = 45;

interface ChaosState {
  round: number;
  scenarios: number[];
  phase: "writing" | "voting" | "reveal" | "done";
  answers: Record<string, string>;
  votes: Record<string, string>;
  scores: Record<string, number>;
  timerStart: number;
}

// A-player is Jan on even rounds, Luca on odd rounds
function chaosAPlayer(round: number): Player { return round % 2 === 0 ? "Jan" : "Luca"; }

function ChaosGame({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<"menu" | "mp_setup" | "play">("menu");
  const [mpCode, setMpCode] = useState("");
  const [mpRole, setMpRole] = useState<"host" | "guest">("host");
  const [mpPlayer, setMpPlayer] = useState<Player>("Jan");
  const [timeLeft, setTimeLeft] = useState(WRITING_SECS);
  const advancedKey = useRef("");
  const { session } = useMpSession(screen === "play", mpCode);

  const mpState: ChaosState | null =
    session?.state && Object.keys(session.state).length
      ? (session.state as unknown as ChaosState)
      : null;

  // Countdown
  useEffect(() => {
    if (!mpState || mpState.phase !== "writing") return;
    const start = mpState.timerStart;
    function tick() { setTimeLeft(Math.max(0, Math.ceil(WRITING_SECS - (Date.now() - start) / 1000))); }
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpState?.round, mpState?.phase, mpState?.timerStart]);

  // Host: auto-advance phases
  useEffect(() => {
    if (!mpState || !session || mpRole !== "host") return;
    const key = `${mpState.round}:${mpState.phase}`;
    if (advancedKey.current === key) return;

    if (mpState.phase === "writing") {
      const both = Object.keys(mpState.answers).length >= 2;
      const elapsed = (Date.now() - mpState.timerStart) / 1000;
      if (both || elapsed >= WRITING_SECS) {
        advancedKey.current = key;
        void patchSession(session.id, { state: { ...mpState, phase: "voting" } });
      }
    }
    if (mpState.phase === "voting") {
      const both = Object.keys(mpState.votes).length >= 2;
      if (both) {
        advancedKey.current = key;
        const s = { ...mpState.scores };
        Object.values(mpState.votes).forEach((p) => { s[p] = (s[p] ?? 0) + 1; });
        void patchSession(session.id, { state: { ...mpState, phase: "reveal", scores: s } });
      }
    }
  }, [mpState, session, mpRole]);

  function handleMpStart(code: string, role: "host" | "guest", player: Player) {
    setMpCode(code); setMpRole(role); setMpPlayer(player);
    setScreen("play");
    if (role === "host") {
      const idxs = [...Array(CHAOS_SCENARIOS.length).keys()];
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j]!, idxs[i]!];
      }
      void patchSession(code, {
        state: {
          round: 0,
          scenarios: idxs.slice(0, CHAOS_ROUNDS),
          phase: "writing",
          answers: {},
          votes: {},
          scores: { Jan: 0, Luca: 0 },
          timerStart: Date.now(),
        } as ChaosState,
      });
    }
  }

  async function submitAnswer(choice: string) {
    if (!mpState || !session || mpState.answers[mpPlayer]) return;
    const a = { ...mpState.answers, [mpPlayer]: choice };
    await patchSession(session.id, { state: { ...mpState, answers: a } });
  }

  async function submitVote(votedFor: Player) {
    if (!mpState || !session || mpState.votes[mpPlayer]) return;
    await patchSession(session.id, { state: { ...mpState, votes: { ...mpState.votes, [mpPlayer]: votedFor } } });
  }

  async function nextRound() {
    if (!mpState || !session || mpRole !== "host") return;
    const next = mpState.round + 1;
    if (next >= CHAOS_ROUNDS) {
      await patchSession(session.id, { state: { ...mpState, phase: "done" } });
    } else {
      await patchSession(session.id, {
        state: { ...mpState, round: next, phase: "writing", answers: {}, votes: {}, timerStart: Date.now() },
      });
    }
  }

  const backBtn = (label: string, onClick: () => void) => (
    <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onClick} type="button">{label}</button>
  );

  // ── menu ──
  if (screen === "menu") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          {backBtn("← Games", onBack)}
          <span className="text-xl font-black text-[#0e302e]">Improv Chaos 🎭</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <p className="text-sm font-semibold leading-6 text-[#5b6f68]">
            Ein absurdes Kreta-Szenario erscheint. Beide wählen gleichzeitig eine von 6 witzigen Antworten – 45 Sekunden.
            Dann wird gevoted. Wer am meisten Stimmen sammelt, gewinnt. 10 Runden aus über 130 Szenarien mit je 6 Antworten.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            {["🎭 130+ Szenarien", "🎲 6 Antworten pro Runde", "⏱ 45 Sek. pro Runde", "🗳 Anonymes Voting", "📱 2 Handys"].map((t) => (
              <span key={t} className="rounded-full bg-[#eff6f2] px-3 py-1.5 text-[#125f68]">{t}</span>
            ))}
          </div>
          <button className="btn-sheen mt-5 min-h-12 w-full rounded-[18px] bg-[#e8344a] font-black text-white" onClick={() => setScreen("mp_setup")} type="button">
            Chaos starten 🎭
          </button>
        </div>
      </div>
    );
  }

  // ── mp_setup ──
  if (screen === "mp_setup") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          {backBtn("← Zurück", () => setScreen("menu"))}
          <span className="text-xl font-black text-[#0e302e]">Multiplayer Setup</span>
        </div>
        <div className="ios-glass-card rounded-[28px] p-5">
          <MpSetup game="chaos" onStart={handleMpStart} />
        </div>
      </div>
    );
  }

  // ── play: loading ──
  if (!mpState) {
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Games", onBack)}</div>
        <div className="ios-glass-card flex min-h-[200px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Warte auf Spielstart …</p>
        </div>
      </div>
    );
  }

  const scenarioIdx = mpState.scenarios[mpState.round] ?? 0;
  const scenarioData = CHAOS_SCENARIOS[scenarioIdx] ?? CHAOS_SCENARIOS[0]!;
  const scenario = scenarioData.text;
  const aPlayer = chaosAPlayer(mpState.round);
  const bPlayer: Player = aPlayer === "Jan" ? "Luca" : "Jan";
  const otherPlayer: Player = mpPlayer === "Jan" ? "Luca" : "Jan";
  const roundLabel = `${mpState.round + 1} / ${CHAOS_ROUNDS}`;

  // Shuffle option order per player/round/scenario so it never feels static,
  // without needing to sync order between host and guest.
  const shuffledOptions = useMemo(() => {
    const seed = `${scenarioIdx}:${mpState.round}:${mpPlayer}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const arr = [...scenarioData.options];
    for (let i = arr.length - 1; i > 0; i--) {
      h = (h * 1103515245 + 12345) >>> 0;
      const j = h % (i + 1);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdx, mpState.round, mpPlayer]);

  const RoundHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {backBtn("← Games", onBack)}
        <span className="font-black text-[#789087]">Runde {roundLabel}</span>
      </div>
      <span className="text-sm font-black text-[#e8344a]">
        {mpState.scores.Jan ?? 0} : {mpState.scores.Luca ?? 0}
      </span>
    </div>
  );

  // ── done ──
  if (mpState.phase === "done") {
    const j = mpState.scores.Jan ?? 0;
    const l = mpState.scores.Luca ?? 0;
    const winner = j === l ? "Unentschieden 🤝" : j > l ? "Jan 🏆" : "Luca 🏆";
    return (
      <div className="grid gap-5">
        <div className="flex items-center gap-3">{backBtn("← Games", onBack)}</div>
        <div className="ios-glass-card rounded-[28px] p-6 text-center">
          <p className="text-6xl">🎭</p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[#789087]">Game Over</p>
          <p className="mt-2 text-4xl font-black text-[#0e302e]">{winner}</p>
          <p className="mt-2 font-bold text-[#789087]">Jan {j} · Luca {l} Punkte</p>
          <p className="mt-4 text-sm font-semibold text-[#789087]">
            {j > l ? "Jan ist das kretischste Komik-Talent." : l > j ? "Luca hat Kreta im Blut." : "Unschlagbar zusammen. Wie immer."}
          </p>
          <button className="btn-sheen mt-6 min-h-12 w-full rounded-[18px] bg-[#e8344a] font-black text-white" onClick={() => setScreen("menu")} type="button">
            Nochmal
          </button>
        </div>
      </div>
    );
  }

  // ── writing ──
  if (mpState.phase === "writing") {
    const myAnswer = mpState.answers[mpPlayer];
    const otherAnswered = !!mpState.answers[otherPlayer];
    const pct = timeLeft / WRITING_SECS;
    const urgent = timeLeft <= 10;
    return (
      <div className="grid gap-4">
        <RoundHeader />
        {/* Timer bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#d7e3dc]">
          <div
            className={["h-full rounded-full transition-all duration-500", urgent ? "bg-[#e8344a]" : "bg-[#125f68]"].join(" ")}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="ios-glass-card min-w-0 max-w-full rounded-[28px] p-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 break-words text-xl font-black leading-snug text-[#0e302e]">{scenario}</p>
            <span className={["shrink-0 rounded-full px-3 py-1 text-sm font-black tabular-nums", urgent ? "bg-[#fee2e2] text-[#e8344a]" : "bg-[#eff6f2] text-[#125f68]"].join(" ")}>
              {timeLeft}s
            </span>
          </div>

          {!myAnswer ? (
            <div className="mt-4 grid gap-2.5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#789087]">Wähle deine witzigste Antwort</p>
              {shuffledOptions.map((opt, i) => (
                <button
                  key={i}
                  className="card-interactive min-w-0 max-w-full rounded-[18px] border border-[#cfe0d7] bg-white p-4 text-left"
                  onClick={() => void submitAnswer(opt)}
                  type="button"
                >
                  <span className="block min-w-0 whitespace-normal break-words text-base font-semibold leading-snug text-[#0e302e]">
                    {opt}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 min-w-0 rounded-[18px] bg-[#eff6f2] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#125f68]">Deine Antwort</p>
              <p className="mt-1 min-w-0 whitespace-normal break-words font-semibold text-[#0e302e]">"{myAnswer}"</p>
              <p className="mt-3 text-sm font-semibold text-[#789087]">
                {otherAnswered ? "✓ Beide haben gewählt – Voting startet gleich …" : `⏳ Warte auf ${otherPlayer} …`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── voting ──
  if (mpState.phase === "voting") {
    const myVote = mpState.votes[mpPlayer];
    const ansA = mpState.answers[aPlayer] ?? "– keine Antwort –";
    const ansB = mpState.answers[bPlayer] ?? "– keine Antwort –";
    const sameChoice = !!mpState.answers[aPlayer] && ansA === ansB;
    return (
      <div className="grid gap-4">
        <RoundHeader />
        <div className="ios-glass-card min-w-0 max-w-full rounded-[28px] p-4">
          <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#789087]">Welche Antwort ist witziger?</p>
          <p className="mt-2 min-w-0 whitespace-normal break-words text-center text-sm font-semibold leading-snug text-[#0e302e]">{scenario}</p>
        </div>
        {sameChoice && (
          <div className="rounded-[18px] bg-[#fef3c7] p-3 text-center">
            <p className="text-sm font-black text-[#7a4b00]">🧠 Gleicher Gedanke – Zwillingsseelen!</p>
          </div>
        )}
        {!myVote ? (
          <div className="grid gap-3">
            {([["A", aPlayer, ansA], ["B", bPlayer, ansB]] as [string, Player, string][]).map(([label, player, ans]) => (
              <button
                key={label}
                className="ios-glass-card card-interactive min-w-0 max-w-full rounded-[24px] p-5 text-left"
                onClick={() => void submitVote(player)}
                type="button"
              >
                <span className="inline-block rounded-full bg-[#e8344a] px-2.5 py-0.5 text-xs font-black text-white">Antwort {label}</span>
                <p className="mt-3 min-w-0 whitespace-normal break-words text-lg font-semibold leading-snug text-[#0e302e]">"{ans}"</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="ios-glass-card rounded-[28px] p-5 text-center">
            <p className="text-2xl">🗳️</p>
            <p className="mt-2 font-black text-[#0e302e]">Vote abgegeben!</p>
            <p className="mt-1 text-sm font-semibold text-[#789087]">Warte auf {otherPlayer} …</p>
          </div>
        )}
      </div>
    );
  }

  // ── reveal ──
  if (mpState.phase === "reveal") {
    const ansA = mpState.answers[aPlayer] ?? "–";
    const ansB = mpState.answers[bPlayer] ?? "–";
    const janVote = mpState.votes.Jan;
    const lucaVote = mpState.votes.Luca;
    const janPts = [janVote, lucaVote].filter((v) => v === "Jan").length;
    const lucaPts = [janVote, lucaVote].filter((v) => v === "Luca").length;
    const roundWinner = janPts === lucaPts ? null : janPts > lucaPts ? "Jan" : "Luca";
    return (
      <div className="grid gap-4">
        <RoundHeader />
        <div className="ios-glass-card min-w-0 max-w-full rounded-[28px] p-5">
          <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#789087]">Auflösung</p>
          <p className="mt-2 min-w-0 whitespace-normal break-words text-center text-sm font-semibold leading-snug text-[#0e302e]">{scenario}</p>
        </div>
        {ansA === ansB && (
          <div className="rounded-[18px] bg-[#fef3c7] p-3 text-center">
            <p className="text-sm font-black text-[#7a4b00]">🧠 Gleicher Gedanke – Zwillingsseelen!</p>
          </div>
        )}
        <div className="grid gap-3">
          {([["A", aPlayer, ansA], ["B", bPlayer, ansB]] as [string, Player, string][]).map(([label, player, ans]) => {
            const ptsThisRound = [janVote, lucaVote].filter((v) => v === player).length;
            const won = roundWinner === player;
            return (
              <div key={label} className={["min-w-0 max-w-full rounded-[24px] p-5", won ? "bg-[#0e5558] text-white" : "bg-[#eff6f2] text-[#0e302e]"].join(" ")}>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={["shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black", won ? "bg-white/20 text-white" : "bg-[#e8344a] text-white"].join(" ")}>Antwort {label}</span>
                    <span className="shrink-0 font-black">{player}</span>
                  </div>
                  <span className={["shrink-0 text-lg font-black", won ? "text-[#9de7dc]" : "text-[#789087]"].join(" ")}>
                    {won ? "👑 " : ""}{ptsThisRound} Pkt.
                  </span>
                </div>
                <p className={["mt-3 min-w-0 whitespace-normal break-words text-base font-semibold leading-snug", won ? "text-white/90" : ""].join(" ")}>"{ans}"</p>
                <p className={["mt-2 text-xs font-semibold", won ? "text-white/60" : "text-[#789087]"].join(" ")}>
                  Jan → {janVote ?? "?"} · Luca → {lucaVote ?? "?"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="rounded-[20px] bg-[#fef3c7] p-4 text-center">
          <p className="font-black text-[#7a4b00]">
            {roundWinner ? `${roundWinner} gewinnt die Runde!` : "Unentschieden – beide witzig!"} · Stand: Jan {mpState.scores.Jan ?? 0} · Luca {mpState.scores.Luca ?? 0}
          </p>
        </div>
        {mpRole === "host" ? (
          <button className="btn-sheen min-h-12 w-full rounded-[18px] bg-[#e8344a] font-black text-white" onClick={() => void nextRound()} type="button">
            {mpState.round + 1 >= CHAOS_ROUNDS ? "Ergebnis ansehen 🏆" : "Nächste Runde →"}
          </button>
        ) : (
          <p className="text-center text-sm font-semibold text-[#789087]">Warte auf Host …</p>
        )}
      </div>
    );
  }

  return null;
}

// ─── GAME LOBBY ───────────────────────────────────────────────────────────────

const games: { id: GameId; emoji: string; title: string; desc: string; tag: string }[] = [
  { id: "seeschlacht", emoji: "⚓", title: "Kreta Seeschlacht", desc: "Schiffe versenken — Raum-Code, Flotte platzieren, angreifen, gewinnen. Kretisches Seemannsduell.", tag: "✨ Neu" },
  { id: "pixel",       emoji: "🎨", title: "Pixel Art",         desc: "Gemeinsam ein Bild aufbauen — Frangokastello, Kri-Kri oder einfach frei malen.", tag: "✨ Neu" },
  { id: "soundscape",  emoji: "🎵", title: "Kreta Klangwelt",   desc: "Mischt eure eigene Kreta-Atmosphäre: Wellen, Zikaden, Taverna-Musik und mehr.", tag: "✨ Neu" },
  { id: "chaos",       emoji: "🎭", title: "Improv Chaos",      desc: "Absurdes Kreta-Szenario, 6 witzige Antworten zur Auswahl, dann voten. 130+ Situationen.", tag: "🔥 Heiß" },
  { id: "mindmatch",   emoji: "🧠", title: "Mind Match",        desc: "Beide tippen gleichzeitig — ohne zu reden. Wie gut kennt ihr euch? 80+ Fragen.", tag: "Kooperativ" },
  { id: "krikri",      emoji: "🐐", title: "Kri-Kri Blitz",     desc: "Reaktions-Duell. Warte auf das Kri-Kri und tippe schneller als der Berg.", tag: "Reaktion" },
  { id: "trivia",      emoji: "🏛️", title: "Kreta Trivia",      desc: "15 Fragen über Kreta, Knossos, Dakos und eure Reise.", tag: "Wissen" },
  { id: "distance",    emoji: "🧭", title: "Insel-Kompass",     desc: "Schätze die Luftlinie von eurem Hotel zu 15 Orten auf Kreta.", tag: "Entfernung" },
];

function GameLobby({ onBack, onPlay }: { onBack: () => void; onPlay: (id: GameId) => void }) {
  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b3435,#116b70_58%,#e8a94a)] p-5 text-white shadow-[0_24px_65px_rgba(14,48,46,0.24)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-8 -top-10 text-[150px] opacity-15">🎮</div>
        <button
          className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur transition hover:bg-white/20"
          onClick={onBack}
          type="button"
        >
          ← Dashboard
        </button>
        <p className="relative z-10 mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">Mini Games · Kreta Edition</p>
        <h2 className="relative z-10 mt-2 text-4xl font-black leading-none sm:text-5xl">Game Hub</h2>
        <p className="relative z-10 mt-3 max-w-xl text-base font-semibold leading-7 text-white/80">
          8 Spiele für Jan &amp; Luca – solo, kooperativ und live auf zwei Handys.
        </p>
      </section>

      <section className="grid gap-3">
        {games.map((g) => (
          <button
            key={g.id}
            className="ios-glass-card card-interactive flex items-start gap-4 rounded-[24px] p-5 text-left"
            onClick={() => onPlay(g.id)}
            type="button"
          >
            <span className="text-4xl leading-none">{g.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#0e302e]">{g.title}</span>
                <span className="rounded-full bg-[#e7f4ee] px-2.5 py-0.5 text-xs font-black text-[#125f68]">{g.tag}</span>
              </div>
              <span className="mt-1 block text-sm font-semibold leading-6 text-[#5b6f68]">{g.desc}</span>
            </div>
            <span className="mt-1 text-xl text-[#cfe0d7]">›</span>
          </button>
        ))}
      </section>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function MiniGamesView({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<AppScreen>("lobby");

  if (screen === "seeschlacht") return <SeeschlachtView onBack={() => setScreen("lobby")} />;
  if (screen === "pixel")       return <PixelArtView    onBack={() => setScreen("lobby")} />;
  if (screen === "soundscape")  return <SoundscapeView  onBack={() => setScreen("lobby")} />;
  if (screen === "chaos")       return <ChaosGame       onBack={() => setScreen("lobby")} />;
  if (screen === "mindmatch")   return <MindMatchGame   onBack={() => setScreen("lobby")} />;
  if (screen === "krikri")      return <KriKriGame      onBack={() => setScreen("lobby")} />;
  if (screen === "trivia")      return <TriviaGame      onBack={() => setScreen("lobby")} />;
  if (screen === "distance")    return <DistanceGame    onBack={() => setScreen("lobby")} />;
  return <GameLobby onBack={onBack} onPlay={setScreen} />;
}

