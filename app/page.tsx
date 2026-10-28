"use client";

import React, { useState, useEffect, useTransition } from "react";
import { OpportunityCategory } from "@/config/sources";
import {
  OpportunityItem,
  PipelineStep,
  RadarStreamEvent,
  SourceReport,
  UnderstandResult,
} from "@/types/radar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ProgressTracker } from "@/components/ProgressTracker";
import { SourcesPanel } from "@/components/SourcesPanel";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import {
  Radio,
  Search,
  Sparkles,
  AlertCircle,
  Filter,
  Flame,
  RefreshCw,
  SlidersHorizontal,
  Key,
} from "lucide-react";

const CATEGORIES: Array<"All" | OpportunityCategory> = [
  "All",
  "Internships",
  "Hackathons",
  "Competitions",
  "Scholarships",
  "Fellowships",
  "Open Source",
];

const EXAMPLES = [
  {
    title: "Paid AI/ML internship, 3rd year B.Tech",
    lookingFor: "Paid AI/ML internship, remote or Bangalore with stipend",
    profile:
      "3rd year B.Tech CSE at an Indian engineering college. Skilled in Python, PyTorch, LangChain, NLP, and REST APIs. Built projects with LLMs and computer vision.",
    category: "Internships" as OpportunityCategory,
  },
  {
    title: "Hackathons for beginners in web dev",
    lookingFor: "Beginner-friendly AI & Web Dev hackathons with mentorship and prizes",
    profile:
      "2nd year Computer Science student. Proficient in React, Next.js, Tailwind CSS, and Node.js. Excited to build innovative web apps in team competitions.",
    category: "Hackathons" as OpportunityCategory,
  },
  {
    title: "Scholarships for engineering students",
    lookingFor: "Merit and technical scholarships for engineering college students in India",
    profile:
      "Undergraduate engineering student in India with 8.8 CGPA. Looking for scholarship funding, research grants, or educational sponsorships for 2026-2027.",
    category: "Scholarships" as OpportunityCategory,
  },
];

