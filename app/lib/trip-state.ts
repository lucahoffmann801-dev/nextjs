import {
  categorySummary as fallbackCategorySummary,
  dashboard as fallbackDashboard,
  fixedCosts as fallbackFixedCosts,
  flights as fallbackFlights,
  lists,
  packItems as fallbackPackItems,
  places as fallbackPlaces,
  restaurants as fallbackRestaurants,
  routes as fallbackRoutes,
  sheetSnapshot,
  trains as fallbackTrains,
  type Flight,
  type Place,
  type Restaurant,
  type RoutePlan,
  type TrainLeg,
} from "../trip-data";
import {
  calculateCostState,
  type CategorySummaryItem,
  type CostInput,
  type CostState,
  type DashboardState,
} from "./costing";
import { supabaseRest } from "./supabase-rest";

type FixedRow = {
  id: string;
  item: string;
  category: string | null;
  description: string | null;
  cost_date: string | null;
  amount: number | string | null;
  paid_by: string | null;
  split_mode: string | null;
  split_luca: number | string | null;
  split_jan: number | string | null;
  note: string | null;
  status: string | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string | null;
  travel_day: string | null;
  title: string;
  category: string | null;
  amount: number | string;
  paid_by: string | null;
  split_mode: string | null;
  split_luca: number | string | null;
  split_jan: number | string | null;
  note: string | null;
  created_at: string;
};

type FlightRow = {
  id: string;
  direction: string | null;
  date_local: string | null;
  from_airport: string | null;
  dep_local: string | null;
  to_airport: string | null;
  arr_local: string | null;
  airline: string | null;
  flight_no: string | null;
  booking_ref: string | null;
  note: string | null;
};

type TrainRow = {
  id: string;
  direction: string | null;
  date_label: string | null;
  section: string | null;
  train: string | null;
  from_station: string | null;
  dep_time: string | null;
  dep_platform: string | null;
  to_station: string | null;
  arr_time: string | null;
  arr_platform: string | null;
  total_price: string | null;
  note: string | null;
};

type RouteRow = {
  id: string;
  travel_day: string | null;
  title: string;
  stops: string[] | null;
  maps_url: string | null;
  cost_hint: string | null;
  status: string | null;
  note: string | null;
};

type RestaurantRow = {
  id: string;
  name: string;
  region: string | null;
  ort: string | null;
  kueche: string | null;
  preis: string | null;
  veggie: string | null;
  portionen: string | null;
  prioritaet: string | null;
  fahrt_ab_hotel: string | null;
  warum: string | null;
  notiz: string | null;
  maps_link: string | null;
  rating_hint: string | null;
  lat: number | string | null;
  lng: number | string | null;
  quality_status: string | null;
};

type PoiRow = {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  ort: string | null;
  priority: string | null;
  description: string | null;
  note: string | null;
  maps_link: string | null;
  lat: number | string | null;
  lng: number | string | null;
  quality_status: string | null;
};

