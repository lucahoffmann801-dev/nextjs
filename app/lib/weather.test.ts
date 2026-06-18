import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWeatherAdvisories,
  getWeatherSnapshots,
  routeWeatherAdjustment,
  validWeatherPoint,
  weatherCodeLabel,
} from "./weather";
import type { WeatherDay, WeatherPointSnapshot } from "./weather-types";

const calmDay: WeatherDay = {
  weatherCode: 1,
  temperatureMax: 28,
  temperatureMin: 21,
  apparentTemperatureMax: 29,
  precipitationProbabilityMax: 15,
  windSpeedMax: 18,
  windGustMax: 24,
  uvIndexMax: 7,
  sunrise: "2026-07-02T06:10",
  sunset: "2026-07-02T20:39",
  daylightDuration: 52_140,
};

function snapshot(day: WeatherDay = calmDay): WeatherPointSnapshot {
  return {
    id: "test",
    lat: 35.1829,
    lng: 24.2326,
    date: "2026-07-02",
    available: true,
    current: null,
    day,
    marine: { waveHeightMax: 0.6, wavePeriodMax: 5 },
    advisories: [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("weather validation and labels", () => {
  it("accepts Kreta coordinates and rejects points outside the allowed region", () => {
    expect(validWeatherPoint({ id: "hotel", lat: 35.1829, lng: 24.2326 })).toBe(true);
    expect(validWeatherPoint({ id: "berlin", lat: 52.52, lng: 13.405 })).toBe(false);
  });

  it("maps WMO weather codes to readable German labels", () => {
    expect(weatherCodeLabel(0)).toBe("Klar");
    expect(weatherCodeLabel(63)).toBe("Regen");
    expect(weatherCodeLabel(96)).toBe("Gewitter");
  });
});

describe("weather advisories", () => {
  it("creates practical heat, UV, wind, rain and wave notices", () => {
    const advisories = buildWeatherAdvisories(
      {
        ...calmDay,
        apparentTemperatureMax: 37,
        precipitationProbabilityMax: 82,
        windGustMax: 54,
        uvIndexMax: 9,
      },
      { waveHeightMax: 2.1, wavePeriodMax: 8 },
    );
    expect(advisories.map((item) => item.kind)).toEqual(["heat", "uv", "wind", "rain", "waves"]);
    expect(advisories.every((item) => item.level === "avoid")).toBe(true);
  });
});

describe("weather-aware route scoring", () => {
  it("rewards beaches in calm weather and penalizes hikes in extreme heat", () => {
    const beach = routeWeatherAdjustment(snapshot(), {
      kind: "place",
      title: "Orthi Ammos Beach",
      category: "Strand",
      note: "Ruhige Bucht",
    });
    const hike = routeWeatherAdjustment(
      snapshot({ ...calmDay, apparentTemperatureMax: 37, windGustMax: 47 }),
      {
        kind: "place",
        title: "Imbros Gorge",
        category: "Natur/Wandern",
        note: "Lange Schlucht",
      },
    );
    expect(beach.score).toBeGreaterThan(0);
    expect(hike.score).toBeLessThan(0);
  });

  it("promotes indoor alternatives in difficult weather", () => {
    const result = routeWeatherAdjustment(
      snapshot({ ...calmDay, precipitationProbabilityMax: 85 }),
      {
        kind: "restaurant",
        title: "Taverna",
        category: "Restaurant",
        note: "Überdacht",
      },
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason).toContain("Schlechtwetter");
  });
});

describe("Open-Meteo normalization", () => {
  it("keeps weather usable when the marine provider is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            current: {
              temperature_2m: 27.2,
              apparent_temperature: 28.1,
              weather_code: 1,
              wind_speed_10m: 14,
              wind_gusts_10m: 22,
              is_day: 1,
            },
            daily: {
              time: ["2026-07-02"],
              weather_code: [1],
              temperature_2m_max: [29],
              temperature_2m_min: [21],
              apparent_temperature_max: [31],
              precipitation_probability_max: [10],
              wind_speed_10m_max: [19],
              wind_gusts_10m_max: [28],
              uv_index_max: [8],
              sunrise: ["2026-07-02T06:10"],
              sunset: ["2026-07-02T20:39"],
              daylight_duration: [52140],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("marine down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWeatherSnapshots(
      [{ id: "hotel", lat: 35.1829, lng: 24.2326 }],
      "2026-07-02",
    );

    expect(result.points[0].available).toBe(true);
    expect(result.points[0].current?.temperature).toBe(27.2);
    expect(result.points[0].marine).toBeNull();
    expect(result.points[0].advisories.some((item) => item.kind === "uv")).toBe(true);
  });

  it("returns an unavailable snapshot when the requested date is outside the forecast", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ daily: { time: ["2026-06-18"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ daily: { time: ["2026-06-18"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWeatherSnapshots(
      [{ id: "hotel", lat: 35.1829, lng: 24.2326 }],
      "2026-07-09",
    );

    expect(result.points[0].available).toBe(false);
    expect(result.points[0].day).toBeNull();
    expect(result.points[0].advisories).toEqual([]);
  });
});
