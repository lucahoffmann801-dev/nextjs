"use client";

import { useMemo, useState } from "react";
import {
  POI_GROUPS,
  Poi,
  PoiGroup,
  Restaurant,
  kuecheShort,
  parseRating,
  poiEmoji,
  poiGroup,
  restaurantEmoji,
} from "../lib";

const REGIONS = [
  "Chania / Westkreta",
  "Rethymno / Südküste",
  "Heraklion / Mitte",
  "Lasithi / Ostkreta",
];

const REST_FILTERS: { key: string; label: string; test: (r: Restaurant) => boolean }[] = [
  { key: "top", label: "⭐ Top", test: (r) => r.prioritaet === "Top" },
  { key: "fisch", label: "🐟 Fisch", test: (r) => /meeresfrücht|fisch/i.test(r.kueche ?? "") },
  { key: "ital", label: "🍝 Italienisch", test: (r) => /italien|pizz/i.test(r.kueche ?? "") },
  { key: "veg", label: "🥗 Veggie", test: (r) => /vegan|vegetarisch/i.test(`${r.kueche} ${r.veggie}`) },
  { key: "tav", label: "🍷 Griechisch", test: (r) => /griechisch|tavern|mediterran/i.test(r.kueche ?? "") },
  { key: "cafe", label: "☕ Café", test: (r) => /café|coffee|kaffee|brunch|frühstück/i.test(r.kueche ?? "") },
  { key: "nah", label: "🚗 < 1 h ab Hotel", test: (r) => {
      const m = (r.fahrt_ab_hotel ?? "").match(/(\d+)\s*h/);
      if (!m) return /min/i.test(r.fahrt_ab_hotel ?? "");
      return parseInt(m[1], 10) < 1;
    } },
];

function ratingValue(r: Restaurant | Poi, hint: string | null): number {
  const p = parseRating(hint);
  return p ? parseFloat(p.score.replace(",", ".")) : 0;
}

function MapsBtn({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a className="maps-btn" href={href} target="_blank" rel="noreferrer">
      📍 Maps
    </a>
  );
}

function Stars({ hint }: { hint: string | null }) {
  const p = parseRating(hint);
  if (!p) return null;
  return (
    <span className="rating">
      ★ {p.score} <span className="muted">({p.count})</span>
    </span>
  );
}

export default function GuideTab({
  restaurants,
  pois,
  initialSub,
}: {
  restaurants: Restaurant[];
  pois: Poi[];
  initialSub: "rest" | "poi";
}) {
  const [sub, setSub] = useState<"rest" | "poi">(initialSub);
  return (
    <section className="tab-pane" aria-label="Kreta-Guide">
      <div className="seg seg-2 guide-switch">
        <button className={sub === "rest" ? "on" : ""} onClick={() => setSub("rest")} aria-pressed={sub === "rest"}>
          🍽️ Restaurants
        </button>
        <button className={sub === "poi" ? "on" : ""} onClick={() => setSub("poi")} aria-pressed={sub === "poi"}>
          📸 Sehenswürdigkeiten
        </button>
      </div>
      {sub === "rest" ? <RestaurantList restaurants={restaurants} /> : <PoiList pois={pois} />}
    </section>
  );
}

