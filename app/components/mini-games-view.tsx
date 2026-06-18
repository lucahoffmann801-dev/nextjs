"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "training" | "duel";
type Player = "Jan" | "Luca";
type Phase = "intro" | "ready" | "waiting" | "signal" | "result" | "complete";

type RoundResult = {
  player: Player;
  reactionMs: number;
  falseStart: boolean;
};

const trainingRounds = 5;
const duelRoundsPerPlayer = 3;
const falseStartPenalty = 1000;
const bestTimeStorageKey = "kreta-kri-kri-best-time";

const waitingLines = [
  "Das Kri-Kri schleicht noch hinter dem Felsen …",
  "Nicht zu früh. Die Ziege beobachtet euch.",
  "Wind, Zikaden, Spannung. Noch warten …",
  "Der Berg ruft. Aber noch nicht tippen.",
];

function average(results: RoundResult[]) {
  if (!results.length) return 0;
  return Math.round(results.reduce((sum, result) => sum + result.reactionMs, 0) / results.length);
}

function scoreLabel(milliseconds: number) {
  if (milliseconds < 230) return "Kri-Kri-Legende";
  if (milliseconds < 320) return "Bergziegen-Reflex";
  if (milliseconds < 450) return "Solider Strand-Sprint";
  return "Noch ein Frappé, dann klappt’s";
}

