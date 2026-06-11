// Zentrale Helfer: Supabase-REST, Geld, Datum, Kategorien, Ausgleichslogik.

const SB_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://retjhcetphbcivnmblkl.supabase.co";
const SB_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ??
  "sb_publishable_kF242e8F7sK0FLwWfXHLJQ_Vu9C-HZo";

export async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ---------- Typen ---------- */

export type FixedCost = {
  id: string;
  item: string;
  category: string | null;
  amount: string | number | null;
  paid_by: string | null;
  split_luca: string | number;
  split_jan: string | number;
  status: string | null;
  note: string | null;
};

export type Expense = {
  id: string;
  expense_date: string | null;
  title: string;
  category: string | null;
  amount: string | number;
  paid_by: string | null;
  split_mode: string | null;
  split_luca: string | number;
  split_jan: string | number;
  note: string | null;
  travel_day: string | null;
  created_at?: string;
};

export type Flight = {
  id: string;
  direction: string | null;
  flight_no: string | null;
  airline: string | null;
  from_airport: string | null;
  to_airport: string | null;
  dep_local: string | null;
  arr_local: string | null;
  date_local: string | null;
  status: string | null;
  note: string | null;
};

export type Train = {
  id: string;
  direction: string | null;
  date_label: string | null;
  weekday: string | null;
  section: string | null;
  train: string | null;
  product: string | null;
  from_station: string | null;
  dep_time: string | null;
  dep_platform: string | null;
  to_station: string | null;
  arr_time: string | null;
  arr_platform: string | null;
  ticket_code: string | null;
  total_price: string | null;
  train_binding: string | null;
  travellers: string | null;
  note: string | null;
};

export type RouteRow = {
  id: string;
  travel_day: string | null;
  title: string;
  start_label: string | null;
  stops: string[];
  maps_url: string | null;
  drive_hint: string | null;
  cost_hint: string | null;
  status: string | null;
  note: string | null;
};

export type Restaurant = {
  id: string;
  name: string;
  region: string | null;
  ort: string | null;
  kueche: string | null;
  veggie: string | null;
  prioritaet: string | null;
  fahrt_ab_hotel: string | null;
  maps_link: string | null;
  rating_hint: string | null;
  warum: string | null;
  notiz: string | null;
  is_blocked: boolean;
};

export type Poi = {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  ort: string | null;
  priority: string | null;
  description: string | null;
  note: string | null;
  maps_link: string | null;
};

export type PackItem = {
  id: string;
  item: string;
  category: string | null;
  who: string | null;
  importance: string | null;
  bag: string | null;
  note: string | null;
  luca_done: boolean;
  jan_done: boolean;
};

/* ---------- Geld ---------- */

export const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const eur = (n: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/** Akzeptiert "18,40", "18.40", "1.234,56", "1,234.56", "12 €". */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/* ---------- Ausgleich (Logik unverändert aus den DB-Splits) ---------- */

export type SettleItem = {
  amount: number;
  paid_by: string | null;
  split_luca: number;
  split_jan: number;
};

export type Settlement = {
  total: number;
  lucaPaid: number;
  janPaid: number;
  lucaShare: number;
  janShare: number;
  /** > 0: Luca zahlt an Jan, < 0: Jan zahlt an Luca */
  net: number;
};

export function settle(items: SettleItem[]): Settlement {
  let total = 0,
    lucaPaid = 0,
    janPaid = 0,
    lucaShare = 0,
    janShare = 0,
    lucaToJan = 0,
    janToLuca = 0;
  for (const it of items) {
    const a = it.amount;
    if (!a) continue;
    total += a;
    const sl = a * it.split_luca;
    const sj = a * it.split_jan;
    lucaShare += sl;
    janShare += sj;
    if (it.paid_by === "Jan") {
      janPaid += a;
      lucaToJan += sl;
    } else if (it.paid_by === "Luca") {
      lucaPaid += a;
      janToLuca += sj;
    }
  }
  return { total, lucaPaid, janPaid, lucaShare, janShare, net: lucaToJan - janToLuca };
}

export const toSettleItem = (
  r: { amount: string | number | null; paid_by: string | null; split_luca: string | number; split_jan: string | number },
): SettleItem => ({
  amount: num(r.amount),
  paid_by: r.paid_by,
  split_luca: num(r.split_luca),
  split_jan: num(r.split_jan),
});

/* ---------- Reisetage ---------- */

export const TRIP_DAYS: { iso: string; label: string; short: string; nr: number }[] = Array.from(
  { length: 9 },
  (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 1 + i));
    const weekday = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getUTCDay()];
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return {
      iso: `2026-07-${dd}`,
      label: `${weekday} ${dd}.07.`,
      short: `${dd}.07.`,
      nr: i + 1,
    };
  },
);

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Reisetag heute, sonst der erste Reisetag. */
export function defaultTripDay(): string {
  const t = todayIso();
  return TRIP_DAYS.some((d) => d.iso === t) ? t : TRIP_DAYS[0].iso;
}

