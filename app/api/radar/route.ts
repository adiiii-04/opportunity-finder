import { NextRequest } from "next/server";
import { TRUSTED_SOURCES, OpportunityCategory, TrustedSource } from "@/config/sources";
import {
  understandStudentIntent,
  triageSearchResults,
  extractOpportunitiesFromPage,
} from "@/lib/gemini";
import {
  searchTinyFish,
  fetchTinyFishBatch,
  TinyFishSearchResult,
  TinyFishFetchResult,
  TinyFishError,
} from "@/lib/tinyfish";
import {
  OpportunityItem,
  RadarRequest,
  RadarStreamEvent,
  SourceReport,
  UnderstandResult,
} from "@/types/radar";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow sufficient time for deep fetch and analysis

function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    // remove standard tracking params
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    return u.toString().replace(/\/$/, "");
  } catch {
    return rawUrl.trim().replace(/\/$/, "");
  }
}

function getDomain(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: RadarStreamEvent) => {
    try {
      const dataStr = `data: ${JSON.stringify(event)}\n\n`;
      await writer.write(encoder.encode(dataStr));
    } catch {
      // client disconnected
    }
  };

  // Run the pipeline asynchronously in background and stream chunks
  (async () => {
    try {
      const body = (await req.json()) as RadarRequest;
      const { lookingFor, profile, categories: userCategories } = body;

      if (!lookingFor?.trim() && !profile?.trim()) {
        await sendEvent({
          step: "error",
          message: "Please enter what you are looking for or your student profile.",
          error: "Missing required inputs",
        });
        await writer.close();
        return;
      }

      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      console.log(`\n============================================================`);
      console.log(`🚀 [Radar Pipeline] Starting new scan at ${today}`);
      console.log(`   Looking for: "${lookingFor}"`);
      console.log(`   Profile: "${profile.slice(0, 100)}..."`);
      console.log(`============================================================`);

      // ==========================================
      // STEP 1 - UNDERSTAND (Gemini)
      // ==========================================
      await sendEvent({
        step: "understanding",
        message: "Understanding your profile, target skills, and search criteria...",
        progressPercent: 15,
      });

      let understanding: UnderstandResult;
      try {
        understanding = await understandStudentIntent(lookingFor || "", profile || "", today);
      } catch (err: unknown) {
        console.error("[Radar Pipeline] Gemini understanding failed:", err);
        const errMsg = (err as Error)?.message || "Failed to analyze student profile with Gemini";
        const friendly = errMsg.includes("GEMINI_API_KEY")
          ? "GEMINI_API_KEY is missing or invalid in .env.local"
          : "Could not analyze profile with Gemini. Please check your Gemini API key.";
        await sendEvent({
          step: "error",
          message: friendly,
          error: friendly,
        });
        await writer.close();
        return;
      }

      // If user provided specific category chips, prioritize them; else use Gemini's
      const selectedCategories: OpportunityCategory[] =
        userCategories && userCategories.length > 0
          ? userCategories
          : (understanding.categories as OpportunityCategory[]).filter((c) =>
              TRUSTED_SOURCES.some((s) => s.category === c)
            );

      const activeCategories: OpportunityCategory[] =
        selectedCategories.length > 0
          ? selectedCategories
          : ["Internships", "Hackathons", "Competitions", "Scholarships", "Fellowships", "Open Source"];

      console.log(`[Radar Pipeline] Selected Categories:`, activeCategories);
      console.log(`[Radar Pipeline] Generated Queries:`, understanding.search_queries);

      await sendEvent({
        step: "searching",
        message: `Extracted ${understanding.keywords.length} target signals. Initiating live search on trusted Indian portals...`,
        understanding,
        progressPercent: 30,
      });

      // Filter trusted sources by selected categories
      const targetSources = TRUSTED_SOURCES.filter((s) => activeCategories.includes(s.category));
      const targetDomains = Array.from(new Set(targetSources.map((s) => s.domain))).join(",");

      // Calculate 60 days ago
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // ==========================================
      // STEP 2 - GATHER (Run A and B in parallel)
      // ==========================================
      console.log(`[Radar Pipeline] Gathering sources and searching with after_date=${sixtyDaysAgo}...`);

      // A) Keyword searches
      const searchPromises = understanding.search_queries.slice(0, 5).map((q) =>
        searchTinyFish({
          query: q,
          location: "IN",
          language: "en",
          after_date: sixtyDaysAgo,
          include_domains: targetDomains,
        }).catch((err) => {
          console.warn(`[Radar Pipeline] Search failed for query "${q}":`, err.message);
          return [] as TinyFishSearchResult[];
        })
      );

      // Open-web search with best query
      const bestQuery = understanding.search_queries[0] || `${understanding.keywords.join(" ")} opportunity`;
      const openWebPromise = searchTinyFish({
        query: bestQuery,
        location: "IN",
        language: "en",
        after_date: sixtyDaysAgo,
        exclude_domains:
          "instagram.com,facebook.com,x.com,twitter.com,linkedin.com,youtube.com,reddit.com,pinterest.com,quora.com,medium.com",
      }).catch((err) => {
        console.warn(`[Radar Pipeline] Open web search failed for "${bestQuery}":`, err.message);
        return [] as TinyFishSearchResult[];
      });

      // B) Source listing pages + Internshala keyword slugs
      const listingUrls: string[] = targetSources.map((s) => s.url);
      if (activeCategories.includes("Internships")) {
        const topKeywords = (understanding.keywords || []).slice(0, 2);
        for (const kw of topKeywords) {
          const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          if (slug) {
            listingUrls.push(`https://internshala.com/internships/${slug}-internship/`);
          }
        }
      }

      const [searchBatches, openWebResults] = await Promise.all([
        Promise.all(searchPromises),
        openWebPromise,
      ]);

      const allRawSearchResults: TinyFishSearchResult[] = [
        ...searchBatches.flat(),
        ...openWebResults,
      ];

      console.log(`[Radar Pipeline] Total raw search results collected: ${allRawSearchResults.length}`);

      // Dedupe by URL and max 3 URLs per domain
      const domainCountMap = new Map<string, number>();
      const dedupedSearchUrlMap = new Map<string, TinyFishSearchResult>();

      for (const res of allRawSearchResults) {
        if (!res.url) continue;
        const norm = normalizeUrl(res.url);
        if (dedupedSearchUrlMap.has(norm)) continue;

        const domain = getDomain(norm);
        const currentDomainCount = domainCountMap.get(domain) || 0;
        if (currentDomainCount >= 3) continue;

        domainCountMap.set(domain, currentDomainCount + 1);
        dedupedSearchUrlMap.set(norm, res);
      }

      const filteredSearchResults = Array.from(dedupedSearchUrlMap.values());
      console.log(`[Radar Pipeline] Filtered down to ${filteredSearchResults.length} unique search results (max 3/domain)`);

      // ==========================================
      // STEP 3 - TRIAGE SEARCH RESULTS (Gemini)
      // ==========================================
      await sendEvent({
        step: "reading",
        message: `Triaging ${filteredSearchResults.length} web links to select the most relevant active pages...`,
        progressPercent: 50,
      });

      let triagedUrls: string[] = [];
      if (filteredSearchResults.length > 0) {
        try {
          const triaged = await triageSearchResults(filteredSearchResults, understanding.keywords);
          triagedUrls = triaged.map((t) => t.url);
        } catch (err) {
          console.error("[Radar Pipeline] Triage failed, falling back to top search results:", err);
          triagedUrls = filteredSearchResults.slice(0, 8).map((r) => r.url);
        }
      }

      // ==========================================
      // STEP 4 - FETCH
      // Combine listing pages + triaged URLs
      // ==========================================
      const urlsToFetchSet = new Set<string>();
      for (const u of listingUrls) urlsToFetchSet.add(normalizeUrl(u));
      for (const u of triagedUrls) urlsToFetchSet.add(normalizeUrl(u));

      const urlsToFetch = Array.from(urlsToFetchSet);
      console.log(`[Radar Pipeline] Total URLs queued for fetch: ${urlsToFetch.length} (${listingUrls.length} listing + ${triagedUrls.length} triaged)`);

      await sendEvent({
        step: "reading",
        message: `Fetching and parsing ${urlsToFetch.length} target pages with Chromium rendering...`,
        activePages: urlsToFetch.slice(0, 8),
        progressPercent: 65,
      });

      // Fetch in batches of max 10
      const fetchedPagesMap = new Map<string, TinyFishFetchResult>();
      const batchSize = 10;

      for (let i = 0; i < urlsToFetch.length; i += batchSize) {
        const chunk = urlsToFetch.slice(i, i + batchSize);
        const { results, errors } = await fetchTinyFishBatch(chunk);
        for (const item of results) {
          if (item?.url) {
            fetchedPagesMap.set(normalizeUrl(item.url), item);
          }
        }
        if (errors.length > 0) {
          console.warn(`[Radar Pipeline] Errors encountered on batch ${i / batchSize + 1}:`, errors.length);
        }
      }

      // Build initial source reports
      const sourceReports: SourceReport[] = TRUSTED_SOURCES.map((source) => {
        const isSelected = activeCategories.includes(source.category);
        if (!isSelected) {
          return {
            name: source.name,
            url: source.url,
            domain: source.domain,
            category: source.category,
            status: "not_used",
            itemCount: 0,
            jsHeavy: source.jsHeavy,
          };
        }

        // Check if source URL or its domain was fetched
        const normSourceUrl = normalizeUrl(source.url);
        const match =
          fetchedPagesMap.get(normSourceUrl) ||
          Array.from(fetchedPagesMap.values()).find((p) => getDomain(p.url).includes(source.domain));

        if (!match) {
          return {
            name: source.name,
            url: source.url,
            domain: source.domain,
            category: source.category,
            status: "failed",
            charCount: 0,
            itemCount: 0,
            jsHeavy: source.jsHeavy,
          };
        }

        const chars = (match.text || "").length;
        const status = chars >= 500 ? "ok" : "thin";
        return {
          name: source.name,
          url: source.url,
          domain: source.domain,
          category: source.category,
          status,
          charCount: chars,
          itemCount: 0,
          jsHeavy: source.jsHeavy,
        };
      });

      // Filter pages that have enough content
      const eligiblePages = Array.from(fetchedPagesMap.values()).filter((p) => (p.text || "").length >= 300);
      console.log(`[Radar Pipeline] Pages with sufficient content for extraction: ${eligiblePages.length}`);

      // ==========================================
      // STEP 5 - EXTRACT AND MATCH (Gemini, max 4 at a time)
      // ==========================================
      await sendEvent({
        step: "matching",
        message: `Extracting active opportunities from ${eligiblePages.length} live portals using AI...`,
        sourcesReport: sourceReports,
        progressPercent: 80,
      });

      const extractionPromises = eligiblePages.map(async (page) => {
        const domain = getDomain(page.url);
        const matchedSource = TRUSTED_SOURCES.find((s) => domain.includes(s.domain));
        const sourceName = matchedSource ? matchedSource.name : domain || "Live Web";

        try {
          return await extractOpportunitiesFromPage({
            pageText: page.text,
            pageUrl: page.url,
            sourceName,
            today,
            keywords: understanding.keywords,
            profile: `${lookingFor}\n${profile}`,
          });
        } catch (err) {
          console.error(`[Radar Pipeline] Extraction failed for ${page.url}:`, err);
          return [] as OpportunityItem[];
        }
      });

      const allExtractedBatches = await Promise.all(extractionPromises);
      const rawOpportunities: OpportunityItem[] = allExtractedBatches.flat();
      console.log(`[Radar Pipeline] Extracted total ${rawOpportunities.length} opportunities before validation.`);

      // ==========================================
      // STEP 6 - VALIDATE AND RANK (in code, not AI)
      // ==========================================
      let droppedExpiredCount = 0;
      const validOpportunities: OpportunityItem[] = [];

      for (const item of rawOpportunities) {
        if (!item.title || !item.organization) continue;

        // Drop items where deadline_iso is strictly before today
        if (item.deadline_iso && item.deadline_iso.trim()) {
          const isoDate = item.deadline_iso.trim();
          if (isoDate < today) {
            droppedExpiredCount++;
            continue;
          }
        }

        // Format deadline display
        if (!item.deadline_iso && (!item.deadline_text || item.deadline_text.toLowerCase().includes("not listed") || item.deadline_text.toLowerCase().includes("unknown"))) {
          item.deadline_text = "Deadline not listed - check link";
        }

        // Ensure link is valid
        if (!item.link || !item.link.startsWith("http")) {
          item.link = item.evidence || "#";
        }

        validOpportunities.push(item);
      }

      console.log(`[Radar Pipeline] Dropped ${droppedExpiredCount} expired opportunities. Remaining: ${validOpportunities.length}`);

      // Dedupe by normalized title + organization (keep one with more info)
      const dedupedMap = new Map<string, OpportunityItem>();
      for (const item of validOpportunities) {
        const normKey = `${item.title.toLowerCase().replace(/[^a-z0-9]/g, "")}-${item.organization.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        const existing = dedupedMap.get(normKey);
        if (!existing) {
          dedupedMap.set(normKey, item);
        } else {
          // Keep item with more detailed evidence or why_it_fits or higher score
          const existingInfoLen = (existing.evidence || "").length + (existing.why_it_fits || "").length;
          const newInfoLen = (item.evidence || "").length + (item.why_it_fits || "").length;
          if (item.fit_score > existing.fit_score || newInfoLen > existingInfoLen) {
            dedupedMap.set(normKey, item);
          }
        }
      }

      const uniqueItems = Array.from(dedupedMap.values());

      // Sort by fit_score desc, then nearest deadline
      uniqueItems.sort((a, b) => {
        if (b.fit_score !== a.fit_score) {
          return b.fit_score - a.fit_score;
        }
        if (a.deadline_iso && b.deadline_iso) {
          return a.deadline_iso.localeCompare(b.deadline_iso);
        }
        if (a.deadline_iso && !b.deadline_iso) return -1;
        if (!a.deadline_iso && b.deadline_iso) return 1;
        return 0;
      });

      const finalOpportunities = uniqueItems.slice(0, 30);
      console.log(`[Radar Pipeline] Final ranked opportunities ready: ${finalOpportunities.length}`);

      // Update source reports with final itemCount
      const finalSourceReports = sourceReports.map((sr) => {
        const count = finalOpportunities.filter((op) => op.source_name === sr.name || getDomain(op.link || "").includes(sr.domain)).length;
        return {
          ...sr,
          itemCount: count,
        };
      });

      // Send DONE event with all data
      await sendEvent({
        step: "done",
        message: `Found ${finalOpportunities.length} live verified opportunities matched to your profile!`,
        opportunities: finalOpportunities,
        sourcesReport: finalSourceReports,
        understanding,
        progressPercent: 100,
      });

      await writer.close();
    } catch (err: unknown) {
      console.error("[Radar Pipeline] Unhandled pipeline error:", err);
      let friendly = "An unexpected error occurred while searching for opportunities.";
      if (err instanceof TinyFishError) {
        friendly = err.friendlyMessage;
      } else if (err instanceof Error) {
        if (err.message.includes("401") || err.message.includes("API key")) {
          friendly = "Your API key looks wrong. Please check your TINYFISH_API_KEY and GEMINI_API_KEY.";
        } else if (err.message.includes("429")) {
          friendly = "Too many requests, wait a minute.";
        } else if (err.message.includes("402")) {
          friendly = "Daily free limit reached.";
        } else if (err.message.includes("fetch failed") || err.message.includes("network")) {
          friendly = "Couldn't reach TinyFish. Please check your network connection.";
        }
      }

      await sendEvent({
        step: "error",
        message: friendly,
        error: friendly,
      });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
