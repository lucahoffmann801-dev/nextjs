type SupabaseOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  prefer?: string;
};

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment is not configured.");
  }

  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseRest<T>(path: string, options: SupabaseOptions = {}) {
  const { url, key } = getConfig();
  const method = options.method ?? "GET";
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${message}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
