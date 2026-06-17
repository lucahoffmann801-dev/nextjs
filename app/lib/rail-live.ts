import "server-only";

import type {
  RailAlert,
  RailAlternative,
  RailAlternativesResult,
  RailLegLookup,
  RailStatusResult,
} from "./rail-live-types";

const providerName = "Transitous / MOTIS";
const defaultBaseUrl = "https://api.transitous.org";
const defaultTimeZone = "Europe/Berlin";
const requestTimeoutMs = 12_000;
const stationCache = new Map<string, { id: string; name: string }>();

type TransitousPlace = {
  type?: string;
  id?: string;
  name?: string;
  modes?: string[];
  importance?: number;
};

type TransitousAlert = {
  headerText?: string;
  descriptionText?: string;
  severityLevel?: string;
  effect?: string;
  url?: string;
};

type TransitousStop = {
  name?: string;
  stopId?: string;
  departure?: string;
  scheduledDeparture?: string;
  arrival?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
  cancelled?: boolean;
};

type TransitousLeg = {
  mode?: string;
  from?: TransitousStop;
  to?: TransitousStop;
  duration?: number;
  realTime?: boolean;
  displayName?: string;
  tripShortName?: string;
  headsign?: string;
  tripId?: string;
  cancelled?: boolean;
  alerts?: TransitousAlert[];
};

type TransitousItinerary = {
  id?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: TransitousLeg[];
};

type TransitousPlan = {
  itineraries?: TransitousItinerary[];
};

function normalized(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/hauptbahnhof/g, "hbf")
    .replace(/bahnhof/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trainNumber(value: string | undefined) {
  return (value ?? "").match(/\d+/)?.[0] ?? "";
}

function minutesBetween(actual?: string, planned?: string) {
  if (!actual || !planned) return null;
  const difference = Math.round((new Date(actual).getTime() - new Date(planned).getTime()) / 60_000);
  return Number.isFinite(difference) ? difference : null;
}

function timeLabel(value?: string, timeZone = defaultTimeZone) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function parseDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const german = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (german) return `${german[3]}-${german[2]}-${german[1]}`;
  throw new Error("Das Reisedatum konnte nicht gelesen werden.");
}

