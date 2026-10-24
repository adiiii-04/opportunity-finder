"use client";

import React from "react";
import { OpportunityItem, OpportunityType } from "@/types/radar";
import {
  Calendar,
  MapPin,
  ExternalLink,
  Award,
  Sparkles,
  Clock,
  Briefcase,
  GraduationCap,
  Code2,
  Trophy,
  Users,
} from "lucide-react";

interface OpportunityCardProps {
  item: OpportunityItem;
}

const TYPE_CONFIG: Record<
  OpportunityType,
  { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Internship: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800/60",
    icon: Briefcase,
  },
  Hackathon: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    icon: Code2,
  },
  Competition: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/60",
    icon: Trophy,
  },
  Scholarship: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    icon: GraduationCap,
  },
  Fellowship: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/60",
    icon: Users,
  },
  "Open Source": {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800/60",
    icon: Sparkles,
  },
};

export function OpportunityCard({ item }: OpportunityCardProps) {
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG["Internship"];
  const TypeIcon = typeConfig.icon;

  // Check if closing within 7 days
  const isClosingSoon = React.useMemo(() => {
    if (!item.deadline_iso) return false;
    const deadline = new Date(item.deadline_iso);
    const now = new Date();
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }, [item.deadline_iso]);

  // Fit score styles
  const getScoreStyle = (score: number) => {
    if (score >= 8) {
      return "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30";
    }
    if (score >= 5) {
      return "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30";
    }
    return "border-slate-400 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40";
  };

  return (
    <div className="group relative flex flex-col justify-between bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-5 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/80 transition-all duration-200">
      <div>
        {/* Top Header: Type Badge + Fit Score Circle */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
          >
            <TypeIcon className="w-3.5 h-3.5" />
            {item.type}
          </span>

          {/* Fit Score Circle */}
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-full border-2 font-bold text-xs shadow-xs ${getScoreStyle(
              item.fit_score
            )}`}
            title={`Fit Score: ${item.fit_score}/10 based on your profile match`}
          >
            {item.fit_score}
            <span className="text-[9px] opacity-70">/10</span>
          </div>
        </div>

        {/* Title and Organization */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
          {item.title}
        </h3>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1 mb-3">
          {item.organization}
        </p>

        {/* Mode, Location & Stipend/Prize Meta */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-3.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
            <MapPin className="w-3 h-3 text-slate-400" />
            {item.mode} {item.location ? `• ${item.location}` : ""}
          </span>

          {item.stipend_or_prize && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-900/50">
              <Award className="w-3.5 h-3.5 text-indigo-500" />
              {item.stipend_or_prize}
            </span>
          )}
        </div>

        {/* Deadline */}
        <div className="mb-3">
          {isClosingSoon ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold animate-pulse">
              <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Closing soon: {item.deadline_text || item.deadline_iso}
            </div>
          ) : item.deadline_iso ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Deadline: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.deadline_text || item.deadline_iso}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Deadline not listed — check link
            </div>
          )}
        </div>

        {/* Eligibility */}
        {item.eligibility && (
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-3 bg-slate-50/80 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Eligibility: </span>
            {item.eligibility}
          </div>
        )}

        {/* Why it fits (written directly to student in italics) */}
        {item.why_it_fits && (
          <p className="text-xs italic text-indigo-900/90 dark:text-indigo-200/90 bg-indigo-50/60 dark:bg-indigo-950/30 border-l-2 border-indigo-500 pl-2.5 py-1.5 rounded-r-md mb-3">
            &ldquo;{item.why_it_fits}&rdquo;
          </p>
        )}

        {/* Matched Keywords */}
        {item.keyword_matches && item.keyword_matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.keyword_matches.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: Source Name + Apply/View button */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
          via <span className="font-medium text-slate-600 dark:text-slate-400">{item.source_name || "Live Web"}</span>
        </span>

        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow transition-all"
        >
          Apply / View
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
