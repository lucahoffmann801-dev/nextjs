import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/weather", () => {
  it("rejects coordinates outside Kreta before contacting a provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/weather", {
        method: "POST",
        body: JSON.stringify({ points: [{ id: "berlin", lat: 52.52, lng: 13.405 }] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects more than 30 locations", async () => {
    const points = Array.from({ length: 31 }, (_, index) => ({
      id: `p-${index}`,
      lat: 35.18,
      lng: 24.23,
    }));
    const response = await POST(
      new Request("http://localhost/api/weather", {
        method: "POST",
        body: JSON.stringify({ points }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 502 when the upstream weather provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("provider unavailable", { status: 503 })),
    );
    const response = await POST(
      new Request("http://localhost/api/weather", {
        method: "POST",
        body: JSON.stringify({ points: [{ id: "hotel", lat: 35.1829, lng: 24.2326 }] }),
      }),
    );
    expect(response.status).toBe(502);
  });
});
