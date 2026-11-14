"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme, Theme } from "@/context/ThemeContext";
import { Sun, Moon, Laptop, ChevronDown } from "lucide-react";

interface ThemeToggleProps {
  variant?: "icon-only" | "full" | "dropdown";
  className?: string;
}

export function ThemeToggle({ variant = "dropdown", className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, systemPreference, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (variant === "icon-only") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none ${className}`}
        title={`Ganti tema (Saat ini: ${resolvedTheme === "dark" ? "Mode Gelap" : "Mode Terang"})`}
        aria-label="Toggle dark mode"
      >
        {resolvedTheme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400 animate-spin-once" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600" />
        )}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition focus:outline-none shadow-2xs"
        title="Pilih Tema Tampilan (Terang / Gelap / Sistem)"
        aria-expanded={isOpen}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="w-3.5 h-3.5 text-blue-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className="font-semibold hidden sm:inline text-[11px]">
          {theme === "system" ? "Sistem" : resolvedTheme === "dark" ? "Gelap" : "Terang"}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-xl py-1.5 z-50 animate-fadeIn text-xs">
          {[
            {
              id: "light" as Theme,
              label: "Mode Terang",
              icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
            },
            {
              id: "dark" as Theme,
              label: "Mode Gelap",
              icon: <Moon className="w-3.5 h-3.5 text-blue-400" />,
            },
            {
              id: "system" as Theme,
              label: `Ikuti Sistem (${systemPreference === "dark" ? "Gelap" : "Terang"})`,
              icon: <Laptop className="w-3.5 h-3.5 text-slate-400" />,
            },
          ].map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTheme(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-left font-semibold transition ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

