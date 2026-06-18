"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
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
  trip,
  type FixedCost,
  type Flight,
  type Place,
  type Restaurant,
  type RoutePlan,
  type TrainLeg,
} from "./trip-data";
import type {
  CategorySummaryItem,
  DashboardState,
  ExpenseItem,
} from "./lib/costing";
import type { NewExpenseInput, TripState } from "./lib/trip-state";
import type {
  RailAlternativesResult,
  RailLegLookup,
  RailStatusResult,
} from "./lib/rail-live-types";
import { routeWeatherAdjustment, weatherCodeEmoji, weatherCodeLabel } from "./lib/weather-domain";
import type { WeatherPointRequest, WeatherPointSnapshot, WeatherResponse } from "./lib/weather-types";

type View = "home" | "kosten" | "reise" | "routen" | "karte" | "guide" | "packen";
type GuideMode = "restaurants" | "sights";
type PackItem = (typeof fallbackPackItems)[number] & {
  lucaDone?: boolean;
  janDone?: boolean;
};
type PointKind = "hotel" | "place" | "restaurant";
type RouteDurationId = "short" | "half" | "full" | "intense";
type MealPlanId = "none" | "coffee" | "snack" | "lunch" | "dinner" | "lunchDinner" | "flexTwo";
type RouteInterestId = "highlights" | "beach" | "nature" | "culture" | "history" | "photo" | "relaxed";
type RoutePaceId = "easy" | "balanced" | "packed";
type WalkingLevelId = "low" | "medium" | "high";
type SplitPreset = "50_50" | "jan_full" | "luca_full" | "custom";
type RoutePoint = {
  id: string;
  kind: PointKind;
  title: string;
  category: string;
  region: string;
  note: string;
  maps: string;
  lat: number;
  lng: number;
  priority: string;
  rating: number | null;
  stayMinutes: number;
  arrivalMinutes?: number;
  reason: string;
  alternatives?: RoutePoint[];
  weather?: WeatherPointSnapshot;
};
type PlannedRoute = {
  id: string;
  day: string;
  title: string;
  startTime: string;
  stops: RoutePoint[];
  totalKm: number;
  driveMinutes: number;
  walkMinutes: number;
  stayMinutes: number;
  totalMinutes: number;
  stress: "entspannt" | "mittel" | "intensiv";
  mapsLinks: string[];
  createdAt: string;
  weatherCheckedAt?: string;
};
type RailLegUiState = {
  status?: RailStatusResult;
  statusLoading?: boolean;
  statusError?: string;
  alternatives?: RailAlternativesResult;
  alternativesLoading?: boolean;
  alternativesError?: string;
};
type ToastState = {
  title: string;
  detail?: string;
  tone?: "success" | "error" | "celebrate";
};
type CostBreakdownPhase = "fixed" | "trip";
type CostBreakdownEntry = {
  label: string;
  amount: number;
  meta: string;
};
type CostBreakdownItem = {
  id: string;
  phase: CostBreakdownPhase;
  label: string;
  amount: number;
  icon: string;
  color: string;
  entries: CostBreakdownEntry[];
};

const views: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "kosten", label: "Kosten" },
  { id: "reise", label: "Reise" },
  { id: "routen", label: "Routen" },
  { id: "guide", label: "Guide" },
];

const heroImage =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Aerial_view_of_Balos_beach.jpg/1280px-Aerial_view_of_Balos_beach.jpg";

const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function money(value: number) {
  return currency.format(value);
}

async function requestWeather(points: WeatherPointRequest[], date?: string, refresh = false) {
  const response = await fetch("/api/weather", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, date, refresh }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Wetterdaten konnten nicht geladen werden.");
  return result as WeatherResponse;
}

function timeFromIso(value: string | null | undefined) {
  if (!value) return "–";
  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? value;
}

function tripProgress() {
  const now = Date.now();
  const start = new Date("2026-07-01T00:00:00+03:00").getTime();
  const end = new Date("2026-07-10T00:00:00+03:00").getTime();
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

type TravelMoment = {
  id: string;
  kind: "flight" | "train";
  label: string;
  title: string;
  detail: string;
  at: Date;
};

function nextTravelMoment(flights: Flight[], trains: TrainLeg[]): TravelMoment | null {
  const moments: TravelMoment[] = [
    ...flights.map((flight) => ({
      id: flight.id,
      kind: "flight" as const,
      label: flight.direction,
      title: `${flight.number} · ${flight.from} → ${flight.to}`,
      detail: `${flight.date} · ${flight.dep}`,
      at: new Date(`${germanDateToIso(flight.date)}T${flight.dep}:00+02:00`),
    })),
    ...trains.map((train) => ({
      id: train.id,
      kind: "train" as const,
      label: train.direction,
      title: `${train.train} · ${train.from} → ${train.to}`,
      detail: `${train.date} · ${train.dep} · Gleis ${train.depPlatform}`,
      at: new Date(`${germanDateToIso(train.date)}T${train.dep}:00+02:00`),
    })),
  ].filter((moment) => !Number.isNaN(moment.at.getTime()));
  const now = Date.now() - 30 * 60_000;
  return moments.filter((moment) => moment.at.getTime() >= now).sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseAmountFlexible(raw: string): number | null {
  let text = raw.replace(/[€\s]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma > -1) {
    text = text.replace(",", ".");
  }
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function todayTravelDayLabel(): string | null {
  const now = new Date();
  if (now.getFullYear() !== 2026 || now.getMonth() !== 6) return null;
  const day = now.getDate();
  if (day < 1 || day > 9) return null;
  return lists.travelDays[day - 1] ?? null;
}

function categoryEmoji(category: string) {
  const text = category.toLowerCase();
  if (text.includes("ausgleich")) return "💸";
  if (text.includes("tank")) return "⛽";
  if (text.includes("park") || text.includes("maut")) return "🅿️";
  if (text.includes("supermarkt")) return "🛒";
  if (text.includes("restaurant") || text.includes("café") || text.includes("essen")) return "🍽️";
  if (text.includes("strand")) return "🏖️";
  if (text.includes("ausflüge") || text.includes("eintritt")) return "🎟️";
  if (text.includes("einkäufe")) return "🛍️";
  if (text.includes("apotheke") || text.includes("notfall")) return "💊";
  if (text.includes("öpnv") || text.includes("taxi")) return "🚕";
  if (text.includes("fähre")) return "⛴️";
  if (text.includes("hotel")) return "🏨";
  if (text.includes("mietwagen")) return "🚗";
  return "📦";
}

const ratingFilters = [
  { value: "all", label: "Alle Ratings" },
  { value: "4.8", label: "ab 4,8" },
  { value: "4.6", label: "ab 4,6" },
  { value: "4.4", label: "ab 4,4" },
];

const priorityFilters = [
  { value: "all", label: "Alle Empfehlungen" },
  { value: "Top", label: "Must-see" },
  { value: "Hoch", label: "Sehr gut" },
  { value: "Solide", label: "Optional" },
];

const restaurantCuisineFilters = [
  { value: "all", label: "Alle Küchen", terms: [] },
  { value: "greek", label: "Griechisch", terms: ["greek", "cretan", "taverna", "griechisch", "kretisch"] },
  { value: "seafood", label: "Fisch/Meeresfrüchte", terms: ["seafood", "fish", "angler", "fisch", "meeresfrüchte", "meeresfr"] },
  { value: "italian", label: "Italienisch", terms: ["italian", "pizza", "pasta"] },
  { value: "asian", label: "Asiatisch/Sushi", terms: ["asian", "sushi", "japanese", "chinese", "thai", "asiatisch"] },
  { value: "mexican", label: "Mexikanisch", terms: ["mexican", "taco"] },
  { value: "cafe", label: "Café/Brunch", terms: ["cafe", "café", "coffee", "kaffee", "breakfast", "frühstück", "brunch"] },
];

const veggieFilters = [
  { value: "all", label: "Alle" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarisch+" },
];

const sightTypeFilters = [
  { value: "all", label: "Alle Typen", terms: [] },
  { value: "beach", label: "Strand", terms: ["beach", "strand", "wasserfall", "höhle", "insel"] },
  { value: "museum", label: "Museum", terms: ["museum", "museen", "galerie"] },
  { value: "history", label: "Historisch", terms: ["historical", "archaeological", "fortress", "castle", "lighthouse", "historisch", "archäologisch", "festung", "burg", "leuchtturm"] },
  { value: "nature", label: "Natur/Wandern", terms: ["hiking", "nature", "park", "gorge", "trail", "wandern", "wandergebiet", "natur", "naturschutz"] },
  { value: "activity", label: "Aktiv/Tour", terms: ["tour", "outdoor", "boat", "safari", "bike", "escape", "amusement", "aktiv", "reiseveranstalter", "touristeninformation"] },
  { value: "viewpoint", label: "Aussicht", terms: ["viewpoint", "observation", "scenic", "aussicht", "aussichtsplattform"] },
];

const travelDayOptions = [
  { value: "2026-07-01", label: "Mi, 01.07." },
  { value: "2026-07-02", label: "Do, 02.07." },
  { value: "2026-07-03", label: "Fr, 03.07." },
  { value: "2026-07-04", label: "Sa, 04.07." },
  { value: "2026-07-05", label: "So, 05.07." },
  { value: "2026-07-06", label: "Mo, 06.07." },
  { value: "2026-07-07", label: "Di, 07.07." },
  { value: "2026-07-08", label: "Mi, 08.07." },
  { value: "2026-07-09", label: "Do, 09.07." },
];

const routeDurationOptions: Array<{ value: RouteDurationId; label: string; minutes: number; stops: number }> = [
  { value: "short", label: "Kurz", minutes: 210, stops: 2 },
  { value: "half", label: "Halbtag", minutes: 360, stops: 4 },
  { value: "full", label: "Ganzer Tag", minutes: 540, stops: 6 },
  { value: "intense", label: "Intensiv", minutes: 660, stops: 8 },
];

const routeInterestOptions: Array<{ value: RouteInterestId; label: string; terms: string[] }> = [
  { value: "highlights", label: "Highlights", terms: ["top", "hoch", "highlight", "sehenswürdigkeit", "google 4,8", "google 4,9"] },
  { value: "beach", label: "Strände", terms: ["strand", "beach", "küste", "wasser", "insel"] },
  { value: "nature", label: "Natur/Wandern", terms: ["natur", "wandern", "schlucht", "gorge", "trail", "park", "höhle"] },
  { value: "culture", label: "Kultur", terms: ["museum", "galerie", "kultur", "kirche", "kloster", "kunst"] },
  { value: "history", label: "Historisch", terms: ["historisch", "archäologisch", "festung", "burg", "ruine", "denkmal"] },
  { value: "photo", label: "Fotospots", terms: ["aussicht", "viewpoint", "scenic", "leuchtturm", "panorama", "fot"] },
  { value: "relaxed", label: "Entspannt", terms: ["strand", "aussicht", "park", "garten", "promenade", "hafen"] },
];

const mealPlanOptions: Array<{ value: MealPlanId; label: string; meals: number; restaurantMinutes: number; preferredSlots: number[] }> = [
  { value: "none", label: "Keine", meals: 0, restaurantMinutes: 0, preferredSlots: [] },
  { value: "coffee", label: "Kaffee-Stopp", meals: 1, restaurantMinutes: 30, preferredSlots: [10 * 60 + 45] },
  { value: "snack", label: "Snack/Café", meals: 1, restaurantMinutes: 40, preferredSlots: [11 * 60 + 30] },
  { value: "lunch", label: "Mittagessen", meals: 1, restaurantMinutes: 75, preferredSlots: [13 * 60] },
  { value: "dinner", label: "Abendessen", meals: 1, restaurantMinutes: 85, preferredSlots: [19 * 60] },
  { value: "lunchDinner", label: "Mittag + Abend", meals: 2, restaurantMinutes: 75, preferredSlots: [13 * 60, 19 * 60] },
  { value: "flexTwo", label: "2 flexible Pausen", meals: 2, restaurantMinutes: 60, preferredSlots: [12 * 60, 17 * 60 + 30] },
];

const routePaceOptions: Array<{ value: RoutePaceId; label: string; radiusFactor: number; durationBuffer: number; stopFactor: number }> = [
  { value: "easy", label: "Entspannt", radiusFactor: 0.82, durationBuffer: -25, stopFactor: 0.78 },
  { value: "balanced", label: "Ausgewogen", radiusFactor: 1, durationBuffer: 35, stopFactor: 1 },
  { value: "packed", label: "Viel sehen", radiusFactor: 1.22, durationBuffer: 95, stopFactor: 1.25 },
];

const walkingLevelOptions: Array<{ value: WalkingLevelId; label: string; multiplier: number }> = [
  { value: "low", label: "Wenig laufen", multiplier: 0.7 },
  { value: "medium", label: "Normal", multiplier: 1 },
  { value: "high", label: "Wandern okay", multiplier: 1.35 },
];

const expenseSplitOptions: Array<{ value: SplitPreset; label: string; luca: number; jan: number }> = [
  { value: "50_50", label: "50% / 50%", luca: 0.5, jan: 0.5 },
  { value: "jan_full", label: "Jan zahlt komplett", luca: 0, jan: 1 },
  { value: "luca_full", label: "Luca zahlt komplett", luca: 1, jan: 0 },
  { value: "custom", label: "Eigener Split", luca: 0.5, jan: 0.5 },
];

const costCategoryVisuals = [
  { terms: ["flug"], icon: "✈️", color: "#7dd3fc" },
  { terms: ["hotel", "unterkunft"], icon: "🏨", color: "#c4b5fd" },
  { terms: ["mietwagen", "auto"], icon: "🚙", color: "#fdba74" },
  { terms: ["bahn", "zug"], icon: "🚆", color: "#86efac" },
  { terms: ["tanken", "benzin", "diesel"], icon: "⛽", color: "#fde047" },
  { terms: ["restaurant", "cafe", "essen"], icon: "🍽️", color: "#fca5a5" },
  { terms: ["supermarkt", "lebensmittel"], icon: "🛒", color: "#67e8f9" },
  { terms: ["parken", "maut"], icon: "🅿️", color: "#94a3b8" },
  { terms: ["strand", "liegen", "schirme"], icon: "🏖️", color: "#5eead4" },
  { terms: ["ausflug", "eintritt"], icon: "🎟️", color: "#f0abfc" },
  { terms: ["einkauf", "shopping"], icon: "🛍️", color: "#f9a8d4" },
  { terms: ["apotheke", "notfall"], icon: "💊", color: "#f87171" },
  { terms: ["taxi", "opnv", "bus"], icon: "🚕", color: "#a7f3d0" },
  { terms: ["sonstig"], icon: "📦", color: "#d6d3d1" },
];

function costCategoryVisual(category: string) {
  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return costCategoryVisuals.find((item) => item.terms.some((term) => normalized.includes(term))) ?? {
    icon: "💶",
    color: "#e5e7eb",
  };
}

function buildCostBreakdown(fixedCosts: FixedCost[], expenses: ExpenseItem[]) {
  const groups = new Map<string, CostBreakdownItem>();

  function addEntry(phase: CostBreakdownPhase, label: string, amount: number, entry: CostBreakdownEntry) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const id = `${phase}:${label.toLowerCase()}`;
    const visual = costCategoryVisual(label);
    const current = groups.get(id) ?? {
      id,
      phase,
      label,
      amount: 0,
      icon: visual.icon,
      color: visual.color,
      entries: [],
    };
    current.amount += amount;
    current.entries.push(entry);
    groups.set(id, current);
  }

  for (const cost of fixedCosts) {
    addEntry("fixed", cost.area, cost.amount, {
      label: cost.kind,
      amount: cost.amount,
      meta: [cost.date, `${cost.paidBy} bezahlt`].filter(Boolean).join(" · "),
    });
  }

  for (const expense of expenses) {
    if (expense.isSettlement) continue;
    addEntry("trip", expense.category, expense.amount, {
      label: expense.note.trim() || expense.category,
      amount: expense.amount,
      meta: [expense.travelDay, `${expense.paidBy} bezahlt`].filter(Boolean).join(" · "),
    });
  }

  return Array.from(groups.values())
    .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

const hotelPoint: RoutePoint = {
  id: "hotel-base",
  kind: "hotel",
  title: trip.hotel,
  category: "Unterkunft",
  region: "Südküste",
  note: "Basis in Frangokastello für Start, Ziel und Tagesrouten.",
  maps: trip.hotelMaps,
  lat: 35.1829,
  lng: 24.2326,
  priority: "Basis",
  rating: null,
  stayMinutes: 0,
  reason: "Unterkunft und fixer Ausgangspunkt.",
};

const smartRouteStorageKey = "kreta-smart-routes-v1";
const janLucaImage = "/people/jan-und-luca.png";

const windows1252ByteMap = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const guideTranslations = [
  ["Canoe & kayak rental service", "Kanu- und Kajakverleih"],
  ["Canoe & kayak tour agency", "Kanu- und Kajaktouren"],
  ["Internet marketing service", "Internet-Marketing"],
  ["Motorcycle rental agency", "Motorradverleih"],
  ["Tourist information center", "Touristeninformation"],
  ["Outdoor activity organiser", "Outdoor-Aktivitäten"],
  ["Museum of musical instruments", "Musikinstrumenten-Museum"],
  ["Traditional market", "Traditioneller Markt"],
  ["Sightseeing tour agency", "Sightseeing-Touren"],
  ["Airport shuttle service", "Flughafentransfer"],
  ["Holiday apartment rental", "Ferienwohnungsvermietung"],
  ["Middle Eastern restaurant", "Nahöstliches Restaurant"],
  ["Country food restaurant", "Landküche-Restaurant"],
  ["Fine dining restaurant", "Gehobenes Restaurant"],
  ["Greek Orthodox church", "Griechisch-orthodoxe Kirche"],
  ["Archaeological museum", "Archäologisches Museum"],
  ["Archaeological site", "Archäologische Stätte"],
  ["Natural history museum", "Naturkundemuseum"],
  ["Physical fitness program", "Fitnessprogramm"],
  ["Tourist attraction", "Sehenswürdigkeit"],
  ["Historical landmark", "Historischer Ort"],
  ["Historical place", "Historischer Ort"],
  ["Cultural landmark", "Kulturdenkmal"],
  ["Heritage building", "Historisches Gebäude"],
  ["Heritage museum", "Heimatmuseum"],
  ["Local history museum", "Lokalgeschichtliches Museum"],
  ["Handicraft museum", "Handwerksmuseum"],
  ["Maritime museum", "Maritimes Museum"],
  ["Children's museum", "Kindermuseum"],
  ["History museum", "Geschichtsmuseum"],
  ["Amusement ride supplier", "Freizeitattraktion"],
  ["Amusement center", "Freizeitzentrum"],
  ["Escape room center", "Escape Room"],
  ["Observation deck", "Aussichtspunkt"],
  ["Scenic spot", "Aussichtspunkt"],
  ["Hiking area", "Wandergebiet"],
  ["Hiking guide", "Wander-Guide"],
  ["Nature preserve", "Naturschutzgebiet"],
  ["National reserve", "Nationalreservat"],
  ["Ecological park", "Ökopark"],
  ["Wildlife park", "Wildpark"],
  ["Botanical garden", "Botanischer Garten"],
  ["Community garden", "Gemeinschaftsgarten"],
  ["City park", "Stadtpark"],
  ["Public beach", "Öffentlicher Strand"],
  ["Beach pavillion", "Strandpavillon"],
  ["Boat tour agency", "Bootstouren"],
  ["Boat rental service", "Bootsverleih"],
  ["Cruise agency", "Kreuzfahrtagentur"],
  ["Bus tour agency", "Bustouren"],
  ["Helicopter tour agency", "Helikoptertouren"],
  ["ATV rental service", "Quad-Verleih"],
  ["Bicycle rental service", "Fahrradverleih"],
  ["Sport tour agency", "Sporttouren"],
  ["SCUBA tour agency", "Tauch-Touren"],
  ["SCUBA instructor", "Tauchlehrer"],
  ["Diving center", "Tauchzentrum"],
  ["Dive club", "Tauchclub"],
  ["Dive shop", "Tauchshop"],
  ["Horse riding school", "Reitschule"],
  ["Equestrian facility", "Reitanlage"],
  ["Catholic cathedral", "Katholische Kathedrale"],
  ["Catholic church", "Katholische Kirche"],
  ["Orthodox church", "Orthodoxe Kirche"],
  ["Art gallery", "Kunstgalerie"],
  ["Art museum", "Kunstmuseum"],
  ["Movie theater", "Kino"],
  ["Water park", "Wasserpark"],
  ["Theme park", "Freizeitpark"],
  ["Produce market", "Lebensmittelmarkt"],
  ["City courthouse", "Gericht"],
  ["Corporate office", "Büro"],
  ["Running store", "Laufladen"],
  ["Health consultant", "Gesundheitsberatung"],
  ["Sports club", "Sportverein"],
  ["Tour operator", "Touranbieter"],
  ["Tour agency", "Touranbieter"],
  ["Travel agency", "Reiseagentur"],
  ["Air taxi", "Lufttaxi"],
  ["Army museum", "Militärmuseum"],
  ["Manufacturer", "Hersteller"],
  ["Aquarium", "Aquarium"],
  ["Basilica", "Basilika"],
  ["Beach", "Strand"],
  ["Castle", "Burg"],
  ["Cathedral", "Kathedrale"],
  ["Church", "Kirche"],
  ["Fortress", "Festung"],
  ["Fountain", "Brunnen"],
  ["Garden", "Garten"],
  ["Market", "Markt"],
  ["Memorial", "Gedenkstätte"],
  ["Monastery", "Kloster"],
  ["Monument", "Denkmal"],
  ["Museum", "Museum"],
  ["Park", "Park"],
  ["Playground", "Spielplatz"],
  ["Sculpture", "Skulptur"],
  ["Winery", "Weingut"],
  ["Vegetarian restaurant", "Vegetarisches Restaurant"],
  ["Mediterranean restaurant", "Mediterranes Restaurant"],
  ["Angler fish restaurant", "Fischrestaurant"],
  ["Fish & chips restaurant", "Fish-and-Chips-Restaurant"],
  ["Country food restaurant", "Landküche-Restaurant"],
  ["Meat dish restaurant", "Fleischgerichte-Restaurant"],
  ["Barbecue restaurant", "Grillrestaurant"],
  ["Breakfast restaurant", "Frühstücksrestaurant"],
  ["Delivery Restaurant", "Lieferservice"],
  ["Eclectic restaurant", "Vielfältiges Restaurant"],
  ["Fast food restaurant", "Fast-Food-Restaurant"],
  ["Family restaurant", "Familienrestaurant"],
  ["Falafel restaurant", "Falafel-Restaurant"],
  ["Italian restaurant", "Italienisches Restaurant"],
  ["Greek restaurant", "Griechisches Restaurant"],
  ["Seafood restaurant", "Meeresfrüchte-Restaurant"],
  ["Sushi restaurant", "Sushi-Restaurant"],
  ["Asian restaurant", "Asiatisches Restaurant"],
  ["English restaurant", "Englisches Restaurant"],
  ["Vegan restaurant", "Veganes Restaurant"],
  ["Small plates restaurant", "Tapas/kleine Teller"],
  ["Lunch restaurant", "Mittagsrestaurant"],
  ["Brunch restaurant", "Brunch-Restaurant"],
  ["Fish restaurant", "Fischrestaurant"],
  ["Dessert restaurant", "Dessertrestaurant"],
  ["Middle Eastern restaurant", "Nahöstliches Restaurant"],
  ["Guest house", "Gästehaus"],
  ["Resort hotel", "Resorthotel"],
  ["Capsule hotel", "Kapselhotel"],
  ["Townhouse complex", "Reihenhausanlage"],
  ["Holiday apartment rental", "Ferienwohnungsvermietung"],
  ["Coffee shop", "Café"],
  ["Coffee stand", "Kaffeestand"],
  ["Juice shop", "Saftbar"],
  ["Noodle shop", "Nudelshop"],
  ["Bagel shop", "Bagelshop"],
  ["Soup kitchen", "Suppenküche"],
  ["Wine cellar", "Weinkeller"],
  ["Wine bar", "Weinbar"],
  ["Beer garden", "Biergarten"],
  ["Beach club", "Strandclub"],
  ["Night club", "Nachtclub"],
  ["Cocktail bar", "Cocktailbar"],
  ["Oxygen cocktail spot", "Cocktailbar"],
  ["Bar & grill", "Bar & Grill"],
  ["Barbecue area", "Grillplatz"],
  ["Advertising service", "Werbeservice"],
  ["Caterer", "Catering"],
  ["Diner", "Diner"],
  ["Grill", "Grill"],
  ["Hotel", "Hotel"],
  ["Cafe", "Café"],
  ["Bar", "Bar"],
  ["Restaurant", "Restaurant"],
  ["Vegan & veggie", "Vegan & vegetarisch"],
  ["Vegan options", "Vegane Optionen"],
  ["Vegetarian options", "Vegetarische Optionen"],
  ["Accepts reservations", "Reservierungen möglich"],
  ["Outdoor seating", "Außenplätze"],
  ["Dine-in", "Essen vor Ort"],
  ["Takeout", "Zum Mitnehmen"],
  ["Reviews", "Bewertungen"],
  ["Place ID", "Place-ID"],
].sort((a, b) => b[0].length - a[0].length);

function repairMojibake(value: string) {
  if (!/[ÃÂÎÏâ]/.test(value)) {
    return value;
  }

  try {
    const bytes = Array.from(value, (char) => {
      const code = char.charCodeAt(0);
      if (code <= 0xff) {
        return code;
      }
      const mapped = windows1252ByteMap.get(code);
      if (mapped != null) {
        return mapped;
      }
      throw new Error("Cannot repair");
    });
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    return repaired.includes("�") ? value : repaired;
  } catch {
    return value;
  }
}

function repairGuideText(value?: string | null) {
  const repaired = repairMojibake(value ?? "");
  if (/^\?+$/.test(repaired.trim())) {
    return "€".repeat(repaired.trim().length);
  }
  return repaired
    .replaceAll("S?dk?ste", "Südküste")
    .replaceAll("s?dk?ste", "südküste")
    .replaceAll("m?glich", "möglich")
    .replaceAll("M?glich", "Möglich")
    .replaceAll("Pr?fen", "Unklar")
    .replaceAll("pr?fen", "unklar")
    .replaceAll("Prüfen", "Unklar")
    .replaceAll("prüfen", "unklar")
    .replaceAll(" ? ", " · ");
}

function translateGuideText(value: string) {
  return guideTranslations.reduce((text, [english, german]) => text.replaceAll(english, german), value).replace(
    /Google\s+(\d)[.,](\d)/g,
    "Google $1,$2",
  );
}

function readableText(value?: string | null) {
  return translateGuideText(repairGuideText(value));
}

function normalizedText(value?: string | null) {
  const repaired = repairGuideText(value);
  return `${repaired} ${translateGuideText(repaired)}`.toLowerCase();
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => value ?? "").filter(Boolean))).sort((a, b) =>
    readableText(a).localeCompare(readableText(b), "de"),
  );
}

function matchesTerms(text: string, terms: string[]) {
  return !terms.length || terms.some((term) => text.includes(term));
}

function googleRating(value?: string | null) {
  const match = readableText(value).match(/Google\s+(\d(?:[.,]\d)?)/i);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1].replace(",", "."));
}

