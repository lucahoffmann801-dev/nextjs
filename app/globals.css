@import "tailwindcss";

/* ---------- Tokens ---------- */
:root {
  --bg: #f6f2e9;
  --card: #ffffff;
  --ink: #16222c;
  --muted: #5b6b77;
  --line: rgba(22, 34, 44, 0.1);
  --aegean: #0e62a5;
  --aegean-deep: #0b4f86;
  --aegean-ink: #083a63;
  --sea: #0e8c8c;
  --sun: #f0b53c;
  --warn: #b4540a;
  --danger: #b3261e;
  --radius: 18px;
  --nav-h: 62px;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
button, a { -webkit-tap-highlight-color: transparent; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 3px solid var(--aegean); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.right { text-align: right; }

/* ---------- Shell ---------- */
.app { max-width: 720px; margin: 0 auto; padding: 0 14px; }

.topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(10px + env(safe-area-inset-top)) 2px 10px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
}
.topbar-title { font-weight: 700; letter-spacing: -0.01em; }

.sync {
  display: inline-flex; align-items: center; gap: 7px;
  border: 1px solid var(--line); background: var(--card);
  border-radius: 999px; padding: 6px 12px; font-size: 13px; color: var(--muted);
}
.sync-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.sync-live .sync-dot { background: #1e7f4f; }
.sync-loading .sync-dot { background: var(--sun); animation: pulse 1.2s infinite; }
.sync-offline { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
.sync-offline .sync-dot { background: var(--warn); }
@keyframes pulse { 50% { opacity: 0.35; } }

.content { padding-bottom: calc(var(--nav-h) + 96px + env(safe-area-inset-bottom)); }
.tab-pane { display: flex; flex-direction: column; gap: 12px; animation: fade 0.25s ease; }
@keyframes fade { from { opacity: 0; transform: translateY(4px); } }

.section-title {
  margin: 14px 2px 0; font-size: 14px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted);
}

/* ---------- Hero (Boarding-Pass) ---------- */
.hero {
  background: linear-gradient(160deg, var(--aegean-deep) 0%, var(--aegean) 62%, #1379c4 100%);
  color: #fff; border-radius: 24px; padding: 18px 18px 14px;
  box-shadow: 0 10px 28px rgba(11, 79, 134, 0.28);
}
.hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.hero-kicker { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.hero-sub { margin: 2px 0 0; opacity: 0.85; font-size: 14px; }
.hero-badge {
  background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; white-space: nowrap;
}
.hero-route { display: flex; align-items: center; gap: 12px; margin: 18px 0 6px; }
.hero-port { display: flex; flex-direction: column; min-width: 76px; }
.hero-port.right { align-items: flex-end; text-align: right; }
.hero-port strong { font-size: 26px; letter-spacing: 0.02em; font-family: var(--font-mono); }
.hero-port span { font-size: 12px; opacity: 0.8; }
.hero-time { font-family: var(--font-mono); font-size: 13px !important; opacity: 1 !important; margin-top: 2px; }
.hero-arc { flex: 1; position: relative; border-top: 2px dashed rgba(255, 255, 255, 0.55); height: 0; }
.hero-plane {
  position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
  background: inherit; font-size: 16px;
}
.hero-days { display: flex; gap: 6px; margin: 12px 0 4px; }
.hero-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.3); }
.hero-dot.done { background: var(--sun); }
.hero-hotel {
  display: block; margin-top: 10px; padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.3);
  color: #fff; text-decoration: none; font-size: 14px; font-weight: 500;
}
.hero-hotel:active { opacity: 0.8; }

/* ---------- Kompakte Kostenzeile ---------- */
.cost-strip {
  display: flex; align-items: center; gap: 14px; text-align: left;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 13px 14px; width: 100%;
}
.cost-strip > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cost-strip-label { font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.cost-strip strong { font-size: 14.5px; white-space: nowrap; }
.cost-strip-net { margin-left: auto; }
.cost-strip-net strong { color: var(--aegean-ink); }
.cost-strip-arrow { color: var(--muted); font-size: 20px; }

/* ---------- Quick-Grid ---------- */
.quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 560px) { .quick-grid { grid-template-columns: repeat(4, 1fr); } }
.quick-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 14px; min-height: 96px; text-align: left;
  transition: transform 0.08s ease;
}
.quick-card:active { transform: scale(0.97); }
.quick-emoji { font-size: 22px; margin-bottom: 2px; }
.quick-label { font-weight: 650; font-size: 14.5px; letter-spacing: -0.01em; }
.quick-sub { font-size: 12px; color: var(--muted); }

