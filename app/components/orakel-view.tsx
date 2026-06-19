"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

type BetType = "player" | "yesno";
type BetValue = "Jan" | "Luca" | "ja" | "nein" | null;

interface OrakelQ {
  text: string;
  type: BetType;
  emoji: string;
  hint?: string; // kleine Erklärung wann auflösbar
}

const QUESTIONS: OrakelQ[] = [
  // Persönlich – Jan & Luca
  { text: "Wer bekommt den schlimmeren Sonnenbrand?", type: "player", emoji: "☀️", hint: "Am Ende der Reise vergleichen" },
  { text: "Wer macht auf der ganzen Reise mehr Fotos?", type: "player", emoji: "📸", hint: "Handyspeicher checken am letzten Tag" },
  { text: "Wer schläft durchschnittlich länger?", type: "player", emoji: "😴", hint: "Gefühl nach 3 Tagen" },
  { text: "Wer ist der bessere Navigator?", type: "player", emoji: "🧭", hint: "Gemeinsam bewerten am Ende" },
  { text: "Wer lernt bis Abreise mehr griechische Wörter?", type: "player", emoji: "🇬🇷", hint: "Kleines Abfrage-Quiz am letzten Abend" },
  { text: "Wer isst mutiger / exotischer auf der ganzen Reise?", type: "player", emoji: "🐙", hint: "Auflösung am letzten Abend" },
  { text: "Wer findet zuerst eine Urlaubskatze und benennt sie?", type: "player", emoji: "🐈", hint: "Sobald es passiert!" },
  { text: "Wer spricht mehr mit Einheimischen?", type: "player", emoji: "💬", hint: "Gefühl nach der Reise" },
  { text: "Wer verbraucht mehr Sonnencreme insgesamt?", type: "player", emoji: "🧴", hint: "Tube-Vergleich am Ende" },
  { text: "Wer kauft mehr unnötiges Zeug?", type: "player", emoji: "🛍️", hint: "Koffer-Inhalt am Heimtag" },
  // Ereignisse – ja/nein
  { text: "Wird die Samaria-Schlucht komplett gewandert?", type: "yesno", emoji: "⛰️", hint: "Nach dem Wandertag" },
  { text: "Jan springt von einer Klippe ins Meer", type: "yesno", emoji: "🪨", hint: "Sobald es passiert – oder halt nicht" },
  { text: "Luca fällt irgendwann unfreiwillig ins Wasser", type: "yesno", emoji: "💦", hint: "Spontan" },
  { text: "Es gibt mindestens einen echten Regentag", type: "yesno", emoji: "🌧️", hint: "Wetter beobachten" },
  { text: "Jan und Luca finden ein Lokal das nicht auf Google Maps steht", type: "yesno", emoji: "🍴", hint: "Wenn Lokal entdeckt wird" },
  { text: "Das erste unbestellte Raki kommt schon am Tag 1", type: "yesno", emoji: "🥃", hint: "Tag 1 abends" },
  { text: "Mindestens ein geplanter Tag wird spontan komplett umgeworfen", type: "yesno", emoji: "🎲", hint: "Wenn es passiert" },
  { text: "Luca kauft mindestens 3 Souvenirs", type: "yesno", emoji: "🪴", hint: "Heimreisetag" },
  { text: "Das beste Essen kommt aus einer Taverna ohne Speisekarte", type: "yesno", emoji: "🫒", hint: "Wenn Essen des Urlaubs feststeht" },
  { text: "Frangokastello wird zum absoluten Lieblingsort erklärt", type: "yesno", emoji: "🏰", hint: "Meinungsabgleich am letzten Tag" },
  { text: "Es gibt mindestens einen Moment wo beide gleichzeitig 'wow' sagen", type: "yesno", emoji: "🌅", hint: "Spontan!" },
  { text: "Jan ist am letzten Abend melancholisch wegen der Abreise", type: "yesno", emoji: "😶", hint: "Letzter Abend" },
  { text: "Die Reise wird spontan um mindestens einen Tag verlängert", type: "yesno", emoji: "🔁", hint: "Falls es passiert" },
  { text: "Das letzte Foto der Reise zeigt Jan & Luca zusammen", type: "yesno", emoji: "📱", hint: "Letztes Foto im Handyspeicher" },
  { text: "Kreta wird für den nächsten Sommer sofort wieder gebucht", type: "yesno", emoji: "✈️", hint: "Im Flieger nach Hause" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = "Jan" | "Luca";

interface OrakelBet {
  idx: number;
  janBet: BetValue;
  lucaBet: BetValue;
  result: BetValue;
  resolvedAt: string | null;
}

interface OrakelState {
  bets: OrakelBet[];
  scores: Record<string, number>;
}

interface OrakelSession {
  id: string;
  state: OrakelState;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchOrakel(): Promise<OrakelSession> {
  const res = await fetch("/api/orakel", { cache: "no-store" });
  return res.json() as Promise<OrakelSession>;
}

async function patchOrakel(state: OrakelState): Promise<OrakelSession> {
  const res = await fetch("/api/orakel", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  return res.json() as Promise<OrakelSession>;
}

// ─── Component ────────────────────────────────────────────────────────────────

type OrakelScreen = "list" | "detail";
type Filter = "alle" | "offen" | "aktiv" | "fertig";

const PLAYER_KEY = "orakel-player";

export default function OrakelView({ onBack }: { onBack: () => void }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<OrakelSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState<OrakelScreen>("list");
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("alle");

  // Load saved player identity
  useEffect(() => {
    const saved = localStorage.getItem(PLAYER_KEY) as Player | null;
    if (saved === "Jan" || saved === "Luca") setPlayer(saved);
  }, []);

  function choosePlayer(p: Player) {
    localStorage.setItem(PLAYER_KEY, p);
    setPlayer(p);
  }

  const load = useCallback(async () => {
    try {
      const s = await fetchOrakel();
      setSession(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Player selection ──
  if (!player) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Dashboard</button>
        </div>
        <div className="ios-glass-card rounded-[28px] p-6 text-center">
          <p className="text-4xl">🔮</p>
          <p className="mt-3 text-xl font-black text-[#0e302e]">Wer bist du?</p>
          <p className="mt-1 text-sm font-semibold text-[#789087]">Wird auf diesem Gerät gespeichert.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["Jan", "Luca"] as Player[]).map((p) => (
              <button key={p} className="btn-sheen min-h-14 rounded-[18px] bg-[#4a1070] text-xl font-black text-white" onClick={() => choosePlayer(p)} type="button">{p}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const state = session?.state;

  function getBet(idx: number): OrakelBet | undefined {
    return state?.bets[idx];
  }

  async function placeBet(idx: number, bet: BetValue) {
    if (!state || saving) return;
    setSaving(true);
    const newBets = state.bets.map((b) =>
      b.idx === idx
        ? { ...b, [player === "Jan" ? "janBet" : "lucaBet"]: bet }
        : b,
    );
    const updated = await patchOrakel({ ...state, bets: newBets });
    setSession(updated);
    setSaving(false);
  }

  async function resolvebet(idx: number, result: BetValue) {
    if (!state || saving) return;
    setSaving(true);
    const bet = state.bets[idx]!;
    const janCorrect = bet.janBet === result ? 1 : 0;
    const lucaCorrect = bet.lucaBet === result ? 1 : 0;
    const newScores = {
      Jan: (state.scores.Jan ?? 0) + janCorrect,
      Luca: (state.scores.Luca ?? 0) + lucaCorrect,
    };
    const newBets = state.bets.map((b) =>
      b.idx === idx
        ? { ...b, result, resolvedAt: new Date().toISOString() }
        : b,
    );
    const updated = await patchOrakel({ bets: newBets, scores: newScores });
    setSession(updated);
    setSaving(false);
    setScreen("list");
  }

  // ── Loading ──
  if (loading || !state) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Dashboard</button>
        </div>
        <div className="ios-glass-card flex min-h-[200px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Orakel wird geladen …</p>
        </div>
      </div>
    );
  }

  const bets = state.bets;
  const resolved = bets.filter((b) => b.result !== null);
  const bothPlaced = bets.filter((b) => b.janBet && b.lucaBet && !b.result);
  const open = bets.filter((b) => !b.janBet || !b.lucaBet).filter((b) => !b.result);
  const myOpen = open.filter((b) => !(player === "Jan" ? b.janBet : b.lucaBet));

  // ── Detail ──
  if (screen === "detail" && selected !== null) {
    const bet = getBet(selected)!;
    const q = QUESTIONS[selected]!;
    const myBetKey = player === "Jan" ? "janBet" : "lucaBet";
    const otherBetKey = player === "Jan" ? "lucaBet" : "janBet";
    const otherPlayer: Player = player === "Jan" ? "Luca" : "Jan";
    const myBet = bet[myBetKey] as BetValue;
    const otherBet = bet[otherBetKey] as BetValue;
    const isResolved = bet.result !== null;

    const optA: BetValue = q.type === "player" ? "Jan" : "ja";
    const optB: BetValue = q.type === "player" ? "Luca" : "nein";
    const labelA = q.type === "player" ? "Jan" : "Ja";
    const labelB = q.type === "player" ? "Luca" : "Nein";

    const janCorrect = isResolved && bet.janBet === bet.result;
    const lucaCorrect = isResolved && bet.lucaBet === bet.result;
    const myCorrect = isResolved && myBet === bet.result;

    return (
      <div className="grid gap-4 overflow-x-clip">
        <div className="flex items-center gap-3">
          <button className="min-h-10 rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={() => setScreen("list")} type="button">← Orakel</button>
          <span className="text-sm font-black text-[#789087]">Wette {selected + 1}/25</span>
        </div>

        <div className="ios-glass-card rounded-[28px] p-5">
          <span className="text-3xl">{q.emoji}</span>
          <p className="mt-3 text-xl font-black leading-snug text-[#0e302e]">{q.text}</p>
          {q.hint && <p className="mt-2 text-xs font-semibold text-[#789087]">💡 {q.hint}</p>}
        </div>

        {/* Bets */}
        {!isResolved && (
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#789087]">Deine Wette ({player})</p>
            <div className="grid grid-cols-2 gap-2">
              {([optA, optB] as BetValue[]).map((opt, i) => {
                const label = i === 0 ? labelA : labelB;
                const picked = myBet === opt;
                return (
                  <button
                    key={String(opt)}
                    className={["min-h-14 rounded-[18px] text-base font-black transition active:scale-[0.97]",
                      picked ? "bg-[#125f68] text-white shadow-[0_0_0_3px_#9de7dc]" : "bg-[#eff6f2] text-[#0e302e]"].join(" ")}
                    disabled={saving}
                    onClick={() => void placeBet(selected, opt)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Other's bet status */}
            <div className="rounded-[14px] bg-[#eff6f2] p-3 text-sm font-semibold text-[#789087]">
              {otherBet
                ? <span className="text-[#125f68]">✓ {otherPlayer} hat bereits gewettet</span>
                : <span>⏳ {otherPlayer} hat noch nicht gewettet</span>}
            </div>
          </div>
        )}

        {/* Revealed bets if both placed */}
        {!isResolved && bet.janBet && bet.lucaBet && (
          <div className="rounded-[20px] bg-[#fff1d8] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a4b00]">Beide haben gewettet!</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-white/70 p-3 text-center">
                <p className="text-xs font-black text-[#789087]">Jan</p>
                <p className="mt-1 text-lg font-black text-[#0e302e]">{bet.janBet}</p>
              </div>
              <div className="rounded-[12px] bg-white/70 p-3 text-center">
                <p className="text-xs font-black text-[#789087]">Luca</p>
                <p className="mt-1 text-lg font-black text-[#0e302e]">{bet.lucaBet}</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[#7a4b00]">Ergebnis auflösen:</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([optA, optB] as BetValue[]).map((opt, i) => (
                <button
                  key={String(opt)}
                  className="min-h-11 rounded-[14px] bg-[#f0a23a] font-black text-[#0e302e] active:scale-[0.97]"
                  disabled={saving}
                  onClick={() => void resolvebet(selected, opt)}
                  type="button"
                >
                  {i === 0 ? labelA : labelB}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resolved */}
        {isResolved && (
          <div className={["rounded-[24px] p-5 text-center", myCorrect ? "bg-[#0e5558] text-white" : "bg-[#eff6f2] text-[#0e302e]"].join(" ")}>
            <p className="text-3xl">{myCorrect ? "🎯" : "💀"}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] opacity-70">Ergebnis</p>
            <p className="mt-1 text-3xl font-black">{bet.result}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["Jan", "Luca"] as Player[]).map((p) => {
                const pBet = p === "Jan" ? bet.janBet : bet.lucaBet;
                const correct = pBet === bet.result;
                return (
                  <div key={p} className={["rounded-[12px] p-3 text-center", myCorrect ? "bg-white/15" : "bg-white/60"].join(" ")}>
                    <p className="text-xs font-black opacity-70">{p}</p>
                    <p className="mt-1 font-black">{pBet ?? "–"}</p>
                    <p className="text-xs font-semibold">{correct ? "✓ +1 Pkt." : "✗"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Filtered list ──
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "offen", label: `Offen (${myOpen.length})` },
    { key: "aktiv", label: `Aktiv (${bothPlaced.length})` },
    { key: "fertig", label: `Aufgelöst (${resolved.length})` },
  ];

  const filteredBets = bets.filter((b) => {
    if (filter === "offen") return !b.result && !(player === "Jan" ? b.janBet : b.lucaBet);
    if (filter === "aktiv") return !b.result && b.janBet && b.lucaBet;
    if (filter === "fertig") return b.result !== null;
    return true;
  });

  return (
    <div className="grid gap-5 overflow-x-clip">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1a0533,#4a1070_55%,#e8a94a)] p-5 text-white shadow-[0_24px_65px_rgba(30,5,60,0.28)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-6 -top-8 text-[130px] opacity-15">🔮</div>
        <button className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur" onClick={onBack} type="button">← Dashboard</button>
        <p className="relative z-10 mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#d4a8f5]">Kreta Orakel · Jul 2026</p>
        <h2 className="relative z-10 mt-2 text-4xl font-black leading-none sm:text-5xl">Reisewetten</h2>
        <p className="relative z-10 mt-3 text-base font-semibold leading-7 text-white/80">
          25 Wetten über Jan & Lucas Kreta-Reise. Tippen, wetten, am Ende abrechnen.
        </p>
        {/* Score */}
        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          {(["Jan", "Luca"] as Player[]).map((p) => (
            <div key={p} className="rounded-[14px] bg-white/15 px-3 py-2 backdrop-blur">
              <p className="text-xs font-black text-white/70">{p}</p>
              <p className="text-2xl font-black tabular-nums">{state.scores[p] ?? 0} <span className="text-sm font-semibold text-white/70">Pkt.</span></p>
            </div>
          ))}
          <div className="rounded-[14px] bg-white/15 px-3 py-2 backdrop-blur">
            <p className="text-xs font-black text-white/70">Aufgelöst</p>
            <p className="text-2xl font-black tabular-nums">{resolved.length}<span className="text-sm font-semibold text-white/70">/25</span></p>
          </div>
        </div>
      </section>

      {/* My open bets alert */}
      {myOpen.length > 0 && (
        <div className="flex items-center gap-3 rounded-[18px] bg-[#fff1d8] px-4 py-3">
          <span className="text-xl">⚡</span>
          <div className="flex-1">
            <p className="text-sm font-black text-[#7a4b00]">{myOpen.length} Wette{myOpen.length !== 1 ? "n" : ""} warten auf dich ({player})</p>
          </div>
          <button className="rounded-full bg-[#f0a23a] px-3 py-1 text-xs font-black text-[#0e302e]" onClick={() => setFilter("offen")} type="button">Anzeigen</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={["shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
              filter === f.key ? "bg-[#4a1070] text-white" : "bg-[#eff6f2] text-[#0e302e]"].join(" ")}
            onClick={() => setFilter(f.key)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bet list */}
      <div className="grid gap-2 overflow-x-clip">
        {filteredBets.map((bet) => {
          const q = QUESTIONS[bet.idx]!;
          const myBet = (player === "Jan" ? bet.janBet : bet.lucaBet) as BetValue;
          const otherBet = (player === "Jan" ? bet.lucaBet : bet.janBet) as BetValue;
          const isResolved = bet.result !== null;
          const myCorrect = isResolved && myBet === bet.result;
          const bothBet = !!(bet.janBet && bet.lucaBet);

          let statusColor = "bg-[#eff6f2]";
          let statusIcon = "⚪";
          if (isResolved) { statusColor = myCorrect ? "bg-[#e7f4ee]" : "bg-[#fee2e2]"; statusIcon = myCorrect ? "✅" : "❌"; }
          else if (bothBet) { statusColor = "bg-[#fff1d8]"; statusIcon = "🟡"; }
          else if (myBet) { statusColor = "bg-[#eff6f2]"; statusIcon = "🔵"; }

          return (
            <button
              key={bet.idx}
              className={["flex items-center gap-4 rounded-[20px] p-4 text-left transition active:scale-[0.99] hover:shadow-sm", statusColor].join(" ")}
              onClick={() => { setSelected(bet.idx); setScreen("detail"); }}
              type="button"
            >
              <span className="text-2xl leading-none">{q.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#0e302e]">{q.text}</p>
                <p className="mt-0.5 text-xs font-semibold text-[#789087]">
                  {isResolved
                    ? `Ergebnis: ${bet.result} · ${myCorrect ? "Du liegst richtig!" : "Daneben"}`
                    : myBet
                    ? `Deine Wette: ${myBet}${otherBet ? ` · ${player === "Jan" ? "Luca" : "Jan"}: ${otherBet}` : " · andere wartet"}`
                    : "Noch keine Wette platziert"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{statusIcon}</span>
                <span className="text-[#cfe0d7]">›</span>
              </div>
            </button>
          );
        })}
        {filteredBets.length === 0 && (
          <p className="py-8 text-center text-sm font-semibold text-[#789087]">Keine Wetten in dieser Kategorie.</p>
        )}
      </div>
    </div>
  );
}