function matchesRating(value: string | null | undefined, filter: string) {
  if (filter === "all") {
    return true;
  }
  const rating = googleRating(value);
  return rating != null && rating >= Number.parseFloat(filter);
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function hasCoordinates(item: { lat?: number | null; lng?: number | null }): item is { lat: number; lng: number } {
  return Number.isFinite(item.lat) && Number.isFinite(item.lng);
}

function priorityScore(priority?: string | null) {
  const text = normalizedText(priority);
  if (text.includes("top")) return 60;
  if (text.includes("hoch")) return 42;
  if (text.includes("solide")) return 24;
  return 12;
}

function dedupePlaces(places: Place[]) {
  const byKey = new Map<string, Place>();
  for (const place of places) {
    const coordKey = hasCoordinates(place) ? `${place.lat.toFixed(4)},${place.lng.toFixed(4)}` : readableText(place.maps);
    const key = `${stripDiacritics(normalizedText(place.title)).replace(/\s+/g, " ").trim()}|${coordKey}`;
    const existing = byKey.get(key);
    if (!existing || priorityScore(place.priority) + (googleRating(place.note) ?? 0) > priorityScore(existing.priority) + (googleRating(existing.note) ?? 0)) {
      byKey.set(key, place);
    }
  }
  return Array.from(byKey.values());
}

function isTourismPlace(place: Place) {
  const text = normalizedText(
    `${place.title} ${place.category} ${place.location ?? ""} ${place.effort} ${place.cost} ${place.note}`,
  );
  const plain = stripDiacritics(text);
  const positiveTerms = [
    "sehenswurdigkeit",
    "tourist attraction",
    "strand",
    "beach",
    "museum",
    "historisch",
    "archaologisch",
    "aussicht",
    "viewpoint",
    "scenic",
    "wandern",
    "hiking",
    "schlucht",
    "gorge",
    "hohle",
    "cave",
    "festung",
    "fortress",
    "burg",
    "castle",
    "park",
    "garten",
    "botan",
    "natur",
    "lighthouse",
    "leuchtturm",
    "brunnen",
    "denkmal",
    "memorial",
    "monument",
    "aquarium",
    "weingut",
    "winery",
    "touristeninformation",
    "sightseeing",
    "bootstour",
    "boat tour",
    "freizeit",
    "escape",
    "wasserfall",
    "waterfall",
  ];
  const accommodationTerms = [
    "hotel",
    "resort",
    "villa",
    "apartment",
    "studio",
    "unterkunft",
    "ferienwohnung",
    "ferienwohnungsvermietung",
    "guest house",
    "hostel",
    "rooms",
  ];
  const foodTerms = [
    "restaurant",
    "taverna",
    "cafe",
    "coffee",
    "bar",
    "grill",
    "diner",
    "brunch",
    "bistro",
    "sushi",
    "pizza",
    "fast-food",
    "bäckerei",
    "backerei",
    "bakery",
    "philo",
    "cream",
  ];
  const serviceTerms = [
    "shop",
    "laden",
    "geschaft",
    "store",
    "office",
    "buro",
    "dienst",
    "marketing",
    "werbeservice",
    "gericht",
    "courthouse",
    "manufacturer",
    "hersteller",
    "parkplatz",
    "tankstelle",
    "gas station",
    "airport shuttle",
    "flughafentransfer",
    "immobilien",
    "rental agency",
    "autovermietung",
    "motorcycle rental",
    "massage",
    "spa",
    "wellness",
    "therapy",
    "therapies",
    "fitness",
    "gift box",
  ];
  const shopTerms = ["shop", "laden", "geschaft", "store", "museumsshop", "running store"];
  const religiousTerms = [
    "kloster",
    "monastery",
    "kirche",
    "church",
    "kathedrale",
    "cathedral",
    "temple",
    "basilika",
    "basilica",
    "moschee",
    "mosque",
    "ναός",
  ];
  const isAccommodation = accommodationTerms.some((term) => plain.includes(term));
  const isFood = foodTerms.some((term) => plain.includes(term));
  const isShop = shopTerms.some((term) => plain.includes(term));
  const isReligious = religiousTerms.some((term) => plain.includes(term));
  const isService = serviceTerms.some((term) => plain.includes(term));
  const hasTourismValue = positiveTerms.some((term) => plain.includes(term));

  if (isAccommodation || isFood || isShop || isReligious) return false;
  if (isService && !hasTourismValue) return false;
  return hasTourismValue || priorityScore(place.priority) >= 42;
}

function isCreteRestaurant(restaurant: Restaurant) {
  const text = stripDiacritics(
    normalizedText(`${restaurant.name} ${restaurant.place} ${restaurant.region} ${restaurant.why} ${restaurant.maps}`),
  );
  const blockedTerms = [
    "hopferei",
    "merkurstrasse",
    "merkurstraße",
    "ramstein",
    "miesenbach",
    "kohlwaldchen",
    "kohilwaldchen",
    "iliovasilema restaurant",
    "iliovasilema",
    "mezedopoleio crete",
    "mezedopoleio",
    "cretangastronomy",
    "crete restaurant ramstein",
    "4928370746258572476",
  ];
  if (blockedTerms.some((term) => text.includes(stripDiacritics(term.toLowerCase())))) return false;
  if (hasCoordinates(restaurant) && distanceKm(hotelPoint, restaurant) > 260) return false;
  return true;
}

function isCleanBackendRoute(route: RoutePlan) {
  const text = stripDiacritics(normalizedText(`${route.title} ${route.stops.join(" ")} ${route.note} ${route.maps}`));
  const blockedTerms = ["hopferei", "ramstein", "miesenbach", "iliovasilema", "mezedopoleio", "cretangastronomy"];
  return !blockedTerms.some((term) => text.includes(term));
}

function distanceKm(a: Pick<RoutePoint, "lat" | "lng">, b: Pick<RoutePoint, "lat" | "lng">) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimateDriveMinutes(km: number) {
  return Math.max(6, Math.round((km / 48) * 60 + 5));
}

function minutesFromTime(value: string) {
  const [hours = "9", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function timeLabel(minutes: number) {
  const dayMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(dayMinutes / 60);
  const rest = dayMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function formatKm(km: number) {
  return `${Math.round(km)} km`;
}

function stayMinutesForPlace(place: Place) {
  const text = stripDiacritics(normalizedText(`${place.category} ${place.effort} ${place.note}`));
  if (text.includes("schlucht") || text.includes("gorge") || text.includes("hiking") || text.includes("wandern")) return 140;
  if (text.includes("strand") || text.includes("beach")) return 110;
  if (text.includes("museum") || text.includes("archaologisch") || text.includes("historisch")) return 75;
  if (text.includes("tour") || text.includes("boot")) return 120;
  if (text.includes("aussicht") || text.includes("viewpoint") || text.includes("denkmal")) return 35;
  return 55;
}

function walkingMinutesForPoint(point: RoutePoint, walkingLevel: WalkingLevelId) {
  if (point.kind !== "place") return 0;
  const text = stripDiacritics(normalizedText(`${point.title} ${point.category} ${point.note}`));
  const base =
    text.includes("schlucht") || text.includes("gorge") || text.includes("wandern") || text.includes("hiking")
      ? 65
      : text.includes("strand") || text.includes("beach")
        ? 20
        : text.includes("museum")
          ? 12
          : 18;
  const level = walkingLevelOptions.find((option) => option.value === walkingLevel) ?? walkingLevelOptions[1];
  return Math.round(base * level.multiplier);
}

function tourismEmoji(value: string) {
  const text = stripDiacritics(normalizedText(value));
  if (text.includes("strand") || text.includes("beach")) return "🏖️";
  if (text.includes("museum") || text.includes("galerie")) return "🏛️";
  if (text.includes("schlucht") || text.includes("wandern") || text.includes("natur")) return "🥾";
  if (text.includes("aussicht") || text.includes("viewpoint")) return "📸";
  if (text.includes("burg") || text.includes("festung") || text.includes("historisch")) return "🏰";
  return "📍";
}

function restaurantEmoji(value: string) {
  const text = stripDiacritics(normalizedText(value));
  if (text.includes("cafe") || text.includes("kaffee") || text.includes("brunch")) return "☕";
  if (text.includes("sushi") || text.includes("asian")) return "🍣";
  if (text.includes("pizza") || text.includes("italien")) return "🍕";
  if (text.includes("fish") || text.includes("fisch") || text.includes("seafood")) return "🐟";
  if (text.includes("vegan") || text.includes("vegetar")) return "🥗";
  return "🍽️";
}

function placeToRoutePoint(place: Place): RoutePoint | null {
  if (!hasCoordinates(place)) return null;
  return {
    id: `place-${place.id}`,
    kind: "place",
    title: readableText(place.title),
    category: readableText(place.category),
    region: readableText(place.region),
    note: readableText(place.note),
    maps: place.maps,
    lat: place.lat,
    lng: place.lng,
    priority: readableText(place.priority),
    rating: googleRating(place.note),
    stayMinutes: stayMinutesForPlace(place),
    reason: "Passt zu euren Filtern und liegt sinnvoll auf der Tagesroute.",
  };
}

function restaurantToRoutePoint(restaurant: Restaurant): RoutePoint | null {
  if (!hasCoordinates(restaurant)) return null;
  return {
    id: `restaurant-${restaurant.id}`,
    kind: "restaurant",
    title: readableText(restaurant.name),
    category: readableText(restaurant.cuisine || "Restaurant"),
    region: readableText(restaurant.region),
    note: readableText(restaurant.why || restaurant.veggie || restaurant.ratingHint),
    maps: restaurant.maps,
    lat: restaurant.lat,
    lng: restaurant.lng,
    priority: readableText(restaurant.priority),
    rating: googleRating(restaurant.ratingHint),
    stayMinutes: 75,
    reason: "Essensstopp in Routennähe mit passenden Google-Maps-Daten.",
  };
}

function googleMapsDirectionsLink(points: RoutePoint[]) {
  const coords = points.map((point) => `${point.lat},${point.lng}`);
  const [origin, ...rest] = coords;
  const destination = rest.pop() ?? origin;
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (rest.length) {
    params.set("waypoints", rest.join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function googleMapsRouteLinks(points: RoutePoint[]) {
  if (points.length <= 10) return [googleMapsDirectionsLink(points)];
  const links: string[] = [];
  for (let start = 0; start < points.length - 1; start += 8) {
    const segment = points.slice(start, Math.min(points.length, start + 10));
    if (segment.length >= 2) links.push(googleMapsDirectionsLink(segment));
  }
  return links;
}

function routeMetrics(points: RoutePoint[], walkingLevel: WalkingLevelId = "medium") {
  let totalKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalKm += distanceKm(points[index - 1], points[index]);
  }
  const driveMinutes = estimateDriveMinutes(totalKm);
  const stayMinutes = points.reduce((sum, point) => sum + point.stayMinutes, 0);
  const walkMinutes = points.reduce((sum, point) => sum + walkingMinutesForPoint(point, walkingLevel), 0);
  return { driveMinutes, stayMinutes, totalKm, totalMinutes: driveMinutes + stayMinutes + walkMinutes, walkMinutes };
}

function orderRoutePoints(start: RoutePoint, end: RoutePoint, points: RoutePoint[]) {
  const remaining = [...points];
  const ordered: RoutePoint[] = [];
  let current = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const score = distanceKm(current, candidate) + distanceKm(candidate, end) * 0.35;
      if (score < bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return [start, ...ordered, end];
}

function matchesRouteInterest(point: RoutePoint, interests: RouteInterestId[]) {
  if (!interests.length) return true;
  const text = stripDiacritics(normalizedText(`${point.title} ${point.category} ${point.note} ${point.priority}`));
  return interests.some((interest) => {
    const option = routeInterestOptions.find((item) => item.value === interest);
    return option?.terms.some((term) => text.includes(stripDiacritics(term.toLowerCase())));
  });
}

function buildSmartRoute({
  day,
  duration,
  end,
  interests,
  lowStress,
  maxDriveMinutes,
  maxStops,
  mealPlan,
  pace,
  places,
  restaurants,
  start,
  startTime,
  walkingLevel,
  weatherByPoint,
  weatherCheckedAt,
}: {
  day: string;
  duration: RouteDurationId;
  end: RoutePoint;
  interests: RouteInterestId[];
  lowStress: boolean;
  maxDriveMinutes: number;
  maxStops: number;
  mealPlan: MealPlanId;
  pace: RoutePaceId;
  places: Place[];
  restaurants: Restaurant[];
  start: RoutePoint;
  startTime: string;
  walkingLevel: WalkingLevelId;
  weatherByPoint?: Map<string, WeatherPointSnapshot>;
  weatherCheckedAt?: string;
}) {
  const durationConfig = routeDurationOptions.find((option) => option.value === duration) ?? routeDurationOptions[1];
  const mealConfig = mealPlanOptions.find((option) => option.value === mealPlan) ?? mealPlanOptions[0];
  const paceConfig = routePaceOptions.find((option) => option.value === pace) ?? routePaceOptions[1];
  const poiBudget = Math.max(1, Math.min(maxStops - mealConfig.meals, Math.round(durationConfig.stops * paceConfig.stopFactor)));
  const routeRadius = (lowStress ? 95 : duration === "intense" ? 210 : duration === "full" ? 165 : duration === "half" ? 115 : 70) * paceConfig.radiusFactor;
  const pointCandidates = places
    .map(placeToRoutePoint)
    .filter((point): point is RoutePoint => Boolean(point))
    .map((point) => ({ ...point, weather: weatherByPoint?.get(point.id) }))
    .filter((point) => point.id !== start.id && point.id !== end.id)
    .filter((point) => distanceKm(start, point) + distanceKm(point, end) <= routeRadius * 2.25)
    .filter((point) => matchesRouteInterest(point, interests))
    .filter((point) => walkingLevel !== "low" || walkingMinutesForPoint(point, walkingLevel) <= 38)
    .sort((a, b) => {
      const aWeather = routeWeatherAdjustment(a.weather, a).score;
      const bWeather = routeWeatherAdjustment(b.weather, b).score;
      const aScore = priorityScore(a.priority) + (a.rating ?? 0) * 8 - distanceKm(start, a) * 0.25 - walkingMinutesForPoint(a, walkingLevel) * 0.08 + aWeather;
      const bScore = priorityScore(b.priority) + (b.rating ?? 0) * 8 - distanceKm(start, b) * 0.25 - walkingMinutesForPoint(b, walkingLevel) * 0.08 + bWeather;
      return bScore - aScore;
    });

  const picked: RoutePoint[] = [];
  for (const candidate of pointCandidates) {
    if (picked.length >= poiBudget) break;
    const testRoute = orderRoutePoints(start, end, [...picked, candidate]);
    const metrics = routeMetrics(testRoute, walkingLevel);
    if (metrics.driveMinutes <= maxDriveMinutes && metrics.totalMinutes <= durationConfig.minutes + paceConfig.durationBuffer + (lowStress ? -15 : 45)) {
      picked.push({
        ...candidate,
        reason: [routeReason(candidate, interests), routeWeatherAdjustment(candidate.weather, candidate).reason]
          .filter(Boolean)
          .join(" "),
      });
    }
  }

  const orderedPoiRoute = orderRoutePoints(start, end, picked);
  const restaurantCandidates = restaurants
    .map(restaurantToRoutePoint)
    .filter((point): point is RoutePoint => Boolean(point))
    .map((point) => ({ ...point, weather: weatherByPoint?.get(point.id) }))
    .filter((point) => distanceToRoute(point, orderedPoiRoute) <= (lowStress ? 12 : 22))
    .sort((a, b) => {
      const aScore = priorityScore(a.priority) + (a.rating ?? 0) * 9 - distanceToRoute(a, orderedPoiRoute) * 2 + routeWeatherAdjustment(a.weather, a).score;
      const bScore = priorityScore(b.priority) + (b.rating ?? 0) * 9 - distanceToRoute(b, orderedPoiRoute) * 2 + routeWeatherAdjustment(b.weather, b).score;
      return bScore - aScore;
    });

  const meals = restaurantCandidates.slice(0, mealConfig.meals).map((restaurant, index) => ({
    ...restaurant,
    stayMinutes: mealConfig.restaurantMinutes,
    reason: [
      mealConfig.meals > 1 && index === 0 ? "Mittagspause nah an der Route." : "Essensstopp nah an der Route.",
      routeWeatherAdjustment(restaurant.weather, restaurant).reason,
    ].filter(Boolean).join(" "),
  }));
  const finalRoute = addAlternatives(orderRoutePoints(start, end, [...picked, ...meals]), pointCandidates, restaurantCandidates);
  const metrics = routeMetrics(finalRoute, walkingLevel);
  const stress =
    metrics.totalMinutes > durationConfig.minutes + 45 || metrics.driveMinutes > maxDriveMinutes
      ? "intensiv"
      : metrics.totalMinutes > durationConfig.minutes - 15
        ? "mittel"
        : "entspannt";

  return {
    id: `smart-${Date.now()}`,
    day,
    title: `Smart Route ${travelDayOptions.find((option) => option.value === day)?.label ?? day}`,
    startTime,
    stops: withArrivalTimes(finalRoute, startTime, walkingLevel),
    ...metrics,
    stress,
    mapsLinks: googleMapsRouteLinks(finalRoute),
    createdAt: new Date().toISOString(),
    weatherCheckedAt,
  } satisfies PlannedRoute;
}

function distanceToRoute(point: RoutePoint, route: RoutePoint[]) {
  return Math.min(...route.map((routePoint) => distanceKm(point, routePoint)));
}

function addAlternatives(route: RoutePoint[], poiCandidates: RoutePoint[], restaurantCandidates: RoutePoint[]) {
  return route.map((point) => {
    if (point.kind === "hotel") return point;
    const pool = point.kind === "restaurant" ? restaurantCandidates : poiCandidates;
    const alternatives = pool
      .filter((candidate) => candidate.id !== point.id)
      .filter((candidate) => candidate.kind === point.kind)
      .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))
      .slice(0, 3)
      .map((candidate) => ({
        ...candidate,
        reason: `Alternative in ${formatKm(distanceKm(point, candidate))} Entfernung zu ${point.title}.`,
      }));
    return { ...point, alternatives };
  });
}

function withArrivalTimes(points: RoutePoint[], startTime: string, walkingLevel: WalkingLevelId) {
  let cursor = minutesFromTime(startTime);
  return points.map((point, index) => {
    if (index > 0) {
      cursor += estimateDriveMinutes(distanceKm(points[index - 1], point));
    }
    const arrivalMinutes = cursor;
    cursor += point.stayMinutes + walkingMinutesForPoint(point, walkingLevel);
    return { ...point, arrivalMinutes };
  });
}

function rebuildPlannedRoute(route: PlannedRoute, stops: RoutePoint[], walkingLevel: WalkingLevelId = "medium") {
  const metrics = routeMetrics(stops, walkingLevel);
  return {
    ...route,
    stops: withArrivalTimes(stops, route.startTime, walkingLevel),
    ...metrics,
    stress: metrics.totalMinutes > 560 ? "intensiv" : metrics.totalMinutes > 390 ? "mittel" : "entspannt",
    mapsLinks: googleMapsRouteLinks(stops),
  } satisfies PlannedRoute;
}

function routeReason(point: RoutePoint, interests: RouteInterestId[]) {
  const labels = interests
    .map((interest) => routeInterestOptions.find((option) => option.value === interest)?.label)
    .filter(Boolean)
    .join(", ");
  if (labels) return `Treffer für ${labels}; ${point.rating ? `Google ${point.rating.toLocaleString("de-DE")}` : point.priority}.`;
  return point.rating ? `Starker Google-Treffer mit ${point.rating.toLocaleString("de-DE")}.` : `Guter ${point.priority}-Stopp.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function daysUntilTrip() {
  const now = new Date();
  const start = new Date(trip.startDate);
  return Math.ceil((start.getTime() - now.getTime()) / 86_400_000);
}

function isKeyboardField(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneWebApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function refreshRootViewport(scrollTop = window.scrollY) {
  const root = document.documentElement;
  const scrollingElement = document.scrollingElement;
  if (!scrollingElement) return;

  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  scrollingElement.scrollTop = scrollTop;
  void root.offsetHeight;

  window.requestAnimationFrame(() => {
    scrollingElement.scrollTop = scrollTop;
    root.style.scrollBehavior = previousScrollBehavior;
  });
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const preventBackgroundScroll = (event: TouchEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-scroll-lock-scrollable]")) return;
      event.preventDefault();
    };

    root.classList.add("modal-scroll-locked");
    document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });

    return () => {
      root.classList.remove("modal-scroll-locked");
      document.removeEventListener("touchmove", preventBackgroundScroll);
      window.requestAnimationFrame(() => refreshRootViewport(scrollY));
    };
  }, [locked]);
}

function fallbackState(): TripState {
  return {
    dashboard: fallbackDashboard as DashboardState,
    categorySummary: fallbackCategorySummary.map((item) => ({ ...item, open: 0 })),
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

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [guideMode, setGuideMode] = useState<GuideMode>("restaurants");
  const [appState, setAppState] = useState<TripState>(() => fallbackState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedSmartRoutes, setSavedSmartRoutes] = useState<PlannedRoute[]>([]);
  const [smartRoutesLoaded, setSmartRoutesLoaded] = useState(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [hotelWeather, setHotelWeather] = useState<WeatherPointSnapshot | null>(null);
  const [weatherCheckedAt, setWeatherCheckedAt] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(title: string, detail?: string, tone: ToastState["tone"] = "success") {
    setToast({ title, detail, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  const maxCategoryTotal = useMemo(
    () => Math.max(1, ...appState.categorySummary.map((category) => category.total)),
    [appState.categorySummary],
  );

  const tourismPlaces = useMemo(
    () => dedupePlaces(appState.places.filter(isTourismPlace)),
    [appState.places],
  );

  const creteRestaurants = useMemo(
    () => appState.restaurants.filter(isCreteRestaurant),
    [appState.restaurants],
  );

  const cleanBackendRoutes = useMemo(
    () => appState.routes.filter(isCleanBackendRoute),
    [appState.routes],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDaysLeft(daysUntilTrip()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // iOS can leave fixed/sticky layers attached to stale keyboard viewport geometry.
  // Installed iOS apps therefore use a fixed-height shell with its own content scroller.
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const ios = isIOSDevice();
    const standalone = ios && isStandaloneWebApp();
    let keyboardSession = false;
    let animationFrame = 0;
    const timers = new Set<number>();
    const updateManualShell = () => {
      if (!root.classList.contains("ios-manual-shell")) return;
      root.style.setProperty("--ios-shell-height", `${window.innerHeight}px`);
    };
    const enableManualShell = () => {
      if (!ios) return;
      if (root.classList.contains("ios-manual-shell")) {
        updateManualShell();
        return;
      }
      const previousScrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
      root.classList.add("ios-manual-shell");
      updateManualShell();
      window.requestAnimationFrame(() => {
        const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region");
        if (scrollRegion) scrollRegion.scrollTop = previousScrollTop;
      });
    };
    const keyboardIsOpen = () => {
      if (!vv) return isKeyboardField(document.activeElement);
      return window.innerHeight - vv.height > 120;
    };
    const clearTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
    const recoverViewport = () => {
      clearTimers();
      [0, 80, 240].forEach((delay) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (!keyboardIsOpen()) {
            refreshRootViewport();
            updateManualShell();
          }
        }, delay);
        timers.add(timer);
      });
    };
    const syncViewport = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const open = keyboardIsOpen();
        root.classList.toggle("kb-open", open);
        if (open) {
          keyboardSession = true;
        } else if (keyboardSession) {
          keyboardSession = false;
          enableManualShell();
          recoverViewport();
        }
        updateManualShell();
      });
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isKeyboardField(event.target as Element | null)) return;
      keyboardSession = true;
      root.classList.add("kb-open");
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        syncViewport();
      }, 180);
      timers.add(timer);
    };
    const onFocusOut = () => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        syncViewport();
      }, 60);
      timers.add(timer);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncViewport();
    };

    if (standalone) enableManualShell();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", updateManualShell);
    vv?.addEventListener("resize", syncViewport);
    updateManualShell();
    return () => {
      clearTimers();
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", updateManualShell);
      vv?.removeEventListener("resize", syncViewport);
      root.classList.remove("ios-manual-shell", "kb-open");
      root.style.removeProperty("--ios-shell-height");
    };
  }, []);

  async function loadHotelWeather(refresh = false) {
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const result = await requestWeather(
        [{ id: hotelPoint.id, lat: hotelPoint.lat, lng: hotelPoint.lng }],
        undefined,
        refresh,
      );
      setHotelWeather(result.points[0] ?? null);
      setWeatherCheckedAt(result.checkedAt);
    } catch (weatherLoadError) {
      setWeatherError(
        weatherLoadError instanceof Error ? weatherLoadError.message : "Wetterdaten konnten nicht geladen werden.",
      );
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHotelWeather(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(smartRouteStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as PlannedRoute[];
          setSavedSmartRoutes(Array.isArray(parsed) ? parsed.slice(0, 12) : []);
        }
      } catch {
        setSavedSmartRoutes([]);
      } finally {
        setSmartRoutesLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!smartRoutesLoaded) return;
    window.localStorage.setItem(smartRouteStorageKey, JSON.stringify(savedSmartRoutes.slice(0, 12)));
  }, [savedSmartRoutes, smartRoutesLoaded]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/trip-state", { cache: "no-store" });
        if (!response.ok) throw new Error("Backend-State konnte nicht geladen werden.");
        const state = (await response.json()) as TripState;
        if (!cancelled) {
          setAppState(state);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Backend nicht erreichbar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const manualScroller = document.documentElement.classList.contains("ios-manual-shell")
      ? scrollRegionRef.current
      : null;

    if (view === "home") {
      if (manualScroller) {
        manualScroller.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const top = Math.max((contentRef.current?.offsetTop ?? 0) - 72, 0);
    if (manualScroller) {
      manualScroller.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [view]);

  async function createExpense(input: NewExpenseInput) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const state = await response.json();
      if (!response.ok) throw new Error(state.error ?? "Ausgabe konnte nicht gespeichert werden.");
      setAppState(state as TripState);
      const settlement = input.splitMode?.toLowerCase() === "ausgleichszahlung";
      showToast(
        settlement ? "Ausgleich eingetragen" : "Gespeichert",
        `${money(input.amount)} · ${input.category} · ${input.paidBy} bezahlt`,
        settlement ? "celebrate" : "success",
      );
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ausgabe konnte nicht gespeichert werden.");
      showToast("Speichern hat nicht geklappt", "Bitte kurz prüfen und nochmal versuchen.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePackItem(id: string, field: "lucaDone" | "janDone", value: boolean) {
    const nextPackItems = appState.packItems.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    const complete = nextPackItems.length > 0 && nextPackItems.every((item) => item.lucaDone && item.janDone);
    setAppState((current) => ({ ...current, packItems: nextPackItems }));
    if (complete) {
      showToast("Packliste komplett", "Luca und Jan haben alles abgehakt. Kreta kann kommen.", "celebrate");
    }
    try {
      const response = await fetch(`/api/pack/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setAppState((current) => ({
        ...current,
        packItems: current.packItems.map((item) => (item.id === id ? { ...item, [field]: !value } : item)),
      }));
      showToast("Packliste nicht gespeichert", "Die Änderung wurde zurückgenommen.", "error");
    }
  }

  async function deleteExpense(id: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const state = await response.json();
      if (!response.ok) throw new Error(state.error ?? "Ausgabe konnte nicht gelöscht werden.");
      setAppState(state as TripState);
      showToast("Ausgabe gelöscht", "Die Kosten wurden neu berechnet.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Ausgabe konnte nicht gelöscht werden.");
      showToast("Löschen fehlgeschlagen", "Die Ausgabe ist noch vorhanden.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveSmartRoute(route: PlannedRoute) {
    setSavedSmartRoutes((current) => [route, ...current.filter((item) => item.id !== route.id)].slice(0, 12));
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: route.id,
          day: route.day,
          title: route.title,
          stops: route.stops.map((stop) => stop.title),
          maps: route.mapsLinks[0] ?? "#",
          cost: `${formatKm(route.totalKm)} · ${formatDuration(route.totalMinutes)}`,
          status: "Smart",
          note: `${route.stress} · ${formatDuration(route.driveMinutes)} Fahrt · ${route.stops.length} Stopps`,
        }),
      });
      const state = await response.json();
      if (!response.ok) throw new Error(state.error ?? "Route konnte nicht gespeichert werden.");
      setAppState(state as TripState);
      showToast("Route gespeichert", `${route.stops.length} Stopps · ${formatKm(route.totalKm)}`, "celebrate");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Route konnte nicht gespeichert werden.");
      showToast("Backend-Speicherung fehlgeschlagen", "Die Route bleibt lokal auf diesem Gerät erhalten.", "error");
    } finally {
      setSaving(false);
    }
  }

  const modalOpen = quickExpenseOpen || Boolean(expenseToDelete);

  return (
    <main className="app-shell text-[#17201c]">
      <header className="ios-glass-header sticky top-0 z-40">
        <div className="ios-header-inner mx-auto flex max-w-6xl items-center justify-between gap-3 px-4">
          <button
            className="min-w-0 text-left"
            onClick={() => setView("home")}
            type="button"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#357179] sm:text-[11px]">
              {trip.dates}
            </p>
            <h1 className="truncate text-[19px] font-black leading-none text-[#0e302e] sm:text-xl">
              {trip.title} · {trip.people}
            </h1>
          </button>
          <SyncPill error={Boolean(error)} loading={loading} sourceKind={appState.source.kind} />
          <nav className="hidden items-center gap-1 rounded-[8px] border border-[#d7e3dc] bg-white/82 p-1 shadow-sm md:flex">
            {views.map((item) => (
              <TabButton
                active={view === item.id}
                key={item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </TabButton>
            ))}
          </nav>
        </div>
      </header>

      <div className="app-scroll-region" ref={scrollRegionRef}>
        {view === "home" && (
          <Hero
            daysLeft={daysLeft}
            onQuickExpense={() => setQuickExpenseOpen(true)}
            setView={setView}
            weather={hotelWeather}
          />
        )}

        <div ref={contentRef} className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <div key={view} className="view-enter">
          {view === "home" && (
            <HomeView
              dashboard={appState.dashboard}
              expenses={appState.expenses}
              flights={appState.flights}
              hotelWeather={hotelWeather}
              onQuickExpense={() => setQuickExpenseOpen(true)}
              onRefreshWeather={() => void loadHotelWeather(true)}
              placesCount={tourismPlaces.length}
              restaurantsCount={creteRestaurants.length}
              routes={cleanBackendRoutes}
              savedSmartRoutes={savedSmartRoutes}
              setGuideMode={setGuideMode}
              setView={setView}
              trains={appState.trains}
              weatherCheckedAt={weatherCheckedAt}
              weatherError={weatherError}
              weatherLoading={weatherLoading}
            />
          )}
          {view === "kosten" && (
            <CostsView
              categorySummary={appState.categorySummary}
              dashboard={appState.dashboard}
              expenses={appState.expenses}
              fixedCosts={appState.fixedCosts}
              maxCategoryTotal={maxCategoryTotal}
              onCreateExpense={createExpense}
              onRequestDeleteExpense={setExpenseToDelete}
              saving={saving}
            />
          )}
          {view === "reise" && <TravelView flights={appState.flights} trains={appState.trains} />}
          {view === "routen" && (
            <RoutesView
              onSaveSmartRoute={saveSmartRoute}
              places={tourismPlaces}
              restaurants={creteRestaurants}
              routes={cleanBackendRoutes}
              savedSmartRoutes={savedSmartRoutes}
            />
          )}
          {view === "karte" && (
            <MapView
              places={tourismPlaces}
              restaurants={creteRestaurants}
              savedSmartRoutes={savedSmartRoutes}
            />
          )}
          {view === "guide" && (
            <GuideView
              guideMode={guideMode}
              places={tourismPlaces}
              restaurants={creteRestaurants}
              setGuideMode={setGuideMode}
            />
          )}
          {view === "packen" && (
            <PackView onTogglePack={togglePackItem} packItems={appState.packItems} />
          )}
          </div>

          <footer className="mt-8 border-t border-[#d7e3dc] pt-5 text-sm text-[#5b6f68]">
            <p>
              {appState.source.kind === "supabase"
                ? "Daten kommen live aus eurem Reise-Backend."
                : "Gerade offline, ihr seht den letzten gespeicherten Stand."}{" "}
              Stand der Planungsdaten: {appState.source.sheetSeed}.
            </p>
            <p className="mt-2">Bild: Balos Beach, Wikimedia Commons, CC BY-SA 4.0.</p>
          </footer>
        </div>
      </div>

      {!modalOpen && (
        <nav aria-label="Hauptnavigation" className="mobile-glass-nav md:hidden">
          <div className="mobile-nav-grid">
            {views.map((item) => (
              <button
                aria-current={view === item.id ? "page" : undefined}
                className={classNames(
                  "flex min-w-0 overflow-hidden flex-col items-center justify-center gap-0.5 rounded-[18px] px-0.5 text-[10.5px] font-black leading-none transition active:scale-[0.96]",
                  view === item.id
                    ? "bg-[#0e777c] text-white shadow-[0_10px_24px_rgba(14,119,124,0.26)]"
                    : "text-[#43665e] hover:bg-white/54",
                )}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <NavIcon view={item.id} />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {toast && !modalOpen && (
        <div
          className={classNames(
            "toast-pop ios-toast fixed left-3 right-3 z-[90] mx-auto flex max-w-md items-start gap-3 rounded-[24px] border px-4 py-3 text-left shadow-[0_18px_46px_rgba(14,48,46,0.18)] md:left-1/2 md:right-auto md:w-[min(420px,calc(100%-32px))] md:-translate-x-1/2",
            toast.tone === "error"
              ? "border-[#f1c7bb] bg-[#fff3ee]/86 text-[#8c3219]"
              : toast.tone === "celebrate"
                ? "celebration-toast border-[#ffe1a8] bg-[#fff9e8]/92 text-[#0e302e]"
                : "border-white/70 bg-[#f8fffb]/84 text-[#0e302e]",
          )}
          role="status"
        >
          <span
            aria-hidden="true"
            className={classNames(
              "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-black",
              toast.tone === "error"
                ? "bg-[#ffd5c8] text-[#8c3219]"
                : toast.tone === "celebrate"
                  ? "bg-[#ffe1a8] text-[#7a4b00]"
                  : "bg-[#dff6ed] text-[#125f68]",
            )}
          >
            {toast.tone === "error" ? "!" : toast.tone === "celebrate" ? "✦" : "✓"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black leading-tight">{toast.title}</span>
            {toast.detail && <span className="mt-0.5 block truncate text-xs font-bold opacity-72">{toast.detail}</span>}
          </span>
          <button
            aria-label="Meldung schließen"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/58 text-lg font-black text-current transition active:scale-95"
            onClick={() => setToast(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      <QuickExpenseLauncher
        hidden={modalOpen || Boolean(toast) || view === "kosten"}
        onClick={() => setQuickExpenseOpen(true)}
        saving={saving}
      />
      <DeleteExpenseDialog
        expense={expenseToDelete}
        onCancel={() => setExpenseToDelete(null)}
        onConfirm={async () => {
          if (!expenseToDelete) return;
          await deleteExpense(expenseToDelete.id);
          setExpenseToDelete(null);
        }}
        saving={saving}
      />
      {quickExpenseOpen && (
        <QuickExpenseSheet
          onClose={() => setQuickExpenseOpen(false)}
          onCreateExpense={createExpense}
          open
          saving={saving}
        />
      )}
    </main>
  );
}

function Hero({
  daysLeft,
  onQuickExpense,
  setView,
  weather,
}: {
  daysLeft: number | null;
  onQuickExpense: () => void;
  setView: (view: View) => void;
  weather: WeatherPointSnapshot | null;
}) {
  const countdown =
    daysLeft === null
      ? "bald"
      : daysLeft > 1
      ? `Noch ${daysLeft} Tage`
      : daysLeft === 1
        ? "Morgen geht's los"
        : daysLeft === 0
          ? "Heute geht's los"
          : "Ihr seid unterwegs";
  const weatherCode = weather?.current?.weatherCode ?? weather?.day?.weatherCode;
  const isDay = weather?.current?.isDay ?? true;
  const windy = Math.max(weather?.current?.windSpeed ?? 0, weather?.current?.windGust ?? 0) >= 32;
  const mood =
    weatherCode != null && weatherCode >= 51
      ? "rain"
      : windy
        ? "wind"
        : isDay
          ? "sun"
          : "night";

  return (
    <section className={classNames("hero-mood relative overflow-hidden border-b border-[#c9d9d1]", `hero-mood-${mood}`)}>
      <div className="absolute inset-0">
        <Image
          alt="Balos Beach auf Kreta"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={heroImage}
        />
        <div className="hero-mood-overlay absolute inset-0" />
        <span aria-hidden="true" className="hero-orb hero-orb-one" />
        <span aria-hidden="true" className="hero-orb hero-orb-two" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-7 text-white sm:py-9">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b8f4eb] sm:text-sm">
            {trip.hotel} · Frangokastello
          </p>
          <h2 className="mt-2 text-3xl font-black leading-[1.02] sm:text-5xl">
            Kreta läuft.
            <span className="block text-[#ffe1a8]">Jan &amp; Luca ready.</span>
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex h-10 items-center rounded-full border border-white/35 bg-white/12 px-4 text-sm font-black backdrop-blur">
              {countdown}
            </span>
            {weather?.current && (
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-white/35 bg-white/12 px-4 text-sm font-black backdrop-blur">
                {weatherCodeEmoji(weatherCode, isDay)}
                {weather.current.temperature != null ? `${Math.round(weather.current.temperature)} °C` : weatherCodeLabel(weatherCode)}
              </span>
            )}
            <button
              className="inline-flex h-10 items-center rounded-full bg-[#ffe1a8] px-4 text-sm font-black text-[#0e302e] shadow-sm transition hover:bg-[#ffd585]"
              onClick={onQuickExpense}
              type="button"
            >
              + Ausgabe
            </button>
            <a
              className="inline-flex h-10 items-center rounded-full border border-white/35 bg-white/10 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
              href={trip.hotelMaps}
              rel="noreferrer"
              target="_blank"
            >
              Hotel in Maps
            </a>
          </div>
        </div>
        <button
          className="relative hidden h-36 w-28 overflow-hidden rounded-[14px] border border-white/25 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:block"
          onClick={() => setView("guide")}
          type="button"
        >
          <Image alt="Jan und Luca auf Kreta" className="object-cover" fill sizes="112px" src={janLucaImage} />
        </button>
      </div>
    </section>
  );
}

function HomeView({
  dashboard,
  expenses,
  flights,
  hotelWeather,
  onQuickExpense,
  onRefreshWeather,
  placesCount,
  restaurantsCount,
  routes,
  savedSmartRoutes,
  setGuideMode,
  setView,
  trains,
  weatherCheckedAt,
  weatherError,
  weatherLoading,
}: {
  dashboard: DashboardState;
  expenses: ExpenseItem[];
  flights: Flight[];
  hotelWeather: WeatherPointSnapshot | null;
  onQuickExpense: () => void;
  onRefreshWeather: () => void;
  placesCount: number;
  restaurantsCount: number;
  routes: RoutePlan[];
  savedSmartRoutes: PlannedRoute[];
  setGuideMode: (mode: GuideMode) => void;
  setView: (view: View) => void;
  trains: TrainLeg[];
  weatherCheckedAt: string;
  weatherError: string;
  weatherLoading: boolean;
}) {
  const outboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("hin")) ?? flights[0];
  const latestExpense = expenses[0];
  const todayLabel = todayTravelDayLabel();

  const todaySmart = todayLabel
    ? savedSmartRoutes.find((route) => route.day.includes(todayLabel))
    : undefined;
  const todayBackend = todayLabel
    ? routes.find((route) => normalizedText(route.day).includes(todayLabel))
    : undefined;
  const nextSmart = savedSmartRoutes[0];
  const planTitle = todaySmart?.title ?? todayBackend?.title ?? nextSmart?.title ?? null;
  const planMaps = todaySmart?.mapsLinks[0] ?? todayBackend?.maps ?? nextSmart?.mapsLinks[0] ?? null;
  const planStops = todaySmart?.stops.map((stop) => stop.title) ?? todayBackend?.stops ?? nextSmart?.stops.map((stop) => stop.title) ?? [];
  const planIsToday = Boolean(todaySmart || todayBackend);
  const nextMoment = nextTravelMoment(flights, trains);
  const progress = tripProgress();

  const settlementShort =
    dashboard.direction === "ausgeglichen"
      ? "Ausgeglichen"
      : dashboard.direction === "luca_an_jan"
        ? `Luca → Jan ${money(dashboard.settlementAmount)}`
        : `Jan → Luca ${money(dashboard.settlementAmount)}`;

  const quickCards: Array<{ emoji: string; label: string; sub: string; action: () => void }> = [
    { emoji: "➕", label: "Ausgabe eintragen", sub: "Schnell erfassen", action: onQuickExpense },
    {
      emoji: "🗓️",
      label: "Heutiger Plan",
      sub: planTitle ? planTitle : "Im Smart Planer bauen",
      action: () => setView("routen"),
    },
    {
      emoji: "🧭",
      label: "Tagesroute öffnen",
      sub: planMaps ? "Navigation in Maps" : "Noch keine Route",
      action: () => {
        if (planMaps && planMaps !== "#") window.open(planMaps, "_blank", "noreferrer");
        else setView("routen");
      },
    },
    { emoji: "🎒", label: "Packliste", sub: "Abhaken für beide", action: () => setView("packen") },
    {
      emoji: "🍽️",
      label: "Restaurants",
      sub: `${restaurantsCount} Kreta-Tipps`,
      action: () => {
        setGuideMode("restaurants");
        setView("guide");
      },
    },
    {
      emoji: "📸",
      label: "Sehenswürdigkeiten",
      sub: `${placesCount} echte Orte`,
      action: () => {
        setGuideMode("sights");
        setView("guide");
      },
    },
    { emoji: "🗺️", label: "Karte", sub: "Hotel, POIs, Routen", action: () => setView("karte") },
    { emoji: "🤖", label: "Smart Route", sub: "Tagesplan generieren", action: () => setView("routen") },
    {
      emoji: "✈️",
      label: "Reise",
      sub: outboundFlight ? `${outboundFlight.number} · ${outboundFlight.dep}` : "Flug & Bahn",
      action: () => setView("reise"),
    },
    { emoji: "💶", label: "Kosten & Ausgleich", sub: settlementShort, action: () => setView("kosten") },
  ];

  return (
    <div className="grid gap-5">
      <button
        className="ios-glass-card flex w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-[24px] px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-[#8fb0a4]"
        onClick={() => setView("kosten")}
        type="button"
      >
        <span className="grid">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">Gesamt</span>
          <span className="text-[15px] font-black tabular-nums text-[#0e302e]">{money(dashboard.totalBudget)}</span>
        </span>
        <span className="grid">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">Vor Ort</span>
          <span className="text-[15px] font-black tabular-nums text-[#0e302e]">{money(dashboard.onTrip.amount)}</span>
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">Ausgleich aktuell</span>
          <span className="truncate text-[15px] font-black tabular-nums text-[#125f68]">{settlementShort}</span>
        </span>
        <span className="text-xl font-black text-[#9bb0a7]">›</span>
      </button>

      <WeatherCockpit
        checkedAt={weatherCheckedAt}
        error={weatherError}
        loading={weatherLoading}
        onRefresh={onRefreshWeather}
        weather={hotelWeather}
      />

      <section className="ios-glass-card overflow-hidden rounded-[24px] p-4">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle kicker="Reisefortschritt" title={progress > 0 ? `${progress} % Kreta-Modus` : "Die Reise rückt näher"} />
          <span className="rounded-full bg-[#e7f4ee] px-3 py-1.5 text-xs font-black text-[#125f68]">
            {trip.dates}
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#dfe9e3]">
          <div className="travel-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Nächster Reisebaustein</p>
            {nextMoment ? (
              <>
                <p className="mt-1 text-lg font-black text-[#0e302e]">
                  {nextMoment.kind === "flight" ? "✈️" : "🚆"} {nextMoment.title}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#5b6f68]">{nextMoment.detail}</p>
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold text-[#5b6f68]">Alle hinterlegten Reiseetappen sind abgeschlossen.</p>
            )}
          </div>
          <button
            className="min-h-11 rounded-[14px] bg-[#125f68] px-4 py-2.5 text-sm font-black text-white transition active:scale-[0.98] hover:bg-[#0e4d54]"
            onClick={() => setView("reise")}
            type="button"
          >
            Reise öffnen
          </button>
        </div>
      </section>

      <section>
        <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">Schnellzugriff</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickCards.map((card) => (
            <button
              className="ios-glass-card flex min-h-[104px] flex-col items-start gap-1 rounded-[22px] p-3.5 text-left transition active:scale-[0.97] sm:hover:-translate-y-0.5 sm:hover:border-[#8fb0a4] sm:hover:shadow-md"
              key={card.label}
              onClick={card.action}
              type="button"
            >
              <span aria-hidden="true" className="text-[22px] leading-none">{card.emoji}</span>
              <span className="mt-1 text-[14px] font-black leading-tight text-[#0e302e]">{card.label}</span>
              <span className="line-clamp-1 text-xs font-semibold text-[#5b6f68]">{card.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {planTitle && (
        <section className="ios-glass-card rounded-[24px] border-[#125f68]/22 p-4">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle kicker={planIsToday ? "Heutiger Plan" : "Nächster Plan"} title={planTitle} />
            {planMaps && planMaps !== "#" && (
              <a
                className="shrink-0 rounded-[10px] bg-[#125f68] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0e4d54]"
                href={planMaps}
                rel="noreferrer"
                target="_blank"
              >
                🧭 Starten
              </a>
            )}
          </div>
          {planStops.length > 0 && (
            <p className="mt-3 text-sm font-semibold leading-6 text-[#44635b]">
              {planStops.slice(0, 6).join(" → ")}
              {planStops.length > 6 ? " → …" : ""}
            </p>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="ios-glass-dark rounded-[24px] p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9de7dc]">Vor Ort ausgegeben</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{money(dashboard.onTrip.amount)}</p>
          <p className="mt-1 text-sm font-semibold text-white/72">
            {latestExpense ? `Zuletzt: ${latestExpense.category} · ${money(latestExpense.amount)}` : "Noch keine Vor-Ort-Ausgabe."}
          </p>
          <button
            className="mt-3 h-11 w-full rounded-[10px] bg-[#ffe1a8] px-4 text-sm font-black text-[#0e302e] transition hover:bg-[#ffd585]"
            onClick={onQuickExpense}
            type="button"
          >
            + Ausgabe hinzufügen
          </button>
        </div>
        <div className="ios-glass-card overflow-hidden rounded-[24px]">
          <div className="relative h-40 w-full">
            <Image
              alt="Jan und Luca auf Kreta"
              className="object-cover object-[50%_30%]"
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              src={janLucaImage}
            />
          </div>
          <div className="p-3.5">
            <p className="text-sm font-black text-[#0e302e]">Jan &amp; Luca · {trip.dates}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#5b6f68]">
              Schnelle Kosten, gute Stopps und genug Luft für spontane Strandentscheidungen.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CostsView({
  categorySummary,
  dashboard,
  expenses,
  fixedCosts,
  maxCategoryTotal,
  onCreateExpense,
  onRequestDeleteExpense,
  saving,
}: {
  categorySummary: CategorySummaryItem[];
  dashboard: DashboardState;
  expenses: ExpenseItem[];
  fixedCosts: FixedCost[];
  maxCategoryTotal: number;
  onCreateExpense: (input: NewExpenseInput) => Promise<boolean>;
  onRequestDeleteExpense: (expense: ExpenseItem) => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-5 overflow-x-clip">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <BalancePanel dashboard={dashboard} expenses={expenses} fixedCosts={fixedCosts} />
        <div className="ios-glass-card rounded-[24px] p-4">
          <SectionTitle kicker="Abrechnung" title="Live-Summen" />
          <div className="mt-4 grid gap-3">
            {categorySummary.map((item) => (
              <CategoryBar category={item} key={item.name} max={maxCategoryTotal} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <ExpenseForm onCreateExpense={onCreateExpense} saving={saving} title="Ausgabe eintragen" />

        <section className="ios-glass-card rounded-[24px] p-4">
          <SectionTitle kicker="Vor Ort" title="Aktuelle Einträge" />
          <div className="mt-4 grid gap-3">
            {expenses.length === 0 && (
              <p className="rounded-[8px] bg-[#eff6f2] p-4 text-sm font-semibold text-[#44635b]">
                Noch keine laufenden Ausgaben gespeichert.
              </p>
            )}
            {expenses.map((expense) => (
              <ExpenseRow
                expense={expense}
                key={expense.id}
                onDelete={() => onRequestDeleteExpense(expense)}
                saving={saving}
              />
            ))}
          </div>
        </section>
      </section>

      <SettlementPaymentForm dashboard={dashboard} onCreateExpense={onCreateExpense} saving={saving} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fixedCosts.map((cost) => (
          <FixedCostCard cost={cost} key={`${cost.area}-${cost.kind}`} />
        ))}
      </section>
    </div>
  );
}

function WeatherCockpit({
  checkedAt,
  error,
  loading,
  onRefresh,
  weather,
}: {
  checkedAt: string;
  error: string;
  loading: boolean;
  onRefresh: () => void;
  weather: WeatherPointSnapshot | null;
}) {
  const current = weather?.current;
  const day = weather?.day;
  const code = current?.weatherCode ?? day?.weatherCode;
  const checkedLabel = checkedAt
    ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(checkedAt))
    : "";

  return (
    <section className="weather-cockpit ios-glass-dark overflow-hidden rounded-[24px] p-4 text-white">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9de7dc]">Heute in Frangokastello</p>
            <h2 className="mt-1 text-2xl font-black">
              {loading && !weather
                ? "Wetter wird geladen…"
                : `${weatherCodeEmoji(code, current?.isDay ?? true)} ${weatherCodeLabel(code)}`}
            </h2>
          </div>
          <button
            className="min-h-10 rounded-[12px] border border-white/22 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/18 disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
            onClick={onRefresh}
            type="button"
          >
            {loading ? "Aktualisiert…" : "↻ Aktualisieren"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-[14px] bg-[#ffdfd4]/14 px-3 py-3 text-sm font-bold text-[#ffd4c7]" role="alert">
            {error}
          </p>
        ) : weather ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <WeatherFact
                label="Temperatur"
                value={current?.temperature != null ? `${Math.round(current.temperature)} °C` : "–"}
              />
              <WeatherFact
                label="Regen"
                value={day?.precipitationProbabilityMax != null ? `${Math.round(day.precipitationProbabilityMax)} %` : "–"}
              />
              <WeatherFact label="UV max." value={day?.uvIndexMax != null ? day.uvIndexMax.toFixed(1) : "–"} />
              <WeatherFact
                label="Wind"
                value={day?.windGustMax != null ? `${Math.round(day.windGustMax)} km/h` : "–"}
              />
              <WeatherFact
                label="Wellen"
                value={weather.marine?.waveHeightMax != null ? `${weather.marine.waveHeightMax.toFixed(1)} m` : "–"}
              />
              <WeatherFact label="Sonne auf" value={timeFromIso(day?.sunrise)} />
              <WeatherFact label="Sonne unter" value={timeFromIso(day?.sunset)} />
              <WeatherFact
                label="Gefühlt"
                value={current?.apparentTemperature != null ? `${Math.round(current.apparentTemperature)} °C` : "–"}
              />
            </div>
            {weather.advisories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {weather.advisories.map((advisory) => (
                  <span
                    className={classNames(
                      "rounded-full px-3 py-1.5 text-xs font-black",
                      advisory.level === "avoid"
                        ? "bg-[#ffd5c8] text-[#74270f]"
                        : "bg-[#fff0c9] text-[#684600]",
                    )}
                    key={advisory.kind}
                    title={advisory.detail}
                  >
                    {advisory.title}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs font-semibold leading-5 text-white/62">
              {checkedLabel ? `Stand ${checkedLabel} Uhr · ` : ""}
              Open‑Meteo Modellprognose, keine amtliche Warnung oder Küstennavigation.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function WeatherFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/12 bg-white/8 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/58">{label}</p>
      <p className="mt-1 text-base font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function SettlementPaymentForm({
  dashboard,
  onCreateExpense,
  saving,
}: {
  dashboard: DashboardState;
  onCreateExpense: (input: NewExpenseInput) => Promise<boolean>;
  saving: boolean;
}) {
  const defaultPayer = dashboard.direction === "jan_an_luca" ? "Jan" : "Luca";
  const [payer, setPayer] = useState<"Luca" | "Jan">(defaultPayer);
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState("");
  const parsedAmount = parseAmountFlexible(amount);
  const recipient = payer === "Luca" ? "Jan" : "Luca";
  const suggestedAmount = dashboard.settlementAmount > 0 ? dashboard.settlementAmount : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsedAmount === null) {
      setFormError("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    setFormError("");
    const ok = await onCreateExpense({
      travelDay: `Ausgleich · ${new Intl.DateTimeFormat("de-DE").format(new Date())}`,
      category: "Ausgleichszahlung",
      amount: parsedAmount,
      paidBy: payer,
      splitMode: "Ausgleichszahlung",
      splitLuca: 0,
      splitJan: 0,
      note: `Direkte Zahlung: ${payer} an ${recipient}`,
    });
    if (!ok) return;
    setAmount("");
  }

  return (
    <form className="ios-glass-card rounded-[24px] p-4" onSubmit={submit}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle kicker="Direkt ausgleichen" title="Ausgleichzahlung eintragen" />
        {suggestedAmount !== null && (
          <button
            className="h-10 rounded-full border border-[#cbdad2] bg-white/74 px-3 text-xs font-black text-[#125f68] transition active:scale-95"
            onClick={() => setAmount(String(suggestedAmount).replace(".", ","))}
            type="button"
          >
            offen: {money(suggestedAmount)}
          </button>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#5b6f68]">
        Tragt hier eine echte Zahlung zwischen euch ein. Sie reduziert den Ausgleich, ohne den Reise-Gesamtbetrag zu erhöhen.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Betrag</span>
          <span className="relative">
            <input
              className="h-12 w-full rounded-[16px] border border-[#cbdad2] bg-white/86 px-3 pr-10 text-lg font-black tabular-nums text-[#0e302e] outline-none transition focus:border-[#125f68]"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="frei wählbar"
              value={amount}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base font-black text-[#789087]">€</span>
          </span>
        </label>
        <div className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Richtung</span>
          <div className="grid h-12 grid-cols-2 gap-1 rounded-[16px] bg-[#e9efe9] p-1">
            {(["Luca", "Jan"] as const).map((person) => {
              const to = person === "Luca" ? "Jan" : "Luca";
              return (
                <button
                  aria-pressed={payer === person}
                  className={classNames(
                    "rounded-[13px] px-2 text-xs font-black transition",
                    payer === person ? "bg-white text-[#0e302e] shadow-sm" : "text-[#5b6f68]",
                  )}
                  key={person}
                  onClick={() => setPayer(person)}
                  type="button"
                >
                  {person} → {to}
                </button>
              );
            })}
          </div>
        </div>
        <button
          className="h-12 self-end rounded-[16px] bg-[#125f68] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(18,95,104,0.18)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? "Speichert..." : "Zahlung speichern"}
        </button>
      </div>
      {formError && (
        <p className="mt-3 text-sm font-black text-[#8c3219]" role="alert">
          {formError}
        </p>
      )}
    </form>
  );
}

function ExpenseForm({
  compact = false,
  onSaved,
  onCreateExpense,
  saving,
  title,
}: {
  compact?: boolean;
  onSaved?: () => void;
  onCreateExpense: (input: NewExpenseInput) => Promise<boolean>;
  saving: boolean;
  title: string;
}) {
  const [travelDay, setTravelDay] = useState(todayTravelDayLabel() ?? lists.travelDays[0] ?? "Mi, 01.07.");
  const [category, setCategory] = useState("Restaurants & Cafés");
  const [paidBy, setPaidBy] = useState<"Luca" | "Jan">("Luca");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [splitPreset, setSplitPreset] = useState<SplitPreset>("50_50");
  const [customLuca, setCustomLuca] = useState(50);
  const amountRef = useRef<HTMLInputElement>(null);
  const selectedSplit = expenseSplitOptions.find((option) => option.value === splitPreset) ?? expenseSplitOptions[0];
  const splitLuca = splitPreset === "custom" ? Math.max(0, Math.min(100, customLuca)) / 100 : selectedSplit.luca;
  const splitJan = splitPreset === "custom" ? 1 - splitLuca : selectedSplit.jan;
  const parsedAmount = parseAmountFlexible(amount);

  useEffect(() => {
    if (!compact) return;
    const timer = window.setTimeout(() => {
      amountRef.current?.focus({ preventScroll: true });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [compact]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsedAmount === null) {
      setFormError("Bitte einen gültigen Betrag eingeben, z. B. 18,40.");
      amountRef.current?.focus();
      return;
    }
    setFormError("");
    const ok = await onCreateExpense({
      travelDay,
      category,
      amount: parsedAmount,
      paidBy,
      splitMode: splitPreset === "custom" ? `${Math.round(splitLuca * 100)}/${Math.round(splitJan * 100)}` : selectedSplit.label,
      splitLuca,
      splitJan,
      note,
    });
    if (!ok) return;
    setAmount("");
    setNote("");
    setSplitPreset("50_50");
    setCustomLuca(50);
    onSaved?.();
  }

  return (
    <form
      className={classNames(
        "rounded-[24px] bg-white/86 p-4",
        compact ? "p-1 shadow-none" : "ios-glass-card",
      )}
      onSubmit={submit}
    >
      {!compact && <SectionTitle kicker="Vor Ort" title={title} />}

      <label className={classNames("grid gap-1.5", !compact && "mt-4")}>
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Betrag</span>
        <span className="relative">
          <input
            className="h-16 w-full rounded-[14px] border-2 border-[#cbdad2] bg-white px-4 pr-12 text-[28px] font-black tabular-nums text-[#0e302e] outline-none transition focus:border-[#125f68]"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            ref={amountRef}
            value={amount}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl font-black text-[#789087]">€</span>
        </span>
      </label>

      <div className="mt-4 grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Reisetag</span>
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {lists.travelDays.map((day, index) => (
            <button
              aria-pressed={travelDay === day}
              className={classNames(
                "flex h-[52px] shrink-0 flex-col items-center justify-center rounded-[12px] border px-3.5 transition",
                travelDay === day
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e]",
              )}
              key={day}
              onClick={() => setTravelDay(day)}
              type="button"
            >
              <span className="text-[13px] font-black leading-tight">Tag {index + 1}</span>
              <span className={classNames("text-[11px] font-bold", travelDay === day ? "text-white/80" : "text-[#789087]")}>{day}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Kategorie</span>
        <div className="flex flex-wrap gap-2">
          {lists.categories.map((item) => (
            <button
              aria-pressed={category === item}
              className={classNames(
                "min-h-10 rounded-full border px-3.5 py-2 text-sm font-bold transition",
                category === item
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e]",
              )}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              <span aria-hidden="true">{categoryEmoji(item)}</span> {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Bezahlt von</span>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-[#e9efe9] p-1">
          {(["Luca", "Jan"] as const).map((person) => (
            <button
              aria-pressed={paidBy === person}
              className={classNames(
                "h-11 rounded-[10px] text-sm font-black transition",
                paidBy === person ? "bg-white text-[#0e302e] shadow-sm" : "text-[#5b6f68]",
              )}
              key={person}
              onClick={() => setPaidBy(person)}
              type="button"
            >
              {person}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Aufteilung</span>
        <div className="flex flex-wrap gap-2">
          {expenseSplitOptions.map((option) => (
            <button
              aria-pressed={splitPreset === option.value}
              className={classNames(
                "min-h-10 rounded-full border px-3.5 py-2 text-sm font-bold transition",
                splitPreset === option.value
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e]",
              )}
              key={option.value}
              onClick={() => setSplitPreset(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {splitPreset === "custom" && (
          <div className="grid gap-2 rounded-[12px] bg-[#eff6f2] p-3">
            <label className="grid gap-2 text-sm font-bold text-[#34554e]">
              Luca: {Math.round(splitLuca * 100)} % · Jan: {Math.round(splitJan * 100)} %
              <input
                max={100}
                min={0}
                onChange={(event) => setCustomLuca(Number(event.target.value))}
                type="range"
                value={customLuca}
              />
            </label>
          </div>
        )}
      </div>

      <label className="mt-3 grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">
          Notiz <span className="font-bold normal-case tracking-normal">(optional)</span>
        </span>
        <input
          className="h-11 rounded-[12px] border border-[#cbdad2] bg-white px-3 text-[#0e302e] outline-none transition focus:border-[#125f68]"
          onChange={(event) => setNote(event.target.value)}
          placeholder="z. B. Taverne in Loutro"
          value={note}
        />
      </label>

      {formError && (
        <p className="mt-3 text-sm font-black text-[#8c3219]" role="alert">
          {formError}
        </p>
      )}

      <button
        className="mt-4 h-[52px] w-full rounded-[14px] bg-[#125f68] px-4 text-base font-black text-white transition hover:bg-[#0e4d54] disabled:cursor-wait disabled:opacity-60"
        disabled={saving}
        type="submit"
      >
        {saving ? "Wird gespeichert…" : parsedAmount !== null ? `${money(parsedAmount)} speichern` : "Speichern"}
      </button>
    </form>
  );
}

function QuickExpenseLauncher({ hidden = false, onClick, saving }: { hidden?: boolean; onClick: () => void; saving: boolean }) {
  if (hidden) return null;

  return (
    <button
      className="quick-fab fixed z-[60] grid h-14 w-14 place-items-center rounded-full border border-white/25 bg-[#0e302e]/94 text-white shadow-[0_18px_44px_rgba(14,48,46,0.34)] transition hover:bg-[#125f68] active:scale-95 md:flex md:w-auto md:gap-2 md:pl-3 md:pr-5"
      disabled={saving}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffe1a8] text-[28px] leading-none text-[#0e302e] md:h-9 md:w-9 md:text-xl">+</span>
      <span className="hidden text-[15px] font-black md:inline">Ausgabe</span>
    </button>
  );
}

function DeleteExpenseDialog({
  expense,
  onCancel,
  onConfirm,
  saving,
}: {
  expense: ExpenseItem | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  saving: boolean;
}) {
  const open = Boolean(expense);
  useBodyScrollLock(open);

  if (!expense) return null;
  const settlement = Boolean(expense.isSettlement);

  return (
    <div
      className="ios-viewport-overlay fixed inset-0 z-[100] flex items-end justify-center bg-[#061f20]/52 p-3 backdrop-blur-sm sm:items-center"
      onClick={saving ? undefined : onCancel}
      role="presentation"
    >
      <section
        aria-label="Ausgabe löschen bestätigen"
        aria-modal="true"
        className="ios-alert-panel quick-sheet max-h-[calc(100dvh-28px)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/64 bg-[#fbfdf9]/90 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[30px]"
        data-scroll-lock-scrollable
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#c9d8d0] sm:hidden" />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8c3219]">Bist du sicher?</p>
        <h2 className="mt-1 text-2xl font-black text-[#0e302e]">
          {settlement ? "Ausgleichzahlung löschen" : "Ausgabe löschen"}
        </h2>
        <div className="mt-4 rounded-[20px] border border-white/72 bg-white/72 p-4 shadow-sm">
          <p className="text-sm font-bold text-[#357179]">{expense.travelDay}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-lg font-black leading-tight text-[#0e302e]">{expense.category}</p>
            <p className="shrink-0 text-lg font-black tabular-nums text-[#0e302e]">{money(expense.amount)}</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#5b6f68]">Bezahlt von {expense.paidBy}</p>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-[#5b6f68]">
          {settlement
            ? "Die Direktzahlung und ihre Gegenbuchung werden entfernt. Der offene Ausgleich wird danach sofort neu berechnet."
            : "Die Ausgabe wird aus den Vor-Ort-Kosten entfernt und der Ausgleich wird danach sofort neu berechnet."}
        </p>
        <div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-2 bg-[#fbfdf9]/90 pt-3 backdrop-blur">
          <button
            className="h-12 rounded-[16px] border border-[#cbdad2] bg-white/80 px-4 text-sm font-black text-[#34554e] transition active:scale-[0.98]"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            Abbrechen
          </button>
          <button
            className="h-12 rounded-[16px] bg-[#8c3219] px-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(140,50,25,0.22)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            disabled={saving}
            onClick={onConfirm}
            type="button"
          >
            {saving ? "Lösche..." : "Ja, löschen"}
          </button>
        </div>
      </section>
    </div>
  );
}

function QuickExpenseSheet({
  onClose,
  onCreateExpense,
  open,
  saving,
}: {
  onClose: () => void;
  onCreateExpense: (input: NewExpenseInput) => Promise<boolean>;
  open: boolean;
  saving: boolean;
}) {
  useBodyScrollLock(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    pointerId: -1,
    startY: 0,
    currentY: 0,
    startedAt: 0,
  });
  const suppressHandleClick = useRef(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  function startSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressHandleClick.current = false;
    dragState.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      currentY: event.clientY,
      startedAt: performance.now(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragState.current.pointerId !== event.pointerId) return;
    dragState.current.currentY = event.clientY;
    const distance = Math.max(0, event.clientY - dragState.current.startY);
    if (distance > 4) suppressHandleClick.current = true;
    setDragY(distance);
  }

  function finishSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragState.current.pointerId !== event.pointerId) return;
    const distance = Math.max(0, dragState.current.currentY - dragState.current.startY);
    const elapsed = Math.max(1, performance.now() - dragState.current.startedAt);
    const velocity = distance / elapsed;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current.pointerId = -1;
    setDragging(false);

    if (distance >= 88 || velocity >= 0.55) {
      setDragY(panelRef.current?.offsetHeight ?? window.innerHeight);
      window.setTimeout(onClose, 140);
      return;
    }
    setDragY(0);
  }

  if (!open) return null;

  return (
    <div
      className="ios-viewport-overlay fixed inset-0 z-[70] flex items-end justify-center bg-[#082324]/52 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-label="Ausgabe eintragen"
        aria-modal="true"
        className="quick-sheet quick-sheet-panel max-h-[min(92dvh,calc(100dvh-24px))] w-full max-w-xl overflow-y-auto rounded-t-[30px] border border-white/64 bg-[#fbfdf9]/92 p-4 pb-[calc(18px+env(safe-area-inset-bottom))] shadow-[0_-18px_70px_rgba(0,0,0,0.28)] sm:max-h-[86vh] sm:rounded-[30px]"
        data-dragging={dragging}
        data-scroll-lock-scrollable
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        style={{ "--sheet-drag-y": `${dragY}px` } as CSSProperties}
      >
        <button
          aria-label="Ausgabenfenster nach unten ziehen oder schließen"
          className="sheet-drag-handle -mx-1 -mt-2 mb-1 flex h-8 w-[calc(100%+8px)] touch-none items-center justify-center sm:hidden"
          onClick={() => {
            if (!suppressHandleClick.current) onClose();
            suppressHandleClick.current = false;
          }}
          onPointerCancel={finishSheetDrag}
          onPointerDown={startSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={finishSheetDrag}
          type="button"
        >
          <span className="h-1.5 w-12 rounded-full bg-[#bdcbc4] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />
        </button>
        <div className="flex items-center justify-between px-1 pb-1">
          <p className="text-lg font-black text-[#0e302e]">Ausgabe eintragen</p>
          <button
            aria-label="Schließen"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#eff6f2] text-base font-black text-[#125f68] transition hover:bg-[#dcebe3]"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <ExpenseForm compact onCreateExpense={onCreateExpense} onSaved={onClose} saving={saving} title="+ Ausgabe" />
      </div>
    </div>
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

function connectionBufferMinutes(leg: TrainLeg, orderedLegs: TrainLeg[]) {
  const index = orderedLegs.findIndex((candidate) => candidate.id === leg.id);
  const next = orderedLegs[index + 1];
  if (!next || normalizedText(leg.to) !== normalizedText(next.from)) return null;
  const arrival = timeToMinutes(leg.arr);
  const departure = timeToMinutes(next.dep);
  if (arrival === null || departure === null) return null;
  return departure >= arrival ? departure - arrival : departure + 24 * 60 - arrival;
}

function railLookup(leg: TrainLeg, orderedLegs: TrainLeg[]): RailLegLookup {
  return {
    id: leg.id,
    train: leg.train,
    from: leg.from,
    to: leg.to,
    date: leg.date,
    plannedDeparture: leg.dep,
    plannedArrival: leg.arr,
    plannedDeparturePlatform: leg.depPlatform,
    plannedArrivalPlatform: leg.arrPlatform,
    fromStationId: leg.fromStationId,
    toStationId: leg.toStationId,
    timeZone: leg.timeZone || "Europe/Berlin",
    connectionBufferMinutes: connectionBufferMinutes(leg, orderedLegs),
  };
}

function TravelView({ flights, trains }: { flights: Flight[]; trains: TrainLeg[] }) {
  const [activeTab, setActiveTab] = useState("outbound-trains");
  const [railState, setRailState] = useState<Record<string, RailLegUiState>>({});
  const outboundTrains = trains.filter((leg) => stripDiacritics(normalizedText(leg.direction)).includes("hin"));
  const inboundTrains = trains.filter((leg) => stripDiacritics(normalizedText(leg.direction)).includes("ruck"));
  const outboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("hin")) ?? flights[0];
  const inboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("ruck")) ?? flights[1];
  const checkingAll = trains.some((leg) => railState[leg.id]?.statusLoading);
  const tabs = [
    { id: "outbound-trains", label: "Hin-Züge" },
    { id: "outbound-flight", label: "Hin-Flug" },
    { id: "inbound-flight", label: "Rück-Flug" },
    { id: "inbound-trains", label: "Rück-Züge" },
  ];

  async function checkStatus(leg: TrainLeg, orderedLegs: TrainLeg[]) {
    setRailState((current) => ({
      ...current,
      [leg.id]: { ...current[leg.id], statusLoading: true, statusError: undefined },
    }));
    try {
      const response = await fetch("/api/rail/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(railLookup(leg, orderedLegs)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live-Status konnte nicht geladen werden.");
      setRailState((current) => ({
        ...current,
        [leg.id]: {
          ...current[leg.id],
          status: result as RailStatusResult,
          statusLoading: false,
          statusError: undefined,
        },
      }));
    } catch (error) {
      setRailState((current) => ({
        ...current,
        [leg.id]: {
          ...current[leg.id],
          statusLoading: false,
          statusError: error instanceof Error ? error.message : "Live-Status konnte nicht geladen werden.",
        },
      }));
    }
  }

  async function findAlternatives(leg: TrainLeg, orderedLegs: TrainLeg[]) {
    setRailState((current) => ({
      ...current,
      [leg.id]: { ...current[leg.id], alternativesLoading: true, alternativesError: undefined },
    }));
    try {
      const response = await fetch("/api/rail/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(railLookup(leg, orderedLegs)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Alternativen konnten nicht geladen werden.");
      setRailState((current) => ({
        ...current,
        [leg.id]: {
          ...current[leg.id],
          alternatives: result as RailAlternativesResult,
          alternativesLoading: false,
          alternativesError: undefined,
        },
      }));
    } catch (error) {
      setRailState((current) => ({
        ...current,
        [leg.id]: {
          ...current[leg.id],
          alternativesLoading: false,
          alternativesError: error instanceof Error ? error.message : "Alternativen konnten nicht geladen werden.",
        },
      }));
    }
  }

  async function checkAllTrains() {
    for (let index = 0; index < trains.length; index += 2) {
      const batch = trains.slice(index, index + 2);
      await Promise.allSettled(
        batch.map((leg) => {
          const returnLeg = stripDiacritics(normalizedText(leg.direction)).includes("ruck");
          return checkStatus(leg, returnLeg ? inboundTrains : outboundTrains);
        }),
      );
    }
  }

  return (
    <div className="grid gap-5">
      <section className="ios-glass-card rounded-[24px] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle kicker="Reise-Zentrale" title="Reise" />
          {trains.length > 0 && (
            <button
              className="min-h-11 rounded-[14px] bg-[#125f68] px-4 py-2.5 text-sm font-black text-white transition active:scale-[0.98] hover:bg-[#0e4d54] disabled:cursor-wait disabled:opacity-60"
              disabled={checkingAll}
              onClick={() => void checkAllTrains()}
              type="button"
            >
              {checkingAll ? "Prüft Bahnreise…" : "Alle Bahnabschnitte prüfen"}
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              aria-pressed={activeTab === tab.id}
              className={classNames(
                "min-h-10 rounded-[8px] border px-3 py-2 text-sm font-black transition",
                activeTab === tab.id
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e] hover:border-[#8fb0a4] hover:bg-[#eff6f2]",
              )}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-[14px] bg-white/58 px-3 py-2.5 text-sm font-semibold leading-6 text-[#5b6f68]">
          Keine Hintergrundabfragen: Live-Status und Alternativen werden nur nach eurem Tippen geladen.
        </p>
      </section>

      {activeTab === "outbound-trains" && (
        <section className="grid gap-4 lg:grid-cols-2">
          {outboundTrains.map((leg) => (
            <TrainLegCard
              key={leg.id}
              leg={leg}
              onCheckStatus={() => checkStatus(leg, outboundTrains)}
              onFindAlternatives={() => findAlternatives(leg, outboundTrains)}
              state={railState[leg.id]}
            />
          ))}
        </section>
      )}

      {activeTab === "inbound-trains" && (
        <section className="grid gap-4 lg:grid-cols-2">
          {inboundTrains.map((leg) => (
            <TrainLegCard
              key={leg.id}
              leg={leg}
              onCheckStatus={() => checkStatus(leg, inboundTrains)}
              onFindAlternatives={() => findAlternatives(leg, inboundTrains)}
              state={railState[leg.id]}
            />
          ))}
        </section>
      )}

      {activeTab === "outbound-flight" && outboundFlight && <FlightCard flight={outboundFlight} />}
      {activeTab === "inbound-flight" && inboundFlight && <FlightCard flight={inboundFlight} />}

      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <SectionTitle kicker="Basis" title={trip.hotel} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#44635b]">
            Frangokastello 730 11, Kreta. Praktischer Ausgangspunkt für Sfakia,
            Loutro, Imbros, Plakias und Südküste.
          </p>
          <a
            className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
            href={trip.hotelMaps}
            rel="noreferrer"
            target="_blank"
          >
            Maps öffnen
          </a>
        </div>
      </section>
    </div>
  );
}

function RoutesView({
  onSaveSmartRoute,
  places,
  restaurants,
  routes,
  savedSmartRoutes,
}: {
  onSaveSmartRoute: (route: PlannedRoute) => void;
  places: Place[];
  restaurants: Restaurant[];
  routes: RoutePlan[];
  savedSmartRoutes: PlannedRoute[];
}) {
  const selectablePoints = useMemo(
    () => [hotelPoint, ...places.map(placeToRoutePoint).filter((point): point is RoutePoint => Boolean(point)).slice(0, 180)],
    [places],
  );
  const [day, setDay] = useState(travelDayOptions[1].value);
  const [startId, setStartId] = useState(hotelPoint.id);
  const [endId, setEndId] = useState(hotelPoint.id);
  const [startTime, setStartTime] = useState("09:30");
  const [duration, setDuration] = useState<RouteDurationId>("half");
  const [mealPlan, setMealPlan] = useState<MealPlanId>("lunch");
  const [pace, setPace] = useState<RoutePaceId>("balanced");
  const [walkingLevel, setWalkingLevel] = useState<WalkingLevelId>("medium");
  const [interests, setInterests] = useState<RouteInterestId[]>(["highlights", "beach"]);
  const [maxDriveMinutes, setMaxDriveMinutes] = useState(170);
  const [maxStops, setMaxStops] = useState(6);
  const [lowStress, setLowStress] = useState(true);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState("");
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const startPoint = selectablePoints.find((point) => point.id === startId) ?? hotelPoint;
  const endPoint = selectablePoints.find((point) => point.id === endId) ?? hotelPoint;

  function toggleInterest(interest: RouteInterestId) {
    setInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest],
    );
  }

  async function generateRoute() {
    let weatherByPoint: Map<string, WeatherPointSnapshot> | undefined;
    let checkedAt: string | undefined;
    setWeatherNotice("");
    if (weatherEnabled) {
      setWeatherLoading(true);
      const rawCandidates = [
        startPoint,
        endPoint,
        ...places
          .map(placeToRoutePoint)
          .filter((point): point is RoutePoint => Boolean(point))
          .filter((point) => matchesRouteInterest(point, interests)),
        ...restaurants.map(restaurantToRoutePoint).filter((point): point is RoutePoint => Boolean(point)),
      ]
        .filter((point) => point.lat >= 34.5 && point.lat <= 36 && point.lng >= 23 && point.lng <= 27)
        .filter((point) => distanceKm(startPoint, point) + distanceKm(point, endPoint) <= 430)
        .sort(
          (a, b) =>
            priorityScore(b.priority) +
            (b.rating ?? 0) * 8 -
            distanceKm(startPoint, b) * 0.15 -
            (priorityScore(a.priority) + (a.rating ?? 0) * 8 - distanceKm(startPoint, a) * 0.15),
        );
      const uniqueCandidates = Array.from(new Map(rawCandidates.map((point) => [point.id, point])).values()).slice(0, 30);
      try {
        const result = await requestWeather(
          uniqueCandidates.map((point) => ({ id: point.id, lat: point.lat, lng: point.lng })),
          day,
        );
        const available = result.points.filter((point) => point.available);
        if (available.length > 0) {
          weatherByPoint = new Map(available.map((point) => [point.id, point]));
          checkedAt = result.checkedAt;
          setWeatherNotice(`${available.length} Wetterpunkte für ${day} berücksichtigt.`);
        } else {
          setWeatherNotice("Für diesen Reisetag liegt noch keine belastbare Vorhersage vor. Route ohne Wettergewichtung berechnet.");
        }
      } catch (weatherLoadError) {
        setWeatherNotice(
          `${weatherLoadError instanceof Error ? weatherLoadError.message : "Wetter nicht verfügbar."} Route ohne Wettergewichtung berechnet.`,
        );
      } finally {
        setWeatherLoading(false);
      }
    }

    const route = buildSmartRoute({
      day,
      duration,
      end: endPoint,
      interests,
      lowStress,
      maxDriveMinutes,
      maxStops,
      mealPlan,
      pace,
      places,
      restaurants,
      start: startPoint,
      startTime,
      walkingLevel,
      weatherByPoint,
      weatherCheckedAt: checkedAt,
    });
    setPlannedRoute(route);
  }

  function replaceRouteStop(index: number, replacement: RoutePoint) {
    setPlannedRoute((current) => {
      if (!current) return current;
      const stops = current.stops.map((stop, stopIndex) => (stopIndex === index ? replacement : stop));
      return rebuildPlannedRoute(current, stops, walkingLevel);
    });
  }

  return (
    <div className="grid gap-5 overflow-x-clip">
      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle kicker="Smart Route planen" title="Tagesroute automatisch bauen" />
          <button
            className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
            disabled={weatherLoading}
            onClick={() => void generateRoute()}
            type="button"
          >
            {weatherLoading ? "Wetter wird geprüft…" : "Route berechnen"}
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          <FilterPillGroup label="Reisetag" onChange={setDay} options={travelDayOptions} value={day} />
          <div className="grid gap-4 lg:grid-cols-[0.7fr_1fr_1fr]">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Start-Uhrzeit</span>
              <input
                className="h-11 w-full min-w-0 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
                onChange={(event) => setStartTime(event.target.value)}
                type="time"
                value={startTime}
              />
            </label>
            <RoutePointSelect label="Startpunkt" onChange={setStartId} options={selectablePoints} value={startId} />
            <RoutePointSelect label="Endpunkt" onChange={setEndId} options={selectablePoints} value={endId} />
          </div>
          <FilterPillGroup label="Dauer" onChange={(value) => setDuration(value as RouteDurationId)} options={routeDurationOptions} value={duration} />
          <div className="grid gap-4 lg:grid-cols-2">
            <FilterPillGroup label="Plan-Stil" onChange={(value) => setPace(value as RoutePaceId)} options={routePaceOptions} value={pace} />
            <FilterPillGroup label="Laufen" onChange={(value) => setWalkingLevel(value as WalkingLevelId)} options={walkingLevelOptions} value={walkingLevel} />
          </div>
          <MultiPillGroup active={interests} label="Interessen" onToggle={toggleInterest} options={routeInterestOptions} />
          <FilterPillGroup label="Mahlzeiten" onChange={(value) => setMealPlan(value as MealPlanId)} options={mealPlanOptions} value={mealPlan} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-black text-[#0e302e]">
              Max. Fahrzeit
              <input
                className="h-11 w-full min-w-0 rounded-[8px] border border-[#cbdad2] px-3 text-sm outline-none focus:border-[#125f68]"
                min={45}
                onChange={(event) => setMaxDriveMinutes(Number(event.target.value))}
                type="number"
                value={maxDriveMinutes}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-[#0e302e]">
              Max. Stopps
              <input
                className="h-11 w-full min-w-0 rounded-[8px] border border-[#cbdad2] px-3 text-sm outline-none focus:border-[#125f68]"
                min={2}
                onChange={(event) => setMaxStops(Number(event.target.value))}
                type="number"
                value={maxStops}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-[8px] border border-[#cbdad2] px-3 text-sm font-black text-[#0e302e]">
              <input checked={lowStress} onChange={(event) => setLowStress(event.target.checked)} type="checkbox" />
              Wenig Stress
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-[8px] border border-[#cbdad2] px-3 text-sm font-black text-[#0e302e]">
              <input
                checked={weatherEnabled}
                onChange={(event) => setWeatherEnabled(event.target.checked)}
                type="checkbox"
              />
              Wetter berücksichtigen
            </label>
          </div>
          {weatherNotice && (
            <p className="rounded-[14px] bg-[#eff6f2] px-3 py-2.5 text-sm font-bold leading-6 text-[#44635b]" role="status">
              {weatherNotice}
            </p>
          )}
        </div>
      </section>

      {plannedRoute && (
        <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle kicker="Vorschlag" title={plannedRoute.title} />
            <button
              className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
              onClick={() => onSaveSmartRoute(plannedRoute)}
              type="button"
            >
              Route speichern
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Fact label="Dauer" value={formatDuration(plannedRoute.totalMinutes)} />
            <Fact label="Fahrt" value={formatDuration(plannedRoute.driveMinutes)} />
            <Fact label="Laufen" value={formatDuration(plannedRoute.walkMinutes)} />
            <Fact label="Distanz" value={formatKm(plannedRoute.totalKm)} />
            <Fact label="Stress" value={plannedRoute.stress} />
            <Fact
              label="Tageslicht"
              value={(() => {
                const dayWeather = plannedRoute.stops.find((stop) => stop.weather?.available)?.weather?.day;
                return dayWeather ? `${timeFromIso(dayWeather.sunrise)}–${timeFromIso(dayWeather.sunset)}` : "ohne Prognose";
              })()}
            />
          </div>
          <ol className="mt-5 grid gap-3">
            {plannedRoute.stops.map((stop, index) => (
              <li className="rounded-[8px] bg-[#eff6f2] p-3" key={`${stop.id}-${index}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-sm font-black text-[#125f68]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#0e302e]">
                      {stop.kind === "restaurant" ? restaurantEmoji(stop.category) : tourismEmoji(stop.category)} {stop.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#5b6f68]">
                      {stop.arrivalMinutes != null ? `${timeLabel(stop.arrivalMinutes)} · ` : ""}
                      {stop.category} · {stop.reason}
                    </p>
                    {stop.weather?.available && stop.weather.day && (
                      <p className="mt-2 text-xs font-black text-[#357179]">
                        {weatherCodeEmoji(stop.weather.day.weatherCode)} {weatherCodeLabel(stop.weather.day.weatherCode)}
                        {stop.weather.day.temperatureMax != null ? ` · bis ${Math.round(stop.weather.day.temperatureMax)} °C` : ""}
                        {stop.weather.day.precipitationProbabilityMax != null
                          ? ` · ${Math.round(stop.weather.day.precipitationProbabilityMax)} % Regen`
                          : ""}
                      </p>
                    )}
                    {stop.alternatives && stop.alternatives.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {stop.alternatives.map((alternative) => (
                          <button
                            className="rounded-[8px] border border-[#cbdad2] bg-white px-3 py-2 text-xs font-black text-[#34554e] transition hover:border-[#8fb0a4] hover:bg-[#f8fbf9]"
                            key={alternative.id}
                            onClick={() => replaceRouteStop(index, alternative)}
                            type="button"
                          >
                            Stattdessen: {alternative.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {plannedRoute.mapsLinks.map((link, index) => (
              <a
                className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
                href={link}
                key={link}
                rel="noreferrer"
                target="_blank"
              >
                Maps-Route {plannedRoute.mapsLinks.length > 1 ? index + 1 : "öffnen"}
              </a>
            ))}
          </div>
          {plannedRoute.weatherCheckedAt && (
            <p className="mt-3 text-xs font-semibold text-[#789087]">
              Wetterstand:{" "}
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(
                new Date(plannedRoute.weatherCheckedAt),
              )}
              . Modellprognose von Open‑Meteo.
            </p>
          )}
        </section>
      )}

      {savedSmartRoutes.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {savedSmartRoutes.map((route) => (
            <SavedSmartRouteCard key={route.id} route={route} />
          ))}
        </section>
      )}

      {routes.filter((route) => route.status === "Smart").length > 0 && (
        <section>
          <SectionTitle kicker="Gespeichert" title="Smart-Routen aus dem Backend" />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {routes.filter((route) => route.status === "Smart").map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RoutePointSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: RoutePoint[];
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">{label}</span>
      <select
        className="h-11 w-full min-w-0 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiPillGroup({
  active,
  label,
  onToggle,
  options,
}: {
  active: RouteInterestId[];
  label: string;
  onToggle: (value: RouteInterestId) => void;
  options: Array<{ value: RouteInterestId; label: string }>;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = active.includes(option.value);
          return (
            <button
              aria-pressed={pressed}
              className={classNames(
                "min-h-10 rounded-[8px] border px-3 py-2 text-sm font-black transition",
                pressed
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e] hover:border-[#8fb0a4] hover:bg-[#eff6f2]",
              )}
              key={option.value}
              onClick={() => onToggle(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SavedSmartRouteCard({ route }: { route: PlannedRoute }) {
  return (
    <article className="card-interactive rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">
            {travelDayOptions.find((option) => option.value === route.day)?.label ?? route.day}
          </p>
          <h3 className="mt-1 text-xl font-black text-[#0e302e]">{route.title}</h3>
        </div>
        <StatusPill>{route.stress}</StatusPill>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#44635b]">
        {route.stops.map((stop) => stop.title).join(" · ")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <SoftPill>{formatDuration(route.totalMinutes)}</SoftPill>
        <SoftPill>{formatKm(route.totalKm)}</SoftPill>
        <SoftPill>{route.stops.length} Stopps</SoftPill>
      </div>
      <a
        className="mt-4 inline-flex rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
        href={route.mapsLinks[0]}
        rel="noreferrer"
        target="_blank"
      >
        Maps öffnen
      </a>
    </article>
  );
}

function MapView({
  places,
  restaurants,
  savedSmartRoutes,
}: {
  places: Place[];
  restaurants: Restaurant[];
  savedSmartRoutes: PlannedRoute[];
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(hotelPoint);
  const [mapRouteStops, setMapRouteStops] = useState<RoutePoint[]>([hotelPoint, hotelPoint]);
  const [layers, setLayers] = useState({
    top: false,
    beaches: true,
    nature: true,
    culture: true,
    restaurants: true,
    routes: true,
  });

  const mapPlaces = useMemo(
    () =>
      places
        .map(placeToRoutePoint)
        .filter((point): point is RoutePoint => Boolean(point))
        .filter((point) => {
          const text = stripDiacritics(normalizedText(`${point.title} ${point.category} ${point.note}`));
          const categorySelected = layers.beaches || layers.nature || layers.culture;
          const categoryMatch =
            !categorySelected ||
            (layers.beaches && (text.includes("strand") || text.includes("beach") || text.includes("kuste"))) ||
            (layers.nature && (text.includes("natur") || text.includes("wandern") || text.includes("schlucht") || text.includes("park"))) ||
            (layers.culture && (text.includes("museum") || text.includes("historisch") || text.includes("burg") || text.includes("festung")));
          return categoryMatch && (!layers.top || priorityScore(point.priority) >= 42 || (point.rating ?? 0) >= 4.7);
        })
        .sort((a, b) => priorityScore(b.priority) + (b.rating ?? 0) * 6 - (priorityScore(a.priority) + (a.rating ?? 0) * 6))
        .slice(0, 180),
    [layers.beaches, layers.culture, layers.nature, layers.top, places],
  );
  const mapRestaurants = useMemo(
    () =>
      layers.restaurants
        ? restaurants
            .map(restaurantToRoutePoint)
            .filter((point): point is RoutePoint => Boolean(point))
            .sort((a, b) => priorityScore(b.priority) + (b.rating ?? 0) * 6 - (priorityScore(a.priority) + (a.rating ?? 0) * 6))
            .slice(0, 120)
        : [],
    [layers.restaurants, restaurants],
  );

  useEffect(() => {
    if (!mapElementRef.current) return;
    let cancelled = false;

    async function initMap() {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !mapElementRef.current) return;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      mapRef.current?.remove();
      const map = L.map(mapElementRef.current, { scrollWheelZoom: true }).setView([35.24, 24.85], 9);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      const bounds: Array<[number, number]> = [];
      const addPoint = (point: RoutePoint) => {
        bounds.push([point.lat, point.lng]);
        const topPoint = priorityScore(point.priority) >= 42 || (point.rating ?? 0) >= 4.7;
        const emoji = point.kind === "restaurant" ? restaurantEmoji(point.category) : point.kind === "hotel" ? "🏨" : tourismEmoji(point.category);
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;align-items:center;justify-content:center;width:${topPoint ? 36 : 32}px;height:${topPoint ? 36 : 32}px;border-radius:8px;background:white;border:2px solid ${topPoint ? "#f0a23a" : "#125f68"};box-shadow:0 8px 22px rgba(14,48,46,.20);font-size:18px">${emoji}</span>`,
            iconAnchor: [18, 18],
          }),
        });
        marker
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(point.title)}</strong><br/><span>${escapeHtml(point.category)}</span><br/><span>${point.rating ? `Google ${point.rating.toLocaleString("de-DE")}` : escapeHtml(point.priority)}</span><br/><span>${formatKm(distanceKm(hotelPoint, point))} ab Hotel</span><br/><a href="${escapeHtml(point.maps)}" target="_blank" rel="noreferrer">Maps öffnen</a>`,
          )
          .on("click", () => setSelectedPoint(point));
      };

      addPoint(hotelPoint);
      mapPlaces.forEach(addPoint);
      mapRestaurants.forEach(addPoint);

      if (layers.routes) {
        [...savedSmartRoutes, currentMapRoute(mapRouteStops)].filter(Boolean).forEach((route) => {
          const routePoints = (route as PlannedRoute).stops;
          const latLngs = routePoints.map((point) => [point.lat, point.lng] as [number, number]);
          if (latLngs.length > 1) {
            L.polyline(latLngs, {
              className: "route-draw-line",
              color: "#125f68",
              opacity: 0.78,
              weight: 4,
            }).addTo(map);
            routePoints.forEach((point, index) => {
              L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<span class="route-step-marker${index === 0 ? " route-step-active" : ""}">${index + 1}</span>`,
                  iconAnchor: [12, 12],
                }),
              }).addTo(map);
            });
          }
        });
      }

      if (bounds.length) {
        map.fitBounds(bounds, { maxZoom: 10, padding: [28, 28] });
      }
    }

    initMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [layers.routes, mapPlaces, mapRestaurants, mapRouteStops, savedSmartRoutes]);

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function addPointToMapRoute(point: RoutePoint) {
    setMapRouteStops((current) => {
      const start = current[0] ?? hotelPoint;
      const end = current[current.length - 1] ?? hotelPoint;
      const middle = current.slice(1, -1).filter((item) => item.id !== point.id);
      return [start, ...middle, point, end];
    });
  }

  const mapRoute = currentMapRoute(mapRouteStops);

  return (
    <div className="grid gap-5">
      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle kicker="Karte" title="POIs, Restaurants & Tagesrouten" />
          {mapRoute && (
            <a
              className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
              href={mapRoute.mapsLinks[0]}
              rel="noreferrer"
              target="_blank"
            >
              Aktuelle Route in Maps
            </a>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <MapLayerButton active={layers.top} onClick={() => toggleLayer("top")}>Top</MapLayerButton>
          <MapLayerButton active={layers.beaches} onClick={() => toggleLayer("beaches")}>Strände</MapLayerButton>
          <MapLayerButton active={layers.nature} onClick={() => toggleLayer("nature")}>Natur</MapLayerButton>
          <MapLayerButton active={layers.culture} onClick={() => toggleLayer("culture")}>Kultur</MapLayerButton>
          <MapLayerButton active={layers.restaurants} onClick={() => toggleLayer("restaurants")}>Restaurants</MapLayerButton>
          <MapLayerButton active={layers.routes} onClick={() => toggleLayer("routes")}>Routen</MapLayerButton>
        </div>
        <div ref={mapElementRef} className="mt-4 h-[520px] overflow-hidden rounded-[8px] border border-[#d7e3dc] bg-[#eff6f2]" />
      </section>

      {selectedPoint && (
        <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">
                {selectedPoint.kind === "restaurant" ? "Restaurant" : selectedPoint.kind === "hotel" ? "Basis" : "Ort"}
              </p>
              <h3 className="mt-1 text-xl font-black text-[#0e302e]">{selectedPoint.title}</h3>
            </div>
            <StatusPill>{selectedPoint.rating ? `Google ${selectedPoint.rating.toLocaleString("de-DE")}` : selectedPoint.priority}</StatusPill>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#44635b]">{selectedPoint.note || selectedPoint.category}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
              onClick={() => setMapRouteStops((current) => [selectedPoint, ...current.slice(1)])}
              type="button"
            >
              Als Start
            </button>
            <button
              className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
              onClick={() => setMapRouteStops((current) => [...current.slice(0, -1), selectedPoint])}
              type="button"
            >
              Als Ziel
            </button>
            <button
              className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
              onClick={() => addPointToMapRoute(selectedPoint)}
              type="button"
            >
              Zur Route hinzufügen
            </button>
            <a
              className="rounded-[8px] bg-[#f1f5f2] px-4 py-3 text-sm font-black text-[#34554e] transition hover:bg-[#e3ece7]"
              href={selectedPoint.maps}
              rel="noreferrer"
              target="_blank"
            >
              Maps öffnen
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function currentMapRoute(points: RoutePoint[]) {
  const uniqueStops = points.filter((point, index) => index === 0 || index === points.length - 1 || point.id !== points[index - 1].id);
  if (uniqueStops.length < 2) return null;
  const metrics = routeMetrics(uniqueStops);
  return {
    id: "current-map-route",
    day: travelDayOptions[1].value,
    title: "Aktuelle Kartenroute",
    startTime: "09:30",
    stops: uniqueStops,
    ...metrics,
    stress: metrics.totalMinutes > 520 ? "intensiv" : metrics.totalMinutes > 360 ? "mittel" : "entspannt",
    mapsLinks: googleMapsRouteLinks(uniqueStops),
    createdAt: new Date().toISOString(),
  } satisfies PlannedRoute;
}

function MapLayerButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={classNames(
        "min-h-10 rounded-[8px] border px-3 py-2 text-sm font-black transition",
        active
          ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
          : "border-[#cbdad2] bg-white text-[#34554e] hover:border-[#8fb0a4] hover:bg-[#eff6f2]",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function GuideView({
  guideMode,
  places,
  restaurants,
  setGuideMode,
}: {
  guideMode: GuideMode;
  places: Place[];
  restaurants: Restaurant[];
  setGuideMode: (mode: GuideMode) => void;
}) {
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [restaurantCuisineFilter, setRestaurantCuisineFilter] = useState("all");
  const [veggieFilter, setVeggieFilter] = useState("all");
  const [sightTypeFilter, setSightTypeFilter] = useState("all");
  const activeItems = guideMode === "restaurants" ? restaurants : places;
  const normalizedQuery = normalizedText(query.trim());
  const regionOptions = useMemo(() => uniqueValues(activeItems.map((item) => item.region)), [activeItems]);
  const regionFilterOptions = useMemo(
    () => [
      { value: "all", label: "Alle Regionen" },
      ...regionOptions.map((region) => ({ value: region, label: readableText(region) })),
    ],
    [regionOptions],
  );
  const activeFilterCount = [
    normalizedQuery,
    regionFilter !== "all",
    priorityFilter !== "all",
    ratingFilter !== "all",
    guideMode === "restaurants" && restaurantCuisineFilter !== "all",
    guideMode === "restaurants" && veggieFilter !== "all",
    guideMode === "sights" && sightTypeFilter !== "all",
  ].filter(Boolean).length;

  const filteredPlaces = useMemo(
    () =>
      places.filter((place) => {
        const typeFilter = sightTypeFilters.find((filter) => filter.value === sightTypeFilter);
        const text = [
          place.title,
          place.category,
          place.region,
          place.location,
          place.priority,
          place.effort,
          place.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          (!normalizedQuery || normalizedText(text).includes(normalizedQuery)) &&
          (regionFilter === "all" || place.region === regionFilter) &&
          (priorityFilter === "all" || place.priority === priorityFilter) &&
          matchesRating(place.note, ratingFilter) &&
          matchesTerms(normalizedText(`${place.title} ${place.category} ${place.effort}`), typeFilter?.terms ?? [])
        );
      }),
    [normalizedQuery, places, priorityFilter, ratingFilter, regionFilter, sightTypeFilter],
  );

  const filteredRestaurants = useMemo(
    () =>
      restaurants.filter((restaurant) => {
        const cuisineFilter = restaurantCuisineFilters.find((filter) => filter.value === restaurantCuisineFilter);
        const text = [
          restaurant.name,
          restaurant.region,
          restaurant.place,
          restaurant.cuisine,
          restaurant.price,
          restaurant.veggie,
          restaurant.priority,
          restaurant.why,
          restaurant.ratingHint,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const veggieText = normalizedText(`${restaurant.veggie} ${restaurant.why} ${restaurant.cuisine}`);
        const veggieMatches =
          veggieFilter === "all" ||
          (veggieFilter === "vegan" && veggieText.includes("vegan")) ||
          (veggieFilter === "vegetarian" &&
            (veggieText.includes("vegan") || veggieText.includes("vegetarian") || veggieText.includes("vegetarisch")));
        return (
          (!normalizedQuery || normalizedText(text).includes(normalizedQuery)) &&
          (regionFilter === "all" || restaurant.region === regionFilter) &&
          (priorityFilter === "all" || restaurant.priority === priorityFilter) &&
          matchesRating(restaurant.ratingHint, ratingFilter) &&
          matchesTerms(normalizedText(`${restaurant.cuisine} ${restaurant.why}`), cuisineFilter?.terms ?? []) &&
          veggieMatches
        );
      }),
    [normalizedQuery, ratingFilter, regionFilter, restaurantCuisineFilter, restaurants, priorityFilter, veggieFilter],
  );

  const visibleCount = guideMode === "restaurants" ? filteredRestaurants.length : filteredPlaces.length;
  const activeLabel = guideMode === "restaurants" ? "Restaurants" : "Sehenswürdigkeiten";
  const resetFilters = () => {
    setQuery("");
    setRegionFilter("all");
    setPriorityFilter("all");
    setRatingFilter("all");
    setRestaurantCuisineFilter("all");
    setVeggieFilter("all");
    setSightTypeFilter("all");
  };

  return (
    <div className="grid gap-5 overflow-x-clip">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle kicker="Guide" title={`${visibleCount}/${activeItems.length} ${activeLabel}`} />
        <div className="grid w-full grid-cols-2 rounded-[8px] border border-[#d7e3dc] bg-white p-1 shadow-sm sm:w-auto">
          <TabButton active={guideMode === "restaurants"} onClick={() => setGuideMode("restaurants")}>
            Restaurants
          </TabButton>
          <TabButton active={guideMode === "sights"} onClick={() => setGuideMode("sights")}>
            Sehenswürdigkeiten
          </TabButton>
        </div>
      </section>

      <section className="grid gap-3 rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <input
          className="h-11 w-full min-w-0 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            guideMode === "restaurants"
              ? "Restaurant, Ort, Küche, Rating suchen"
              : "Sehenswürdigkeit, Region, Typ suchen"
          }
          value={query}
        />
        <div className="grid gap-4">
          <FilterPillGroup label="Region" onChange={setRegionFilter} options={regionFilterOptions} value={regionFilter} />
          <div className="grid gap-4 lg:grid-cols-2">
            <FilterPillGroup label="Empfehlung" onChange={setPriorityFilter} options={priorityFilters} value={priorityFilter} />
            <FilterPillGroup label="Rating" onChange={setRatingFilter} options={ratingFilters} value={ratingFilter} />
          </div>
        </div>
        {guideMode === "restaurants" ? (
          <div className="grid gap-4">
            <FilterPillGroup label="Küche" onChange={setRestaurantCuisineFilter} options={restaurantCuisineFilters} value={restaurantCuisineFilter} />
            <FilterPillGroup label="Veggie" onChange={setVeggieFilter} options={veggieFilters} value={veggieFilter} />
          </div>
        ) : (
          <div className="grid gap-4">
            <FilterPillGroup label="Kategorie" onChange={setSightTypeFilter} options={sightTypeFilters} value={sightTypeFilter} />
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#e3ece7] pt-3">
          <FilterLegend guideMode={guideMode} />
          <ResetFilterButton active={activeFilterCount > 0} onClick={resetFilters} />
        </div>
      </section>

      {guideMode === "sights" ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </section>
      )}
    </div>
  );
}

function PackView({
  onTogglePack,
  packItems,
}: {
  onTogglePack: (id: string, field: "lucaDone" | "janDone", value: boolean) => void;
  packItems: PackItem[];
}) {
  const totalChecks = packItems.length * 2;
  const doneChecks = packItems.reduce(
    (sum, item) => sum + (item.lucaDone ? 1 : 0) + (item.janDone ? 1 : 0),
    0,
  );
  const progress = totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0;
  const bags = new Map<string, PackItem[]>();
  for (const item of packItems) {
    const key = item.bag || "Sonstiges";
    bags.set(key, [...(bags.get(key) ?? []), item]);
  }

  return (
    <div className="grid gap-5">
      <section
        className={classNames(
          "rounded-[14px] border border-[#d7e3dc] bg-white p-4 shadow-sm",
          progress === 100 && "pack-complete",
        )}
      >
        <div className="flex items-center justify-between">
          <SectionTitle kicker="Packliste" title={`${doneChecks}/${totalChecks} Haken gesetzt`} />
          <p className="text-sm font-black tabular-nums text-[#125f68]">{progress} %</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e4ece7]">
          <div className="h-full rounded-full bg-[#125f68] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm font-semibold text-[#5b6f68]">
          L und J einzeln antippen, der Stand wird für beide gespeichert.
        </p>
      </section>

      {Array.from(bags.entries()).map(([bag, items]) => (
        <section key={bag}>
          <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[#789087]">{bag}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div
                className="flex items-center gap-3 rounded-[14px] border border-[#d7e3dc] bg-white p-3.5 shadow-sm"
                key={item.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black text-[#0e302e]">
                    {item.item}{" "}
                    {item.importance === "Muss" && (
                      <span className="rounded-full bg-[#eff6f2] px-2 py-0.5 text-[11px] font-black text-[#34554e] align-[2px]">
                        Muss
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-bold text-[#789087]">
                    {[item.category, item.note].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {(["lucaDone", "janDone"] as const).map((field) => {
                    const checked = Boolean(item[field]);
                    return (
                      <button
                        aria-label={`${item.item}: ${field === "lucaDone" ? "Luca" : "Jan"} ${checked ? "erledigt" : "offen"}`}
                        aria-pressed={checked}
                        className={classNames(
                          "h-11 w-11 rounded-[12px] border text-sm font-black transition active:scale-95",
                          checked
                            ? "border-[#125f68] bg-[#125f68] text-white"
                            : "border-[#cbdad2] bg-white text-[#789087]",
                        )}
                        key={field}
                        onClick={() => onTogglePack(item.id, field, !checked)}
                        type="button"
                      >
                        {field === "lucaDone" ? "L" : "J"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BalancePanel({
  dashboard,
  expenses,
  fixedCosts,
}: {
  dashboard: DashboardState;
  expenses: ExpenseItem[];
  fixedCosts: FixedCost[];
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [chartMode, setChartMode] = useState<"all" | "fixed" | "trip">("all");
  const breakdown = useMemo(() => buildCostBreakdown(fixedCosts, expenses), [expenses, fixedCosts]);
  const fixedBreakdown = breakdown.filter((item) => item.phase === "fixed");
  const tripBreakdown = breakdown.filter((item) => item.phase === "trip");
  const fixedExpenses = fixedBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const tripExpenses = tripBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const calculatedTotal = fixedExpenses + tripExpenses;
  const totalExpenses = calculatedTotal > 0 ? calculatedTotal : Math.max(0, dashboard.totalBudget);
  const activeBreakdown =
    chartMode === "fixed" ? fixedBreakdown : chartMode === "trip" ? tripBreakdown : breakdown;
  const activeSubtotal = activeBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const activeTotal = chartMode === "all" ? totalExpenses : activeSubtotal;
  const chartModeLabel = chartMode === "fixed" ? "Im Vorfeld" : chartMode === "trip" ? "Vor Ort" : "Gesamt";
  let chartCursor = 0;
  const chartGradient =
    activeBreakdown.length > 0 && activeTotal > 0
      ? `conic-gradient(${activeBreakdown
          .map((item) => {
            const start = chartCursor;
            chartCursor += (item.amount / activeTotal) * 100;
            return `${item.color} ${start}% ${chartCursor}%`;
          })
          .join(", ")})`
      : "conic-gradient(rgba(255,255,255,0.18) 0 100%)";
  const chartLabel =
    activeBreakdown.length > 0
      ? activeBreakdown
          .map((item) => `${item.label} ${Math.round((item.amount / activeTotal) * 100)} Prozent`)
          .join(", ")
      : "Noch keine Ausgaben";

  return (
    <section className="ios-glass-dark rounded-[24px] p-5 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9fe0d5]">
        Aktueller Ausgleich
      </p>
      <h3 className="mt-3 text-4xl font-black">{dashboard.settlementText}</h3>
      <p className="mt-2 text-6xl font-black leading-none">{money(dashboard.settlementAmount)}</p>
      <div className="mt-5 rounded-[18px] bg-white/10 p-4">
        <div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-[#b8f4eb]">Wofür wurde Geld ausgegeben?</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9fe0d5]" />
                Live
              </span>
            </div>
            <p className="mt-1 text-3xl font-black tabular-nums">{money(activeTotal)}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-black/20 p-1">
              {(["all", "fixed", "trip"] as const).map((mode) => (
                <button
                  className={classNames(
                    "whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] transition active:scale-[0.97]",
                    chartMode === mode
                      ? "bg-[#9fe0d5] text-[#0d3535] shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                      : "text-white/70 hover:text-white"
                  )}
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  type="button"
                >
                  {mode === "all" ? "Gesamt" : mode === "fixed" ? "Vorfeld" : "Vor Ort"}
                </button>
              ))}
            </div>
        </div>

        <div className="mt-4 grid items-center gap-4 min-[480px]:grid-cols-[112px_1fr]">
          <div
            aria-label={chartLabel}
            className="relative mx-auto h-28 w-28 shrink-0 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.18)] min-[480px]:mx-0"
            role="img"
            style={{ background: chartGradient }}
          >
            <div className="absolute inset-[13px] grid place-items-center rounded-full bg-[#164f51] text-center">
              <div>
                <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-white/55">{chartModeLabel}</span>
                <span className="mt-0.5 block text-sm font-black tabular-nums">{money(activeTotal)}</span>
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            {activeBreakdown.slice(0, 5).map((item) => (
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs" key={item.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="font-bold leading-tight text-white/75">{item.label}</span>
                </div>
                <span className="shrink-0 font-black tabular-nums">{money(item.amount)}</span>
              </div>
            ))}
            {activeBreakdown.length > 5 && (
              <p className="text-[10px] font-bold text-white/50">+ {activeBreakdown.length - 5} weitere Kategorien</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-black/10 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/50">🧳 Im Vorfeld</p>
            <p className="mt-1 text-base font-black tabular-nums">{money(fixedExpenses)}</p>
          </div>
          <div className="rounded-[12px] bg-black/10 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/50">🌴 Vor Ort</p>
            <p className="mt-1 text-base font-black tabular-nums">{money(tripExpenses)}</p>
          </div>
        </div>

        <button
          aria-controls="cost-breakdown-details"
          aria-expanded={detailsOpen}
          className="mt-3 flex min-h-11 w-full items-center justify-between rounded-[12px] border border-white/10 bg-white/8 px-3 text-sm font-black transition hover:bg-white/12 active:scale-[0.99]"
          onClick={() => setDetailsOpen((open) => !open)}
          type="button"
        >
          <span>{detailsOpen ? "Details schließen" : "Alle Kategorien & Details"}</span>
          <span
            aria-hidden="true"
            className={classNames("text-lg transition-transform", detailsOpen && "rotate-180")}
          >
            ⌄
          </span>
        </button>

        {detailsOpen && (
          <div className="mt-3 grid gap-3" id="cost-breakdown-details">
            <CostBreakdownGroup
              emptyText="Noch keine Kosten im Vorfeld."
              items={fixedBreakdown}
              title="🧳 Im Vorfeld"
              total={fixedExpenses}
            />
            <CostBreakdownGroup
              emptyText="Noch keine Vor-Ort-Ausgaben. Tanken, Restaurants und weitere Einträge erscheinen hier automatisch."
              items={tripBreakdown}
              title="🌴 Vor Ort"
              total={tripExpenses}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function CostBreakdownGroup({
  emptyText,
  items,
  title,
  total,
}: {
  emptyText: string;
  items: CostBreakdownItem[];
  title: string;
  total: number;
}) {
  return (
    <section className="rounded-[14px] bg-black/12 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-black">{title}</h4>
        <p className="text-sm font-black tabular-nums text-[#b8f4eb]">{money(total)}</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">{emptyText}</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {items.map((item) => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            return (
              <div className="rounded-[12px] bg-white/8 p-2.5" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-base"
                      style={{ backgroundColor: `${item.color}26` }}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{item.label}</p>
                      <p className="text-[10px] font-bold text-white/50">{Math.round(percentage)} % dieser Gruppe</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-black tabular-nums">{money(item.amount)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color, width: `${Math.max(3, percentage)}%` }}
                  />
                </div>
                <div className="mt-2 grid gap-1 border-t border-white/8 pt-2">
                  {item.entries.map((entry, index) => (
                    <div
                      className="flex items-start justify-between gap-3 text-[11px] font-semibold text-white/60"
                      key={`${item.id}:${entry.label}:${index}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-white/75">{entry.label}</p>
                        <p className="truncate text-[10px] text-white/40">{entry.meta}</p>
                      </div>
                      <span className="shrink-0 tabular-nums">{money(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CategoryBar({ category, max }: { category: CategorySummaryItem; max: number }) {
  const width = Math.max(4, (category.total / max) * 100);
  const saldo =
    category.lucaBalance < 0
      ? `Luca: ${money(Math.abs(category.lucaBalance))} an Jan`
      : category.lucaBalance > 0
        ? `Jan: ${money(category.lucaBalance)} an Luca`
        : "ausgeglichen";

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black leading-tight text-[#0e302e]">{category.name}</p>
          <p className="text-sm font-semibold text-[#5b6f68]">{saldo}</p>
        </div>
        <p className="shrink-0 text-lg font-black text-[#0e302e]">{money(category.total)}</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-[8px] bg-[#e6eee9]">
        <div className="h-full rounded-[8px] bg-[#125f68]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ExpenseRow({
  expense,
  onDelete,
  saving,
}: {
  expense: ExpenseItem;
  onDelete: () => void;
  saving: boolean;
}) {
  const isSettlement = Boolean(expense.isSettlement);
  const settlementRecipient = expense.paidBy === "Luca" ? "Jan" : "Luca";
  const balanceLabel = isSettlement
    ? `${expense.paidBy} → ${settlementRecipient} · direkter Ausgleich`
    : expense.lucaBalance < 0
      ? `Luca an Jan ${money(Math.abs(expense.lucaBalance))}`
      : expense.lucaBalance > 0
        ? `Jan an Luca ${money(expense.lucaBalance)}`
        : "ausgeglichen";

  return (
    <article
      className={classNames(
        "rounded-[18px] border p-3 shadow-[0_10px_24px_rgba(14,48,46,0.06)]",
        isSettlement ? "border-[#b9d8d0] bg-[#edf8f4]/90" : "border-white/70 bg-[#eff6f2]/86",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#357179]">{expense.travelDay}</p>
          <h3 className="truncate text-lg font-black text-[#0e302e]">{expense.category}</h3>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <p className="text-lg font-black tabular-nums text-[#0e302e]">{money(expense.amount)}</p>
          <button
            aria-label={`${expense.category} löschen`}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#efc7bc] bg-white/88 text-lg font-black leading-none text-[#8c3219] shadow-sm transition active:scale-95 disabled:opacity-60"
            disabled={saving}
            onClick={onDelete}
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#44635b]">
        {isSettlement ? "Ausgleich" : `Bezahlt von ${expense.paidBy}`} · {balanceLabel}
      </p>
      {expense.note && <p className="mt-1 text-sm font-medium text-[#5b6f68]">{expense.note}</p>}
    </article>
  );
}

function FixedCostCard({ cost }: { cost: FixedCost }) {
  const balanceLabel =
    cost.lucaBalance < 0
      ? `Luca an Jan ${money(Math.abs(cost.lucaBalance))}`
      : cost.lucaBalance > 0
        ? `Jan an Luca ${money(cost.lucaBalance)}`
        : "ausgeglichen";

  return (
    <article className="card-interactive rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{cost.area}</p>
          <h3 className="mt-1 text-xl font-black text-[#0e302e]">{cost.kind}</h3>
        </div>
        <StatusPill>{cost.status}</StatusPill>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#44635b]">{cost.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Fact label="Betrag" value={money(cost.amount)} />
        <Fact label="Gezahlt von" value={cost.paidBy} />
        <Fact label="Luca Anteil" value={money(cost.lucaShare)} />
        <Fact label="Jan Anteil" value={money(cost.janShare)} />
      </div>
      <p className="mt-4 rounded-[8px] bg-[#eff6f2] px-3 py-2 text-sm font-black text-[#0e302e]">
        {balanceLabel}
      </p>
    </article>
  );
}

function trainVehicleImage(leg: TrainLeg) {
  const text = stripDiacritics(normalizedText(`${leg.id} ${leg.train} ${leg.section}`));
  if (text.includes("1091")) return "/vehicles/trains/ice-1091.png";
  if (text.includes("2065")) return "/vehicles/trains/ic-2065.png";
  if (text.includes("2066")) return "/vehicles/trains/ic-2066.png";
  if (text.includes("1090")) return "/vehicles/trains/ice-1090.png";
  if (text.includes("rb70") || text.includes("12548")) return "/vehicles/trains/rb70-12548.png";
  return "";
}

function flightVehicleImage(flight: Flight) {
  return stripDiacritics(normalizedText(`${flight.airline} ${flight.aircraft}`)).includes("ryanair")
    ? "/vehicles/aircraft/ryanair-737-800.jpg"
    : "";
}

function trainOrderCode(leg: TrainLeg) {
  return stripDiacritics(normalizedText(leg.direction)).includes("ruck") ? "626247648569" : "109766598505";
}

function germanDateToIso(value: string) {
  const match = readableText(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return "2026-07-01";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function bahnConnectionUrl(leg: TrainLeg) {
  const params = new URLSearchParams({
    S: readableText(leg.from),
    Z: readableText(leg.to),
    date: germanDateToIso(leg.date),
    time: leg.dep,
  });
  return `https://www.bahn.de/buchung/start?${params.toString()}`;
}

function VehicleImage({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="relative flex aspect-[16/5] w-full items-center justify-center overflow-hidden rounded-[8px] border border-[#d7e3dc] bg-[#f7faf8]">
      {src ? (
        <Image alt={alt} className="object-contain p-2" fill sizes="(min-width: 1024px) 50vw, 100vw" src={src} />
      ) : (
        <span className="text-sm font-black text-[#789087]">Kein Fahrzeugbild</span>
      )}
    </div>
  );
}

function flightStatusLinks(flight: Flight) {
  const airportLinks = [
    `${flight.from} ${flight.to}`.includes("NUE")
      ? { label: "Nürnberg Airport", href: "https://www.airport-nuernberg.de/en/flights" }
      : null,
    `${flight.from} ${flight.to}`.includes("CHQ")
      ? { label: "Chania Airport", href: "https://www.chq-airport.gr/en/flight-list" }
      : null,
  ].filter((item): item is { label: string; href: string } => Boolean(item));
  return [
    { label: "Ryanair Updates", href: "https://www.ryanair.com/gb/en/lp/travel-updates" },
    ...airportLinks,
  ];
}

function FlightCard({ flight }: { flight: Flight }) {
  const image = flightVehicleImage(flight);
  const statusLinks = flightStatusLinks(flight);

  return (
    <article className="card-interactive rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <VehicleImage alt={`${flight.airline} ${flight.aircraft}`} src={image} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{flight.direction}</p>
          <h3 className="mt-1 text-2xl font-black text-[#0e302e]">
            {flight.from} → {flight.to}
          </h3>
        </div>
        <StatusPill>{flight.number}</StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Fact label="Datum" value={flight.date} />
        <Fact label="Zeit" value={`${flight.dep} - ${flight.arr}`} />
        <Fact label="Airline" value={flight.airline} />
        <Fact label="Flugzeug" value={flight.aircraft || "Boeing 737-800"} />
        <Fact label="Buchung" value={flight.booking} />
        <Fact label="Status" value="Offizielle Live-Seiten" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className="rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
          href={flight.manageUrl}
          rel="noreferrer"
          target="_blank"
        >
          Buchung öffnen
        </a>
        {statusLinks.map((link) => (
          <a
            className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
            href={link.href}
            key={link.href}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}

function railStatusLabel(status?: RailStatusResult) {
  if (!status) return "nicht geprüft";
  if (status.state === "cancelled") return "Ausfall";
  if (status.state === "delayed") return "verspätet";
  if (status.state === "on_time") return "pünktlich";
  if (status.state === "scheduled") return "nur Fahrplan";
  return "unbekannt";
}

function railStatusClass(status?: RailStatusResult) {
  if (status?.state === "cancelled") return "bg-[#ffe4dc] text-[#8c3219]";
  if (status?.state === "delayed") return "bg-[#fff0c9] text-[#76510c]";
  if (status?.state === "on_time") return "bg-[#dff6ed] text-[#125f68]";
  return "bg-[#edf1ee] text-[#5b6f68]";
}

function delayLabel(delay: number | null, realtime: boolean) {
  if (!realtime) return "keine Echtzeit";
  if (delay === null) return "unbekannt";
  if (delay <= 0) return "pünktlich";
  return `+${delay} Min.`;
}

function TrainLegCard({
  leg,
  onCheckStatus,
  onFindAlternatives,
  state,
}: {
  leg: TrainLeg;
  onCheckStatus: () => Promise<void>;
  onFindAlternatives: () => Promise<void>;
  state?: RailLegUiState;
}) {
  const orderCode = trainOrderCode(leg);
  const connectionUrl = bahnConnectionUrl(leg);
  const status = state?.status;
  const alternatives = state?.alternatives;
  const checkedAt = status
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(status.checkedAt))
    : "";

  return (
    <article className="ios-glass-card overflow-hidden rounded-[24px]">
      <div className="p-4">
      <VehicleImage alt={leg.train} src={trainVehicleImage(leg)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{leg.direction}</p>
          <h3 className="mt-1 truncate text-xl font-black text-[#0e302e]">{leg.section}</h3>
          <p className="mt-1 text-sm font-bold text-[#357179]">{leg.train}</p>
        </div>
        <span className={classNames("shrink-0 rounded-full px-3 py-1.5 text-xs font-black", railStatusClass(status))}>
          {state?.statusLoading ? "prüft..." : railStatusLabel(status)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Fact label="Datum" value={leg.date} />
        <Fact label="Zug" value={leg.train} />
        <Fact label={leg.from} value={`${leg.dep} · Gleis ${leg.depPlatform}`} />
        <Fact label={leg.to} value={`${leg.arr} · Gleis ${leg.arrPlatform}`} />
        <Fact label="Auftrag" value={orderCode} />
        <Fact label="Preis/Personen" value={`${leg.price} · 2 Personen`} />
      </div>
      <p className="mt-3 text-sm font-medium text-[#44635b]">{leg.note}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          className="min-h-11 rounded-[14px] bg-[#125f68] px-3 py-2.5 text-sm font-black text-white transition active:scale-[0.98] hover:bg-[#0e4d54] disabled:cursor-wait disabled:opacity-60"
          disabled={state?.statusLoading}
          onClick={() => void onCheckStatus()}
          type="button"
        >
          {state?.statusLoading ? "Live wird geladen..." : status ? "Live aktualisieren" : "Live-Status abrufen"}
        </button>
        <button
          className="min-h-11 rounded-[14px] bg-[#e7f4ee] px-3 py-2.5 text-sm font-black text-[#125f68] transition active:scale-[0.98] hover:bg-[#dcebe3] disabled:cursor-wait disabled:opacity-60"
          disabled={state?.alternativesLoading}
          onClick={() => void onFindAlternatives()}
          type="button"
        >
          {state?.alternativesLoading ? "Sucht..." : alternatives ? "Alternativen aktualisieren" : "Alternative suchen"}
        </button>
        <a
          className="min-h-11 rounded-[14px] bg-white/72 px-3 py-2.5 text-center text-sm font-black text-[#34554e] transition hover:bg-white"
          href={connectionUrl}
          rel="noreferrer"
          target="_blank"
        >
          Bei DB öffnen
        </a>
        <CopyOrderButton code={orderCode} />
      </div>
      {state?.statusError && (
        <p className="mt-3 rounded-[14px] bg-[#fff0eb] px-3 py-2.5 text-sm font-bold text-[#8c3219]" role="alert">
          {state.statusError}
        </p>
      )}
      {state?.alternativesError && (
        <p className="mt-3 rounded-[14px] bg-[#fff0eb] px-3 py-2.5 text-sm font-bold text-[#8c3219]" role="alert">
          {state.alternativesError}
        </p>
      )}
      <details className="mt-4 rounded-[14px] bg-[#eff6f2] p-3">
        <summary className="cursor-pointer text-sm font-black text-[#0e302e]">Details & Bahn-Checkliste</summary>
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-[#44635b]">
          <li>Gleiswechsel und Echtzeitstatus kurz vor Abfahrt nochmals prüfen.</li>
          <li>Zugbindung beachten; bei erwarteter Zielverspätung ab 20 Minuten Alternativen prüfen.</li>
          <li>Ticket und Auftragscode offline verfügbar halten.</li>
          <li>{checkedAt ? `Zuletzt manuell geprüft: ${checkedAt}.` : "Noch nicht live geprüft."}</li>
        </ul>
      </details>
      </div>

      {status && (
        <section aria-live="polite" className="border-t border-white/70 bg-[#f1f7f3]/72 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#357179]">Live-Ergebnis</p>
              <h4 className="mt-1 text-lg font-black text-[#0e302e]">{status.train}</h4>
            </div>
            <span className={classNames("rounded-full px-3 py-1.5 text-xs font-black", railStatusClass(status))}>
              {railStatusLabel(status)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#789087]">Abfahrt</p>
              <p className="mt-1 font-black text-[#0e302e]">
                {status.departure.actual || status.departure.planned} · {delayLabel(status.departure.delayMinutes, status.realtime)}
              </p>
              <p className="mt-0.5 font-semibold text-[#5b6f68]">
                Gleis {status.departure.platform || status.departure.plannedPlatform || "unbekannt"}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#789087]">Ankunft</p>
              <p className="mt-1 font-black text-[#0e302e]">
                {status.arrival.actual || status.arrival.planned || leg.arr} · {delayLabel(status.arrival.delayMinutes, status.realtime)}
              </p>
              <p className="mt-0.5 font-semibold text-[#5b6f68]">
                Gleis {status.arrival.platform || status.arrival.plannedPlatform || "unbekannt"}
              </p>
            </div>
          </div>

          {(status.departure.platformChanged || status.arrival.platformChanged) && (
            <p className="mt-3 rounded-[14px] bg-[#fff0c9] px-3 py-2.5 text-sm font-black text-[#76510c]">
              Gleiswechsel erkannt. Bitte Beschilderung am Bahnhof beachten.
            </p>
          )}

          {status.recommendation && (
            <div className="mt-3 flex flex-col gap-2 rounded-[14px] bg-[#fff0c9] px-3 py-3 text-[#76510c] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-black leading-5">{status.recommendation}</p>
              <button
                className="min-h-10 shrink-0 rounded-[12px] bg-[#76510c] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                disabled={state?.alternativesLoading}
                onClick={() => void onFindAlternatives()}
                type="button"
              >
                Alternativen prüfen
              </button>
            </div>
          )}

          {status.alerts.length > 0 && (
            <div className="mt-3 border-t border-[#d7e3dc] pt-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Betriebsmeldungen</p>
              <div className="mt-2 grid gap-2">
                {status.alerts.map((alert) => (
                  <div key={`${alert.title}-${alert.description || ""}`}>
                    <p className="text-sm font-black text-[#0e302e]">{alert.title}</p>
                    {alert.description && <p className="mt-0.5 text-sm font-semibold leading-5 text-[#5b6f68]">{alert.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs font-semibold leading-5 text-[#789087]">{status.sourceNote}</p>
        </section>
      )}

      {alternatives && (
        <section aria-live="polite" className="border-t border-white/70 bg-white/58 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#357179]">Manuelle Suche</p>
              <h4 className="mt-1 text-lg font-black text-[#0e302e]">Alternative Verbindungen</h4>
            </div>
            <span className="text-sm font-black text-[#125f68]">{alternatives.alternatives.length}</span>
          </div>

          {alternatives.alternatives.length === 0 ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-[#5b6f68]">{alternatives.sourceNote}</p>
          ) : (
            <div className="mt-3 divide-y divide-[#d7e3dc]">
              {alternatives.alternatives.map((alternative) => (
                <div className="py-3 first:pt-0 last:pb-0" key={alternative.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black tabular-nums text-[#0e302e]">
                        {alternative.departure} → {alternative.arrival}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-[#357179]">
                        {alternative.trains.join(" · ") || "Bahnverbindung"}
                      </p>
                    </div>
                    <a
                      className="min-h-10 shrink-0 rounded-[12px] bg-[#125f68] px-3 py-2 text-xs font-black text-white"
                      href={alternative.bookingUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Öffnen
                    </a>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#5b6f68]">
                    {alternative.durationMinutes} Min. · {alternative.transfers === 0 ? "direkt" : `${alternative.transfers} Umstieg${alternative.transfers === 1 ? "" : "e"}`}
                    {alternative.fromPlatform ? ` · ab Gleis ${alternative.fromPlatform}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          {alternatives.alternatives.length > 0 && (
            <p className="mt-3 text-xs font-semibold leading-5 text-[#789087]">{alternatives.sourceNote}</p>
          )}
        </section>
      )}
    </article>
  );
}

function CopyOrderButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="rounded-[8px] bg-[#f1f5f2] px-4 py-3 text-sm font-black text-[#34554e] transition hover:bg-[#e3ece7]"
      onClick={copyCode}
      type="button"
    >
      {copied ? "Kopiert" : "Auftrag kopieren"}
    </button>
  );
}

function RouteCard({ route }: { route: RoutePlan }) {
  return (
    <article className="card-interactive flex min-h-[260px] flex-col rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{route.day}</p>
          <h3 className="mt-1 text-xl font-black text-[#0e302e]">{route.title}</h3>
        </div>
        <StatusPill>{route.cost}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {route.stops.map((stop) => (
          <span className="rounded-[8px] bg-[#eff6f2] px-2 py-1 text-xs font-bold text-[#34554e]" key={stop}>
            {stop}
          </span>
        ))}
      </div>
      <p className="mt-4 flex-1 text-sm font-semibold text-[#44635b]">{route.note}</p>
      <a
        className="mt-4 inline-flex justify-center rounded-[8px] btn-sheen bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
        href={route.maps}
        rel="noreferrer"
        target="_blank"
      >
        Route in Maps
      </a>
    </article>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const rating = googleRating(place.note);
  const ratingCount = readableText(place.note).match(/(\d[\d.]*)\s*Bewertung/)?.[1] ?? null;
  const isTop = normalizedText(place.priority).includes("top");
  const description = readableText(place.note).replace(/Google\s+\d[,.]\d.*$/i, "").trim();

  return (
    <article className="card-interactive flex flex-col gap-2.5 rounded-[14px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#eff6f2] text-[20px]">
          {tourismEmoji(`${place.category} ${place.title} ${place.effort}`)}
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-black leading-snug text-[#0e302e]">
            {readableText(place.title)} {isTop && <span title="Must-see">⭐</span>}
          </h3>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[#5b6f68]">
            {readableText(place.location) || "Kreta"} · {readableText(place.region)}
          </p>
        </div>
      </div>
      {description && (
        <p className="line-clamp-2 text-sm font-medium leading-6 text-[#44635b]">{description}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <SoftPill>{readableText(place.category)}</SoftPill>
        {place.effort && <SoftPill>{readableText(place.effort)}</SoftPill>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {rating !== null ? (
          <span className="text-sm font-black text-[#8a5b00]">
            ★ {rating.toFixed(1).replace(".", ",")}
            {ratingCount && <span className="font-bold text-[#789087]"> ({ratingCount})</span>}
          </span>
        ) : (
          <span />
        )}
        <a
          className="rounded-[10px] bg-[#e7f1ee] px-3.5 py-2.5 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
          href={place.maps}
          rel="noreferrer"
          target="_blank"
        >
          📍 Maps
        </a>
      </div>
    </article>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const rating = googleRating(restaurant.ratingHint);
  const ratingCount = readableText(restaurant.ratingHint).match(/(\d[\d.]*)\s*Bewertung/)?.[1] ?? null;
  const isTop = normalizedText(restaurant.priority).includes("top");
  const veggieText = normalizedText(restaurant.veggie);
  const cuisineShort = readableText(restaurant.cuisine).split(",")[0]?.trim() || "Restaurant";

  return (
    <article className="card-interactive flex flex-col gap-2.5 rounded-[14px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#eff6f2] text-[20px]">
          {restaurantEmoji(`${restaurant.cuisine} ${restaurant.veggie}`)}
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-black leading-snug text-[#0e302e]">
            {readableText(restaurant.name)} {isTop && <span title="Empfehlung">⭐</span>}
          </h3>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[#5b6f68]">
            {readableText(restaurant.place) || "Kreta"} · {readableText(restaurant.region)}
          </p>
        </div>
      </div>
      {restaurant.why && (
        <p className="line-clamp-2 text-sm font-medium leading-6 text-[#44635b]">{readableText(restaurant.why)}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <SoftPill>{cuisineShort}</SoftPill>
        {veggieText.includes("vegan") && <SoftPill>🥗 Vegan</SoftPill>}
        {restaurant.drive && <SoftPill>🚗 {readableText(restaurant.drive)}</SoftPill>}
        {restaurant.price && <SoftPill>{readableText(restaurant.price)}</SoftPill>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {rating !== null ? (
          <span className="text-sm font-black text-[#8a5b00]">
            ★ {rating.toFixed(1).replace(".", ",")}
            {ratingCount && <span className="font-bold text-[#789087]"> ({ratingCount})</span>}
          </span>
        ) : (
          <span />
        )}
        <a
          className="rounded-[10px] bg-[#e7f1ee] px-3.5 py-2.5 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
          href={restaurant.maps}
          rel="noreferrer"
          target="_blank"
        >
          📍 Maps
        </a>
      </div>
    </article>
  );
}

function SoftPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[8px] bg-[#eff6f2] px-2 py-1 text-xs font-bold text-[#34554e]">
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#789087]">{label}</p>
      <p className="mt-1 font-black text-[#0e302e]">{value}</p>
    </div>
  );
}

function SectionTitle({
  action,
  kicker,
  title,
}: {
  action?: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#357179]">{kicker}</p>
        <h2 className="mt-1 text-2xl font-black gradient-text">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function FilterPillGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              aria-pressed={active}
              className={classNames(
                "min-h-10 rounded-[8px] border px-3 py-2 text-sm font-black transition",
                active
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e] hover:border-[#8fb0a4] hover:bg-[#eff6f2]",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterLegend({ guideMode }: { guideMode: GuideMode }) {
  const items =
    guideMode === "restaurants"
      ? [
          ["Empfehlung", "Must-see = sehr stark, Sehr gut = klare Empfehlung, Optional = guter Füller"],
          ["Küche", "aus den Kategorien der beiden Restaurant-Blätter"],
          ["Veggie", "aus Kategorien und Details der deutschen Tabelle"],
        ]
      : [
          ["Kategorie", "aus dem Sehenswürdigkeiten-Blatt der neuen Excel-Datei"],
          ["Empfehlung", "Must-see = sehr stark, Sehr gut = klare Empfehlung, Optional = guter Füller"],
          ["Bereinigt", "Hotels, religiöse Orte, Shops, Gastronomie und Services werden hier ausgeblendet"],
        ];

  return (
    <div className="grid gap-2 text-xs font-semibold text-[#5f756d] sm:grid-cols-3">
      {items.map(([title, description]) => (
        <p className="rounded-[8px] bg-[#eff6f2] px-3 py-2" key={title}>
          <span className="font-black text-[#125f68]">{title}:</span> {description}
        </p>
      ))}
    </div>
  );
}

function ResetFilterButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      className={classNames(
        "h-11 shrink-0 rounded-[8px] px-4 text-sm font-black transition",
        active ? "bg-[#e7f4ee] text-[#125f68] hover:bg-[#dcebe3]" : "bg-[#eff3f1] text-[#91a49c]",
      )}
      disabled={!active}
      onClick={onClick}
      type="button"
    >
      Zurücksetzen
    </button>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={classNames(
        "h-9 min-w-0 truncate rounded-[8px] px-2 text-[13px] font-black transition sm:px-3 sm:text-sm",
        active ? "bg-[#125f68] text-white shadow-sm" : "text-[#42655d] hover:bg-[#e6eee9]",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SyncPill({ error, loading, sourceKind }: { error: boolean; loading: boolean; sourceKind: "supabase" | "fallback" }) {
  const offline = !loading && (error || sourceKind === "fallback");
  const label = loading ? "Lädt…" : offline ? "Offline · neu laden" : "Synchron";
  const dotClass = loading ? "bg-[#e7b53c] animate-pulse" : offline ? "bg-[#c2410c]" : "bg-[#1e7f4f]";

  return (
    <button
      aria-live="polite"
      className={classNames(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black shadow-sm backdrop-blur-xl sm:text-xs",
        offline ? "border-[#e4b2a1] bg-[#fff1eb]/84 text-[#8c3219]" : "border-white/70 bg-white/62 text-[#44635b]",
      )}
      onClick={offline ? () => window.location.reload() : undefined}
      type="button"
    >
      <span aria-hidden="true" className={classNames("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </button>
  );
}

function NavIcon({ view }: { view: View }) {
  const common = {
    "aria-hidden": true,
    className: "h-[21px] w-[21px]",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };
  switch (view) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9" />
        </svg>
      );
    case "kosten":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6.5" rx="7" ry="3" />
          <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
        </svg>
      );
    case "reise":
      return (
        <svg {...common}>
          <path d="M10.5 13.5 4 11l1.5-1.5L11 10l4.5-4.5a1.8 1.8 0 0 1 2.5 2.5L13.5 12.5l.5 5.5-1.5 1.5-2.5-6.5-3 3V19l-1.5 1L5 17l-3-.5 1-1.5h3z" />
        </svg>
      );
    case "routen":
      return (
        <svg {...common}>
          <circle cx="6" cy="19" r="2.2" />
          <circle cx="18" cy="5" r="2.2" />
          <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
        </svg>
      );
    case "karte":
      return (
        <svg {...common}>
          <path d="M12 21s-6.5-5.4-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.6 12 21 12 21Z" />
          <circle cx="12" cy="10.5" r="2.3" />
        </svg>
      );
    case "guide":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect height="12" rx="2.5" width="14" x="5" y="8" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2M9 12v4M15 12v4" />
        </svg>
      );
  }
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-[8px] bg-[#e7f4ee] px-2 py-1 text-xs font-black text-[#125f68]">
      {children}
    </span>
  );
}
