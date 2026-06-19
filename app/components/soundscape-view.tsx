"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Sound definitions ────────────────────────────────────────────────────────

type SoundId = "wellen" | "zikaden" | "wind" | "grillen" | "hafen" | "taverna";

interface SoundDef {
  id: SoundId;
  label: string;
  emoji: string;
  desc: string;
  defaultVol: number;
  defaultMuted: boolean;
  maxGain: number; // ceiling so loud oscillators don't clip
}

const SOUNDS: SoundDef[] = [
  { id: "wellen",    label: "Meereswellen",    emoji: "🌊", desc: "Sanftes Auf und Ab",           defaultVol: 65, defaultMuted: false, maxGain: 0.55 },
  { id: "zikaden",   label: "Zikaden",          emoji: "🦗", desc: "Tagsüber allgegenwärtig",     defaultVol: 50, defaultMuted: false, maxGain: 0.12 },
  { id: "wind",      label: "Sommerwind",        emoji: "🌬️", desc: "Leises Rauschen",             defaultVol: 30, defaultMuted: false, maxGain: 0.35 },
  { id: "grillen",   label: "Grillen",           emoji: "🌃", desc: "Nächtliches Gezirpe",         defaultVol: 45, defaultMuted: true,  maxGain: 0.10 },
  { id: "hafen",     label: "Hafen",             emoji: "⛵", desc: "Möwen & Hafengeräusche",      defaultVol: 40, defaultMuted: true,  maxGain: 0.28 },
  { id: "taverna",   label: "Taverna-Melodie",   emoji: "🎵", desc: "Leise Bouzouki-Klänge",       defaultVol: 35, defaultMuted: true,  maxGain: 0.22 },
];

function computeGain(s: SoundDef, vol: number, isMuted: boolean): number {
  if (isMuted) return 0;
  return (vol / 100) * s.maxGain;
}

// ─── Web Audio synthesizers ───────────────────────────────────────────────────
// Each synthesizer receives a pre-created masterGain node and returns a cleanup fn.

function makeNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function synthWellen(ctx: AudioContext, masterGain: GainNode): () => void {
  const src = makeNoise(ctx);
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 260; lpf.Q.value = 1.0;

  // Slow swell LFO (0.10 Hz)
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.10; lfo.type = "sine";
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 0.5; // modulate masterGain up/down by 50% of its current value
  lfo.connect(lfoAmp);
  // LFO into gain.gain AudioParam for amplitude modulation
  lfoAmp.connect(masterGain.gain);

  src.connect(lpf);
  lpf.connect(masterGain);
  lfo.start(); src.start();
  return () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } };
}

function synthZikaden(ctx: AudioContext, masterGain: GainNode): () => void {
  const stops: (() => void)[] = [];
  [3700, 4200, 4900].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq; osc.type = "sawtooth";
    const trem = ctx.createOscillator();
    trem.frequency.value = 18 + i * 4; trem.type = "sine";
    const tremGain = ctx.createGain(); tremGain.gain.value = 0.4;
    const oscVol = ctx.createGain(); oscVol.gain.value = 1 / 3;
    trem.connect(tremGain); tremGain.connect(oscVol.gain);
    osc.connect(oscVol); oscVol.connect(masterGain);
    osc.start(); trem.start();
    stops.push(() => { try { osc.stop(); trem.stop(); } catch { /* already stopped */ } });
  });
  return () => stops.forEach((s) => s());
}

function synthWind(ctx: AudioContext, masterGain: GainNode): () => void {
  const src = makeNoise(ctx);
  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass"; bpf.frequency.value = 550; bpf.Q.value = 0.6;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18; lfo.type = "sine";
  const lfoAmp = ctx.createGain(); lfoAmp.gain.value = 0.35;
  lfo.connect(lfoAmp); lfoAmp.connect(masterGain.gain);

  src.connect(bpf); bpf.connect(masterGain);
  lfo.start(); src.start();
  return () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } };
}

function synthGrillen(ctx: AudioContext, masterGain: GainNode): () => void {
  const stops: (() => void)[] = [];
  [7300, 8200, 9100].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq; osc.type = "square";
    const trem = ctx.createOscillator();
    trem.frequency.value = 28 + i * 5; trem.type = "square";
    const tremGain = ctx.createGain(); tremGain.gain.value = 0.35;
    const oscVol = ctx.createGain(); oscVol.gain.value = 1 / 3;
    trem.connect(tremGain); tremGain.connect(oscVol.gain);
    osc.connect(oscVol); oscVol.connect(masterGain);
    osc.start(); trem.start();
    stops.push(() => { try { osc.stop(); trem.stop(); } catch { /* already stopped */ } });
  });
  return () => stops.forEach((s) => s());
}

