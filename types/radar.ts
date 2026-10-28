import { OpportunityCategory } from "@/config/sources";

export type OpportunityType =
  | "Internship"
  | "Hackathon"
  | "Competition"
  | "Scholarship"
  | "Fellowship"
  | "Open Source";

export type WorkMode = "Online" | "In-person" | "Hybrid" | "Remote" | "Unknown";

export interface UnderstandResult {
  categories: OpportunityCategory[];
  keywords: string[];
  skills: string[];
  level: "1st year" | "2nd year" | "3rd year" | "final year" | "graduate" | string;
  location_preference: "remote" | string;
  search_queries: string[];
}

export interface OpportunityItem {
  id?: string;
  title: string;
  organization: string;
  type: OpportunityType;
  mode: WorkMode;
  location: string;
  deadline_text: string;
  deadline_iso: string | null;
  eligibility: string;
  stipend_or_prize: string | null;
  link: string;
  evidence: string;
  keyword_matches: string[];
  fit_score: number; // 1-10
  why_it_fits: string;
  source_name?: string;
}

export interface TriagedResult {
  url: string;
  reason: string;
}

export interface SourceReport {
  name: string;
  url: string;
  domain: string;
  category: OpportunityCategory;
  status: "ok" | "thin" | "failed" | "not_used";
  charCount?: number;
  itemCount: number;
  jsHeavy?: boolean;
}

export interface RadarRequest {
  lookingFor: string;
  profile: string;
  categories?: OpportunityCategory[];
  geminiApiKey?: string;
  tinyfishApiKey?: string;
}

export type PipelineStep =
  | "understanding"
  | "searching"
  | "reading"
  | "matching"
  | "done"
  | "error";

export interface RadarStreamEvent {
  step: PipelineStep;
  message: string;
  understanding?: UnderstandResult;
  sourcesReport?: SourceReport[];
  activePages?: string[];
  opportunities?: OpportunityItem[];
  progressPercent?: number;
  error?: string;
}
