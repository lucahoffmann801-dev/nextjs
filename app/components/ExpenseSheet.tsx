"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Expense,
  FixedCost,
  Flight,
  PackItem,
  Poi,
  Restaurant,
  RouteRow,
  Train,
  sb,
} from "../lib";
import ExpenseSheet from "./ExpenseSheet";
import GuideTab from "./Guide";
import { CostsTab, Dashboard, PackTab, RoutesTab, TravelTab } from "./Tabs";

type Tab = "home" | "kosten" | "reise" | "routen" | "guide" | "packen";

type Data = {
  fixed: FixedCost[];
  expenses: Expense[];
  flights: Flight[];
  trains: Train[];
  routes: RouteRow[];
  restaurants: Restaurant[];
  pois: Poi[];
  pack: PackItem[];
};

const NAV: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "Home", icon: <IconHome /> },
  { key: "kosten", label: "Kosten", icon: <IconCoins /> },
  { key: "reise", label: "Reise", icon: <IconPlane /> },
  { key: "routen", label: "Routen", icon: <IconMap /> },
  { key: "guide", label: "Guide", icon: <IconCompass /> },
  { key: "packen", label: "Packen", icon: <IconBag /> },
];

export default function KretaApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [guideSub, setGuideSub] = useState<"rest" | "poi">("rest");
  const [data, setData] = useState<Data | null>(null);
  const [sync, setSync] = useState<"loading" | "live" | "offline">("loading");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setSync((s) => (s === "live" ? "live" : "loading"));
    try {
      const [fixed, expenses, flights, trains, routes, restaurants, pois, pack] =
        await Promise.all([
          sb<FixedCost[]>("kreta_fixed_costs?select=*"),
          sb<Expense[]>("kreta_expenses?select=*&order=expense_date.desc,created_at.desc"),
          sb<Flight[]>("kreta_flights?select=*&order=id.asc"),
          sb<Train[]>("kreta_trains?select=*&order=id.asc"),
          sb<RouteRow[]>("kreta_routes?select=*"),
          sb<Restaurant[]>(
            "kreta_restaurants?select=id,name,region,ort,kueche,veggie,prioritaet,fahrt_ab_hotel,maps_link,rating_hint,warum,notiz,is_blocked&is_blocked=eq.false&limit=1000",
          ),
          sb<Poi[]>("kreta_pois?select=id,name,type,region,ort,priority,description,note,maps_link&limit=1000"),
          sb<PackItem[]>("kreta_pack_items?select=*&order=id.asc"),
        ]);
      setData({ fixed, expenses, flights, trains, routes, restaurants, pois, pack });
      setSync("live");
    } catch {
      setSync("offline");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const goto = (target: string) => {
    if (target.startsWith("guide")) {
      setGuideSub(target.endsWith("poi") ? "poi" : "rest");
      setTab("guide");
    } else {
      setTab(target as Tab);
    }
    window.scrollTo({ top: 0 });
  };

  const onExpenseSaved = (e: Expense, msg: string) => {
    setData((d) => (d ? { ...d, expenses: [e, ...d.expenses] } : d));
    showToast(msg);
  };

  const onExpenseDeleted = (id: string) => {
    setData((d) => (d ? { ...d, expenses: d.expenses.filter((x) => x.id !== id) } : d));
    showToast("Ausgabe gelöscht");
  };

  const onPackToggle = async (id: string, field: "luca_done" | "jan_done", value: boolean) => {
    setData((d) =>
      d
        ? { ...d, pack: d.pack.map((p) => (p.id === id ? { ...p, [field]: value } : p)) }
        : d,
    );
    try {
      await sb(`kreta_pack_items?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      setData((d) =>
        d
          ? { ...d, pack: d.pack.map((p) => (p.id === id ? { ...p, [field]: !value } : p)) }
          : d,
      );
      showToast("Konnte nicht speichern, bitte erneut tippen");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-title">Kreta 2026</span>
        <button
          className={`sync sync-${sync}`}
          onClick={sync === "offline" ? load : undefined}
          aria-live="polite"
        >
          <span className="sync-dot" aria-hidden="true" />
          {sync === "live" && "Synchron"}
          {sync === "loading" && "Lädt…"}
          {sync === "offline" && "Offline · erneut laden"}
        </button>
      </header>

      <main className="content">
        {!data && sync !== "offline" && <Skeleton />}
        {!data && sync === "offline" && (
          <div className="card empty-card">
            <p>Gerade keine Verbindung zum Reise-Backend.</p>
            <button className="ghost-btn" onClick={load}>Erneut versuchen</button>
          </div>
        )}
        {data && (
          <>
            {tab === "home" && (
              <Dashboard
                fixed={data.fixed}
                expenses={data.expenses}
                routes={data.routes}
                flights={data.flights}
                onOpenExpense={() => setSheetOpen(true)}
                onGoto={goto}
              />
            )}
            {tab === "kosten" && (
              <CostsTab
                fixed={data.fixed}
                expenses={data.expenses}
                onDeleted={onExpenseDeleted}
                onOpenExpense={() => setSheetOpen(true)}
              />
            )}
            {tab === "reise" && <TravelTab flights={data.flights} trains={data.trains} />}
            {tab === "routen" && <RoutesTab routes={data.routes} />}
            {tab === "guide" && (
              <GuideTab key={guideSub} restaurants={data.restaurants} pois={data.pois} initialSub={guideSub} />
            )}
            {tab === "packen" && <PackTab items={data.pack} onToggle={onPackToggle} />}
          </>
        )}
      </main>

      <button className="fab" onClick={() => setSheetOpen(true)} aria-label="Ausgabe eintragen">
        <span aria-hidden="true">＋</span> Ausgabe
      </button>

      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={tab === n.key ? "on" : ""}
            onClick={() => goto(n.key)}
            aria-current={tab === n.key ? "page" : undefined}
          >
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <ExpenseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={onExpenseSaved} />

      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="tab-pane" aria-hidden="true">
      <div className="skeleton hero-skel" />
      <div className="skeleton strip-skel" />
      <div className="quick-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton quick-skel" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Icons (Stroke-SVGs, ruhiger als Emoji in der Navigation) ---------- */

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9" />
    </svg>
  );
}
function IconCoins() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  );
}
function IconPlane() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 13.5 4 11l1.5-1.5L11 10l4.5-4.5a1.8 1.8 0 0 1 2.5 2.5L13.5 12.5l.5 5.5-1.5 1.5-2.5-6.5-3 3V19l-1.5 1L5 17l-3-.5 1-1.5h3z" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14" />
    </svg>
  );
}
function IconCompass() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}
function IconBag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="8" width="14" height="12" rx="2.5" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M9 12v4M15 12v4" />
    </svg>
  );
}