function synthHafen(ctx: AudioContext, masterGain: GainNode): () => void {
  // Low-freq harbor rumble
  const src = makeNoise(ctx);
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass"; lpf.frequency.value = 160; lpf.Q.value = 0.5;

  // Seagull: modulated high-freq oscillator
  const gull = ctx.createOscillator();
  gull.frequency.value = 850; gull.type = "sine";
  const gullLfo = ctx.createOscillator();
  gullLfo.frequency.value = 2.8;
  const gullEnv = ctx.createGain(); gullEnv.gain.value = 0.12;
  const gullLfoGain = ctx.createGain(); gullLfoGain.gain.value = 0.1;
  gullLfo.connect(gullLfoGain); gullLfoGain.connect(gullEnv.gain);
  gull.connect(gullEnv);

  const mix = ctx.createGain(); mix.gain.value = 1;
  src.connect(lpf); lpf.connect(mix);
  gullEnv.connect(mix); mix.connect(masterGain);

  gull.start(); gullLfo.start(); src.start();
  return () => { try { src.stop(); gull.stop(); gullLfo.stop(); } catch { /* already stopped */ } };
}

function synthTaverna(ctx: AudioContext, masterGain: GainNode): () => void {
  // Repeating bouzouki-ish melody (Greek Dorian / minor scale)
  const A = 220;
  const scale = [1, 9/8, 6/5, 4/3, 3/2, 5/3, 7/4, 2];
  const melody = [0, 2, 4, 3, 2, 4, 5, 4, 2, 0, 1, 3, 2, 0, 0, 0];
  const noteLen = 0.38;
  let running = true;
  let nextTime = ctx.currentTime + 0.05;
  let idx = 0;

  const tick = () => {
    if (!running) return;
    while (nextTime < ctx.currentTime + 1.8) {
      const ratio = scale[melody[idx % melody.length]!]!;
      const osc = ctx.createOscillator();
      osc.frequency.value = A * ratio;
      osc.type = "triangle";
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, nextTime);
      env.gain.linearRampToValueAtTime(1, nextTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, nextTime + noteLen * 0.85);
      osc.connect(env); env.connect(masterGain);
      osc.start(nextTime); osc.stop(nextTime + noteLen);
      nextTime += noteLen * 0.92;
      idx++;
    }
    setTimeout(tick, 400);
  };
  tick();
  return () => { running = false; };
}

