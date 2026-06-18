export type WeatherPointRequest = {
  id: string;
  lat: number;
  lng: number;
};

export type WeatherAdvisoryKind = "heat" | "uv" | "wind" | "rain" | "waves";
export type WeatherAdvisoryLevel = "info" | "watch" | "avoid";

export type WeatherAdvisory = {
  kind: WeatherAdvisoryKind;
  level: WeatherAdvisoryLevel;
  title: string;
  detail: string;
};

export type WeatherCurrent = {
  temperature: number | null;
  apparentTemperature: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  windGust: number | null;
  isDay: boolean | null;
};

export type WeatherDay = {
  weatherCode: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
  apparentTemperatureMax: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedMax: number | null;
  windGustMax: number | null;
  uvIndexMax: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylightDuration: number | null;
};

export type MarineDay = {
  waveHeightMax: number | null;
  wavePeriodMax: number | null;
};

export type WeatherPointSnapshot = {
  id: string;
  lat: number;
  lng: number;
  date: string;
  available: boolean;
  current: WeatherCurrent | null;
  day: WeatherDay | null;
  marine: MarineDay | null;
  advisories: WeatherAdvisory[];
};

export type WeatherResponse = {
  checkedAt: string;
  requestedDate: string;
  points: WeatherPointSnapshot[];
  source: {
    weather: "Open-Meteo";
    marine: "Open-Meteo Marine";
    note: string;
  };
};

export type RouteWeatherTarget = {
  kind: "hotel" | "place" | "restaurant";
  category: string;
  note: string;
  title: string;
};

export type RouteWeatherAdjustment = {
  score: number;
  reason: string | null;
};
