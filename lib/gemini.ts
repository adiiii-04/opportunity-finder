import { GoogleGenAI } from "@google/genai";
import { geminiLimiter } from "./limiter";
import {
  UnderstandResult,
  TriagedResult,
  OpportunityItem,
} from "@/types/radar";
import { TinyFishSearchResult } from "./tinyfish";

function getGeminiClient(customApiKey?: string): { ai: GoogleGenAI; model: string } {
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Please add it to your Vercel Project Settings > Environment Variables, or enter it in the API Keys dialog in the app header."
    );
  }
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });
  return { ai, model };
}

function cleanJsonText(raw: string | undefined): string {
  if (!raw) return "";
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * STEP 1 - UNDERSTAND
 * Understand user's lookingFor and profile, extract keywords, category focus, and 5 targeted queries.
 */
export async function understandStudentIntent(
  lookingFor: string,
  profile: string,
  today: string,
  customApiKey?: string
): Promise<UnderstandResult> {
  const { ai, model } = getGeminiClient(customApiKey);

  const prompt = `You are the intelligence engine of Opportunity Radar, helping Indian college students find live internships, hackathons, competitions, scholarships, fellowships, and open-source opportunities.
Today's date is: ${today}.

User's Request:
"Looking for": ${JSON.stringify(lookingFor)}
"Student Profile": ${JSON.stringify(profile)}

Analyze what the student is seeking and their profile. Return a JSON object with this exact structure:
{
  "categories": ["Internships" | "Hackathons" | "Competitions" | "Scholarships" | "Fellowships" | "Open Source"],
  "keywords": ["5-8 specific, high-signal keywords, e.g. machine learning, NLP, Python, stipend, web development"],
  "skills": ["extracted technical or soft skills"],
  "level": "1st year" | "2nd year" | "3rd year" | "final year" | "graduate",
  "location_preference": "remote" | "Bangalore" | "Delhi" | "any",
  "search_queries": [
    "5 short, specific search queries combining keywords with opportunity intent words like 'internship apply', 'hackathon registration open', 'scholarship 2026-27 last date', 'fellowship 2027 apply', targeted for Indian students"
  ]
}

Important:
- Categories must be chosen from the 6 valid categories: "Internships", "Hackathons", "Competitions", "Scholarships", "Fellowships", "Open Source".
- Provide exactly 5 high quality search_queries.
- Output strictly JSON.`;

  return geminiLimiter.run(async () => {
    console.log(`[Gemini Understand] Analyzing student profile with model ${model}...`);
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = cleanJsonText(response.text);
    const parsed = JSON.parse(text) as UnderstandResult;
    console.log(`[Gemini Understand] Generated keywords:`, parsed.keywords);
    console.log(`[Gemini Understand] Generated search queries:`, parsed.search_queries);
    return parsed;
  });
}

/**
 * STEP 3 - TRIAGE SEARCH RESULTS
 * Filter down live web search results to the top 8 most promising URLs.
 */
export async function triageSearchResults(
  results: TinyFishSearchResult[],
  keywords: string[],
  customApiKey?: string
): Promise<TriagedResult[]> {
  if (results.length === 0) return [];

  const { ai, model } = getGeminiClient(customApiKey);

  const simplifiedResults = results.map((r, i) => ({
    index: i,
    title: r.title,
    snippet: r.snippet,
    url: r.url,
    date: r.date,
  }));

  const prompt = `You are evaluating search results for Indian college students looking for active opportunities.
Student target keywords: ${JSON.stringify(keywords)}

Here are ${simplifiedResults.length} search results:
${JSON.stringify(simplifiedResults, null, 2)}

Instructions:
1. Pick the up to 8 most promising URLs that look like a SPECIFIC live opportunity page, active registration portal, or genuine current listing page.
2. REJECT listicles ("top 10", "best", "how to", "tips"), news recaps, winners/results pages, expired blog posts, generic homepages with no listings, and social media.
3. Return a JSON array of up to 8 items:
[
  {
    "url": "https://exact-url-from-results",
    "reason": "Brief 1-sentence reason why this was selected or why it looks active"
  }
]

Strictly return JSON array.`;

  return geminiLimiter.run(async () => {
    console.log(`[Gemini Triage] Triaging ${results.length} search results...`);
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = cleanJsonText(response.text);
    const parsed = JSON.parse(text);
    const triaged: TriagedResult[] = Array.isArray(parsed) ? parsed : [];
    console.log(`[Gemini Triage] Selected ${triaged.length} URLs for deep page fetch:`);
    triaged.forEach((t) => console.log(`  -> ${t.url} (${t.reason})`));
    return triaged;
  });
}

/**
 * STEP 5 - EXTRACT AND MATCH
 * Extract verified open opportunities from page text (first 20,000 characters).
 */
export async function extractOpportunitiesFromPage(params: {
  pageText: string;
  pageUrl: string;
  sourceName: string;
  today: string;
  keywords: string[];
  profile: string;
  customApiKey?: string;
}): Promise<OpportunityItem[]> {
  const { ai, model } = getGeminiClient(params.customApiKey);
  const truncatedText = params.pageText.slice(0, 20000);

  const prompt = `You are an expert opportunity analyzer for Opportunity Radar.
Today's date is: ${params.today}.
Source Name: ${params.sourceName}
Page URL: ${params.pageUrl}
Student Keywords: ${JSON.stringify(params.keywords)}
Student Profile: ${JSON.stringify(params.profile)}

Page Content:
\"\"\"
${truncatedText}
\"\"\"

Instruction:
Extract ONLY real, specific opportunities that are currently open or upcoming as of today (${params.today}).
Ignore ads, navigation, and expired items.
If the page only shows past dates, already closed programs, or the program is between cycles, return an empty array [].
NEVER invent or guess deadlines.
Return a JSON array, max 10 items:
[
  {
    "title": "Opportunity Title (e.g. AI Summer Internship 2026)",
    "organization": "Company or Institute Name",
    "type": "Internship" | "Hackathon" | "Competition" | "Scholarship" | "Fellowship" | "Open Source",
    "mode": "Online" | "In-person" | "Hybrid" | "Remote" | "Unknown",
    "location": "Location (city or India/Global or Remote)",
    "deadline_text": "Exact text for deadline, e.g. 'Nov 15, 2026' or 'Rolling'",
    "deadline_iso": "YYYY-MM-DD or null if no exact date is found",
    "eligibility": "One line summary of who can apply",
    "stipend_or_prize": "Stipend amount or prize pool or null if unpaid/unspecified",
    "link": "The specific opportunity URL if present in the page text/links, otherwise ${params.pageUrl}",
    "evidence": "Short quote (1-2 sentences) from the page showing the deadline or open status",
    "keyword_matches": ["which user keywords it matches from ${JSON.stringify(params.keywords)}"],
    "fit_score": 8, // integer 1-10, based on keywords, skills, level, location
    "why_it_fits": "One encouraging sentence written directly to the student explaining why this matches their background"
  }
]

Strictly return a JSON array.`;

  return geminiLimiter.run(async () => {
    console.log(`[Gemini Extract] Analyzing ${params.sourceName} (${params.pageUrl}) [${truncatedText.length} chars]...`);
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = cleanJsonText(response.text);
    const parsed = JSON.parse(text);
    const items: OpportunityItem[] = Array.isArray(parsed) ? parsed : [];
    console.log(`[Gemini Extract] Extracted ${items.length} opportunities from ${params.sourceName}`);
    return items.map((item) => ({
      ...item,
      source_name: params.sourceName,
    }));
  });
}
