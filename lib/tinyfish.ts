import { tinyfishLimiter } from "./limiter";
import { pageCache } from "./cache";

export interface TinyFishSearchResult {
  position?: number;
  title: string;
  snippet: string;
  url: string;
  site_name?: string;
  date?: string;
}

export interface TinyFishFetchResult {
  url: string;
  title?: string;
  text: string;
}

export interface TinyFishFetchError {
  url: string;
  error?: string;
}

let hasLoggedFirstSearch = false;

export class TinyFishError extends Error {
  status?: number;
  friendlyMessage: string;

  constructor(status: number | undefined, rawMessage: string) {
    let friendly = "Couldn't reach TinyFish";
    if (status === 401) {
      friendly = "Your API key looks wrong";
    } else if (status === 429) {
      friendly = "Too many requests, wait a minute";
    } else if (status === 402) {
      friendly = "Daily free limit reached";
    } else if (rawMessage && rawMessage.includes("fetch failed")) {
      friendly = "Couldn't reach TinyFish (network error)";
    }
    super(friendly);
    this.name = "TinyFishError";
    this.status = status;
    this.friendlyMessage = friendly;
  }
}

function getApiKey(): string {
  const key = process.env.TINYFISH_API_KEY?.trim();
  if (!key) {
    throw new TinyFishError(401, "TINYFISH_API_KEY environment variable is not configured");
  }
  return key;
}

async function fetchWithRetry(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const execute = async (isRetry = false): Promise<Response> => {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (response.status === 429 && !isRetry) {
        console.warn(`[TinyFish] Hit 429 rate limit on ${url}. Retrying once after 3 seconds...`);
        await new Promise((r) => setTimeout(r, 3000));
        return await execute(true);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[TinyFish API Error] Status ${response.status}: ${errorText}`);
        throw new TinyFishError(response.status, errorText);
      }

      return response;
    } catch (err: unknown) {
      if (err instanceof TinyFishError) throw err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const message = isAbort ? `Request timed out after ${timeoutMs}ms` : (err as Error)?.message || String(err);
      console.error(`[TinyFish Network Error] ${message}`);
      throw new TinyFishError(undefined, message);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return execute();
}

/**
 * TinyFish Search API
 * GET https://api.search.tinyfish.ai
 */
export async function searchTinyFish(params: {
  query: string;
  location?: string;
  language?: string;
  after_date?: string;
  include_domains?: string;
  exclude_domains?: string;
}): Promise<TinyFishSearchResult[]> {
  const apiKey = getApiKey();
  const url = new URL("https://api.search.tinyfish.ai");
  url.searchParams.set("query", params.query);
  url.searchParams.set("location", params.location || "IN");
  url.searchParams.set("language", params.language || "en");
  if (params.after_date) {
    url.searchParams.set("after_date", params.after_date);
  }
  if (params.include_domains) {
    url.searchParams.set("include_domains", params.include_domains);
  }
  if (params.exclude_domains) {
    url.searchParams.set("exclude_domains", params.exclude_domains);
  }

  return tinyfishLimiter.run(async () => {
    console.log(`[TinyFish Search] Query: "${params.query}" | include: "${params.include_domains || 'all'}" | exclude: "${params.exclude_domains || 'none'}"`);
    const response = await fetchWithRetry(
      url.toString(),
      {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
      },
      15000 // 15s timeout
    );

    const json = await response.json();

    if (!hasLoggedFirstSearch) {
      console.log(`[TinyFish Search] RAW RESPONSE (first call sample):`, JSON.stringify(json, null, 2).slice(0, 800));
      hasLoggedFirstSearch = true;
    }

    const results: TinyFishSearchResult[] = Array.isArray(json?.results) ? json.results : [];
    console.log(`[TinyFish Search] Got ${results.length} results for "${params.query}"`);
    return results;
  });
}

/**
 * TinyFish Fetch API
 * POST https://api.fetch.tinyfish.ai
 * Accepts up to 10 URLs per call. Caches each result for 30 minutes in memory.
 */
export async function fetchTinyFishBatch(urls: string[]): Promise<{
  results: TinyFishFetchResult[];
  errors: TinyFishFetchError[];
}> {
  if (urls.length === 0) return { results: [], errors: [] };

  const apiKey = getApiKey();
  const cachedResults: TinyFishFetchResult[] = [];
  const uncachedUrls: string[] = [];

  for (const u of urls) {
    const cached = pageCache.get<TinyFishFetchResult>(u);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedUrls.push(u);
    }
  }

  if (uncachedUrls.length === 0) {
    return { results: cachedResults, errors: [] };
  }

  return tinyfishLimiter.run(async () => {
    console.log(`[TinyFish Fetch] Fetching batch of ${uncachedUrls.length} URLs (cached: ${cachedResults.length})...`);
    try {
      const response = await fetchWithRetry(
        "https://api.fetch.tinyfish.ai",
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ urls: uncachedUrls }),
        },
        150000 // 150s timeout
      );

      const json = await response.json();
      const freshResults: TinyFishFetchResult[] = Array.isArray(json?.results) ? json.results : [];
      const errors: TinyFishFetchError[] = Array.isArray(json?.errors) ? json.errors : [];

      // Cache fresh results
      for (const item of freshResults) {
        if (item.url && item.text) {
          pageCache.set(item.url, item);
        }
      }

      if (errors.length > 0) {
        console.warn(`[TinyFish Fetch] ${errors.length} URLs reported errors:`, errors.map((e) => `${e.url}: ${e.error}`));
      }

      return {
        results: [...cachedResults, ...freshResults],
        errors,
      };
    } catch (err: unknown) {
      console.error(`[TinyFish Fetch] Batch error:`, err);
      // Skip errors, never crash!
      const errorMsg = err instanceof TinyFishError ? err.friendlyMessage : "Fetch failed";
      return {
        results: cachedResults,
        errors: uncachedUrls.map((u) => ({ url: u, error: errorMsg })),
      };
    }
  });
}