type PackRow = {
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

export type TripState = CostState & {
  flights: Flight[];
  trains: TrainLeg[];
  routes: RoutePlan[];
  restaurants: Restaurant[];
  places: Place[];
  packItems: Array<(typeof fallbackPackItems)[number] & { lucaDone?: boolean; janDone?: boolean }>;
  source: {
    kind: "supabase" | "fallback";
    readAt: string;
    sheetSeed: string;
  };
};

export type NewExpenseInput = {
  travelDay: string;
  category: string;
  amount: number;
  paidBy: "Luca" | "Jan";
  splitMode?: string;
  splitLuca?: number;
  splitJan?: number;
  note?: string;
};

export type NewRouteInput = {
  id: string;
  day: string;
  title: string;
  stops: string[];
  maps: string;
  cost: string;
  status: string;
  note: string;
};

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Number(String(value).replace("€", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function shareValue(value: number | string | null | undefined, fallback: number) {
  const parsed = numberValue(value);
  if (!parsed) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

function fixedInput(row: FixedRow): CostInput {
  return {
    id: row.id,
    area: row.category ?? "Sonstiges",
    kind: row.item,
    description: row.description ?? row.note ?? "",
    status: row.status ?? "Offen",
    date: row.cost_date ?? "",
    amount: numberValue(row.amount),
    paidBy: row.paid_by ?? "Offen",
    splitLuca: shareValue(row.split_luca, 0.5),
    splitJan: shareValue(row.split_jan, 0.5),
    source: "fixed",
    note: row.note,
  };
}

function expenseInput(row: ExpenseRow): CostInput {
  return {
    id: row.id,
    area: row.category ?? row.title,
    kind: row.title,
    description: row.created_at,
    status: "Bezahlt",
    date: row.travel_day ?? row.expense_date ?? "",
    amount: numberValue(row.amount),
    paidBy: row.paid_by ?? "Offen",
    splitLuca: shareValue(row.split_luca, 0.5),
    splitJan: shareValue(row.split_jan, 0.5),
    source: "trip",
    note: row.note,
  };
}

function fallbackState(): TripState {
  return {
    dashboard: fallbackDashboard as DashboardState,
    categorySummary: withExpenseCategories(fallbackCategorySummary.map((item) => ({ ...item, open: 0 }))),
    fixedCosts: fallbackFixedCosts,
    expenses: [],
    flights: fallbackFlights,
    trains: fallbackTrains,
    routes: fallbackRoutes,
    restaurants: fallbackRestaurants,
    places: fallbackPlaces,
    packItems: fallbackPackItems,
    source: {
      kind: "fallback",
      readAt: new Date().toISOString(),
      sheetSeed: sheetSnapshot.readAt,
    },
  };
}

function withExpenseCategories(summary: CategorySummaryItem[]) {
  const seen = new Set(summary.map((item) => item.name));
  const extended = [...summary];

  for (const category of lists.categories) {
    if (seen.has(category)) continue;
    extended.push({
      name: category,
      total: 0,
      open: 0,
      lucaPaid: 0,
      janPaid: 0,
      lucaShare: 0,
      janShare: 0,
      lucaBalance: 0,
    });
  }

  return extended;
}

function mapFlight(row: FlightRow): Flight {
  return {
    id: row.id,
    direction: row.direction ?? "",
    date: row.date_local ?? "",
    from: row.from_airport ?? "",
    dep: row.dep_local ?? "",
    to: row.to_airport ?? "",
    arr: row.arr_local ?? "",
    airline: row.airline ?? "",
    number: row.flight_no ?? "",
    booking: row.booking_ref ?? "",
    aircraft: row.note?.includes("Boeing") ? "Boeing 737-800" : "",
    manageUrl: "https://www.ryanair.com/de/de/trip/manage",
  };
}

function mapTrain(row: TrainRow): TrainLeg {
  return {
    id: row.id,
    direction: row.direction ?? "",
    date: row.date_label ?? "",
    section: row.section ?? "",
    train: row.train ?? "",
    from: row.from_station ?? "",
    dep: row.dep_time ?? "",
    depPlatform: row.dep_platform ?? "",
    to: row.to_station ?? "",
    arr: row.arr_time ?? "",
    arrPlatform: row.arr_platform ?? "",
    price: row.total_price ?? "",
    note: row.note ?? "",
  };
}

function mapRoute(row: RouteRow): RoutePlan {
  return {
    id: row.id,
    day: row.travel_day ?? "Offen",
    title: row.title,
    stops: row.stops ?? [],
    cost: row.cost_hint ?? "",
    status: row.status ?? "Idee",
    note: row.note ?? "",
    maps: row.maps_url ?? "#",
  };
}

function normalizedLookup(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function allowedRoute(row: RouteRow) {
  const text = normalizedLookup(`${row.title} ${row.stops?.join(" ") ?? ""} ${row.note ?? ""} ${row.maps_url ?? ""}`);
  return !["hopferei", "ramstein", "miesenbach", "iliovasilema", "mezedopoleio", "cretangastronomy"].some((term) =>
    text.includes(term),
  );
}

function allowedRestaurant(row: RestaurantRow) {
  const text = normalizedLookup(`${row.name} ${row.ort ?? ""} ${row.region ?? ""} ${row.warum ?? ""} ${row.maps_link ?? ""}`);
  return !["hopferei", "ramstein", "miesenbach", "iliovasilema restaurant", "mezedopoleio crete", "cretangastronomy"].some((term) =>
    text.includes(term),
  );
}

function mapRestaurant(row: RestaurantRow): Restaurant {
  const lat = row.lat == null ? null : numberValue(row.lat);
  const lng = row.lng == null ? null : numberValue(row.lng);

  return {
    id: row.id,
    name: row.name,
    region: row.region ?? "",
    place: row.ort ?? "",
    cuisine: row.kueche ?? "",
    price: row.preis ?? "",
    veggie: row.veggie ?? "",
    portions: row.portionen ?? "",
    priority: row.prioritaet ?? "",
    drive: row.fahrt_ab_hotel ?? "",
    why: row.warum ?? row.notiz ?? "",
    maps: row.maps_link ?? "#",
    lat,
    lng,
    qualityStatus: row.quality_status ?? "sheet_seed",
    ratingHint: row.rating_hint ?? "",
  };
}

function mapPoi(row: PoiRow): Place {
  const lat = row.lat == null ? null : numberValue(row.lat);
  const lng = row.lng == null ? null : numberValue(row.lng);

  return {
    id: row.id,
    title: row.name,
    category: row.type ?? "",
    region: row.region ?? "",
    location: row.ort ?? "",
    priority: row.priority ?? "",
    effort: row.description ?? "",
    cost: "",
    note: row.note ?? "",
    maps: row.maps_link ?? "#",
    lat,
    lng,
    qualityStatus: row.quality_status ?? "sheet_seed",
  };
}

function mapPackItem(row: PackRow) {
  return {
    id: row.id,
    item: row.item,
    category: row.category ?? "",
    who: row.who ?? "",
    importance: row.importance ?? "",
    bag: row.bag ?? "",
    note: row.note ?? "",
    lucaDone: row.luca_done,
    janDone: row.jan_done,
  };
}

export async function getTripState(): Promise<TripState> {
  try {
    const [fixedRows, expenseRows, flightRows, trainRows, routeRows, restaurantRows, poiRows, packRows] =
      await Promise.all([
        supabaseRest<FixedRow[]>("kreta_fixed_costs?select=*&order=id.asc"),
        supabaseRest<ExpenseRow[]>("kreta_expenses?select=*&order=created_at.desc"),
        supabaseRest<FlightRow[]>("kreta_flights?select=*&order=id.asc"),
        supabaseRest<TrainRow[]>("kreta_trains?select=*&order=id.asc"),
        supabaseRest<RouteRow[]>("kreta_routes?select=*&order=id.asc"),
        supabaseRest<RestaurantRow[]>("kreta_restaurants?select=*&order=id.asc"),
        supabaseRest<PoiRow[]>("kreta_pois?select=*&order=id.asc"),
        supabaseRest<PackRow[]>("kreta_pack_items?select=*&order=id.asc"),
      ]);

    const calculated = calculateCostState(
      fixedRows.map(fixedInput).filter((item) => item.amount > 0),
      expenseRows.map(expenseInput),
    );

    return {
      ...calculated,
      categorySummary: withExpenseCategories(calculated.categorySummary),
      flights: flightRows.map(mapFlight),
      trains: trainRows.map(mapTrain),
      routes: routeRows.filter(allowedRoute).map(mapRoute),
      restaurants: restaurantRows.length ? restaurantRows.filter(allowedRestaurant).map(mapRestaurant) : fallbackRestaurants,
      places: poiRows.length ? poiRows.map(mapPoi) : fallbackPlaces,
      packItems: packRows.length ? packRows.map(mapPackItem) : fallbackPackItems,
      source: {
        kind: "supabase",
        readAt: new Date().toISOString(),
        sheetSeed: "10.06.2026, 20:10",
      },
    };
  } catch (error) {
    console.error(error);
    return fallbackState();
  }
}

export async function createExpense(input: NewExpenseInput) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Der Betrag muss größer als 0 sein.");
  }

  if (input.paidBy !== "Luca" && input.paidBy !== "Jan") {
    throw new Error("Bezahlt von muss Luca oder Jan sein.");
  }

  const note = input.note?.trim() ?? "";
  const category = input.category.trim();
  const splitLuca = shareValue(input.splitLuca, 0.5);
  const splitJan = shareValue(input.splitJan, 1 - splitLuca);
  await supabaseRest<ExpenseRow[]>("kreta_expenses?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: {
      travel_day: input.travelDay,
      title: category,
      category,
      amount,
      paid_by: input.paidBy,
      split_mode: input.splitMode ?? "50/50",
      split_luca: splitLuca,
      split_jan: splitJan,
      note,
      source: "app",
    },
  });

  return getTripState();
}

export async function createRoute(input: NewRouteInput) {
  const id = input.id.trim();
  const title = input.title.trim();
  if (!id || !title) {
    throw new Error("Route braucht ID und Titel.");
  }

  await supabaseRest<RouteRow[]>("kreta_routes?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id,
      travel_day: input.day,
      title,
      stops: input.stops,
      maps_url: input.maps,
      cost_hint: input.cost,
      status: input.status,
      note: input.note,
    },
  });

  return getTripState();
}

export async function deleteExpense(id: string) {
  if (!id) throw new Error("Expense id missing.");
  await supabaseRest<null>(`kreta_expenses?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return getTripState();
}