function timeZoneOffset(date: string, timeZone: string) {
  const reference = new Date(`${date}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(reference)
    .find((item) => item.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}

function plannedIso(input: RailLegLookup, minutesShift = 0) {
  const date = parseDate(input.date);
  const offset = timeZoneOffset(date, input.timeZone || defaultTimeZone);
  const dateTime = new Date(`${date}T${input.plannedDeparture}:00${offset}`);
  if (Number.isNaN(dateTime.getTime())) throw new Error("Die geplante Abfahrtszeit ist ungültig.");
  dateTime.setMinutes(dateTime.getMinutes() + minutesShift);
  return dateTime.toISOString();
}

function bookingUrl(input: RailLegLookup, departure: string) {
  const date = new Date(departure);
  const params = new URLSearchParams({
    S: input.from,
    Z: input.to,
    date: new Intl.DateTimeFormat("sv-SE", { timeZone: input.timeZone || defaultTimeZone }).format(date),
    time: new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: input.timeZone || defaultTimeZone,
    }).format(date),
  });
  return `https://www.bahn.de/buchung/start?${params.toString()}`;
}

function apiBaseUrl() {
  return (process.env.RAIL_API_BASE_URL || defaultBaseUrl).replace(/\/$/, "");
}

async function providerFetch<T>(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          process.env.RAIL_API_USER_AGENT ||
          "Kreta-Reise-App/1.0 (+https://nextjs-blush-five-13.vercel.app/)",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Bahn-Datenquelle antwortet mit HTTP ${response.status}.`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Die Bahn-Datenquelle hat zu lange gebraucht.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isRailPlace(place: TransitousPlace) {
  return (place.modes ?? []).some((mode) =>
    ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL", "REGIONAL_RAIL", "SUBURBAN"].includes(mode),
  );
}

async function resolveStation(name: string, suppliedId?: string) {
  if (suppliedId) return { id: suppliedId, name };
  const cacheKey = normalized(name);
  const cached = stationCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    text: name,
    type: "STOP",
    language: "de",
  });
  const places = await providerFetch<TransitousPlace[]>(`/api/v1/geocode?${params.toString()}`);
  const candidates = places
    .filter((place) => place.type === "STOP" && place.id && place.name)
    .sort((left, right) => {
      const leftName = normalized(left.name);
      const rightName = normalized(right.name);
      const target = normalized(name);
      const leftScore = (leftName === target ? 100 : leftName.includes(target) ? 50 : 0) + (isRailPlace(left) ? 30 : 0) + (left.importance ?? 0);
      const rightScore = (rightName === target ? 100 : rightName.includes(target) ? 50 : 0) + (isRailPlace(right) ? 30 : 0) + (right.importance ?? 0);
      return rightScore - leftScore;
    });
  const station = candidates[0];
  if (!station?.id || !station.name) throw new Error(`Bahnhof "${name}" wurde nicht eindeutig gefunden.`);
  const result = { id: station.id, name: station.name };
  stationCache.set(cacheKey, result);
  return result;
}

function transitLegs(plan: TransitousPlan) {
  return (plan.itineraries ?? []).flatMap((itinerary) =>
    (itinerary.legs ?? [])
      .filter((leg) => Boolean(leg.tripId || leg.displayName || leg.tripShortName))
      .map((leg) => ({ itinerary, leg })),
  );
}

function legName(leg: TransitousLeg) {
  return leg.displayName || leg.tripShortName || "";
}

function matchScore(input: RailLegLookup, leg: TransitousLeg) {
  const requestedTrain = normalized(input.train);
  const candidateTrain = normalized(legName(leg));
  const requestedNumber = trainNumber(input.train);
  const candidateNumber = trainNumber(legName(leg));
  let score = 0;
  if (requestedTrain && candidateTrain === requestedTrain) score += 100;
  else if (requestedNumber && candidateNumber === requestedNumber) score += 70;
  else if (requestedTrain && candidateTrain.includes(requestedTrain)) score += 45;

  const from = normalized(leg.from?.name);
  const to = normalized(leg.to?.name);
  if (from && (from.includes(normalized(input.from)) || normalized(input.from).includes(from))) score += 18;
  if (to && (to.includes(normalized(input.to)) || normalized(input.to).includes(to))) score += 18;

  const plannedDeparture = leg.from?.scheduledDeparture;
  if (plannedDeparture) {
    const requested = new Date(plannedIso(input)).getTime();
    const difference = Math.abs(new Date(plannedDeparture).getTime() - requested) / 60_000;
    if (difference <= 3) score += 30;
    else if (difference <= 15) score += 18;
    else if (difference <= 45) score += 6;
  }
  return score;
}

function normalizeAlerts(alerts: TransitousAlert[] | undefined): RailAlert[] {
  return (alerts ?? [])
    .map((alert) => ({
      title: alert.headerText?.trim() || alert.effect?.trim() || "Betriebsmeldung",
      description: alert.descriptionText?.trim() || undefined,
      severity: alert.severityLevel || undefined,
      effect: alert.effect || undefined,
      url: alert.url || undefined,
    }))
    .filter((alert, index, all) => all.findIndex((candidate) => candidate.title === alert.title) === index)
    .slice(0, 4);
}

function recommendationFor(
  input: RailLegLookup,
  cancelled: boolean,
  departureDelay: number | null,
  arrivalDelay: number | null,
  alerts: RailAlert[],
) {
  if (cancelled) return "Zug fällt aus. Jetzt eine Alternative suchen.";
  const seriousAlert = alerts.some((alert) =>
    /significant|severe|no.?service|reduced.?service|ausfall|störung|unterbrech/i.test(
      `${alert.severity} ${alert.effect} ${alert.title} ${alert.description}`,
    ),
  );
  if (seriousAlert) return "Größere Betriebsmeldung erkannt. Alternativen vorsorglich prüfen.";
  if (
    input.connectionBufferMinutes &&
    arrivalDelay !== null &&
    arrivalDelay + 5 >= input.connectionBufferMinutes
  ) {
    return `Anschluss gefährdet: geplant sind nur ${input.connectionBufferMinutes} Minuten Umstieg.`;
  }
  if (Math.max(departureDelay ?? 0, arrivalDelay ?? 0) >= 15) {
    return "Mindestens 15 Minuten Verspätung. Alternativen können sinnvoll sein.";
  }
  return undefined;
}

async function planFor(input: RailLegLookup, minutesShift: number, results: number) {
  const [from, to] = await Promise.all([
    resolveStation(input.from, input.fromStationId),
    resolveStation(input.to, input.toStationId),
  ]);
  const params = new URLSearchParams({
    fromPlace: from.id,
    toPlace: to.id,
    time: plannedIso(input, minutesShift),
    arriveBy: "false",
    numItineraries: String(results),
    pedestrianProfile: "FOOT",
    transitModes: "RAIL",
    detailedTransfers: "true",
  });
  return providerFetch<TransitousPlan>(`/api/v6/plan?${params.toString()}`);
}

export async function getRailStatus(input: RailLegLookup): Promise<RailStatusResult> {
  const plan = await planFor(input, -20, 6);
  const candidates = transitLegs(plan)
    .map(({ itinerary, leg }) => ({ itinerary, leg, score: matchScore(input, leg) }))
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];

  if (!best || best.score < 60) {
    return {
      provider: providerName,
      checkedAt: new Date().toISOString(),
      state: "unknown",
      matched: false,
      confidence: best?.score ?? 0,
      realtime: false,
      train: input.train,
      departure: {
        planned: input.plannedDeparture,
        delayMinutes: null,
        plannedPlatform: input.plannedDeparturePlatform,
        platformChanged: false,
      },
      arrival: {
        planned: input.plannedArrival,
        delayMinutes: null,
        plannedPlatform: input.plannedArrivalPlatform,
        platformChanged: false,
      },
      cancelled: false,
      alerts: [],
      sourceNote: "Kein ausreichend sicherer Treffer. Bitte zusätzlich den DB-Link öffnen.",
    };
  }

  const leg = best.leg;
  const cancelled = Boolean(leg.cancelled || leg.from?.cancelled || leg.to?.cancelled);
  const departureDelay = leg.realTime
    ? minutesBetween(leg.from?.departure, leg.from?.scheduledDeparture)
    : null;
  const arrivalDelay = leg.realTime
    ? minutesBetween(leg.to?.arrival, leg.to?.scheduledArrival)
    : null;
  const departurePlatform = leg.from?.track || leg.from?.scheduledTrack;
  const plannedDeparturePlatform = input.plannedDeparturePlatform || leg.from?.scheduledTrack;
  const arrivalPlatform = leg.to?.track || leg.to?.scheduledTrack;
  const plannedArrivalPlatform = input.plannedArrivalPlatform || leg.to?.scheduledTrack;
  const alerts = normalizeAlerts(leg.alerts);
  const largestDelay = Math.max(departureDelay ?? 0, arrivalDelay ?? 0);
  const state = cancelled
    ? "cancelled"
    : !leg.realTime
      ? "scheduled"
      : largestDelay >= 3
        ? "delayed"
        : "on_time";

  return {
    provider: providerName,
    checkedAt: new Date().toISOString(),
    state,
    matched: true,
    confidence: Math.min(100, best.score),
    realtime: Boolean(leg.realTime),
    train: legName(leg) || input.train,
    destination: leg.headsign,
    departure: {
      planned: timeLabel(leg.from?.scheduledDeparture, input.timeZone) || input.plannedDeparture,
      actual: leg.realTime ? timeLabel(leg.from?.departure, input.timeZone) || undefined : undefined,
      delayMinutes: departureDelay,
      plannedPlatform: plannedDeparturePlatform,
      platform: departurePlatform,
      platformChanged: Boolean(
        departurePlatform &&
          plannedDeparturePlatform &&
          normalized(departurePlatform) !== normalized(plannedDeparturePlatform),
      ),
    },
    arrival: {
      planned: timeLabel(leg.to?.scheduledArrival, input.timeZone) || input.plannedArrival,
      actual: leg.realTime ? timeLabel(leg.to?.arrival, input.timeZone) || undefined : undefined,
      delayMinutes: arrivalDelay,
      plannedPlatform: plannedArrivalPlatform,
      platform: arrivalPlatform,
      platformChanged: Boolean(
        arrivalPlatform &&
          plannedArrivalPlatform &&
          normalized(arrivalPlatform) !== normalized(plannedArrivalPlatform),
      ),
    },
    cancelled,
    alerts,
    recommendation: recommendationFor(input, cancelled, departureDelay, arrivalDelay, alerts),
    sourceNote: leg.realTime
      ? "Manuell abgerufene Echtzeitdaten. Angaben können sich kurzfristig ändern."
      : "Verbindung gefunden, aber aktuell liegen nur Fahrplandaten ohne Echtzeit vor.",
  };
}

function itineraryToAlternative(input: RailLegLookup, itinerary: TransitousItinerary): RailAlternative | null {
  const transit = (itinerary.legs ?? []).filter((leg) => Boolean(leg.tripId || leg.displayName || leg.tripShortName));
  if (!transit.length || !itinerary.startTime || !itinerary.endTime) return null;
  const first = transit[0];
  const last = transit[transit.length - 1];
  const trains = transit.map(legName).filter(Boolean);
  return {
    id: itinerary.id || `${itinerary.startTime}-${trains.join("-")}`,
    departure: timeLabel(first.from?.departure || itinerary.startTime, input.timeZone),
    arrival: timeLabel(last.to?.arrival || itinerary.endTime, input.timeZone),
    durationMinutes: Math.round((itinerary.duration ?? 0) / 60),
    transfers: Math.max(0, transit.length - 1),
    trains,
    fromPlatform: first.from?.track || first.from?.scheduledTrack,
    toPlatform: last.to?.track || last.to?.scheduledTrack,
    realtime: transit.some((leg) => Boolean(leg.realTime)),
    cancelled: transit.some((leg) => Boolean(leg.cancelled || leg.from?.cancelled || leg.to?.cancelled)),
    alerts: normalizeAlerts(transit.flatMap((leg) => leg.alerts ?? [])),
    bookingUrl: bookingUrl(input, first.from?.departure || itinerary.startTime),
  };
}

export async function getRailAlternatives(input: RailLegLookup): Promise<RailAlternativesResult> {
  const plan = await planFor(input, -5, 8);
  const requestedTrain = normalized(input.train);
  const alternatives = (plan.itineraries ?? [])
    .map((itinerary) => itineraryToAlternative(input, itinerary))
    .filter((alternative): alternative is RailAlternative => Boolean(alternative))
    .filter((alternative) => !alternative.cancelled)
    .filter((alternative) => !alternative.trains.some((train) => normalized(train) === requestedTrain))
    .filter(
      (alternative, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.departure === alternative.departure &&
            candidate.arrival === alternative.arrival &&
            candidate.trains.join("|") === alternative.trains.join("|"),
        ) === index,
    )
    .slice(0, 4);

  return {
    provider: providerName,
    checkedAt: new Date().toISOString(),
    alternatives,
    sourceNote: alternatives.length
      ? "Alternativen wurden nur auf Anforderung gesucht. Vor Abfahrt bitte nochmals prüfen."
      : "Keine abweichende Verbindung gefunden. Der DB-Link bleibt als zusätzlicher Fallback verfügbar.",
  };
}
