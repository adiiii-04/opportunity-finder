"use client";

import { useState } from "react";
import { SourceReport } from "@/types/radar";
import { TRUSTED_SOURCES } from "@/config/sources";
import { ChevronDown, ChevronUp, Database, ExternalLink, ShieldCheck } from "lucide-react";

interface SourcesPanelProps {
  reports?: SourceReport[];
}

export function SourcesPanel({ reports }: SourcesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Merge default sources with runtime reports
  const sourceList = TRUSTED_SOURCES.map((s) => {
    const report = reports?.find((r) => r.name === s.name || r.url === s.url);
    return {
      ...s,
      status: report?.status || "not_used",
      charCount: report?.charCount || 0,
      itemCount: report?.itemCount || 0,
    };
  });

  const okCount = sourceList.filter((s) => s.status === "ok").length;
  const thinCount = sourceList.filter((s) => s.status === "thin").length;
  const failedCount = sourceList.filter((s) => s.status === "failed").length;

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden mb-10 transition-all">
      {/* Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Sources Monitored ({TRUSTED_SOURCES.length})
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Top curated Indian portals & open programs across 6 categories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {reports && reports.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {okCount} OK
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {thinCount} Thin
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {failedCount} Failed
                </span>
              )}
            </div>
          )}
          <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 dark:border-slate-800">
          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Status Legend:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Active / Content OK (≥ 500 chars)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Thin text (&lt; 500 chars, JS heavy)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Failed / Blocked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              Not queried in this search
            </span>
          </div>

          {/* Sources Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sourceList.map((source, idx) => {
              const statusDot =
                source.status === "ok"
                  ? "bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                  : source.status === "thin"
                  ? "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900"
                  : source.status === "failed"
                  ? "bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900"
                  : "bg-slate-300 dark:bg-slate-600";

              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {source.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {source.jsHeavy && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-300">
                            JS
                          </span>
                        )}
                        <span className={`w-2 h-2 rounded-full ${statusDot}`} title={`Status: ${source.status}`} />
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">{source.name}</div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mt-0.5 truncate max-w-full"
                    >
                      {source.domain}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Matches:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {source.itemCount} items
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 italic">
            * Note: Websites marked with <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">JS</code> render complex Single Page Applications. Fetch uses Chromium to render dynamic content, and can be further extended with the TinyFish Agent API.
          </p>
        </div>
      )}
    </div>
  );
}