function RestaurantList({ restaurants }: { restaurants: Restaurant[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [limit, setLimit] = useState(24);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return restaurants
      .filter((r) => !r.is_blocked)
      .filter((r) => !region || r.region === region)
      .filter((r) =>
        filters.every((f) => REST_FILTERS.find((x) => x.key === f)?.test(r) ?? true),
      )
      .filter(
        (r) =>
          !query ||
          `${r.name} ${r.ort} ${r.kueche} ${r.warum}`.toLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          (b.prioritaet === "Top" ? 1 : 0) - (a.prioritaet === "Top" ? 1 : 0) ||
          ratingValue(b, b.rating_hint) - ratingValue(a, a.rating_hint),
      );
  }, [restaurants, q, region, filters]);

  return (
    <>
      <FilterBar
        q={q}
        setQ={setQ}
        region={region}
        setRegion={setRegion}
        chips={REST_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        active={filters}
        toggle={(k) => {
          setFilters((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
          setLimit(24);
        }}
        placeholder="Restaurant oder Ort suchen"
        count={list.length}
      />
      <div className="guide-grid">
        {list.slice(0, limit).map((r) => (
          <article key={r.id} className="guide-card">
            <div className="guide-head">
              <span className="guide-emoji" aria-hidden="true">{restaurantEmoji(r)}</span>
              <div className="guide-title">
                <h3>
                  {r.name} {r.prioritaet === "Top" && <span title="Empfehlung">⭐</span>}
                </h3>
                <span className="row-sub">{r.ort} · {r.region}</span>
              </div>
            </div>
            <p className="guide-desc">{(r.warum ?? "").split("|")[0].trim() || kuecheShort(r.kueche)}</p>
            <div className="guide-meta">
              <span className="tag">{kuecheShort(r.kueche)}</span>
              {/vegan/i.test(r.veggie ?? "") && <span className="tag">🥗 Vegan</span>}
              {r.fahrt_ab_hotel && <span className="tag">🚗 {r.fahrt_ab_hotel}</span>}
            </div>
            <div className="guide-foot">
              <Stars hint={r.rating_hint} />
              <MapsBtn href={r.maps_link} />
            </div>
          </article>
        ))}
      </div>
      {list.length > limit && (
        <button className="ghost-btn wide" onClick={() => setLimit((l) => l + 24)}>
          Mehr anzeigen ({list.length - limit} weitere)
        </button>
      )}
      {list.length === 0 && <p className="empty-hint">Keine Treffer. Filter lockern oder anders suchen.</p>}
    </>
  );
}

function PoiList({ pois }: { pois: Poi[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [group, setGroup] = useState<PoiGroup | "">("");
  const [topOnly, setTopOnly] = useState(false);
  const [limit, setLimit] = useState(24);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return pois
      .filter((p) => !region || p.region === region)
      .filter((p) => !group || poiGroup(p) === group)
      .filter((p) => !topOnly || p.priority === "Top")
      .filter(
        (p) => !query || `${p.name} ${p.ort} ${p.type} ${p.description}`.toLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          (b.priority === "Top" ? 2 : b.priority === "Hoch" ? 1 : 0) -
            (a.priority === "Top" ? 2 : a.priority === "Hoch" ? 1 : 0) ||
          ratingValue(b, b.note) - ratingValue(a, a.note),
      );
  }, [pois, q, region, group, topOnly]);

  const chips = [
    { key: "__top", label: "⭐ Must-see" },
    ...POI_GROUPS.map((g) => ({ key: g.key, label: `${g.emoji} ${g.label}` })),
  ];

  return (
    <>
      <FilterBar
        q={q}
        setQ={setQ}
        region={region}
        setRegion={setRegion}
        chips={chips}
        active={[...(topOnly ? ["__top"] : []), ...(group ? [group] : [])]}
        toggle={(k) => {
          if (k === "__top") setTopOnly((t) => !t);
          else setGroup((g) => (g === k ? "" : (k as PoiGroup)));
          setLimit(24);
        }}
        placeholder="Sehenswürdigkeit oder Ort suchen"
        count={list.length}
      />
      <div className="guide-grid">
        {list.slice(0, limit).map((p) => (
          <article key={p.id} className="guide-card">
            <div className="guide-head">
              <span className="guide-emoji" aria-hidden="true">{poiEmoji(p)}</span>
              <div className="guide-title">
                <h3>
                  {p.name} {p.priority === "Top" && <span title="Must-see">⭐</span>}
                </h3>
                <span className="row-sub">{p.ort} · {p.region}</span>
              </div>
            </div>
            <div className="guide-meta">
              <span className="tag">{p.type}</span>
            </div>
            <div className="guide-foot">
              <Stars hint={p.note} />
              <MapsBtn href={p.maps_link} />
            </div>
          </article>
        ))}
      </div>
      {list.length > limit && (
        <button className="ghost-btn wide" onClick={() => setLimit((l) => l + 24)}>
          Mehr anzeigen ({list.length - limit} weitere)
        </button>
      )}
      {list.length === 0 && <p className="empty-hint">Keine Treffer. Filter lockern oder anders suchen.</p>}
    </>
  );
}

function FilterBar({
  q,
  setQ,
  region,
  setRegion,
  chips,
  active,
  toggle,
  placeholder,
  count,
}: {
  q: string;
  setQ: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  chips: { key: string; label: string }[];
  active: string[];
  toggle: (key: string) => void;
  placeholder: string;
  count: number;
}) {
  return (
    <div className="filter-bar">
      <div className="filter-row">
        <input
          className="text-input search"
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={placeholder}
        />
        <select className="region-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="">Alle Regionen</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="chip-wrap scroll">
        {chips.map((c) => (
          <button
            key={c.key}
            className={`chip ${active.includes(c.key) ? "on" : ""}`}
            onClick={() => toggle(c.key)}
            aria-pressed={active.includes(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="filter-count">{count} Einträge</p>
    </div>
  );
}