/* ---------- Cards & Listen ---------- */
.card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 16px;
}
.card-kicker { margin: 0 0 2px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.card-note { margin: 10px 0 0; font-size: 13px; color: var(--muted); }
.card-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }

.list-card { padding: 4px 14px; }
.row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0; border-bottom: 1px solid var(--line);
}
.row:last-child { border-bottom: none; }
.row-emoji { font-size: 20px; }
.row-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.row-title { font-weight: 600; font-size: 15px; }
.row-sub { font-size: 12.5px; color: var(--muted); }
.row-sub.warn { color: var(--warn); font-weight: 600; }
.row-amount { font-weight: 650; font-size: 15px; white-space: nowrap; }
.row-confirm { display: flex; gap: 6px; align-items: center; }

.balance-card { background: linear-gradient(180deg, #fff, #f4f8fc); }
.balance-main { margin: 4px 0 12px; font-size: 17px; }
.balance-main strong { font-size: 24px; color: var(--aegean-ink); }
.balance-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
@media (min-width: 560px) { .balance-grid { grid-template-columns: repeat(3, 1fr); } }
.balance-grid div { display: flex; flex-direction: column; }
.balance-grid span { font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.balance-grid strong { font-size: 15px; }

.footnote { margin: 2px 4px 0; font-size: 12.5px; color: var(--muted); }
.empty-card { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.empty-hint { color: var(--muted); text-align: center; padding: 18px 0; }

/* ---------- Pills, Tags, Chips ---------- */
.pill {
  display: inline-block; border: 1px solid var(--line); border-radius: 999px;
  padding: 4px 10px; font-size: 12.5px; font-weight: 600; background: #f2f5f8;
}
.pill.small { padding: 1px 8px; font-size: 11px; vertical-align: 2px; }
.pill-on { background: var(--aegean); border-color: var(--aegean); color: #fff; }

.tag {
  display: inline-block; background: #f1f4f0; border-radius: 8px;
  padding: 3px 8px; font-size: 12px; color: #45554f;
}

.chip-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.chip-wrap.scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.chip-wrap.scroll::-webkit-scrollbar { display: none; }
.chip {
  border: 1.5px solid var(--line); background: var(--card); border-radius: 999px;
  padding: 9px 14px; font-size: 14px; white-space: nowrap; min-height: 40px;
}
.chip.on { background: var(--aegean); border-color: var(--aegean); color: #fff; font-weight: 600; }

/* ---------- Buttons ---------- */
.primary-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--aegean); color: #fff; border: none; border-radius: 14px;
  padding: 12px 18px; font-weight: 650; text-decoration: none; min-height: 46px;
}
.primary-btn:active { background: var(--aegean-deep); }
.ghost-btn {
  border: 1.5px solid var(--aegean); color: var(--aegean-ink); background: transparent;
  border-radius: 14px; padding: 11px 16px; font-weight: 600; min-height: 44px;
}
.ghost-btn.wide { width: 100%; }
.danger-btn {
  background: var(--danger); color: #fff; border: none; border-radius: 10px;
  padding: 8px 12px; font-weight: 600; font-size: 13px;
}
.icon-btn {
  border: none; background: #eef1f4; border-radius: 10px;
  width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; flex: none;
}
.icon-btn.subtle { background: transparent; color: var(--muted); }
.maps-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: #eaf2fa; color: var(--aegean-ink); border-radius: 10px;
  padding: 8px 12px; font-size: 13.5px; font-weight: 600; text-decoration: none; min-height: 38px;
}

/* ---------- Segmented ---------- */
.seg { display: grid; gap: 6px; background: #ebeef1; border-radius: 14px; padding: 4px; }
.seg-2 { grid-template-columns: 1fr 1fr; }
.seg-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 420px) { .seg-4 { grid-template-columns: repeat(2, 1fr); } }
.seg button {
  border: none; background: transparent; border-radius: 11px;
  padding: 11px 6px; font-weight: 600; font-size: 14px; min-height: 44px; color: var(--muted);
}
.seg button.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); }
.guide-switch { position: sticky; top: 54px; z-index: 20; }

/* ---------- Guide-Cards ---------- */
.filter-bar { display: flex; flex-direction: column; gap: 9px; }
.filter-row { display: flex; gap: 8px; }
.text-input, .region-select {
  border: 1.5px solid var(--line); border-radius: 13px; background: var(--card);
  padding: 11px 13px; font-size: 15px; min-height: 46px; width: 100%;
}
.text-input.search { flex: 1; }
.region-select { width: auto; max-width: 46%; color: var(--ink); }
.filter-count { margin: 0 2px; font-size: 12.5px; color: var(--muted); }

.guide-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 600px) { .guide-grid { grid-template-columns: 1fr 1fr; } }
.guide-card {
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 14px; display: flex; flex-direction: column; gap: 9px;
}
.guide-head { display: flex; gap: 11px; align-items: flex-start; }
.guide-emoji {
  font-size: 21px; background: #f2f6f9; border-radius: 12px;
  width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; flex: none;
}
.guide-title h3 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
.guide-desc {
  margin: 0; font-size: 13.5px; color: #3d4c57;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.guide-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.guide-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.rating { font-size: 14px; font-weight: 650; color: #8a5b00; }

/* ---------- Reise ---------- */
.flight-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.flight-route { display: flex; align-items: center; gap: 10px; }
.flight-route > div { display: flex; flex-direction: column; flex: 1; }
.flight-route strong { font-size: 22px; }
.flight-route span { font-size: 12.5px; color: var(--muted); }
.flight-arrow { color: var(--aegean); font-size: 18px; }

.train-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.train-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.train-list li { display: flex; gap: 12px; }
.train-times { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 13.5px; font-weight: 600; }
.train-line { flex: 1; width: 2px; min-height: 18px; background: var(--line); border-radius: 2px; }
.train-info { display: flex; flex-direction: column; gap: 2px; }
.train-title { font-size: 14.5px; font-weight: 600; }

/* ---------- Routen ---------- */
.route-card.highlight { border-color: var(--aegean); box-shadow: 0 4px 14px rgba(14, 98, 165, 0.14); }
.route-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.route-head h3 { margin: 0; font-size: 17px; letter-spacing: -0.01em; }
.stops { margin: 10px 0 0; padding: 0 0 0 2px; list-style: none; }
.stops li { position: relative; padding: 0 0 12px 22px; font-size: 14.5px; }
.stops li::before {
  content: ""; position: absolute; left: 4px; top: 6px;
  width: 9px; height: 9px; border-radius: 50%; background: var(--aegean);
}
.stops li:not(:last-child)::after {
  content: ""; position: absolute; left: 8px; top: 16px; bottom: -3px; width: 2px;
  background: color-mix(in srgb, var(--aegean) 30%, transparent);
}
.stops li:last-child { padding-bottom: 0; }

/* ---------- Packliste ---------- */
.pack-progress-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.bar { height: 9px; background: #e8ebe4; border-radius: 999px; overflow: hidden; }
.bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--sea), var(--aegean)); border-radius: 999px; transition: width 0.3s ease; }
.pack-checks { display: flex; gap: 8px; }
.check {
  width: 44px; height: 44px; border-radius: 12px; border: 1.5px solid var(--line);
  background: var(--card); font-weight: 700; color: var(--muted);
}
.check.on { background: var(--sea); border-color: var(--sea); color: #fff; }

/* ---------- FAB ---------- */
.fab {
  position: fixed; right: 16px; bottom: calc(var(--nav-h) + 18px + env(safe-area-inset-bottom));
  z-index: 35; display: inline-flex; align-items: center; gap: 7px;
  background: var(--aegean); color: #fff; border: none; border-radius: 999px;
  padding: 15px 20px; font-size: 16px; font-weight: 700;
  box-shadow: 0 8px 22px rgba(11, 79, 134, 0.4);
}
.fab:active { transform: scale(0.96); }
.fab span { font-size: 19px; line-height: 1; }

/* ---------- Bottom-Nav ---------- */
.bottom-nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; justify-content: space-around;
  background: color-mix(in srgb, #ffffff 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--line);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
}
.bottom-nav button {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  border: none; background: transparent; color: var(--muted);
  font-size: 10.5px; font-weight: 600; min-width: 52px; min-height: 50px; border-radius: 12px;
}
.bottom-nav button svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.bottom-nav button.on { color: var(--aegean-deep); }

/* ---------- Bottom Sheet ---------- */
.sheet-backdrop {
  position: fixed; inset: 0; z-index: 50; background: rgba(12, 22, 30, 0.45);
  display: flex; align-items: flex-end; justify-content: center;
  animation: fade 0.18s ease;
}
.sheet {
  background: var(--bg); width: 100%; max-width: 560px;
  border-radius: 24px 24px 0 0; padding: 8px 18px calc(18px + env(safe-area-inset-bottom));
  max-height: 92dvh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  animation: slide-up 0.24s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes slide-up { from { transform: translateY(40px); opacity: 0.6; } }
@media (min-width: 640px) {
  .sheet-backdrop { align-items: center; padding: 24px; }
  .sheet { border-radius: 24px; max-height: 86vh; }
}
.sheet-grip { width: 42px; height: 5px; border-radius: 99px; background: #cfd6db; margin: 4px auto 2px; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; }
.sheet-head h2 { margin: 0; font-size: 19px; letter-spacing: -0.01em; }

.field-label { margin: 12px 2px 0; font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.field-label .opt { font-weight: 500; text-transform: none; letter-spacing: 0; }

.amount-wrap { position: relative; }
.amount-input {
  width: 100%; border: 1.5px solid var(--line); border-radius: 16px; background: var(--card);
  padding: 14px 44px 14px 16px; font-size: 30px; font-weight: 700;
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
}
.amount-input:focus { border-color: var(--aegean); }
.amount-cur { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 22px; color: var(--muted); }

.day-strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: none; }
.day-strip::-webkit-scrollbar { display: none; }
.day-chip {
  flex: none; display: flex; flex-direction: column; align-items: center; gap: 1px;
  border: 1.5px solid var(--line); background: var(--card); border-radius: 14px;
  padding: 8px 13px; min-height: 52px;
}
.day-chip.on { background: var(--aegean); border-color: var(--aegean); color: #fff; }
.day-nr { font-size: 13.5px; font-weight: 700; }
.day-date { font-size: 11.5px; opacity: 0.8; }

.custom-split { display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 14px; }
.custom-split-input { display: flex; align-items: center; gap: 5px; }
.custom-split-input input {
  width: 76px; border: 1.5px solid var(--line); border-radius: 11px; background: var(--card);
  padding: 9px 11px; font-family: var(--font-mono); font-size: 16px;
}

.form-error { margin: 10px 2px 0; color: var(--danger); font-size: 14px; font-weight: 600; }

.save-btn {
  margin-top: 16px; width: 100%; min-height: 54px;
  background: var(--aegean); color: #fff; border: none; border-radius: 16px;
  font-size: 17px; font-weight: 700;
}
.save-btn:active { background: var(--aegean-deep); }
.save-btn:disabled { opacity: 0.6; }

/* ---------- Toast ---------- */
.toast {
  position: fixed; left: 50%; transform: translateX(-50%);
  top: calc(14px + env(safe-area-inset-top)); z-index: 60;
  background: var(--ink); color: #fff; border-radius: 999px;
  padding: 11px 20px; font-size: 14.5px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  animation: toast-in 0.25s ease; max-width: calc(100% - 32px);
}
@keyframes toast-in { from { transform: translate(-50%, -16px); opacity: 0; } }

/* ---------- Skeleton ---------- */
.skeleton { background: linear-gradient(100deg, #ece8de 40%, #f5f1e8 50%, #ece8de 60%); background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: var(--radius); }
@keyframes shimmer { to { background-position: -200% 0; } }
.hero-skel { height: 190px; border-radius: 24px; }
.strip-skel { height: 66px; }
.quick-skel { height: 96px; }
