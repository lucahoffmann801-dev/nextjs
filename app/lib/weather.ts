import type {
  MarineDay,
  WeatherCurrent,
  WeatherDay,
  WeatherPointRequest,
  WeatherPointSnapshot,
  WeatherResponse,
} from "./weather-types";
import { buildWeatherAdvisories } from "./weather-domain";

export {
  buildWeatherAdvisories,
  routeWeatherAdjustment,
  weatherCodeEmoji,
  weatherCodeLabel,
} from "./weather-domain";

const weatherEndpoint = "https://api.open-meteo.com/v1/forecast";
const marineEndpoint = "https://marine-api.open-meteo.com/v1/marine";
const requestTimeoutMs = 8_000;

type Numeric = number | null;

type OpenMeteoWeather = {
  latitude?: number;
  longitude?: number;
  current?: {
    temperature_2m?: Numeric;
    apparent_temperature?: Numeric;
    weather_code?: Numeric;
    wind_speed_10m?: Numeric;
    wind_gusts_10m?: Numeric;
    is_day?: Numeric;
  };
  daily?: {
    time?: string[];
    weather_code?: Numeric[];
    temperature_2m_max?: Numeric[];
    temperature_2m_min?: Numeric[];
    apparent_temperature_max?: Numeric[];
    precipitation_probability_max?: Numeric[];
    wind_speed_10m_max?: Numeric[];
    wind_gusts_10m_max?: Numeric[];
    uv_index_max?: Numeric[];
    sunrise?: Array<string | null>;
    sunset?: Array<string | null>;
    daylight_duration?: Numeric[];
  };
};

type OpenMeteoMarine = {
  daily?: {
    time?: string[];
    wave_height_max?: Numeric[];
    wave_period_max?: Numeric[];
  };
};

export const creteWeatherBounds = {
  minLat: 34.5,
  maxLat: 36,
  minLng: 23,
  maxLng: 27,
};

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableNumber(value: unknown): number | null {
  return finiteNumber(value) ? value : null;
}

function valueAt(values: Numeric[] | undefined, index: number) {
  return nullableNumber(values?.[index]);
}

function stringAt(values: Array<string | null> | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "string" && value ? value : null;
}

function localDateInAthens() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Athens" }).format(new Date());
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function mapCurrent(value: OpenMeteoWeather["current"]): WeatherCurrent | null {
  if (!value) return null;
  return {
    temperature: nullableNumber(value.temperature_2m),
    apparentTemperature: nullableNumber(value.apparent_temperature),
    weatherCode: nullableNumber(value.weather_code),
    windSpeed: nullableNumber(value.wind_speed_10m),
    windGust: nullableNumber(value.wind_gusts_10m),
    isDay: finiteNumber(value.is_day) ? value.is_day === 1 : null,
  };
}

function mapWeatherDay(value: OpenMeteoWeather, date: string): WeatherDay | null {
  const index = value.daily?.time?.indexOf(date) ?? -1;
  if (index < 0) return null;
  return {
    weatherCode: valueAt(value.daily?.weather_code, index),
    temperatureMax: valueAt(value.daily?.temperature_2m_max, index),
    temperatureMin: valueAt(value.daily?.temperature_2m_min, index),
    apparentTemperatureMax: valueAt(value.daily?.apparent_temperature_max, index),
    precipitationProbabilityMax: valueAt(value.daily?.precipitation_probability_max, index),
    windSpeedMax: valueAt(value.daily?.wind_speed_10m_max, index),
    windGustMax: valueAt(value.daily?.wind_gusts_10m_max, index),
    uvIndexMax: valueAt(value.daily?.uv_index_max, index),
    sunrise: stringAt(value.daily?.sunrise, index),
    sunset: stringAt(value.daily?.sunset, index),
    daylightDuration: valueAt(value.daily?.daylight_duration, index),
  };
}

function mapMarineDay(value: OpenMeteoMarine | undefined, date: string): MarineDay | null {
  const index = value?.daily?.time?.indexOf(date) ?? -1;
  if (index < 0) return null;
  return {
    waveHeightMax: valueAt(value?.daily?.wave_height_max, index),
    wavePeriodMax: valueAt(value?.daily?.wave_period_max, index),
  };
}

export function validWeatherPoint(point: WeatherPointRequest) {
  return (
    Boolean(point.id.trim()) &&
    finiteNumber(point.lat) &&
    finiteNumber(point.lng) &&
    point.lat >= creteWeatherBounds.minLat &&
    point.lat <= creteWeatherBounds.maxLat &&
    point.lng >= creteWeatherBounds.minLng &&
    point.lng <= creteWeatherBounds.maxLng
  );
}

async function providerFetch<T>(url: string, refresh: boolean): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const options: RequestInit & { next?: { revalidate: number } } = refresh
      ? { cache: "no-store", signal: controller.signal }
      : { next: { revalidate: 900 }, signal: controller.signal };
    const response = await fetch(url, options);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Open-Meteo antwortet mit HTTP ${response.status}: ${detail.slice(0, 180)}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Die Wetterquelle hat zu lange gebraucht.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function commonParams(points: WeatherPointRequest[]) {
  return {
    latitude: points.map((point) => point.lat).join(","),
    longitude: points.map((point) => point.lng).join(","),
    timezone: "Europe/Athens",
  };
}

export async function getWeatherSnapshots(
  points: WeatherPointRequest[],
  requestedDate = localDateInAthens(),
  refresh = false,
): Promise<WeatherResponse> {
  const shared = commonParams(points);
  const weatherParams = new URLSearchParams({
    ...shared,
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,daylight_duration",
    forecast_days: "16",
  });
  const marineParams = new URLSearchParams({
    ...shared,
    daily: "wave_height_max,wave_period_max",
    forecast_days: "8",
    cell_selection: "sea",
  });

  const weatherPromise = providerFetch<OpenMeteoWeather | OpenMeteoWeather[]>(
    `${weatherEndpoint}?${weatherParams.toString()}`,
    refresh,
  );
  const marinePromise = providerFetch<OpenMeteoMarine | OpenMeteoMarine[]>(
    `${marineEndpoint}?${marineParams.toString()}`,
    refresh,
  ).catch(() => null);
  const [weatherPayload, marinePayload] = await Promise.all([weatherPromise, marinePromise]);
  const weatherRows = asArray(weatherPayload);
  const marineRows = marinePayload ? asArray(marinePayload) : [];
  const checkedAt = new Date().toISOString();

  const snapshots = points.map((point, index): WeatherPointSnapshot => {
    const weatherRow = weatherRows[index] ?? {};
    const day = mapWeatherDay(weatherRow, requestedDate);
    const marine = mapMarineDay(marineRows[index], requestedDate);
    return {
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      date: requestedDate,
      available: Boolean(day),
      current: mapCurrent(weatherRow.current),
      day,
      marine,
      advisories: buildWeatherAdvisories(day, marine),
    };
  });

  return {
    checkedAt,
    requestedDate,
    points: snapshots,
    source: {
      weather: "Open-Meteo",
      marine: "Open-Meteo Marine",
      note: "Modellprognose, keine amtliche Warnung und keine Grundlage für Küstennavigation.",
    },
  };
}
