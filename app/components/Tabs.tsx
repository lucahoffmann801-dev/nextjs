"use client";

import { useMemo, useState } from "react";
import {
  Expense,
  FixedCost,
  Flight,
  HOTEL_MAPS,
  PackItem,
  RouteRow,
  Settlement,
  TRIP_DAYS,
  Train,
  catEmoji,
  eur,
  num,
  routeDayForToday,
  sb,
  settle,
  toSettleItem,
  tripStatus,
} from "../lib";

/* =================== Dashboard =================== */

export function Dashboard({
  fixed,
  expenses,
  routes,
  flights,
  onOpenExpense,
  onGoto,
}: {
  fixed: FixedCost[];
  expenses: Expense[];
  routes: RouteRow[];
  flights: Flight[];
  onOpenExpense: () => void;
  onGoto: (tab: string) => void;
}) {
  const all = useMemo(
    () => settle([...fixed.map(toSettleItem), ...expenses.map(toSettleItem)]),
    [fixed, expenses],
  );
  const onSite = useMemo(() => expenses.reduce((s, e) => s + num(e.amount), 0), [expenses]);
  const status = tripStatus();

  const todayRoute = useMemo(() => {
    const key = routeDayForToday();
    if (key) {
      const hit = routes.find((r) => r.travel_day === key);
      if (hit) return hit;
    }
    return routes.find((r) => r.travel_day && /^\d{2}\.\d{2}\.\d{4}$/.test(r.travel_day)) ?? routes[0] ?? null;
  }, [routes]);

  const outbound = flights.find((f) => f.direction !== "Rückflug" && f.id === "F001") ?? flights[0];

  const quick: { emoji: string; label: string; sub: string; action: () => void }[] = [
    { emoji: "➕", label: "Ausgabe eintragen", sub: "Schnell erfassen", action: onOpenExpense },
    {
      emoji: "🗓️",
      label: "Heutiger Plan",
      sub: todayRoute ? todayRoute.title : "Routenideen ansehen",
      action: () => onGoto("routen"),
    },
    {
      emoji: "🧭",
      label: "Tagesroute öffnen",
      sub: "Navigation in Maps",
      action: () => {
        if (todayRoute?.maps_url) window.open(todayRoute.maps_url, "_blank");
        else onGoto("routen");
      },
    },
    { emoji: "🎒", label: "Packliste", sub: "Abhaken für beide", action: () => onGoto("packen") },
    { emoji: "🍽️", label: "Restaurants", sub: "276 Tipps mit Maps", action: () => onGoto("guide:rest") },
    { emoji: "📸", label: "Sehenswürdigkeiten", sub: "Strände, Kultur, Natur", action: () => onGoto("guide:poi") },
    { emoji: "✈️", label: "Flug & Bahn", sub: "Zeiten und Gleise", action: () => onGoto("reise") },
    { emoji: "💶", label: "Kosten & Ausgleich", sub: "Alle Details", action: () => onGoto("kosten") },
  ];

  return (
    <section className="tab-pane" aria-label="Übersicht">
      {/* Boarding-Pass-Hero */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <p className="hero-kicker">Kreta 2026</p>
            <p className="hero-sub">Luca &amp; Jan · 01.–09. Juli</p>
          </div>
          <span className="hero-badge">
            {status.phase === "before" && `Noch ${status.daysLeft} Tage`}
            {status.phase === "during" && `Tag ${status.dayNr} von 9`}
            {status.phase === "after" && "Zurück 🤍"}
          </span>
        </div>
        <div className="hero-route" aria-label="Flugstrecke Nürnberg nach Chania">
          <div className="hero-port">
            <strong>NUE</strong>
            <span>Nürnberg</span>
            <span className="hero-time">{outbound?.dep_local ?? "16:45"}</span>
          </div>
          <div className="hero-arc">
            <span className="hero-plane" aria-hidden="true">✈</span>
          </div>
          <div className="hero-port right">
            <strong>CHQ</strong>
            <span>Chania</span>
            <span className="hero-time">{outbound?.arr_local ?? "20:35"}</span>
          </div>
        </div>
        <div className="hero-days" aria-hidden="true">
          {TRIP_DAYS.map((d) => (
            <span key={d.iso} className={`hero-dot ${status.phase === "during" && d.nr <= status.dayNr ? "done" : ""}`} />
          ))}
        </div>
        <a className="hero-hotel" href={HOTEL_MAPS} target="_blank" rel="noreferrer">
          🏨 Anthos Hotel, Frangokastello · in Maps öffnen
        </a>
      </div>

      {/* Kompakte Kostenzeile */}
      <button className="cost-strip" onClick={() => onGoto("kosten")} aria-label="Kosten und Ausgleich öffnen">
        <div>
          <span className="cost-strip-label">Gesamtausgaben</span>
          <strong className="mono">{eur(all.total)}</strong>
        </div>
        <div>
          <span className="cost-strip-label">Vor Ort</span>
          <strong className="mono">{eur(onSite)}</strong>
        </div>
        <div className="cost-strip-net">
          <span className="cost-strip-label">Ausgleich</span>
          <strong className="mono">
            {all.net >= 0 ? `Luca → Jan ${eur(all.net)}` : `Jan → Luca ${eur(-all.net)}`}
          </strong>
        </div>
        <span className="cost-strip-arrow" aria-hidden="true">›</span>
      </button>

      {/* Schnellzugriff */}
      <h2 className="section-title">Schnellzugriff</h2>
      <div className="quick-grid">
        {quick.map((q) => (
          <button key={q.label} className="quick-card" onClick={q.action}>
            <span className="quick-emoji" aria-hidden="true">{q.emoji}</span>
            <span className="quick-label">{q.label}</span>
            <span className="quick-sub">{q.sub}</span>
          </button>
        ))}
      </div>

      {/* Heutiger Plan */}
      {todayRoute && (
        <>
          <h2 className="section-title">
            {tripStatus().phase === "during" ? "Heutiger Plan" : "Nächster Plan"}
          </h2>
          <RouteCard route={todayRoute} highlight />
        </>
      )}
    </section>
  );
}

/* =================== Kosten =================== */

export function CostsTab({
  fixed,
  expenses,
  onDeleted,
  onOpenExpense,
}: {
  fixed: FixedCost[];
  expenses: Expense[];
  onDeleted: (id: string) => void;
  onOpenExpense: () => void;
}) {
  const all: Settlement = useMemo(
    () => settle([...fixed.map(toSettleItem), ...expenses.map(toSettleItem)]),
    [fixed, expenses],
  );
  const onSite = expenses.reduce((s, e) => s + num(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toSettleItem>[]>();
    for (const f of fixed) {
      const k = f.category ?? "Sonstiges";
      map.set(k, [...(map.get(k) ?? []), toSettleItem(f)]);
    }
    if (expenses.length) map.set("Vor Ort", expenses.map(toSettleItem));
    return [...map.entries()]
      .map(([cat, items]) => ({ cat, s: settle(items) }))
      .sort((a, b) => b.s.total - a.s.total);
  }, [fixed, expenses]);

  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function remove(id: string) {
    try {
      await sb(`kreta_expenses?id=eq.${id}`, { method: "DELETE" });
      onDeleted(id);
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <section className="tab-pane" aria-label="Kosten">
      <div className="card balance-card">
        <p className="card-kicker">Aktueller Ausgleich</p>
        <p className="balance-main mono">
          {all.net >= 0 ? "Luca zahlt an Jan" : "Jan zahlt an Luca"}{" "}
          <strong>{eur(Math.abs(all.net))}</strong>
        </p>
        <div className="balance-grid mono">
          <div><span>Gesamt</span><strong>{eur(all.total)}</strong></div>
          <div><span>Vor Ort</span><strong>{eur(onSite)}</strong></div>
          <div><span>Jan vorgestreckt</span><strong>{eur(all.janPaid)}</strong></div>
          <div><span>Luca vorgestreckt</span><strong>{eur(all.lucaPaid)}</strong></div>
          <div><span>Anteil Luca</span><strong>{eur(all.lucaShare)}</strong></div>
          <div><span>Anteil Jan</span><strong>{eur(all.janShare)}</strong></div>
        </div>
      </div>

      <h2 className="section-title">Bereiche</h2>
      <div className="card list-card">
        {byCategory.map(({ cat, s }) => (
          <div key={cat} className="row">
            <div className="row-main">
              <span className="row-title">{cat}</span>
              <span className="row-sub">
                {s.net === 0
                  ? "ausgeglichen"
                  : s.net > 0
                    ? `Luca: ${eur(s.net)} an Jan`
                    : `Jan: ${eur(-s.net)} an Luca`}
              </span>
            </div>
            <span className="row-amount mono">{eur(s.total)}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">Vor Ort eingetragen</h2>
      {expenses.length === 0 ? (
        <div className="card empty-card">
          <p>Noch keine Ausgaben vor Ort. Die erste ist schnell eingetragen.</p>
          <button className="ghost-btn" onClick={onOpenExpense}>＋ Ausgabe eintragen</button>
        </div>
      ) : (
        <div className="card list-card">
          {[...expenses]
            .sort((a, b) => (b.expense_date ?? "").localeCompare(a.expense_date ?? "") || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
            .map((e) => (
              <div key={e.id} className="row">
                <span className="row-emoji" aria-hidden="true">{catEmoji(e.category)}</span>
                <div className="row-main">
                  <span className="row-title">{e.title}</span>
                  <span className="row-sub">
                    {e.expense_date ? e.expense_date.slice(8, 10) + "." + e.expense_date.slice(5, 7) + "." : ""}
                    {e.travel_day ? ` · ${e.travel_day}` : ""} · {e.paid_by} bezahlt · {e.split_mode}
                  </span>
                </div>
                <span className="row-amount mono">{eur(num(e.amount))}</span>
                {confirmId === e.id ? (
                  <span className="row-confirm">
                    <button className="danger-btn" onClick={() => remove(e.id)}>Löschen</button>
                    <button className="icon-btn" onClick={() => setConfirmId(null)} aria-label="Abbrechen">✕</button>
                  </span>
                ) : (
                  <button className="icon-btn subtle" onClick={() => setConfirmId(e.id)} aria-label={`${e.title} löschen`}>🗑</button>
                )}
              </div>
            ))}
        </div>
      )}

      <h2 className="section-title">Fixkosten</h2>
      <div className="card list-card">
        {[...fixed]
          .sort((a, b) => num(b.amount) - num(a.amount))
          .map((f) => (
            <div key={f.id} className="row">
              <div className="row-main">
                <span className="row-title">{f.item}</span>
                <span className="row-sub">
                  {f.category} · {f.paid_by} bezahlt · {f.status}
                  {Math.abs(num(f.split_luca) - 0.5) > 0.0001 ? " · eigene Aufteilung" : ""}
                </span>
              </div>
              <span className="row-amount mono">{eur(num(f.amount))}</span>
            </div>
          ))}
      </div>
      <p className="footnote">
        Fixkosten stammen aus der gemeinsamen Planung, Vor-Ort-Ausgaben aus der App. Der Ausgleich
        rechnet beides zusammen.
      </p>
    </section>
  );
}

/* =================== Reise (Flug & Bahn) =================== */

export function TravelTab({ flights, trains }: { flights: Flight[]; trains: Train[] }) {
  const dirs = ["Hinfahrt", "Rückfahrt"];
  return (
    <section className="tab-pane" aria-label="Flug und Bahn">
      <h2 className="section-title">Flüge</h2>
      {flights.map((f) => (
        <div key={f.id} className="card flight-card">
          <div className="flight-head">
            <span className="pill">{f.flight_no}</span>
            <span className="muted">{f.date_local}</span>
          </div>
          <div className="flight-route">
            <div>
              <strong className="mono">{f.dep_local}</strong>
              <span>{f.from_airport}</span>
            </div>
            <span className="flight-arrow" aria-hidden="true">→</span>
            <div className="right">
              <strong className="mono">{f.arr_local}</strong>
              <span>{f.to_airport}</span>
            </div>
          </div>
          {f.note && <p className="card-note">{f.note}</p>}
        </div>
      ))}

      <h2 className="section-title">Bahn</h2>
      {dirs.map((dir) => {
        const segs = trains.filter((t) => t.direction === dir);
        if (!segs.length) return null;
        return (
          <div key={dir} className="card train-card">
            <div className="train-head">
              <strong>{dir}</strong>
              <span className="muted">{segs[0].date_label} ({segs[0].weekday})</span>
            </div>
            <ol className="train-list">
              {segs.map((t) => (
                <li key={t.id}>
                  <div className="train-times mono">
                    <span>{t.dep_time}</span>
                    <span className="train-line" aria-hidden="true" />
                    <span>{t.arr_time}</span>
                  </div>
                  <div className="train-info">
                    <span className="train-title">
                      <span className="pill small">{t.train}</span> {t.from_station} → {t.to_station}
                    </span>
                    <span className="row-sub">
                      Gleis {t.dep_platform} → Gleis {t.arr_platform}
                      {t.ticket_code ? ` · Code ${t.ticket_code}` : ""}
                    </span>
                    {t.note && <span className={`row-sub ${/Achtung|nicht gültig/i.test(t.note) ? "warn" : ""}`}>{t.note}</span>}
                  </div>
                </li>
              ))}
            </ol>
            <p className="card-note">
              {segs[0].travellers} · {segs[0].total_price?.includes("€") ? `Ticket ${segs[0].total_price}` : segs[0].total_price}
            </p>
          </div>
        );
      })}
    </section>
  );
}

/* =================== Routen =================== */

export function RouteCard({ route, highlight }: { route: RouteRow; highlight?: boolean }) {
  return (
    <div className={`card route-card ${highlight ? "highlight" : ""}`}>
      <div className="route-head">
        <div>
          <p className="card-kicker">{route.travel_day && route.travel_day !== "Offen" ? route.travel_day : "Tag offen"}</p>
          <h3>{route.title}</h3>
        </div>
        {route.status && <span className={`pill ${route.status === "Geplant" ? "pill-on" : ""}`}>{route.status}</span>}
      </div>
      <ol className="stops">
        {route.stops.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {route.note && <p className="card-note">{route.note}</p>}
      <div className="card-actions">
        {route.maps_url && (
          <a className="primary-btn" href={route.maps_url} target="_blank" rel="noreferrer">
            🧭 Route starten
          </a>
        )}
        {route.cost_hint && <span className="muted">{route.cost_hint}</span>}
      </div>
    </div>
  );
}

export function RoutesTab({ routes }: { routes: RouteRow[] }) {
  const sorted = useMemo(() => {
    const key = (r: RouteRow) =>
      r.travel_day && /^\d{2}\.\d{2}\.\d{4}$/.test(r.travel_day)
        ? r.travel_day.split(".").reverse().join("-")
        : "9999";
    return [...routes].sort((a, b) => key(a).localeCompare(key(b)));
  }, [routes]);
  return (
    <section className="tab-pane" aria-label="Routen">
      <h2 className="section-title">Tagesrouten</h2>
      {sorted.map((r) => (
        <RouteCard key={r.id} route={r} />
      ))}
    </section>
  );
}

/* =================== Packliste =================== */

export function PackTab({
  items,
  onToggle,
}: {
  items: PackItem[];
  onToggle: (id: string, field: "luca_done" | "jan_done", value: boolean) => void;
}) {
  const bags = useMemo(() => {
    const m = new Map<string, PackItem[]>();
    for (const it of items) {
      const k = it.bag ?? "Sonstiges";
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()];
  }, [items]);

  const total = items.length * 2;
  const done = items.reduce((s, i) => s + (i.luca_done ? 1 : 0) + (i.jan_done ? 1 : 0), 0);

  return (
    <section className="tab-pane" aria-label="Packliste">
      <div className="card pack-progress">
        <div className="pack-progress-head">
          <strong>Packfortschritt</strong>
          <span className="mono">{done}/{total}</span>
        </div>
        <div className="bar"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      </div>
      {bags.map(([bag, list]) => (
        <div key={bag}>
          <h2 className="section-title">{bag}</h2>
          <div className="card list-card">
            {list.map((it) => (
              <div key={it.id} className="row pack-row">
                <div className="row-main">
                  <span className="row-title">
                    {it.item} {it.importance === "Muss" && <span className="pill small">Muss</span>}
                  </span>
                  {it.note && <span className="row-sub">{it.note}</span>}
                </div>
                <div className="pack-checks">
                  {(["luca_done", "jan_done"] as const).map((f) => (
                    <button
                      key={f}
                      className={`check ${it[f] ? "on" : ""}`}
                      onClick={() => onToggle(it.id, f, !it[f])}
                      aria-pressed={it[f]}
                      aria-label={`${it.item}: ${f === "luca_done" ? "Luca" : "Jan"} ${it[f] ? "erledigt" : "offen"}`}
                    >
                      {f === "luca_done" ? "L" : "J"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
