"use client";

import React from "react";
import { PipelineStep, UnderstandResult } from "@/types/radar";
import { CheckCircle2, Circle, Loader2, Sparkles, Globe, BookOpen, Target, Check } from "lucide-react";

interface ProgressTrackerProps {
  currentStep: PipelineStep;
  statusMessage: string;
  understanding?: UnderstandResult;
  activePages?: string[];
  progressPercent?: number;
}

const STEPS: Array<{ key: PipelineStep; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "understanding", label: "Understanding you", icon: Sparkles },
  { key: "searching", label: "Searching trusted sites", icon: Globe },
  { key: "reading", label: "Reading pages", icon: BookOpen },
  { key: "matching", label: "Matching", icon: Target },
  { key: "done", label: "Done", icon: Check },
];

export function ProgressTracker({
  currentStep,
  statusMessage,
  understanding,
  activePages,
  progressPercent = 0,
}: ProgressTrackerProps) {
  const getStepStatus = (stepKey: PipelineStep) => {
    const order: PipelineStep[] = ["understanding", "searching", "reading", "matching", "done"];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepKey);

    if (currentStep === "error") return "idle";
    if (currentStep === "done") return "completed";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "idle";
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-indigo-100 dark:border-indigo-950/60 p-6 shadow-sm mb-8 transition-all">
      {/* Top Header & Message */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
            {currentStep === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {currentStep === "done" ? "Scan Complete" : "Live Opportunity Radar Active"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{statusMessage}</p>
          </div>
        </div>

        {/* Progress percent badge */}
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-800/50">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-6">
        <div
          className="bg-linear-to-r from-indigo-500 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(5, progressPercent)}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {STEPS.map((step) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all ${
                status === "completed"
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                  : status === "active"
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-xs"
                  : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500"
              }`}
            >
              {status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : status === "active" ? (
                <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Extracted Understanding Keyword Chips */}
      {understanding && understanding.keywords && understanding.keywords.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              AI Understood Profile Focus:
            </span>
            {understanding.level && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                {understanding.level}
              </span>
            )}
            {understanding.location_preference && understanding.location_preference !== "any" && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                📍 {understanding.location_preference}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {understanding.keywords.map((kw, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active Reading Pills */}
      {activePages && activePages.length > 0 && currentStep === "reading" && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Currently Reading & Parsing Live URLs:
          </div>
          <div className="flex flex-wrap gap-2">
            {activePages.map((url, i) => {
              let display = url;
              try {
                const u = new URL(url);
                display = `${u.hostname}${u.pathname.slice(0, 20)}...`;
              } catch {}
              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-mono animate-pulse"
                >
                  <Globe className="w-3 h-3 text-indigo-500" />
                  {display}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