export function tripStatus(): { phase: "before" | "during" | "after"; dayNr: number; daysLeft: number } {
  const t = todayIso();
  if (t < TRIP_DAYS[0].iso) {
    const ms = Date.parse(TRIP_DAYS[0].iso) - Date.parse(t);
    return { phase: "before", dayNr: 0, daysLeft: Math.round(ms / 86400000) };
  }
  const idx = TRIP_DAYS.findIndex((d) => d.iso === t);
  if (idx >= 0) return { phase: "during", dayNr: idx + 1, daysLeft: 0 };
  return { phase: "after", dayNr: 9, daysLeft: 0 };
}

/** "01.07.2026" für heute bzw. nächste Route. */
export function routeDayForToday(): string | null {
  const t = todayIso();
  const d = TRIP_DAYS.find((x) => x.iso === t);
  return d ? `${d.short}2026` : null;
}

/* ---------- Ausgaben-Kategorien (Quick-Entry-Chips) ---------- */

export const EXPENSE_CATS: { label: string; emoji: string }[] = [
  { label: "Essen", emoji: "🍽️" },
  { label: "Supermarkt", emoji: "🛒" },
  { label: "Tanken", emoji: "⛽" },
  { label: "Eintritt", emoji: "🎟️" },
  { label: "Parken", emoji: "🅿️" },
  { label: "Kaffee", emoji: "☕" },
  { label: "Eis", emoji: "🍦" },
  { label: "Strand", emoji: "🏖️" },
  { label: "Fähre", emoji: "⛴️" },
  { label: "Taxi/Bus", emoji: "🚕" },
  { label: "Hotel", emoji: "🏨" },
  { label: "Mietwagen", emoji: "🚗" },
  { label: "Sonstiges", emoji: "📦" },
];

export const catEmoji = (cat: string | null | undefined): string =>
  EXPENSE_CATS.find((c) => c.label === cat)?.emoji ?? "📦";

/* ---------- Emoji-Mapping Guide ---------- */

export function restaurantEmoji(r: Restaurant): string {
  const s = `${r.kueche ?? ""}`.toLowerCase();
  if (/meeresfrücht|fischrestaurant|fish/.test(s)) return "🐟";
  if (/sushi/.test(s)) return "🍣";
  if (/italien|pizz/.test(s)) return "🍝";
  if (/vegan|vegetarisch/.test(s)) return "🥗";
  if (/patisserie|dessert|eisdiele|kuchen/.test(s)) return "🍦";
  if (/café|coffee|kaffee|frühstück|brunch|bagel/.test(s)) return "☕";
  if (/cocktail|weinbar|weinkeller|^bar|, bar/.test(s)) return "🍸";
  if (/gyros|grill|fast-food|falafel|souvlaki/.test(s)) return "🥙";
  if (/griechisch|tavern|mediterran/.test(s)) return "🍷";
  return "🍽️";
}

/** Kurzes Küchen-Label aus dem teils langen Google-Feld. */
export function kuecheShort(kueche: string | null): string {
  if (!kueche) return "Restaurant";
  const first = kueche.split(",")[0].trim();
  return first.length > 34 ? first.slice(0, 32) + "…" : first;
}

