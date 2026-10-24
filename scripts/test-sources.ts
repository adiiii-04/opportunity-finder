import fs from "fs";
import path from "path";
import { TRUSTED_SOURCES } from "../config/sources";

// Load .env.local manually if running via tsx
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

async function runTestSources() {
  const apiKey = process.env.TINYFISH_API_KEY?.trim();
  if (!apiKey) {
    console.error("\n❌ Error: TINYFISH_API_KEY is not set in .env.local");
    console.error("Please add TINYFISH_API_KEY=your_key to .env.local before running test:sources.\n");
    process.exit(1);
  }

  console.log(`\n============================================================`);
  console.log(`🔍 OPPORTUNITY RADAR: Testing all ${TRUSTED_SOURCES.length} Trusted Sources`);
  console.log(`============================================================\n`);

  // Max 10 URLs per Fetch call according to TinyFish API documentation
  const batchSize = 10;
  const allResults: Map<string, { status: "ok" | "thin" | "failed"; charCount: number; preview: string; error?: string }> = new Map();

  for (let i = 0; i < TRUSTED_SOURCES.length; i += batchSize) {
    const chunk = TRUSTED_SOURCES.slice(i, i + batchSize);
    const urls = chunk.map((s) => s.url);
    console.log(`📡 Fetching batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(TRUSTED_SOURCES.length / batchSize)} (${urls.length} URLs)...`);

    try {
      const res = await fetch("https://api.fetch.tinyfish.ai", {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Batch request failed with status ${res.status}: ${errText}`);
        for (const s of chunk) {
          allResults.set(s.url, {
            status: "failed",
            charCount: 0,
            preview: `[HTTP ${res.status}]`,
            error: errText.slice(0, 80),
          });
        }
        continue;
      }

      const json = await res.json();
      const results: Array<{ url: string; title?: string; text?: string }> = json.results || [];
      const errors: Array<{ url: string; error?: string }> = json.errors || [];

      for (const item of results) {
        const text = (item.text || "").trim();
        const charCount = text.length;
        const status = charCount >= 500 ? "ok" : "thin";
        const preview = text.slice(0, 120).replace(/\s+/g, " ");
        allResults.set(item.url, { status, charCount, preview });
      }

      for (const err of errors) {
        allResults.set(err.url, {
          status: "failed",
          charCount: 0,
          preview: `[Error: ${err.error || "Fetch failed"}]`,
          error: err.error,
        });
      }
    } catch (err: unknown) {
      console.error("Batch fetch exception:", err);
      for (const s of chunk) {
        allResults.set(s.url, {
          status: "failed",
          charCount: 0,
          preview: "[Exception occurred]",
          error: (err as Error)?.message,
        });
      }
    }
  }

  // Print formatted table
  console.log("\n📊 SOURCE STATUS SUMMARY TABLE:\n");
  const tableData = TRUSTED_SOURCES.map((source) => {
    const res = allResults.get(source.url) || {
      status: "failed" as const,
      charCount: 0,
      preview: "[Not returned]",
    };

    return {
      "Source Name": source.name,
      Category: source.category,
      "JS Heavy": source.jsHeavy ? "Yes" : "No",
      Status: res.status.toUpperCase(),
      "Chars Returned": res.charCount,
      "Preview (First 120 chars)": res.preview.slice(0, 60) + (res.preview.length > 60 ? "..." : ""),
    };
  });

  console.table(tableData);

  const okCount = Array.from(allResults.values()).filter((r) => r.status === "ok").length;
  const thinCount = Array.from(allResults.values()).filter((r) => r.status === "thin").length;
  const failedCount = Array.from(allResults.values()).filter((r) => r.status === "failed").length;

  console.log(`\n📌 Summary: ${okCount} OK, ${thinCount} Thin, ${failedCount} Failed out of ${TRUSTED_SOURCES.length} sources.`);
  console.log(`💡 Note: jsHeavy sources that return thin text can be enhanced with TinyFish Agent API in future releases.\n`);
}

runTestSources().catch((err) => {
  console.error("Fatal error running test:sources:", err);
  process.exit(1);
});