const SYNTHS: Record<SoundId, (ctx: AudioContext, masterGain: GainNode) => () => void> = {
  wellen: synthWellen, zikaden: synthZikaden, wind: synthWind,
  grillen: synthGrillen, hafen: synthHafen, taverna: synthTaverna,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoundscapeState {
  volumes: Record<string, number>;
  muted: Record<string, boolean>;
  lastBy: string | null;
}

interface SoundscapeSession {
  id: string;
  state: SoundscapeState;
  updated_at: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchSoundscape(): Promise<SoundscapeSession> {
  const res = await fetch("/api/soundscape", { cache: "no-store" });
  return res.json() as Promise<SoundscapeSession>;
}

async function patchSoundscape(state: SoundscapeState): Promise<SoundscapeSession> {
  const res = await fetch("/api/soundscape", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  return res.json() as Promise<SoundscapeSession>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AudioEntry { masterGain: GainNode; stop: () => void; }

export default function SoundscapeView({ onBack }: { onBack: () => void }) {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [volumes, setVolumes] = useState<Record<string, number>>(
    Object.fromEntries(SOUNDS.map((s) => [s.id, s.defaultVol])),
  );
  const [muted, setMuted] = useState<Record<string, boolean>>(
    Object.fromEntries(SOUNDS.map((s) => [s.id, s.defaultMuted])),
  );
  const [lastSync, setLastSync] = useState<string>("");
  const [player, setPlayer] = useState<string>("Luca");
  const [showPlayerPick, setShowPlayerPick] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<Partial<Record<SoundId, AudioEntry>>>({});
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteRef = useRef(false);

  // ── Load ──
  useEffect(() => {
    const p = localStorage.getItem("soundscape-player");
    if (p === "Jan" || p === "Luca") setPlayer(p);

    fetchSoundscape()
      .then((s) => {
        setVolumes(s.state.volumes ?? Object.fromEntries(SOUNDS.map((sd) => [sd.id, sd.defaultVol])));
        setMuted(s.state.muted ?? Object.fromEntries(SOUNDS.map((sd) => [sd.id, sd.defaultMuted])));
        setLastSync(s.updated_at);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Polling ──
  useEffect(() => {
    if (!started || loading) return;
    const iv = setInterval(async () => {
      if (remoteRef.current) return;
      try {
        const s = await fetchSoundscape();
        if (s.updated_at === lastSync) return;
        remoteRef.current = true;
        const newVols = s.state.volumes;
        const newMuted = s.state.muted;
        setVolumes(newVols);
        setMuted(newMuted);
        setLastSync(s.updated_at);
        // apply to running audio
        SOUNDS.forEach((sd) => {
          const entry = audioRef.current[sd.id];
          if (!entry || !ctxRef.current) return;
          const g = computeGain(sd, newVols[sd.id] ?? sd.defaultVol, newMuted[sd.id] ?? sd.defaultMuted);
          entry.masterGain.gain.setTargetAtTime(g, ctxRef.current.currentTime, 0.3);
        });
        remoteRef.current = false;
      } catch { remoteRef.current = false; }
    }, 2000);
    return () => clearInterval(iv);
  }, [started, loading, lastSync]);

  // ── Start audio ──
  const startAudio = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext as typeof AudioContext;
    const ctx = new AudioCtx() as AudioContext;
    ctxRef.current = ctx;

    SOUNDS.forEach((sd) => {
      const masterGain = ctx.createGain();
      masterGain.gain.value = computeGain(sd, volumes[sd.id] ?? sd.defaultVol, muted[sd.id] ?? sd.defaultMuted);
      masterGain.connect(ctx.destination);
      const stop = SYNTHS[sd.id](ctx, masterGain);
      audioRef.current[sd.id] = { masterGain, stop };
    });

    setStarted(true);
  };

  // ── Stop all ──
  const stopAll = useCallback(() => {
    Object.values(audioRef.current).forEach((e) => e?.stop());
    audioRef.current = {};
    ctxRef.current?.close();
    ctxRef.current = null;
    setStarted(false);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // ── Volume change ──
  const changeVolume = (id: SoundId, vol: number) => {
    setVolumes((prev) => {
      const next = { ...prev, [id]: vol };
      const sd = SOUNDS.find((s) => s.id === id)!;
      if (ctxRef.current && audioRef.current[id]) {
        const g = computeGain(sd, vol, muted[id] ?? false);
        audioRef.current[id]!.masterGain.gain.setTargetAtTime(g, ctxRef.current.currentTime, 0.08);
      }
      scheduleSync({ volumes: next, muted, lastBy: player });
      return next;
    });
  };

  // ── Mute toggle ──
  const toggleMute = (id: SoundId) => {
    setMuted((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const sd = SOUNDS.find((s) => s.id === id)!;
      if (ctxRef.current && audioRef.current[id]) {
        const g = computeGain(sd, volumes[id] ?? sd.defaultVol, next[id] ?? false);
        audioRef.current[id]!.masterGain.gain.setTargetAtTime(g, ctxRef.current.currentTime, 0.18);
      }
      scheduleSync({ volumes, muted: next, lastBy: player });
      return next;
    });
  };

  // ── Debounced sync ──
  const scheduleSync = (state: SoundscapeState) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const s = await patchSoundscape(state);
        setLastSync(s.updated_at);
      } catch { /* ignore */ }
    }, 700);
  };

  const pickPlayer = (p: string) => {
    localStorage.setItem("soundscape-player", p);
    setPlayer(p);
    setShowPlayerPick(false);
  };

  if (loading) {
    return (
      <div className="grid gap-5 overflow-x-clip">
        <button className="min-h-10 self-start rounded-full border border-[#cfe0d7] bg-white/60 px-4 text-sm font-black text-[#125f68]" onClick={onBack} type="button">← Spiele</button>
        <div className="ios-glass-card flex min-h-[250px] items-center justify-center rounded-[28px]">
          <p className="font-bold text-[#789087]">Soundscape wird geladen …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 overflow-x-clip">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#071828,#0e3a5e_52%,#125f68)] p-5 text-white shadow-[0_20px_55px_rgba(7,24,40,0.35)]">
        <div aria-hidden="true" className="absolute -right-4 -top-4 text-[100px] opacity-15">🎵</div>
        <button
          className="relative z-10 min-h-10 rounded-full border border-white/30 bg-white/12 px-4 text-sm font-black backdrop-blur"
          onClick={() => { stopAll(); onBack(); }}
          type="button"
        >
          ← Spiele
        </button>
        <p className="relative z-10 mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#9de7dc]">Kreta Soundscape</p>
        <h2 className="relative z-10 mt-1 text-3xl font-black leading-none">Klangwelt</h2>
        <p className="relative z-10 mt-2 text-sm font-semibold text-white/75">Mischt eure eigene Kreta-Atmosphäre. Beide Handys hören dieselbe Mischung live.</p>

        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
          {/* Player pick */}
          <button
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black backdrop-blur"
            onClick={() => setShowPlayerPick((v) => !v)}
            type="button"
          >
            <span>{player === "Jan" ? "🎸" : "🎹"}</span>
            <span>{player}</span>
            <span className="opacity-60">▾</span>
          </button>
          {/* Status dot */}
          <div className={["flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black", started ? "bg-[#9de7dc]/20 text-[#9de7dc]" : "bg-white/10 text-white/50"].join(" ")}>
            <div className={["h-2 w-2 rounded-full", started ? "bg-[#9de7dc] animate-pulse" : "bg-white/30"].join(" ")} />
            {started ? "Läuft" : "Gestoppt"}
          </div>
        </div>

        {showPlayerPick && (
          <div className="relative z-10 mt-3 flex gap-2">
            {["Jan", "Luca"].map((p) => (
              <button
                key={p}
                className={["rounded-[12px] px-4 py-2 text-sm font-black transition active:scale-[0.97]", player === p ? "bg-[#9de7dc] text-[#071828]" : "bg-white/15 text-white"].join(" ")}
                onClick={() => pickPlayer(p)}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Start / Stop */}
      {!started ? (
        <button
          className="btn-sheen min-h-14 w-full rounded-[20px] bg-[#125f68] text-lg font-black text-white shadow-[0_12px_35px_rgba(18,95,104,0.3)] transition active:scale-[0.98]"
          onClick={startAudio}
          type="button"
        >
          🎵 Soundscape starten
        </button>
      ) : (
        <button
          className="min-h-11 w-full rounded-[20px] bg-[#fee2e2] text-sm font-black text-[#8b1a1a] transition active:scale-[0.98]"
          onClick={stopAll}
          type="button"
        >
          ⏹ Stoppen
        </button>
      )}

      {/* Sound sliders */}
      <div className="grid gap-2.5">
        {SOUNDS.map((s) => {
          const vol = volumes[s.id] ?? s.defaultVol;
          const isMuted = muted[s.id] ?? s.defaultMuted;

          return (
            <div
              key={s.id}
              className={["ios-glass-card rounded-[20px] p-4 transition-opacity", isMuted ? "opacity-45" : "opacity-100"].join(" ")}
            >
              <div className="flex items-center gap-3">
                {/* Mute toggle */}
                <button
                  className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl transition active:scale-[0.90]", isMuted ? "bg-[#e5e5e5]" : "bg-[#e7f4ee]"].join(" ")}
                  onClick={() => toggleMute(s.id)}
                  type="button"
                  title={isMuted ? "Einschalten" : "Stumm"}
                >
                  {isMuted ? "🔇" : s.emoji}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black text-[#0e302e]">{s.label}</p>
                    <p className="shrink-0 text-xs font-black tabular-nums text-[#789087]">{vol}%</p>
                  </div>
                  <p className="text-xs font-semibold text-[#789087]">{s.desc}</p>

                  {/* Range slider */}
                  <input
                    className="mt-2.5 h-1.5 w-full cursor-pointer rounded-full accent-[#125f68]"
                    disabled={isMuted}
                    max={100}
                    min={0}
                    step={1}
                    type="range"
                    value={vol}
                    onChange={(e) => changeVolume(s.id, Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Visual fill bar */}
              {!isMuted && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#dfe9e3]">
                  <div
                    className="h-full rounded-full bg-[#125f68] transition-all duration-100"
                    style={{ width: `${vol}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div className="rounded-[16px] bg-[#eff6f2] px-4 py-3">
        <p className="text-xs font-semibold leading-5 text-[#789087]">
          ✦ Lautstärke-Änderungen werden synchronisiert — das andere Handy passt seine Mischung nach ~2s an. Jedes Gerät spielt den Ton lokal ab.
        </p>
      </div>
    </div>
  );
}
