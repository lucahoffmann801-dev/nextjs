"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameId = "krikri" | "trivia" | "distance";
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
      // join as guest
      await patchSession(upper, { guest: player === "Jan" ? "Luca" : "Jan" });
      setCode(upper);
      setRole("active");
      onStart(upper, "guest", player === "Jan" ? "Luca" : "Jan");
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

// ─── GAME LOBBY ───────────────────────────────────────────────────────────────

const games: { id: GameId; emoji: string; title: string; desc: string; tag: string }[] = [
  { id: "krikri", emoji: "🐐", title: "Kri-Kri Blitz", desc: "Reaktions-Duell. Warte auf das Kri-Kri und tippe schneller als der Berg.", tag: "Reaktion" },
  { id: "trivia", emoji: "🏛️", title: "Kreta Trivia", desc: "15 Fragen über Kreta, Knossos, Dakos und eure Reise. Wer kennt die Insel?", tag: "Wissen" },
  { id: "distance", emoji: "🧭", title: "Insel-Kompass", desc: "Schätze die Luftlinie von eurem Hotel zu 15 Orten auf Kreta.", tag: "Entfernung" },
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
          Drei Spiele für Jan & Luca – solo oder live auf zwei Handys via Supabase.
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

  if (screen === "krikri") return <KriKriGame onBack={() => setScreen("lobby")} />;
  if (screen === "trivia") return <TriviaGame onBack={() => setScreen("lobby")} />;
  if (screen === "distance") return <DistanceGame onBack={() => setScreen("lobby")} />;
  return <GameLobby onBack={onBack} onPlay={setScreen} />;
}
