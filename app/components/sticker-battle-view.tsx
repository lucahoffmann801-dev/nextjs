"use client";

import { useEffect, useRef, useState } from "react";

// ─── Data layer ───────────────────────────────────────────────────────────────

interface StickerState {
  lucaCount: number;
  janCount: number;
  updatedAt: string;
}

async function fetchStickers(): Promise<StickerState> {
  const res = await fetch("/api/stickers", { cache: "no-store" });
  if (!res.ok) throw new Error("Sticker-Stand konnte nicht geladen werden.");
  return (await res.json()) as StickerState;
}

async function patchStickers(player: "Luca" | "Jan", delta: number): Promise<StickerState> {
  const res = await fetch("/api/stickers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, delta }),
  });
  if (!res.ok) throw new Error("Sticker-Stand konnte nicht aktualisiert werden.");
  return (await res.json()) as StickerState;
}

// ─── Small building blocks ────────────────────────────────────────────────────

function ClubCrest({ src, alt, emoji }: { src: string; alt: string; emoji: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eff6f2] text-3xl">
        {emoji}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="h-16 w-16 shrink-0 rounded-full object-contain"
      onError={() => setBroken(true)}
      src={src}
    />
  );
}

function CounterCard({
  name,
  club,
  crestSrc,
  crestEmoji,
  count,
  accentBg,
  accentText,
  leading,
  busy,
  onAdd,
  onSubtract,
}: {
  name: string;
  club: string;
  crestSrc: string;
  crestEmoji: string;
  count: number;
  accentBg: string;
  accentText: string;
  leading: boolean;
  busy: boolean;
  onAdd: () => void;
  onSubtract: () => void;
}) {
  return (
    <div className="ios-glass-card min-w-0 max-w-full rounded-[28px] p-5">
      <div className="flex min-w-0 items-center gap-3">
        <ClubCrest alt={`${club} Wappen`} emoji={crestEmoji} src={crestSrc} />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#0e302e]">{name}</p>
          <p className="truncate text-xs font-semibold text-[#789087]">{club}</p>
        </div>
        {leading && (
          <span className="ml-auto shrink-0 rounded-full bg-[#fef3c7] px-2.5 py-1 text-xs font-black text-[#7a4b00]">
            👑 Führt
          </span>
        )}
      </div>

      <p className={["mt-4 text-center text-6xl font-black tabular-nums", accentText].join(" ")}>{count}</p>
      <p className="mt-1 text-center text-xs font-semibold text-[#789087]">Sticker gesammelt</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          className="min-h-12 flex-1 rounded-[16px] border border-[#cfe0d7] bg-white text-xl font-black text-[#5b6f68] transition active:scale-95 disabled:opacity-40"
          disabled={busy || count <= 0}
          onClick={onSubtract}
          type="button"
        >
          −
        </button>
        <button
          className={["btn-sheen min-h-12 flex-[2] rounded-[16px] text-lg font-black text-white transition active:scale-95 disabled:opacity-60", accentBg].join(" ")}
          disabled={busy}
          onClick={onAdd}
          type="button"
        >
          + Sticker
        </button>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function StickerBattleView({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<StickerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlayer, setBusyPlayer] = useState<"Luca" | "Jan" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchStickers();
        if (!cancelled) { setState(data); setError(null); }
      } catch {
        if (!cancelled) setError("Verbindungsfehler – versuche es erneut.");
      }
    }

    void poll();
    pollRef.current = setInterval(() => void poll(), 2000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleChange(player: "Luca" | "Jan", delta: number) {
    if (!state) return;
    setBusyPlayer(player);
    // Optimistic update for a snappy feel; the next poll reconciles with the server.
    setState((prev) => {
      if (!prev) return prev;
      const key = player === "Luca" ? "lucaCount" : "janCount";
      return { ...prev, [key]: Math.max(0, prev[key] + delta) };
    });
    try {
      const updated = await patchStickers(player, delta);
      setState(updated);
      setError(null);
    } catch {
      setError("Änderung konnte nicht gespeichert werden – bitte nochmal versuchen.");
    } finally {
      setBusyPlayer(null);
    }
  }

  const lucaCount = state?.lucaCount ?? 0;
  const janCount = state?.janCount ?? 0;
  const total = lucaCount + janCount;
  const lucaLeads = lucaCount > janCount;
  const janLeads = janCount > lucaCount;

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0b3435,#116b70_58%,#e8a94a)] p-5 text-white shadow-[0_24px_65px_rgba(14,48,46,0.24)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-8 -top-10 text-[150px] opacity-15">⚽️</div>
        <button
          className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur transition hover:bg-white/20"
          onClick={onBack}
          type="button"
        >
          ← Games
        </button>
        <p className="relative z-10 mt-8 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">Sticker-Wettbewerb</p>
        <h2 className="relative z-10 mt-2 text-4xl font-black leading-none sm:text-5xl">Sammel-Duell</h2>
        <p className="relative z-10 mt-3 max-w-xl text-base font-semibold leading-7 text-white/80">
          Luca sammelt für den 1. FC Kaiserslautern, Jan für Schalke 04. Jeder Fund zählt – mit „−“ könnt ihr Tippfehler korrigieren.
        </p>
      </section>

      {error && (
        <div className="rounded-[18px] bg-[#fee2e2] p-3 text-center text-sm font-semibold text-[#b91c1c]">{error}</div>
      )}

      <section className="grid gap-3">
        <CounterCard
          accentBg="bg-[#C8102E]"
          accentText="text-[#C8102E]"
          busy={busyPlayer === "Luca"}
          club="1. FC Kaiserslautern"
          count={lucaCount}
          crestEmoji="🔴"
          crestSrc="/logos/fck.svg"
          leading={lucaLeads}
          name="Luca"
          onAdd={() => void handleChange("Luca", 1)}
          onSubtract={() => void handleChange("Luca", -1)}
        />
        <CounterCard
          accentBg="bg-[#004D9D]"
          accentText="text-[#004D9D]"
          busy={busyPlayer === "Jan"}
          club="FC Schalke 04"
          count={janCount}
          crestEmoji="🔵"
          crestSrc="/logos/schalke04.svg"
          leading={janLeads}
          name="Jan"
          onAdd={() => void handleChange("Jan", 1)}
          onSubtract={() => void handleChange("Jan", -1)}
        />
      </section>

      <section className="ios-glass-card rounded-[24px] p-4 text-center">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#789087]">Gesamt gesammelt</p>
        <p className="mt-1 text-3xl font-black tabular-nums text-[#0e302e]">{total}</p>
        <p className="mt-1 text-sm font-semibold text-[#789087]">
          {lucaLeads && `Luca führt mit ${lucaCount - janCount} Stickern Vorsprung.`}
          {janLeads && `Jan führt mit ${janCount - lucaCount} Stickern Vorsprung.`}
          {!lucaLeads && !janLeads && total === 0 && "Noch keine Sticker gesammelt – legt los!"}
          {!lucaLeads && !janLeads && total > 0 && "Unentschieden – Kopf an Kopf!"}
        </p>
      </section>
    </div>
  );
}
