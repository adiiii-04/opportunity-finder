"use client";

import { useState, useEffect } from "react";
import { Key, X, Check, ExternalLink, ShieldCheck, HelpCircle } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysSaved?: () => void;
}

export function ApiKeyModal({ isOpen, onClose, onKeysSaved }: ApiKeyModalProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [tinyfishKey, setTinyfishKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiKey(localStorage.getItem("radar_gemini_key") || "");
      setTinyfishKey(localStorage.getItem("radar_tinyfish_key") || "");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (geminiKey.trim()) {
        localStorage.setItem("radar_gemini_key", geminiKey.trim());
      } else {
        localStorage.removeItem("radar_gemini_key");
      }

      if (tinyfishKey.trim()) {
        localStorage.setItem("radar_tinyfish_key", tinyfishKey.trim());
      } else {
        localStorage.removeItem("radar_tinyfish_key");
      }
    }
    setSaved(true);
    if (onKeysSaved) onKeysSaved();
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("radar_gemini_key");
      localStorage.removeItem("radar_tinyfish_key");
      setGeminiKey("");
      setTinyfishKey("");
      if (onKeysSaved) onKeysSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">API Keys Configuration</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your API keys for live radar scans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Gemini API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Get free Gemini key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Paste your Gemini API key (e.g. AIzaSy... or AQ...)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Required for intent understanding, link triaging, and deadline extraction.
            </p>
          </div>

          {/* TinyFish API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                TinyFish API Key
              </label>
              <a
                href="https://tinyfish.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Get TinyFish key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={tinyfishKey}
              onChange={(e) => setTinyfishKey(e.target.value)}
              placeholder="Paste your TinyFish API key"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Required for live web search and Chromium page text rendering.
            </p>
          </div>

          {/* Info callout */}
          <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Security note:</strong> Keys saved here are kept only in your local browser and sent securely over encrypted HTTPS directly to your server API route.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: You can also permanently configure them on Vercel under <strong>Project Settings → Environment Variables</strong> (<code className="font-mono">GEMINI_API_KEY</code> and <code className="font-mono">TINYFISH_API_KEY</code>).
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              Clear saved keys
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    Saved!
                  </>
                ) : (
                  "Save Keys"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
