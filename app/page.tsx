"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
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
};

const views: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "kosten", label: "Kosten" },
  { id: "reise", label: "Reise" },
  { id: "routen", label: "Routen" },
  { id: "karte", label: "Karte" },
  { id: "guide", label: "Guide" },
  { id: "packen", label: "Packen" },
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

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function uniquePills(values: Array<string | undefined | null>) {
  return uniqueValues(values).slice(0, 4);
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
    "mezedopoleio crete",
    "cretangastronomy",
    "crete restaurant ramstein",
  ];
  return !blockedTerms.some((term) => text.includes(stripDiacritics(term.toLowerCase())));
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
}) {
  const durationConfig = routeDurationOptions.find((option) => option.value === duration) ?? routeDurationOptions[1];
  const mealConfig = mealPlanOptions.find((option) => option.value === mealPlan) ?? mealPlanOptions[0];
  const paceConfig = routePaceOptions.find((option) => option.value === pace) ?? routePaceOptions[1];
  const poiBudget = Math.max(1, Math.min(maxStops - mealConfig.meals, Math.round(durationConfig.stops * paceConfig.stopFactor)));
  const routeRadius = (lowStress ? 95 : duration === "intense" ? 210 : duration === "full" ? 165 : duration === "half" ? 115 : 70) * paceConfig.radiusFactor;
  const pointCandidates = places
    .map(placeToRoutePoint)
    .filter((point): point is RoutePoint => Boolean(point))
    .filter((point) => point.id !== start.id && point.id !== end.id)
    .filter((point) => distanceKm(start, point) + distanceKm(point, end) <= routeRadius * 2.25)
    .filter((point) => matchesRouteInterest(point, interests))
    .filter((point) => walkingLevel !== "low" || walkingMinutesForPoint(point, walkingLevel) <= 38)
    .sort((a, b) => {
      const aScore = priorityScore(a.priority) + (a.rating ?? 0) * 8 - distanceKm(start, a) * 0.25 - walkingMinutesForPoint(a, walkingLevel) * 0.08;
      const bScore = priorityScore(b.priority) + (b.rating ?? 0) * 8 - distanceKm(start, b) * 0.25 - walkingMinutesForPoint(b, walkingLevel) * 0.08;
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
        reason: routeReason(candidate, interests),
      });
    }
  }

  const orderedPoiRoute = orderRoutePoints(start, end, picked);
  const restaurantCandidates = restaurants
    .map(restaurantToRoutePoint)
    .filter((point): point is RoutePoint => Boolean(point))
    .filter((point) => distanceToRoute(point, orderedPoiRoute) <= (lowStress ? 12 : 22))
    .sort((a, b) => {
      const aScore = priorityScore(a.priority) + (a.rating ?? 0) * 9 - distanceToRoute(a, orderedPoiRoute) * 2;
      const bScore = priorityScore(b.priority) + (b.rating ?? 0) * 9 - distanceToRoute(b, orderedPoiRoute) * 2;
      return bScore - aScore;
    });

  const meals = restaurantCandidates.slice(0, mealConfig.meals).map((restaurant, index) => ({
    ...restaurant,
    stayMinutes: mealConfig.restaurantMinutes,
    reason: mealConfig.meals > 1 && index === 0 ? "Mittagspause nah an der Route." : "Essensstopp nah an der Route.",
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
  const [packed, setPacked] = useState<Record<string, boolean>>({});
  const [savedSmartRoutes, setSavedSmartRoutes] = useState<PlannedRoute[]>([]);
  const [smartRoutesLoaded, setSmartRoutesLoaded] = useState(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  const maxCategoryTotal = useMemo(
    () => Math.max(1, ...appState.categorySummary.map((category) => category.total)),
    [appState.categorySummary],
  );

  const packedCount = useMemo(
    () => appState.packItems.filter((item) => packed[item.id] || item.lucaDone || item.janDone).length,
    [appState.packItems, packed],
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

    if (view === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const top = Math.max((contentRef.current?.offsetTop ?? 0) - 72, 0);
    window.scrollTo({ top, behavior: "smooth" });
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ausgabe konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
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
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Ausgabe konnte nicht gelöscht werden.");
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Route konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 text-[#17201c]">
      <header className="sticky top-0 z-40 border-b border-[#d7e3dc] bg-[#fbfdf9]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            className="min-w-0 text-left"
            onClick={() => setView("home")}
            type="button"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#357179]">
              {trip.dates}
            </p>
            <h1 className="truncate text-lg font-black text-[#0e302e] sm:text-xl">
              {trip.title} · {trip.people}
            </h1>
          </button>
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

      <Hero daysLeft={daysLeft} onQuickExpense={() => setQuickExpenseOpen(true)} setView={setView} />

      <div ref={contentRef} className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {(loading || error) && (
          <div
            className={classNames(
              "mb-4 rounded-[8px] border px-4 py-3 text-sm font-bold",
              error
                ? "border-[#e4b2a1] bg-[#fff1eb] text-[#8c3219]"
                : "border-[#d7e3dc] bg-white text-[#44635b]",
            )}
          >
            {error || "Live-Backend wird geladen..."}
          </div>
        )}

        {view === "home" && (
          <HomeView
            dashboard={appState.dashboard}
            expenses={appState.expenses}
            flights={appState.flights}
            places={tourismPlaces}
            restaurants={creteRestaurants}
            routes={cleanBackendRoutes}
            onQuickExpense={() => setQuickExpenseOpen(true)}
            setView={setView}
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
            onDeleteExpense={deleteExpense}
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
          <PackView
            packItems={appState.packItems}
            packed={packed}
            packedCount={packedCount}
            setPacked={setPacked}
          />
        )}

        <footer className="mt-8 border-t border-[#d7e3dc] pt-5 text-sm text-[#5b6f68]">
          <p>
            Backend: {appState.source.kind === "supabase" ? "Supabase/Postgres live" : "lokaler Fallback"}.
            Startdaten aus {sheetSnapshot.source}, gelesen am {appState.source.sheetSeed}.
            Das Google Sheet wird nicht mehr beschrieben.
          </p>
          <p className="mt-2">Bild: Balos Beach, Wikimedia Commons, CC BY-SA 4.0.</p>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d7e3dc] bg-[#fbfdf9]/95 px-2 py-2 shadow-[0_-12px_30px_rgba(14,48,46,0.12)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-7 gap-1">
          {views.map((item) => (
            <button
              className={classNames(
                "h-12 rounded-[8px] px-1 text-[11px] font-bold transition",
                view === item.id
                  ? "bg-[#125f68] text-white"
                  : "text-[#44635b] hover:bg-[#e6eee9]",
              )}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <QuickExpenseLauncher onClick={() => setQuickExpenseOpen(true)} saving={saving} />
      <QuickExpenseSheet
        onClose={() => setQuickExpenseOpen(false)}
        onCreateExpense={createExpense}
        open={quickExpenseOpen}
        saving={saving}
      />
    </main>
  );
}

function Hero({
  daysLeft,
  onQuickExpense,
  setView,
}: {
  daysLeft: number | null;
  onQuickExpense: () => void;
  setView: (view: View) => void;
}) {
  const countdown =
    daysLeft === null
      ? "bald"
      : daysLeft > 1
      ? `${daysLeft} Tage`
      : daysLeft === 1
        ? "morgen"
        : daysLeft === 0
          ? "heute"
          : "unterwegs";

  return (
    <section className="relative overflow-hidden border-b border-[#c9d9d1]">
      <div className="absolute inset-0">
        <img alt="Balos Beach auf Kreta" className="h-full w-full object-cover" src={heroImage} />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,35,36,0.9),rgba(15,81,84,0.72)_44%,rgba(255,242,219,0.18))]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-5 px-4 py-8 text-white sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b8f4eb]">
            {trip.hotel}
          </p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black leading-[0.98] sm:text-6xl">
            Kreta läuft.
            <span className="block text-[#ffe1a8]">Jan & Luca ready.</span>
          </h2>
          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-white/86">
            Reisecenter, Karte, Guide, Smart-Routen und Vor-Ort-Kosten in einer App.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <HeroAction onClick={() => setView("routen")}>Smart Route planen</HeroAction>
            <HeroAction onClick={() => setView("karte")}>Karte öffnen</HeroAction>
            <button
              className="inline-flex h-11 items-center rounded-[8px] bg-[#ffe1a8] px-4 text-sm font-black text-[#0e302e] shadow-sm transition hover:bg-[#ffd585]"
              onClick={onQuickExpense}
              type="button"
            >
              + Ausgabe
            </button>
            <a
              className="inline-flex h-11 items-center rounded-[8px] border border-white/40 bg-white/10 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
              href={trip.hotelMaps}
              rel="noreferrer"
              target="_blank"
            >
              Hotel in Maps
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[0.72fr_1fr] lg:items-end">
          <div className="overflow-hidden rounded-[8px] border border-white/24 bg-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur">
            <img alt="Jan und Luca auf Kreta" className="aspect-[4/5] h-full w-full object-cover" src={janLucaImage} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroMetric label="Start" value={countdown} />
            <HeroMetric label="Basis" value="Frangokastello" />
            <HeroMetric label="Hinflug" value="FR 7910" />
            <HeroMetric label="Guide" value="Kreta only" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeView({
  dashboard,
  expenses,
  flights,
  onQuickExpense,
  places,
  restaurants,
  routes,
  setView,
}: {
  dashboard: DashboardState;
  expenses: ExpenseItem[];
  flights: Flight[];
  onQuickExpense: () => void;
  places: Place[];
  restaurants: Restaurant[];
  routes: RoutePlan[];
  setView: (view: View) => void;
}) {
  const outboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("hin")) ?? flights[0];
  const latestExpense = expenses[0];
  const dashboardActions = [
    { title: "Smart Route", text: "Tagesplan mit Stopps, Essen und Maps-Link bauen.", action: () => setView("routen") },
    { title: "Karte", text: "POIs, Restaurants, Hotel und Routen live sehen.", action: () => setView("karte") },
    { title: "Reise", text: "Bahn, Flug, Tickets und DB-Checks an einem Ort.", action: () => setView("reise") },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <SectionTitle kicker="Heute nützlich" title="Was wollt ihr machen?" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {dashboardActions.map((item) => (
              <button
                className="min-h-[132px] rounded-[8px] border border-[#d7e3dc] bg-[#f8fbf9] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8fb0a4] hover:bg-white hover:shadow-md"
                key={item.title}
                onClick={item.action}
                type="button"
              >
                <p className="text-base font-black text-[#0e302e]">{item.title}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#5b6f68]">{item.text}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[8px] border border-[#d7e3dc] bg-[#0e302e] p-4 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#9de7dc]">Live-Kosten</p>
          <p className="mt-2 text-3xl font-black">{money(dashboard.onTrip.amount)}</p>
          <p className="mt-1 text-sm font-semibold text-white/72">
            {latestExpense ? `Zuletzt: ${latestExpense.category} · ${money(latestExpense.amount)}` : "Noch keine Vor-Ort-Ausgabe."}
          </p>
          <button
            className="mt-4 h-11 w-full rounded-[8px] bg-[#ffe1a8] px-4 text-sm font-black text-[#0e302e] transition hover:bg-[#ffd585]"
            onClick={onQuickExpense}
            type="button"
          >
            + Ausgabe hinzufügen
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-[8px] border border-[#d7e3dc] bg-white shadow-sm">
          <img alt="Jan und Luca auf Kreta" className="h-72 w-full object-cover object-[50%_30%]" src={janLucaImage} />
          <div className="p-4">
            <SectionTitle kicker="Crew" title="Jan & Luca" />
            <p className="mt-3 text-sm font-semibold leading-6 text-[#5b6f68]">
              Schnelle Kosten, gute Stopps, echte Kreta-Orte und genug Luft für spontane Strandentscheidungen.
            </p>
          </div>
        </div>
        <div className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <SectionTitle
            action={<MiniLink onClick={() => setView("reise")}>Timeline</MiniLink>}
            kicker="Nächste Reise"
            title={outboundFlight ? `${outboundFlight.number} · ${outboundFlight.dep}` : "Flug und Bahn"}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStatusCard label="Guide" value={`${places.length} Orte`} detail="ohne Hotels, religiöse Orte, Shops" />
            <MiniStatusCard label="Restaurants" value={`${restaurants.length}`} detail="Kreta-Daten, Ausreißer entfernt" />
            <MiniStatusCard label="Hotel" value="Anthos" detail="Basis für Routen & Karte" />
            <MiniStatusCard label="Ausgleich" value={money(dashboard.settlementAmount)} detail={dashboard.settlementText} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <SectionTitle
            action={<MiniLink onClick={() => setView("routen")}>Alle</MiniLink>}
            kicker="Smart Planer"
            title="Routen statt alte Ideen"
          />
          <div className="mt-4 grid gap-3">
            <RouteMini
              route={{
                id: "smart-home-1",
                day: "Kreta",
                title: "Plan aus echten POIs bauen",
                stops: ["Startzeit", "Mahlzeiten", "Laufen", "Alternativen"],
                cost: "Smart",
                status: "Neu",
                note: "Die alten Backend-Ideen sind ausgeblendet; neue Routen entstehen im Smart Planer.",
                maps: trip.hotelMaps,
              }}
            />
            {routes.filter((route) => route.status === "Smart").slice(0, 2).map((route) => (
              <RouteMini route={route} key={route.id} />
            ))}
          </div>
        </div>
        <div className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <SectionTitle
            action={<MiniLink onClick={() => setView("guide")}>Guide</MiniLink>}
            kicker="Entdecken"
            title="Schnellzugriff"
          />
          <div className="mt-4 grid gap-3">
            {outboundFlight && <FlightRow flight={outboundFlight} />}
            <button
              className="rounded-[8px] bg-[#eff6f2] p-3 text-left text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
              onClick={() => setView("karte")}
              type="button"
            >
              Karte mit Hotel, Restaurants und POIs öffnen
            </button>
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
  onDeleteExpense,
  saving,
}: {
  categorySummary: CategorySummaryItem[];
  dashboard: DashboardState;
  expenses: ExpenseItem[];
  fixedCosts: FixedCost[];
  maxCategoryTotal: number;
  onCreateExpense: (input: NewExpenseInput) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <BalancePanel dashboard={dashboard} />
        <div className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
          <SectionTitle kicker="Abrechnung" title="Live-Summen" />
          <div className="mt-4 grid gap-3">
            {categorySummary.map((item) => (
              <CategoryBar category={item} key={item.name} max={maxCategoryTotal} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <ExpenseForm onCreateExpense={onCreateExpense} saving={saving} title="Ausgabe eintragen" />

        <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
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
                onDelete={() => onDeleteExpense(expense.id)}
                saving={saving}
              />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fixedCosts.map((cost) => (
          <FixedCostCard cost={cost} key={`${cost.area}-${cost.kind}`} />
        ))}
      </section>
    </div>
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
  onCreateExpense: (input: NewExpenseInput) => Promise<void>;
  saving: boolean;
  title: string;
}) {
  const [travelDay, setTravelDay] = useState(lists.travelDays[0] ?? "Mi, 01.07.");
  const [category, setCategory] = useState(lists.categories[0] ?? "Tanken");
  const [paidBy, setPaidBy] = useState<"Luca" | "Jan">("Jan");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [splitPreset, setSplitPreset] = useState<SplitPreset>("50_50");
  const [customLuca, setCustomLuca] = useState(50);
  const selectedSplit = expenseSplitOptions.find((option) => option.value === splitPreset) ?? expenseSplitOptions[0];
  const splitLuca = splitPreset === "custom" ? Math.max(0, Math.min(100, customLuca)) / 100 : selectedSplit.luca;
  const splitJan = splitPreset === "custom" ? 1 - splitLuca : selectedSplit.jan;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    await onCreateExpense({
      travelDay,
      category,
      amount: parsed,
      paidBy,
      splitMode: selectedSplit.label,
      splitLuca,
      splitJan,
      note,
    });
    setAmount("");
    setNote("");
    setSplitPreset("50_50");
    setCustomLuca(50);
    onSaved?.();
  }

  return (
    <form
      className={classNames(
        "rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm",
        compact && "border-white/20 bg-white shadow-none",
      )}
      onSubmit={submit}
    >
      <SectionTitle kicker="Vor Ort" title={title} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-[#34554e]">
          Reisetag
          <select
            className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-[#0e302e]"
            onChange={(event) => setTravelDay(event.target.value)}
            value={travelDay}
          >
            {lists.travelDays.map((day) => (
              <option key={day}>{day}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold text-[#34554e]">
          Kategorie
          <select
            className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-[#0e302e]"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {lists.categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold text-[#34554e]">
          Betrag
          <input
            className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-[#0e302e]"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="z.B. 62,40"
            required
            value={amount}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-[#34554e]">
          Bezahlt von
          <select
            className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-[#0e302e]"
            onChange={(event) => setPaidBy(event.target.value as "Luca" | "Jan")}
            value={paidBy}
          >
            <option>Luca</option>
            <option>Jan</option>
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Aufteilen</p>
        <div className="flex flex-wrap gap-2">
          {expenseSplitOptions.map((option) => (
            <button
              aria-pressed={splitPreset === option.value}
              className={classNames(
                "min-h-10 rounded-[8px] border px-3 py-2 text-sm font-black transition",
                splitPreset === option.value
                  ? "border-[#125f68] bg-[#125f68] text-white shadow-sm"
                  : "border-[#cbdad2] bg-white text-[#34554e] hover:border-[#8fb0a4] hover:bg-[#eff6f2]",
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
          <div className="grid gap-2 rounded-[8px] bg-[#eff6f2] p-3">
            <label className="grid gap-2 text-sm font-bold text-[#34554e]">
              Luca-Anteil: {Math.round(splitLuca * 100)}% · Jan-Anteil: {Math.round(splitJan * 100)}%
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
      <label className="mt-3 grid gap-1 text-sm font-bold text-[#34554e]">
        Notiz
        <input
          className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-[#0e302e]"
          onChange={(event) => setNote(event.target.value)}
          placeholder="z.B. Tanken Chora Sfakion"
          value={note}
        />
      </label>
      <button
        className="mt-4 h-11 w-full rounded-[8px] bg-[#125f68] px-4 text-sm font-black text-white transition hover:bg-[#0e4d54] disabled:cursor-wait disabled:opacity-60"
        disabled={saving}
        type="submit"
      >
        {saving ? "Speichere..." : "Speichern & verrechnen"}
      </button>
    </form>
  );
}

function QuickExpenseLauncher({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      className="group fixed bottom-20 right-4 z-[60] flex h-14 items-center gap-2 overflow-hidden rounded-[8px] bg-[#0e302e] px-4 text-sm font-black text-white shadow-[0_18px_44px_rgba(14,48,46,0.28)] transition hover:w-auto hover:bg-[#125f68] md:bottom-6"
      disabled={saving}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#ffe1a8] text-lg text-[#0e302e]">+</span>
      <span className="max-w-0 whitespace-nowrap opacity-0 transition-all group-hover:max-w-28 group-hover:opacity-100 sm:max-w-28 sm:opacity-100">
        Ausgabe
      </span>
    </button>
  );
}

function QuickExpenseSheet({
  onClose,
  onCreateExpense,
  open,
  saving,
}: {
  onClose: () => void;
  onCreateExpense: (input: NewExpenseInput) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#082324]/45 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl rounded-[8px] bg-white p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#357179]">Schnell eintragen</p>
          <button
            className="rounded-[8px] bg-[#eff6f2] px-3 py-2 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
            onClick={onClose}
            type="button"
          >
            Schließen
          </button>
        </div>
        <ExpenseForm compact onCreateExpense={onCreateExpense} onSaved={onClose} saving={saving} title="+ Ausgabe" />
      </div>
    </div>
  );
}

function TravelView({ flights, trains }: { flights: Flight[]; trains: TrainLeg[] }) {
  const [activeTab, setActiveTab] = useState("outbound-trains");
  const [liveCheckedAt, setLiveCheckedAt] = useState("");
  const outboundTrains = trains.filter((leg) => stripDiacritics(normalizedText(leg.direction)).includes("hin"));
  const inboundTrains = trains.filter((leg) => stripDiacritics(normalizedText(leg.direction)).includes("ruck"));
  const outboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("hin")) ?? flights[0];
  const inboundFlight = flights.find((flight) => stripDiacritics(normalizedText(flight.direction)).includes("ruck")) ?? flights[1];
  const tabs = [
    { id: "outbound-trains", label: "Hin-Züge" },
    { id: "outbound-flight", label: "Hin-Flug" },
    { id: "inbound-flight", label: "Rück-Flug" },
    { id: "inbound-trains", label: "Rück-Züge" },
  ];

  return (
    <div className="grid gap-5">
      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle kicker="Reise-Zentrale" title="Reise" />
          <button
            className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
            onClick={() =>
              setLiveCheckedAt(
                new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
              )
            }
            type="button"
          >
            DB-Live prüfen
          </button>
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
        <p className="mt-3 text-sm font-semibold text-[#5b6f68]">
          {liveCheckedAt
            ? `DB-Check vorbereitet: ${liveCheckedAt}. Status/Alternativen werden nur über die Buttons geöffnet.`
            : "Live-Daten werden nicht im Hintergrund geladen. Erst der Button öffnet die manuelle Prüfung."}
        </p>
      </section>

      {activeTab === "outbound-trains" && (
        <section className="grid gap-4 lg:grid-cols-2">
          {outboundTrains.map((leg) => (
            <TrainLegCard key={leg.id} leg={leg} liveCheckedAt={liveCheckedAt} />
          ))}
        </section>
      )}

      {activeTab === "inbound-trains" && (
        <section className="grid gap-4 lg:grid-cols-2">
          {inboundTrains.map((leg) => (
            <TrainLegCard key={leg.id} leg={leg} liveCheckedAt={liveCheckedAt} />
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
            className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
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
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const startPoint = selectablePoints.find((point) => point.id === startId) ?? hotelPoint;
  const endPoint = selectablePoints.find((point) => point.id === endId) ?? hotelPoint;

  function toggleInterest(interest: RouteInterestId) {
    setInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest],
    );
  }

  function generateRoute() {
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
    <div className="grid gap-5">
      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle kicker="Smart Route planen" title="Tagesroute automatisch bauen" />
          <button
            className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
            onClick={generateRoute}
            type="button"
          >
            Route berechnen
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          <FilterPillGroup label="Reisetag" onChange={setDay} options={travelDayOptions} value={day} />
          <div className="grid gap-4 lg:grid-cols-[0.7fr_1fr_1fr]">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">Start-Uhrzeit</span>
              <input
                className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
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
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-black text-[#0e302e]">
              Max. Fahrzeit
              <input
                className="h-11 rounded-[8px] border border-[#cbdad2] px-3 text-sm outline-none focus:border-[#125f68]"
                min={45}
                onChange={(event) => setMaxDriveMinutes(Number(event.target.value))}
                type="number"
                value={maxDriveMinutes}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-[#0e302e]">
              Max. Stopps
              <input
                className="h-11 rounded-[8px] border border-[#cbdad2] px-3 text-sm outline-none focus:border-[#125f68]"
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
          </div>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <Fact label="Dauer" value={formatDuration(plannedRoute.totalMinutes)} />
            <Fact label="Fahrt" value={formatDuration(plannedRoute.driveMinutes)} />
            <Fact label="Laufen" value={formatDuration(plannedRoute.walkMinutes)} />
            <Fact label="Distanz" value={formatKm(plannedRoute.totalKm)} />
            <Fact label="Stress" value={plannedRoute.stress} />
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
                className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
                href={link}
                key={link}
                rel="noreferrer"
                target="_blank"
              >
                Maps-Route {plannedRoute.mapsLinks.length > 1 ? index + 1 : "öffnen"}
              </a>
            ))}
          </div>
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
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
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
    <article className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
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
        className="mt-4 inline-flex rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
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
            L.polyline(latLngs, { color: "#125f68", opacity: 0.72, weight: 4 }).addTo(map);
            routePoints.forEach((point, index) => {
              L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:#125f68;color:white;font-size:12px;font-weight:900">${index + 1}</span>`,
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
              className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
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
              className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
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
    <div className="grid gap-5">
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
          className="h-11 rounded-[8px] border border-[#cbdad2] bg-white px-3 text-sm font-bold text-[#0e302e] outline-none transition focus:border-[#125f68]"
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
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </section>
      )}
    </div>
  );
}

function PackView({
  packItems,
  packed,
  packedCount,
  setPacked,
}: {
  packItems: PackItem[];
  packed: Record<string, boolean>;
  packedCount: number;
  setPacked: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const progress = Math.round((packedCount / packItems.length) * 100);

  return (
    <div className="grid gap-5">
      <section className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
        <SectionTitle kicker="Packliste" title={`${packedCount}/${packItems.length} erledigt`} />
        <div className="mt-4 h-3 overflow-hidden rounded-[8px] bg-[#e4ece7]">
          <div className="h-full rounded-[8px] bg-[#125f68] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {packItems.map((item) => {
          const checked = Boolean(packed[item.id] || item.lucaDone || item.janDone);
          return (
            <label
              className={classNames(
                "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-[8px] border p-4 shadow-sm transition",
                checked ? "border-[#9fd1c1] bg-[#edf7f1]" : "border-[#d7e3dc] bg-white hover:border-[#b7cdc3]",
              )}
              key={item.id}
            >
              <input
                checked={checked}
                className="mt-1 h-5 w-5 accent-[#125f68]"
                onChange={() =>
                  setPacked((current) => ({
                    ...current,
                    [item.id]: !checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <span className="block text-base font-black text-[#0e302e]">{item.item}</span>
                <span className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[#5b6f68]">
                  <span>{item.category}</span>
                  <span>{item.bag}</span>
                  <span>{item.importance}</span>
                </span>
                {item.note && <span className="mt-2 block text-sm font-medium text-[#44635b]">{item.note}</span>}
              </span>
            </label>
          );
        })}
      </section>
    </div>
  );
}

function BalancePanel({ dashboard }: { dashboard: DashboardState }) {
  return (
    <section className="rounded-[8px] border border-[#125f68]/20 bg-[#0f3d3f] p-5 text-white shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9fe0d5]">
        Aktueller Ausgleich
      </p>
      <h3 className="mt-3 text-4xl font-black">{dashboard.settlementText}</h3>
      <p className="mt-2 text-6xl font-black leading-none">{money(dashboard.settlementAmount)}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[8px] bg-white/10 p-3">
          <p className="font-bold text-[#b8f4eb]">Luca Anteil</p>
          <p className="mt-1 text-xl font-black">{money(dashboard.lucaShare)}</p>
        </div>
        <div className="rounded-[8px] bg-white/10 p-3">
          <p className="font-bold text-[#b8f4eb]">Jan Anteil</p>
          <p className="mt-1 text-xl font-black">{money(dashboard.janShare)}</p>
        </div>
      </div>
    </section>
  );
}

function MiniStatusCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#eff6f2] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0e302e]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[#5b6f68]">{detail}</p>
    </div>
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
        <div>
          <p className="font-black text-[#0e302e]">{category.name}</p>
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
  const balanceLabel =
    expense.lucaBalance < 0
      ? `Luca an Jan ${money(Math.abs(expense.lucaBalance))}`
      : expense.lucaBalance > 0
        ? `Jan an Luca ${money(expense.lucaBalance)}`
        : "ausgeglichen";

  return (
    <article className="rounded-[8px] bg-[#eff6f2] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#357179]">{expense.travelDay}</p>
          <h3 className="text-lg font-black text-[#0e302e]">{expense.category}</h3>
        </div>
        <p className="shrink-0 text-lg font-black text-[#0e302e]">{money(expense.amount)}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#44635b]">
        Bezahlt von {expense.paidBy} · {balanceLabel}
      </p>
      {expense.note && <p className="mt-1 text-sm font-medium text-[#5b6f68]">{expense.note}</p>}
      <button
        className="mt-3 rounded-[8px] border border-[#cbdad2] bg-white px-3 py-2 text-xs font-black text-[#8c3219] disabled:opacity-60"
        disabled={saving}
        onClick={onDelete}
        type="button"
      >
        Löschen
      </button>
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
    <article className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
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
    <div className="flex aspect-[16/5] w-full items-center justify-center overflow-hidden rounded-[8px] border border-[#d7e3dc] bg-[#f7faf8]">
      {src ? (
        <img alt={alt} className="h-full w-full object-contain p-2" src={src} />
      ) : (
        <span className="text-sm font-black text-[#789087]">Kein Fahrzeugbild</span>
      )}
    </div>
  );
}

function FlightCard({ flight }: { flight: Flight }) {
  const image = flightVehicleImage(flight);

  return (
    <article className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
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
        <Fact label="Status" value="Direktflug · manuell prüfen" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
          href={flight.manageUrl}
          rel="noreferrer"
          target="_blank"
        >
          Buchung öffnen
        </a>
        <a
          className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
          href={`https://www.google.com/search?q=${encodeURIComponent(`${flight.number} ${flight.date} flight status`)}`}
          rel="noreferrer"
          target="_blank"
        >
          Status prüfen
        </a>
      </div>
    </article>
  );
}

function FlightRow({ flight }: { flight: Flight }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] bg-[#eff6f2] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#0e302e]">
          {flight.direction}: {flight.number}
        </p>
        <p className="text-sm font-semibold text-[#5b6f68]">
          {flight.from} → {flight.to}
        </p>
      </div>
      <p className="shrink-0 text-sm font-black text-[#0e302e]">{flight.dep}</p>
    </div>
  );
}

function TrainLegCard({ leg, liveCheckedAt }: { leg: TrainLeg; liveCheckedAt?: string }) {
  const orderCode = trainOrderCode(leg);
  const connectionUrl = bahnConnectionUrl(leg);

  return (
    <article className="rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <VehicleImage alt={leg.train} src={trainVehicleImage(leg)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{leg.direction}</p>
          <h3 className="mt-1 truncate text-xl font-black text-[#0e302e]">{leg.section}</h3>
          <p className="mt-1 text-sm font-bold text-[#357179]">{leg.train}</p>
        </div>
        <StatusPill>{liveCheckedAt ? "geprüft" : "offen"}</StatusPill>
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
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className="rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
          href={connectionUrl}
          rel="noreferrer"
          target="_blank"
        >
          DB-Status
        </a>
        <a
          className="rounded-[8px] bg-[#e7f4ee] px-4 py-3 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
          href={connectionUrl}
          rel="noreferrer"
          target="_blank"
        >
          Alternativen prüfen
        </a>
        <CopyOrderButton code={orderCode} />
      </div>
      <details className="mt-4 rounded-[8px] bg-[#eff6f2] p-3">
        <summary className="cursor-pointer text-sm font-black text-[#0e302e]">Details & Bahn-Checkliste</summary>
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-[#44635b]">
          <li>Gleiswechsel prüfen, sobald DB-Live geöffnet wurde.</li>
          <li>Zugbindung beachten; bei erwarteter Zielverspätung ab 20 Minuten Alternativen prüfen.</li>
          <li>Ticket und Auftragscode offline verfügbar halten.</li>
          <li>{liveCheckedAt ? `Zuletzt manuell angestoßen: ${liveCheckedAt}.` : "Noch nicht live geprüft."}</li>
        </ul>
      </details>
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
    <article className="flex min-h-[260px] flex-col rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
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
        className="mt-4 inline-flex justify-center rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
        href={route.maps}
        rel="noreferrer"
        target="_blank"
      >
        Route in Maps
      </a>
    </article>
  );
}

function RouteMini({ route }: { route: RoutePlan }) {
  return (
    <div className="rounded-[8px] bg-[#eff6f2] p-3">
      <p className="text-sm font-bold text-[#357179]">{route.day}</p>
      <p className="mt-1 font-black text-[#0e302e]">{route.title}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#44635b]">
        {route.stops.join(" · ")}
      </p>
    </div>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const pills = uniquePills([place.category, place.effort, place.cost]);

  return (
    <article className="flex min-h-[250px] flex-col rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">{readableText(place.region)}</p>
          <h3 className="mt-1 text-xl font-black text-[#0e302e]">{place.title}</h3>
        </div>
        <StatusPill>{place.priority}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((item) => (
          <span className="rounded-[8px] bg-[#eff6f2] px-2 py-1 text-xs font-bold text-[#34554e]" key={item}>
            {readableText(item)}
          </span>
        ))}
      </div>
      {place.location && (
        <div className="mt-3 flex flex-wrap gap-2">
          <SoftPill>{readableText(place.location)}</SoftPill>
        </div>
      )}
      <p className="mt-4 flex-1 text-sm font-semibold text-[#44635b]">{readableText(place.note)}</p>
      <a
        className="mt-4 inline-flex justify-center rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
        href={place.maps}
        rel="noreferrer"
        target="_blank"
      >
        Maps öffnen
      </a>
    </article>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const status = restaurant.price || restaurant.priority;

  return (
    <article className="flex min-h-[270px] flex-col rounded-[8px] border border-[#d7e3dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#357179]">
            {readableText(restaurant.region)}
          </p>
          <h3 className="mt-1 text-xl font-black text-[#0e302e]">{restaurant.name}</h3>
        </div>
        {status && <StatusPill>{readableText(status)}</StatusPill>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {restaurant.ratingHint && <SoftPill>{readableText(restaurant.ratingHint)}</SoftPill>}
        {restaurant.veggie && <SoftPill>{readableText(restaurant.veggie)}</SoftPill>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Fact label="Ort" value={readableText(restaurant.place)} />
        <Fact label="Küche" value={readableText(restaurant.cuisine)} />
        <Fact label="Veggie" value={readableText(restaurant.veggie)} />
        <Fact label="Fahrt" value={readableText(restaurant.drive)} />
      </div>
      <p className="mt-4 flex-1 text-sm font-semibold text-[#44635b]">{readableText(restaurant.why)}</p>
      <a
        className="mt-4 inline-flex justify-center rounded-[8px] bg-[#125f68] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e4d54]"
        href={restaurant.maps}
        rel="noreferrer"
        target="_blank"
      >
        Maps öffnen
      </a>
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

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/20 bg-white/12 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-bold text-[#b8f4eb]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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
        <h2 className="mt-1 text-2xl font-black text-[#0e302e]">{title}</h2>
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
        "h-9 rounded-[8px] px-3 text-sm font-black transition",
        active ? "bg-[#125f68] text-white shadow-sm" : "text-[#42655d] hover:bg-[#e6eee9]",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function HeroAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-11 items-center rounded-[8px] bg-white px-4 text-sm font-black text-[#0e302e] shadow-sm transition hover:bg-[#e6eee9]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MiniLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-[8px] bg-[#eff6f2] px-3 py-2 text-sm font-black text-[#125f68] transition hover:bg-[#dcebe3]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-[8px] bg-[#e7f4ee] px-2 py-1 text-xs font-black text-[#125f68]">
      {children}
    </span>
  );
}