export type PoiGroup =
  | "Strand"
  | "Kultur"
  | "Natur"
  | "Aktiv"
  | "Genuss"
  | "Shopping"
  | "Sonstiges";

export function poiGroup(p: Poi): PoiGroup {
  const s = `${p.type ?? ""} ${p.description ?? ""}`.toLowerCase();
  if (/strand|beach/.test(s)) return "Strand";
  if (/museum|archäolog|festung|burg|kirche|kloster|kathedrale|denkmal|histor|skulptur|galerie|kultur/.test(s))
    return "Kultur";
  if (/schlucht|wander|naturschutz|nationale|park|garten|aussicht|wildpark|gorge/.test(s)) return "Natur";
  if (/boot|fähr|kajak|kanu|tauch|quad|escape|freizeitpark|attraktion|reit|angel|safari|tour|aquarium|marina/.test(s))
    return "Aktiv";
  if (/café|coffee|bäckerei|patisserie|eisdiele|bar|restaurant|markt|winery|kuchen|molkerei|süßwaren|brasserie/.test(s))
    return "Genuss";
  if (/laden|geschäft|souvenir|shop/.test(s)) return "Shopping";
  return "Sonstiges";
}

export function poiEmoji(p: Poi): string {
  const s = `${p.type ?? ""}`.toLowerCase();
  if (/strand|beach/.test(s)) return "🏖️";
  if (/festung|burg/.test(s)) return "🏰";
  if (/museum|archäolog/.test(s)) return "🏛️";
  if (/aussicht/.test(s)) return "⛰️";
  if (/schlucht|wander|gorge/.test(s)) return "🥾";
  if (/fähr|boot|marina|kajak|kanu|tauch/.test(s)) return "🛶";
  if (/kirche|kloster|kathedrale/.test(s)) return "⛪";
  if (/galerie|kunst/.test(s)) return "🎨";
  if (/denkmal|skulptur|brunnen|histor|stadtplatz|rathaus/.test(s)) return "🏺";
  if (/park|garten|naturschutz|wildpark|schutzgebiet/.test(s)) return "🌿";
  if (/markt/.test(s)) return "🧺";
  if (/laden|geschäft|souvenir|shop/.test(s)) return "🛍️";
  if (/café|coffee|bäckerei|patisserie|kuchen|brasserie/.test(s)) return "☕";
  if (/eisdiele|süßwaren/.test(s)) return "🍦";
  if (/bar/.test(s)) return "🍸";
  if (/restaurant|gyros/.test(s)) return "🍽️";
  if (/hotel|unterkunft|apartment|villa|hostel|ferien|lodge|gästehaus|bed & breakfast|resort/.test(s)) return "🏨";
  if (/quad|safari|freizeitpark|escape|reit/.test(s)) return "🎢";
  if (/attraktion|sightseeing|fotospot/.test(s)) return "📸";
  if (/winery/.test(s)) return "🍇";
  if (/aquarium/.test(s)) return "🐠";
  return "📍";
}

export const POI_GROUPS: { key: PoiGroup; label: string; emoji: string }[] = [
  { key: "Strand", label: "Strände", emoji: "🏖️" },
  { key: "Kultur", label: "Kultur", emoji: "🏛️" },
  { key: "Natur", label: "Natur & Wandern", emoji: "🥾" },
  { key: "Aktiv", label: "Aktivitäten", emoji: "🛶" },
  { key: "Genuss", label: "Essen & Café", emoji: "☕" },
  { key: "Shopping", label: "Shoppen", emoji: "🛍️" },
  { key: "Sonstiges", label: "Sonstiges", emoji: "📍" },
];

export function parseRating(hint: string | null): { score: string; count: string } | null {
  if (!hint) return null;
  const m = hint.match(/Google\s*([\d.,]+)\s*\|\s*([\d.]+)\s*Bewertung/);
  if (!m) return null;
  return { score: m[1], count: m[2] };
}

export const HOTEL_MAPS =
  "https://www.google.com/maps/search/?api=1&query=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece";
