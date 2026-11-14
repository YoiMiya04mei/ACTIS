"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import { Clock, AlertTriangle, CheckCircle2, LogOut, ShieldAlert } from "lucide-react";

const DEFAULT_TIMEOUT_MINUTES = 15;
const WARNING_BEFORE_TIMEOUT_SECONDS = 60; // Peringatan 60 detik sebelum auto-logout
const STORAGE_KEY_LAST_ACTIVE = "actis_last_active_timestamp";
const STORAGE_KEY_TIMEOUT = "actis_session_idle_timeout";
const STORAGE_KEY_LOGOUT_REASON = "actis_logout_reason";

export function IdleSessionManager() {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useCurrentUser();

  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_TIMEOUT_MINUTES;
    const saved = localStorage.getItem(STORAGE_KEY_TIMEOUT);
    return saved !== null ? parseInt(saved, 10) : DEFAULT_TIMEOUT_MINUTES;
  });

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(WARNING_BEFORE_TIMEOUT_SECONDS);

  const lastActiveRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);
  const isWarningOpenRef = useRef<boolean>(false);

  // Sync ref with state
  useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  // Load configured timeout from server settings
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTimeoutSetting = async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.session_idle_timeout_minutes !== undefined) {
          const mins = parseInt(json.data.session_idle_timeout_minutes, 10);
          if (!isNaN(mins)) {
            setTimeoutMinutes(mins);
            localStorage.setItem(STORAGE_KEY_TIMEOUT, String(mins));
          }
        }
      } catch (err) {
        console.error("Failed to load session idle timeout setting:", err);
      }
    };

    fetchTimeoutSetting();

    const handleCustomTimeoutUpdate = () => {
      const saved = localStorage.getItem(STORAGE_KEY_TIMEOUT);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) setTimeoutMinutes(parsed);
      }
    };

    window.addEventListener("actis_session_timeout_updated", handleCustomTimeoutUpdate);
    return () => {
      window.removeEventListener("actis_session_timeout_updated", handleCustomTimeoutUpdate);
    };
  }, [isAuthenticated]);

  // Execute timeout logout
  const handleTimeoutLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsWarningOpen(false);

    try {
      sessionStorage.setItem(STORAGE_KEY_LOGOUT_REASON, "timeout");
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
      await logout();
    } catch (err) {
      console.error("Error during idle timeout logout:", err);
    } finally {
      router.push("/login?reason=timeout");
      // Fallback reload if router push is interrupted
      setTimeout(() => {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login?reason=timeout";
        }
      }, 500);
    }
  }, [logout, router]);

  // Reset user activity timer
  const resetActivity = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    if (isWarningOpenRef.current) {
      setIsWarningOpen(false);
    }
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    } catch {}
  }, []);

  // Main Inactivity Watcher Effect
  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      setIsWarningOpen(false);
      return;
    }

    // 0 means disabled
    if (timeoutMinutes <= 0) {
      setIsWarningOpen(false);
      return;
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = WARNING_BEFORE_TIMEOUT_SECONDS * 1000;

    // Initialize or verify current timestamp
    const now = Date.now();
    const stored = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVE));
    if (!stored || isNaN(stored)) {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
      lastActiveRef.current = now;
    } else {
      // Check if user was already inactive before this page load (e.g. computer sleep / closed tab)
      const elapsedOnLoad = now - stored;
      if (elapsedOnLoad >= timeoutMs) {
        handleTimeoutLogout();
        return;
      }
      lastActiveRef.current = stored;
    }

    // User Activity Event Listeners (throttled writing to storage)
    let lastThrottledWrite = Date.now();
    const handleUserInteraction = () => {
      const currentTime = Date.now();
      lastActiveRef.current = currentTime;

      // Automatically dismiss warning modal on user action
      if (isWarningOpenRef.current) {
        setIsWarningOpen(false);
        try {
          localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(currentTime));
        } catch {}
        return;
      }

      // Throttle localStorage write to at most once every 3 seconds
      if (currentTime - lastThrottledWrite >= 3000) {
        lastThrottledWrite = currentTime;
        try {
          localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(currentTime));
        } catch {}
      }
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Cross-tab Synchronization via Storage Event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVE && e.newValue) {
        const otherTabTimestamp = Number(e.newValue);
        if (!isNaN(otherTabTimestamp)) {
          lastActiveRef.current = otherTabTimestamp;
          if (isWarningOpenRef.current) {
            setIsWarningOpen(false);
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Tab Focus & Visibility Watcher
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const checkTime = Date.now();
        const storedTime = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVE)) || lastActiveRef.current;
        const elapsed = checkTime - storedTime;

        if (elapsed >= timeoutMs) {
          handleTimeoutLogout();
        } else if (elapsed < timeoutMs - warningMs) {
          // If active in another tab while this was backgrounded, dismiss warning
          setIsWarningOpen(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    // Periodic Heartbeat Check (every 1 second)
    const intervalId = setInterval(() => {
      const checkNow = Date.now();
      const storedTime = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVE)) || lastActiveRef.current;
      const elapsed = checkNow - storedTime;

      if (elapsed >= timeoutMs) {
        handleTimeoutLogout();
      } else if (elapsed >= timeoutMs - warningMs) {
        const remaining = Math.max(1, Math.ceil((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remaining);
        if (!isWarningOpenRef.current) {
          setIsWarningOpen(true);
        }
      } else {
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, isLoading, timeoutMinutes, handleTimeoutLogout]);

  if (!isAuthenticated || !isWarningOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-5 shadow-2xl ring-4 ring-amber-500/20 text-center">
        {/* Animated Warning Icon */}
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-8 ring-amber-50 dark:ring-amber-950/30">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 uppercase tracking-wider border border-amber-300 dark:border-amber-800">
            Peringatan Keamanan Sesi
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            Sesi Anda Akan Segera Berakhir
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Tidak ada aktivitas yang terdeteksi selama beberapa waktu. Demi keamanan data ISP dan akun Anda, sesi akan ditutup otomatis dalam:
          </p>
        </div>

        {/* Live Countdown Display */}
        <div className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border border-amber-200 dark:border-amber-800/80">
          <div className="flex items-center justify-center space-x-2">
            <span className="font-mono text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400">
              {remainingSeconds}
            </span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Detik
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={resetActivity}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tetap Masuk & Lanjutkan</span>
          </button>

          <button
            type="button"
            onClick={handleTimeoutLogout}
            className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