export default function MiniGamesView({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("training");
  const [phase, setPhase] = useState<Phase>("intro");
  const [player, setPlayer] = useState<Player>("Jan");
  const [results, setResults] = useState<RoundResult[]>([]);
  const [waitingLine, setWaitingLine] = useState(waitingLines[0]);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const signalStartedAt = useRef(0);
  const signalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const stored = Number.parseInt(window.localStorage.getItem(bestTimeStorageKey) ?? "", 10);
      if (Number.isFinite(stored) && stored > 0) setBestTime(stored);
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      if (signalTimer.current) clearTimeout(signalTimer.current);
    };
  }, []);

  const playerResults = useMemo(
    () => results.filter((result) => result.player === player),
    [player, results],
  );
  const latestResult = results.at(-1);
  const janResults = results.filter((result) => result.player === "Jan");
  const lucaResults = results.filter((result) => result.player === "Luca");
  const targetRounds = mode === "training" ? trainingRounds : duelRoundsPerPlayer;
  const currentRound =
    phase === "result"
      ? Math.max(1, playerResults.length)
      : Math.min(targetRounds, playerResults.length + 1);

  function clearSignalTimer() {
    if (!signalTimer.current) return;
    clearTimeout(signalTimer.current);
    signalTimer.current = null;
  }

  function startGame(nextMode: Mode) {
    clearSignalTimer();
    setMode(nextMode);
    setPlayer("Jan");
    setResults([]);
    setPhase("ready");
  }

  function armRound() {
    clearSignalTimer();
    setWaitingLine(waitingLines[Math.floor(Math.random() * waitingLines.length)]);
    setPhase("waiting");
    const delay = 1100 + Math.floor(Math.random() * 2300);
    signalTimer.current = setTimeout(() => {
      signalStartedAt.current = performance.now();
      signalTimer.current = null;
      setPhase("signal");
      navigator.vibrate?.(35);
    }, delay);
  }

  function recordResult(reactionMs: number, falseStart: boolean) {
    const rounded = Math.max(1, Math.round(reactionMs));
    setResults((current) => [...current, { player, reactionMs: rounded, falseStart }]);
    if (!falseStart && (bestTime === null || rounded < bestTime)) {
      setBestTime(rounded);
      window.localStorage.setItem(bestTimeStorageKey, String(rounded));
    }
    setPhase("result");
  }

  function tapKriKri() {
    if (phase === "ready") {
      armRound();
      return;
    }
    if (phase === "waiting") {
      clearSignalTimer();
      recordResult(falseStartPenalty, true);
      return;
    }
    if (phase === "signal") {
      recordResult(performance.now() - signalStartedAt.current, false);
    }
  }

  function advanceRound() {
    const completedByPlayer = results.filter((result) => result.player === player).length;
    if (completedByPlayer < targetRounds) {
      setPhase("ready");
      return;
    }
    if (mode === "duel" && player === "Jan") {
      setPlayer("Luca");
      setPhase("ready");
      return;
    }
    setPhase("complete");
  }

  const duelWinner =
    phase === "complete" && mode === "duel"
      ? average(janResults) === average(lucaResults)
        ? "Unentschieden"
        : average(janResults) < average(lucaResults)
          ? "Jan"
          : "Luca"
      : null;

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b3435,#116b70_58%,#e8a94a)] p-5 text-white shadow-[0_24px_65px_rgba(14,48,46,0.24)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-8 -top-10 text-[150px] opacity-15">
          🐐
        </div>
        <button
          className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur transition hover:bg-white/20"
          onClick={onBack}
          type="button"
        >
          ← Zurück zum Dashboard
        </button>
        <p className="relative z-10 mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">
          Mini Games · Kreta Edition
        </p>
        <h2 className="relative z-10 mt-2 text-4xl font-black leading-none sm:text-5xl">Kri-Kri Blitz</h2>
        <p className="relative z-10 mt-3 max-w-xl text-base font-semibold leading-7 text-white/80">
          Warten, bis das kretische Kri-Kri auftaucht – und dann schneller tippen als der Schatten am Berg.
          Wer zu früh zuckt, kassiert eine saftige Ziegenstrafe.
        </p>
      </section>

      {phase === "intro" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <button
            className="ios-glass-card card-interactive rounded-[24px] p-5 text-left"
            onClick={() => startGame("training")}
            type="button"
          >
            <span className="text-3xl" aria-hidden="true">⚡</span>
            <span className="mt-4 block text-xl font-black text-[#0e302e]">Training</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-[#5b6f68]">
              Fünf schnelle Runden. Jag deinen persönlichen Rekord.
            </span>
            {bestTime && (
              <span className="mt-4 inline-flex rounded-full bg-[#e7f4ee] px-3 py-1.5 text-xs font-black text-[#125f68]">
                Rekord: {bestTime} ms
              </span>
            )}
          </button>
          <button
            className="ios-glass-card card-interactive rounded-[24px] p-5 text-left"
            onClick={() => startGame("duel")}
            type="button"
          >
            <span className="text-3xl" aria-hidden="true">🏁</span>
            <span className="mt-4 block text-xl font-black text-[#0e302e]">Jan vs. Luca</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-[#5b6f68]">
              Drei Blitze pro Person auf diesem Gerät. Der bessere Schnitt gewinnt.
            </span>
            <span className="mt-4 inline-flex rounded-full bg-[#fff1d8] px-3 py-1.5 text-xs font-black text-[#7a4b00]">
              Kurzmatch · 2 Spieler
            </span>
          </button>
        </section>
      ) : (
        <section className="ios-glass-card overflow-hidden rounded-[28px] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#789087]">
                {mode === "training" ? "Training" : "Jan vs. Luca"}
              </p>
              <h3 className="mt-1 text-2xl font-black text-[#0e302e]">
                {phase === "complete" ? "Match beendet" : `${player} · Runde ${currentRound}/${targetRounds}`}
              </h3>
            </div>
            <button
              className="min-h-10 rounded-full bg-[#eff6f2] px-4 text-sm font-black text-[#125f68]"
              onClick={() => {
                clearSignalTimer();
                setPhase("intro");
              }}
              type="button"
            >
              Modus wechseln
            </button>
          </div>

          {phase === "complete" ? (
            <div className="mt-6 grid gap-4">
              <div className="rounded-[24px] bg-[#0e5558] p-6 text-center text-white">
                <p className="text-5xl" aria-hidden="true">{mode === "duel" ? "🏆" : "🐐"}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#9de7dc]">
                  {mode === "duel" ? "Kri-Kri-Champion" : "Training geschafft"}
                </p>
                <p className="mt-2 text-3xl font-black">
                  {mode === "duel" ? duelWinner : scoreLabel(average(results))}
                </p>
                {mode === "duel" ? (
                  <p className="mt-3 font-bold text-white/78">
                    Jan {average(janResults)} ms · Luca {average(lucaResults)} ms
                  </p>
                ) : (
                  <p className="mt-3 font-bold text-white/78">Ø {average(results)} ms · Rekord {bestTime ?? "–"} ms</p>
                )}
              </div>
              <button
                className="btn-sheen min-h-14 rounded-[18px] bg-[#f0a23a] px-5 text-base font-black text-[#0e302e]"
                onClick={() => startGame(mode)}
                type="button"
              >
                Revanche starten
              </button>
            </div>
          ) : (
            <>
              <button
                aria-live="polite"
                className={[
                  "mt-6 grid min-h-[300px] w-full place-items-center overflow-hidden rounded-[28px] border-2 p-6 text-center transition active:scale-[0.99]",
                  phase === "signal"
                    ? "border-[#ffc65c] bg-[#f0a23a] text-[#0e302e] shadow-[0_0_0_10px_rgba(240,162,58,0.16)]"
                    : phase === "waiting"
                      ? "border-[#164f52] bg-[#0d3e3f] text-white"
                      : "border-[#cfe0d7] bg-[#eff6f2] text-[#0e302e]",
                ].join(" ")}
                onClick={tapKriKri}
                type="button"
              >
                <span>
                  <span className="block text-7xl sm:text-8xl" aria-hidden="true">
                    {phase === "signal" ? "🐐" : phase === "waiting" ? "⛰️" : phase === "result" ? "⚡" : "👆"}
                  </span>
                  <span className="mt-5 block text-3xl font-black">
                    {phase === "signal"
                      ? "JETZT!"
                      : phase === "waiting"
                        ? "Warten …"
                        : phase === "result"
                          ? latestResult?.falseStart
                            ? "Zu früh!"
                            : `${latestResult?.reactionMs} ms`
                          : "Bereit?"}
                  </span>
                  <span className="mx-auto mt-3 block max-w-md text-sm font-bold leading-6 opacity-75">
                    {phase === "waiting"
                      ? waitingLine
                      : phase === "signal"
                        ? "Tippen! Das Kri-Kri ist da."
                        : phase === "result"
                          ? latestResult?.falseStart
                            ? `${falseStartPenalty} ms Strafzeit. Das Kri-Kri ist unbeeindruckt.`
                            : scoreLabel(latestResult?.reactionMs ?? 0)
                          : "Tippe zum Starten. Danach Hände stillhalten."}
                  </span>
                </span>
              </button>

              {phase === "result" && (
                <button
                  className="btn-sheen mt-4 min-h-14 w-full rounded-[18px] bg-[#125f68] px-5 text-base font-black text-white"
                  onClick={advanceRound}
                  type="button"
                >
                  {playerResults.length >= targetRounds
                    ? mode === "duel" && player === "Jan"
                      ? "Handy an Luca übergeben"
                      : "Ergebnis ansehen"
                    : "Nächster Blitz"}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="rounded-[22px] border border-[#d7e3dc] bg-white/58 p-4 text-sm font-semibold leading-6 text-[#5b6f68]">
        <p className="font-black text-[#0e302e]">Live-Duell auf zwei Handys</p>
        <p className="mt-1">
          Die App nutzt Supabase aktuell ausschließlich über serverseitige REST-Routen. Für ein sicheres
          Zwei-Handy-Duell braucht es zuerst eine freigegebene Realtime-Struktur mit passenden Regeln; Training
          und lokales Kurzmatch funktionieren bereits ohne neue Backend-Tabelle.
        </p>
      </section>
    </div>
  );
}