export default function HomePage() {
  const [lookingFor, setLookingFor] = useState("");
  const [profile, setProfile] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | OpportunityCategory>("All");

  // API Key modal & state
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasCustomKeys, setHasCustomKeys] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const gKey = localStorage.getItem("radar_gemini_key");
      const tKey = localStorage.getItem("radar_tinyfish_key");
      setHasCustomKeys(Boolean(gKey || tKey));
    }
  }, []);

  const refreshKeyStatus = () => {
    if (typeof window !== "undefined") {
      const gKey = localStorage.getItem("radar_gemini_key");
      const tKey = localStorage.getItem("radar_tinyfish_key");
      setHasCustomKeys(Boolean(gKey || tKey));
    }
  };

  // Pipeline runtime state
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [understanding, setUnderstanding] = useState<UnderstandResult | undefined>(undefined);
  const [activePages, setActivePages] = useState<string[]>([]);
  const [sourcesReport, setSourcesReport] = useState<SourceReport[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Sorting state
  const [filterType, setFilterType] = useState<string>("All");
  const [onlyClosingSoon, setOnlyClosingSoon] = useState(false);
  const [sortBy, setSortBy] = useState<"fit" | "deadline">("fit");

  const [, startTransition] = useTransition();

  const handleApplyExample = (ex: (typeof EXAMPLES)[0]) => {
    setLookingFor(ex.lookingFor);
    setProfile(ex.profile);
    setSelectedCategory(ex.category);
    setErrorMessage(null);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lookingFor.trim() && !profile.trim()) {
      setErrorMessage("Please fill in what you are looking for or describe your profile.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCurrentStep("understanding");
    setStatusMessage("Connecting to Opportunity Radar backend...");
    setProgressPercent(10);
    setOpportunities([]);
    setUnderstanding(undefined);
    setActivePages([]);

    const clientGeminiKey = typeof window !== "undefined" ? localStorage.getItem("radar_gemini_key") || "" : "";
    const clientTinyfishKey = typeof window !== "undefined" ? localStorage.getItem("radar_tinyfish_key") || "" : "";

    const payload = {
      lookingFor,
      profile,
      categories: selectedCategory === "All" ? undefined : [selectedCategory],
      geminiApiKey: clientGeminiKey,
      tinyfishApiKey: clientTinyfishKey,
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      if (clientGeminiKey) headers["x-gemini-api-key"] = clientGeminiKey;
      if (clientTinyfishKey) headers["x-tinyfish-api-key"] = clientTinyfishKey;

      const response = await fetch("/api/radar", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your API key looks wrong. Please check your TINYFISH_API_KEY and GEMINI_API_KEY.");
        } else if (response.status === 429) {
          throw new Error("Too many requests, wait a minute.");
        } else if (response.status === 402) {
          throw new Error("Daily free limit reached.");
        } else {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to initialize Server-Sent Events stream reader.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const eventData = JSON.parse(jsonStr) as RadarStreamEvent;
              startTransition(() => {
                if (eventData.step) setCurrentStep(eventData.step);
                if (eventData.message) setStatusMessage(eventData.message);
                if (typeof eventData.progressPercent === "number") {
                  setProgressPercent(eventData.progressPercent);
                }
                if (eventData.understanding) {
                  setUnderstanding(eventData.understanding);
                }
                if (eventData.activePages) {
                  setActivePages(eventData.activePages);
                }
                if (eventData.sourcesReport) {
                  setSourcesReport(eventData.sourcesReport);
                }
                if (eventData.opportunities) {
                  setOpportunities(eventData.opportunities);
                }
                if (eventData.step === "error" || eventData.error) {
                  setErrorMessage(eventData.error || eventData.message || "An error occurred.");
                }
              });
            } catch (err) {
              console.warn("Failed to parse SSE JSON payload:", err);
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error("Search failed:", err);
      const msg = (err as Error)?.message || "Couldn't reach TinyFish or server.";
      setErrorMessage(msg);
      setCurrentStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered and sorted opportunities
  const filteredOpportunities = React.useMemo(() => {
    return opportunities
      .filter((item) => {
        if (filterType !== "All" && item.type !== filterType) {
          return false;
        }
        if (onlyClosingSoon) {
          if (!item.deadline_iso) return false;
          const diffDays =
            (new Date(item.deadline_iso).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
          if (diffDays < 0 || diffDays > 7) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "fit") {
          return b.fit_score - a.fit_score;
        }
        if (a.deadline_iso && b.deadline_iso) {
          return a.deadline_iso.localeCompare(b.deadline_iso);
        }
        if (a.deadline_iso && !b.deadline_iso) return -1;
        if (!a.deadline_iso && b.deadline_iso) return 1;
        return 0;
      });
  }, [opportunities, filterType, onlyClosingSoon, sortBy]);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  Opportunity Radar
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  India Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Real-time portal intelligence for Indian students
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* API Keys Configuration Button */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">API Keys</span>
              {hasCustomKeys && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950" />
              )}
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeysSaved={refreshKeyStatus}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16 w-full flex-1">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-semibold mb-4 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Live opportunities from 20 trusted sources, matched to you
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Stop searching 20 tabs. <br />
            <span className="bg-clip-text text-transparent bg-linear-to-r from-indigo-600 via-violet-600 to-indigo-500">
              Radar scans them all live.
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Find currently active internships, hackathons, competitions, scholarships, fellowships, and
            open-source programs curated from verified Indian portals, evaluated against your exact profile.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-indigo-500/5 p-6 sm:p-8 mb-10 transition-all">
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Input 1: What are you looking for */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                1. What are you looking for?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  placeholder="e.g. Paid ML internship with stipend, remote AI hackathons, or girls tech scholarships"
                  className="w-full px-4 py-3.5 pl-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Input 2: About you */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                2. About you (Course, Year, College/City, Skills & Interests)
              </label>
              <textarea
                rows={3}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="e.g. 3rd year B.Tech CSE at an engineering college in Pune. Skills: Python, React, PyTorch, SQL. Looking for summer roles or high-prize hackathons."
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>

            {/* Category Chips */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Target Category (Default &quot;All&quot; lets AI decide)
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedCategory === cat
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 scale-105"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Example Pre-fills */}
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">
                Try examples:
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyExample(ex)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-indigo-400 border border-transparent transition-all hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    {ex.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group overflow-hidden rounded-xl bg-linear-to-r from-indigo-600 via-indigo-700 to-violet-600 p-4 text-white font-bold text-base shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.008] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-3 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Scanning 20 Live Portals...
                  </>
                ) : (
                  <>
                    <Radio className="w-5 h-5" />
                    Find Live Opportunities
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-8 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Notice</h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{errorMessage}</p>
              </div>
            </div>

            {/* If error relates to API keys, provide direct button to modal */}
            {(errorMessage.toLowerCase().includes("api key") || errorMessage.includes("GEMINI_API_KEY") || errorMessage.includes("TINYFISH_API_KEY")) && (
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all"
              >
                <Key className="w-3.5 h-3.5" />
                Configure API Keys
              </button>
            )}
          </div>
        )}

        {/* Progress Tracker (Visible when scanning or just completed) */}
        {currentStep && (
          <ProgressTracker
            currentStep={currentStep}
            statusMessage={statusMessage}
            understanding={understanding}
            activePages={activePages}
            progressPercent={progressPercent}
          />
        )}

        {/* Collapsible Trusted Sources Panel */}
        <SourcesPanel reports={sourcesReport} />

        {/* Results Area */}
        {currentStep === "done" && (
          <div className="space-y-6">
            {/* Filter and Sort Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              {/* Type Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
                {["All", "Internship", "Hackathon", "Competition", "Scholarship", "Fellowship", "Open Source"].map(
                  (type) => {
                    const count =
                      type === "All"
                        ? opportunities.length
                        : opportunities.filter((o) => o.type === type).length;
                    return (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                          filterType === type
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {type} ({count})
                      </button>
                    );
                  }
                )}
              </div>

              {/* Toggles: Closing soon & Sort */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Closing Soon Toggle */}
                <button
                  onClick={() => setOnlyClosingSoon(!onlyClosingSoon)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    onlyClosingSoon
                      ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Closing Soon (≤ 7 days)
                </button>

                {/* Sort Toggle */}
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-medium">
                  <button
                    onClick={() => setSortBy("fit")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      sortBy === "fit"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Best match
                  </button>
                  <button
                    onClick={() => setSortBy("deadline")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      sortBy === "deadline"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Nearest deadline
                  </button>
                </div>
              </div>
            </div>

            {/* Results Count Summary */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Showing <strong className="text-slate-900 dark:text-white">{filteredOpportunities.length}</strong> of{" "}
                <strong className="text-slate-900 dark:text-white">{opportunities.length}</strong> verified opportunities
              </span>
              <span>Sorted by {sortBy === "fit" ? "profile match score" : "upcoming deadline"}</span>
            </div>

            {/* Cards Grid */}
            {filteredOpportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredOpportunities.map((op, index) => (
                  <OpportunityCard key={op.id || index} item={op} />
                ))}
              </div>
            ) : (
              /* Friendly Empty State */
              <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-4">
                  <Filter className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No active opportunities match this filter
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
                  Try switching back to &quot;All&quot; categories or unchecking the &quot;Closing Soon&quot; toggle to view more open opportunities.
                </p>
                <button
                  onClick={() => {
                    setFilterType("All");
                    setOnlyClosingSoon(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Opportunity Radar</span> — Powered by TinyFish Search & Fetch + Google Gemini Flash
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
            >
              Configure API Keys
            </button>
            <span>20 Trusted Portals</span>
            <span>Zero Hallucinated Deadlines</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
