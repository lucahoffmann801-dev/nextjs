import type {
  MarineDay,
  RouteWeatherAdjustment,
  RouteWeatherTarget,
  WeatherAdvisory,
  WeatherDay,
  WeatherPointSnapshot,
} from "./weather-types";

export function weatherCodeLabel(code: number | null | undefined) {
  if (code == null) return "Wetter unbekannt";
  if (code === 0) return "Klar";
  if (code <= 2) return "Leicht bewölkt";
  if (code === 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Neblig";
  if (code >= 51 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80 && code <= 82) return "Schauer";
  if (code >= 95) return "Gewitter";
  return "Wechselhaft";
}

export function weatherCodeEmoji(code: number | null | undefined, isDay = true) {
  if (code == null) return "🌤️";
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

export function buildWeatherAdvisories(day: WeatherDay | null, marine: MarineDay | null): WeatherAdvisory[] {
  if (!day) return [];
  const advisories: WeatherAdvisory[] = [];
  const heat = day.apparentTemperatureMax ?? day.temperatureMax;
  if (heat != null && heat >= 34) {
    advisories.push({ kind: "heat", level: "avoid", title: "Starke Hitze", detail: `${Math.round(heat)} °C gefühlt: Mittagssonne und lange Wanderungen meiden.` });
  } else if (heat != null && heat >= 30) {
    advisories.push({ kind: "heat", level: "watch", title: "Heißer Tag", detail: `${Math.round(heat)} °C gefühlt: Wasser, Schatten und Pausen einplanen.` });
  }

  if (day.uvIndexMax != null && day.uvIndexMax >= 8) {
    advisories.push({ kind: "uv", level: "avoid", title: "Sehr hoher UV-Index", detail: `UV ${day.uvIndexMax.toFixed(1)}: konsequenter Sonnenschutz und Mittagspause.` });
  } else if (day.uvIndexMax != null && day.uvIndexMax >= 6) {
    advisories.push({ kind: "uv", level: "watch", title: "Hoher UV-Index", detail: `UV ${day.uvIndexMax.toFixed(1)}: SPF 50, Kopfbedeckung und Schatten.` });
  }

  const wind = Math.max(day.windSpeedMax ?? 0, day.windGustMax ?? 0);
  if (wind >= 50) {
    advisories.push({ kind: "wind", level: "avoid", title: "Starker Wind", detail: `Böen bis ${Math.round(wind)} km/h: exponierte Küsten und Schluchten kritisch prüfen.` });
  } else if (wind >= 32) {
    advisories.push({ kind: "wind", level: "watch", title: "Windiger Tag", detail: `Böen bis ${Math.round(wind)} km/h: Strand- und Bootspläne flexibel halten.` });
  }

  const rain = day.precipitationProbabilityMax;
  if (rain != null && rain >= 75) {
    advisories.push({ kind: "rain", level: "avoid", title: "Hohes Regenrisiko", detail: `${Math.round(rain)} %: Indoor-Alternative bereithalten.` });
  } else if (rain != null && rain >= 45) {
    advisories.push({ kind: "rain", level: "watch", title: "Regen möglich", detail: `${Math.round(rain)} %: kurze Outdoor-Etappen bevorzugen.` });
  }

  const waves = marine?.waveHeightMax;
  if (waves != null && waves >= 1.8) {
    advisories.push({ kind: "waves", level: "avoid", title: "Hoher Wellengang", detail: `Bis ${waves.toFixed(1)} m: Baden und kleine Boote vor Ort neu bewerten.` });
  } else if (waves != null && waves >= 1.1) {
    advisories.push({ kind: "waves", level: "watch", title: "Spürbarer Wellengang", detail: `Bis ${waves.toFixed(1)} m: geschützte Buchten bevorzugen.` });
  }

  return advisories;
}

export function routeWeatherAdjustment(
  snapshot: WeatherPointSnapshot | null | undefined,
  target: RouteWeatherTarget,
): RouteWeatherAdjustment {
  if (!snapshot?.available || !snapshot.day) return { score: 0, reason: null };
  const text = `${target.title} ${target.category} ${target.note}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const isBeach = /strand|beach|kuste|bucht|lagoon/.test(text);
  const isHike = /wandern|hiking|schlucht|gorge|trail|natur/.test(text);
  const isPhoto = /foto|aussicht|viewpoint|panorama/.test(text);
  const isIndoor = target.kind === "restaurant" || /museum|galerie|indoor/.test(text);
  const day = snapshot.day;
  const heat = day.apparentTemperatureMax ?? day.temperatureMax ?? 0;
  const rain = day.precipitationProbabilityMax ?? 0;
  const wind = Math.max(day.windSpeedMax ?? 0, day.windGustMax ?? 0);
  const waves = snapshot.marine?.waveHeightMax ?? 0;
  let score = 0;
  const reasons: string[] = [];

  if (isBeach) {
    if (rain < 30 && wind < 30 && waves < 1.1) {
      score += 14;
      reasons.push("ruhiges Strandwetter");
    }
    if (wind >= 38 || waves >= 1.5) {
      score -= 24;
      reasons.push("Wind oder Wellengang");
    }
  }
  if (isHike) {
    if (heat >= 34) {
      score -= 28;
      reasons.push("zu heiß für lange Outdoor-Etappen");
    } else if (heat <= 29 && rain < 35) {
      score += 10;
      reasons.push("gutes Wanderfenster");
    }
    if (rain >= 60 || wind >= 45) score -= 22;
  }
  if (isPhoto && rain < 35 && (day.weatherCode ?? 3) <= 2) {
    score += 8;
    reasons.push("gutes Licht");
  }
  if (isIndoor && (rain >= 55 || wind >= 40 || heat >= 35)) {
    score += 18;
    reasons.push("starke Schlechtwetter-Alternative");
  }

  return {
    score,
    reason: reasons.length ? `Wetter: ${reasons.join(", ")}.` : null,
  };
}
