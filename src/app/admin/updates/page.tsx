"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
  GitBranch,
  History,
  FileArchive,
  Search,
  Plus,
  X,
  ShieldCheck,
  Sparkles,
  Wrench,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  CloudOff,
  DownloadCloud,
  Pencil,
  Server,
  Info,
} from "lucide-react";

type ChangeCategory = "feat" | "fix" | "improve" | "security";

interface ChangelogItem {
  type: ChangeCategory;
  text: string;
}

interface UpdateHistoryRecord {
  id: string;
  version: string;
  previous_version?: string | null;
  title: string;
  method: string;
  status: string;
  commit_hash?: string | null;
  branch?: string | null;
  build_signature?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  changelog_items: ChangelogItem[];
  notes?: string | null;
  installed_by?: string | null;
  applied_at: string;
  created_at: string;
  isCurrent?: boolean;
}

interface BuildInfo {
  version: string;
  commitHash: string | null;
  commitDate: string | null;
  branch: string;
  repository: string;
  buildSignature: string;
  builtAt: string;
  runtimeMode: "docker" | "standalone" | "node-server";
  isDocker: boolean;
}

interface RemoteCheckResult {
  online: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  remoteVersion: string | null;
  pendingReleases: {
    version: string;
    date?: string;
    title: string;
    changes: ChangelogItem[];
  }[];
  recentCommits: { sha: string; message: string; date: string }[];
  message: string;
}

function formatWibDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d) + " WIB"
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMethodBadge(method: string) {
  switch (method) {
    case "GIT_DOCKER":
      return {
        label: "Git Pull & Docker",
        className:
          "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70",
      };
    case "MANUAL_ZIP_BUNDLE":
      return {
        label: "File ZIP (Offline Bundle)",
        className:
          "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70",
      };
    case "MANUAL_ZIP_SOURCE":
      return {
        label: "File ZIP (Source VPS)",
        className:
          "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/70",
      };
    case "MANUAL_NOTE":
      return {
        label: "Catatan Admin",
        className:
          "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70",
      };
    default:
      return {
        label: "Rilis Historis",
        className:
          "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      };
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "APPLIED":
      return {
        label: "Terpasang",
        className:
          "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70",
      };
    case "STAGED_FOR_REBUILD":
      return {
        label: "Menunggu Rebuild VPS",
        className:
          "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70",
      };
    case "APPLYING":
      return {
        label: "Sedang Dipasang",
        className:
          "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70",
      };
    case "FAILED":
      return {
        label: "Gagal",
        className:
          "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
      };
    default:
      return {
        label: status,
        className:
          "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      };
  }
}

function getChangeCategoryBadge(type: ChangeCategory) {
  switch (type) {
    case "feat":
      return {
        label: "BARU",
        icon: <Sparkles className="w-3 h-3" />,
        className:
          "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
      };
    case "fix":
      return {
        label: "PERBAIKAN",
        icon: <Wrench className="w-3 h-3" />,
        className:
          "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
      };
    case "security":
      return {
        label: "KEAMANAN",
        icon: <ShieldCheck className="w-3 h-3" />,
        className:
          "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
      };
    default:
      return {
        label: "PENINGKATAN",
        icon: <TrendingUp className="w-3 h-3" />,
        className:
          "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
      };
  }
}

export default function SystemUpdatesPage() {
  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog } = useDialog();
  const isAdmin = currentUser?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [history, setHistory] = useState<UpdateHistoryRecord[]>([]);

  // Remote Git check state
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [remoteResult, setRemoteResult] = useState<RemoteCheckResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Manual ZIP upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zipVersion, setZipVersion] = useState("");
  const [zipTitle, setZipTitle] = useState("");
  const [zipNotes, setZipNotes] = useState("");
  const [showZipExtras, setShowZipExtras] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: "success" | "warning" | "error";
    message: string;
    vpsCommand?: string;
    stagedPath?: string;
  } | null>(null);
  const [restartingBanner, setRestartingBanner] = useState(false);

  // History filtering & UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Manual changelog modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteVersion, setNoteVersion] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteType, setNoteType] = useState<ChangeCategory>("feat");
  const [noteChanges, setNoteChanges] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Edit notes modal
  const [editTarget, setEditTarget] = useState<UpdateHistoryRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotesText, setEditNotesText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUpdateState = useCallback(async () => {
    try {
      const res = await fetch("/api/system/updates", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setBuildInfo(json.data.buildInfo);
        const rows: UpdateHistoryRecord[] = json.data.history || [];
        setHistory(rows);
        setExpandedIds((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const init: Record<string, boolean> = {};
          rows.slice(0, 3).forEach((r) => {
            init[r.id] = true;
          });
          return init;
        });
      }
    } catch (err) {
      console.error("Failed to fetch system updates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdateState();
  }, [fetchUpdateState]);

  const handleCopyCommand = async (key: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 2200);
    } catch {
      // Fallback ignored
    }
  };

  const handleCheckRemote = async () => {
    setCheckingRemote(true);
    try {
      const res = await fetch("/api/system/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_remote" }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setRemoteResult(json.data);
      } else {
        setRemoteResult({
          online: false,
          hasUpdate: false,
          currentVersion: buildInfo?.version || "1.1.0",
          remoteVersion: null,
          pendingReleases: [],
          recentCommits: [],
          message: json.error || "Gagal memeriksa update remote.",
        });
      }
    } catch {
      setRemoteResult({
        online: false,
        hasUpdate: false,
        currentVersion: buildInfo?.version || "1.1.0",
        remoteVersion: null,
        pendingReleases: [],
        recentCommits: [],
        message: "Tidak dapat terhubung ke server.",
      });
    } finally {
      setCheckingRemote(false);
    }
  };

  const startRestartPolling = () => {
    setRestartingBanner(true);
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/system/updates", { cache: "no-store" });
        if (res.ok) {
          clearInterval(poll);
          window.location.reload();
        }
      } catch {
        // Container still restarting
      }
      if (attempts >= 35) {
        clearInterval(poll);
        setRestartingBanner(false);
      }
    }, 2000);
  };

  const handleInstallZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !isAdmin) return;

    const ok = await confirmDialog({
      title: "Pasang Update dari File ZIP?",
      message: `Anda akan memproses paket update "${selectedFile.name}" (${formatBytes(
        selectedFile.size
      )})${zipVersion ? ` dengan label versi ${zipVersion}` : ""}. Jika berupa Offline Release Bundle, container akan restart otomatis sekitar 3-10 detik.`,
      confirmText: "Ya, Pasang Sekarang",
      cancelText: "Batal",
      variant: "info",
    });

    if (!ok) return;

    setUploadingZip(true);
    setUploadFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (zipVersion.trim()) formData.append("version", zipVersion.trim());
      if (zipTitle.trim()) formData.append("title", zipTitle.trim());
      if (zipNotes.trim()) formData.append("changelog", zipNotes.trim());

      const res = await fetch("/api/system/updates/upload-zip", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!json.success) {
        setUploadFeedback({
          type: "error",
          message: json.error || "Gagal memproses paket ZIP update.",
        });
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setZipVersion("");
      setZipTitle("");
      setZipNotes("");

      if (json.mode === "BUNDLE_RESTARTING") {
        setUploadFeedback({
          type: "success",
          message: json.message,
        });
        startRestartPolling();
      } else if (json.mode === "SOURCE_STAGED") {
        setUploadFeedback({
          type: "warning",
          message: json.message,
          vpsCommand: json.vpsCommand,
          stagedPath: json.stagedRelativePath,
        });
        await fetchUpdateState();
      } else {
        setUploadFeedback({
          type: "success",
          message: json.message,
        });
        await fetchUpdateState();
      }
    } catch (err: any) {
      setUploadFeedback({
        type: "error",
        message: err?.message || "Terjadi kesalahan saat mengunggah file ZIP.",
      });
    } finally {
      setUploadingZip(false);
    }
  };

  const handleAddChangelog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !isAdmin) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/system/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_changelog",
          version: noteVersion.trim() || buildInfo?.version || "1.1.0",
          title: noteTitle.trim(),
          defaultType: noteType,
          changesText: noteChanges.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setNoteVersion("");
        setNoteTitle("");
        setNoteChanges("");
        await fetchUpdateState();
      }
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEditNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !isAdmin) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/system/updates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          title: editTitle.trim(),
          notes: editNotesText.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditTarget(null);
        await fetchUpdateState();
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      if (methodFilter === "GIT" && item.method !== "GIT_DOCKER") return false;
      if (
        methodFilter === "ZIP" &&
        item.method !== "MANUAL_ZIP_BUNDLE" &&
        item.method !== "MANUAL_ZIP_SOURCE"
      )
        return false;
      if (
        methodFilter === "NOTE" &&
        item.method !== "BASELINE" &&
        item.method !== "MANUAL_NOTE"
      )
        return false;

      if (!q) return true;
      const inChanges = item.changelog_items.some((c) =>
        c.text.toLowerCase().includes(q)
      );
      return (
        item.version.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.commit_hash || "").toLowerCase().includes(q) ||
        (item.installed_by || "").toLowerCase().includes(q) ||
        (item.file_name || "").toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q) ||
        inChanges
      );
    });
  }, [history, methodFilter, searchQuery]);

  const stagedSourceItems = useMemo(
    () => history.filter((h) => h.status === "STAGED_FOR_REBUILD"),
    [history]
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Container Restarting Overlay */}
      {restartingBanner && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Menerapkan Update & Restart Container...
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Paket Offline Bundle sedang diterapkan oleh container{" "}
                <code className="font-mono font-semibold">actis-app</code>. Halaman
                akan dimuat ulang otomatis begitu server siap kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header & Active Version Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              <Server className="w-3 h-3" />
              SYSTEM UPDATE & CHANGELOG
            </span>
            {buildInfo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Versi Aktif: v{buildInfo.version}
              </span>
            )}
            {buildInfo?.commitHash && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <GitBranch className="w-3 h-3" />
                {buildInfo.branch}@{buildInfo.commitHash}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Pembaruan Sistem & Riwayat Perubahan Fitur
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Kelola update aplikasi melalui server VPS (<code className="font-mono text-xs">git pull + docker compose</code>)
            maupun file <code className="font-mono text-xs">.zip</code> manual dengan pencatatan history otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={handleCheckRemote}
              disabled={checkingRemote}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingRemote ? "animate-spin" : ""}`}
              />
              <span>{checkingRemote ? "Memeriksa..." : "Cek Update Online"}</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setNoteVersion(buildInfo?.version || "1.1.0");
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Perubahan Fitur</span>
            </button>
          )}
        </div>
      </div>

      {/* Pending VPS Rebuild Alert if a source .zip is staged */}
      {stagedSourceItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Ada {stagedSourceItems.length} Paket Source ZIP Menunggu Rebuild di VPS
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300/90">
                Jalankan script helper berikut pada folder proyek di VPS untuk mengekstrak & membangun ulang container{" "}
                <code className="font-mono font-bold">actis-app</code>:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              handleCopyCommand("pending-zip-cmd", "./scripts/vps-update-zip.sh")
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 transition"
          >
            {copiedCmd === "pending-zip-cmd" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <code className="font-mono">./scripts/vps-update-zip.sh</code>
          </button>
        </div>
      )}

      {/* Two Update Methods Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Method 1: VPS Git Pull + Docker Compose */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                  <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Metode 1 · Server VPS Langsung
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Git Pull & Docker Compose Rebuild
                  </h2>
                </div>
              </div>
              {buildInfo && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {buildInfo.isDocker ? "Docker Container" : buildInfo.runtimeMode}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Jalankan langsung dari terminal SSH server VPS. Saat container{" "}
              <code className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                actis-app
              </code>{" "}
              selesai dibangun ulang dan menyala, versi baru beserta daftar perubahan pada{" "}
              <code className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                CHANGELOG.json
              </code>{" "}
              otomatis masuk ke tabel History di bawah.
            </p>

            {/* Primary VPS Command Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 bg-slate-900 dark:bg-[#111620] text-slate-100 border border-slate-700/80 rounded-xl px-3.5 py-2.5">
                <code className="text-xs font-mono truncate">
                  git pull && docker compose up -d --build actis-app
                </code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCommand(
                      "git-docker",
                      "git pull && docker compose up -d --build actis-app"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold shrink-0 transition"
                >
                  {copiedCmd === "git-docker" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl px-3.5 py-2">
                <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  Atau pakai script otomatis (sekalian menyertakan hash commit Git):{" "}
                  <code className="font-mono font-bold text-slate-800 dark:text-slate-100">
                    ./scripts/vps-update-git.sh
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCommand("git-script", "./scripts/vps-update-git.sh")
                  }
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  {copiedCmd === "git-script" ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>

            {/* Remote Check Result */}
            {remoteResult && (
              <div
                className={`rounded-xl p-3.5 border text-xs space-y-2 ${
                  !remoteResult.online
                    ? "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    : remoteResult.hasUpdate
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-200"
                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!remoteResult.online ? (
                    <CloudOff className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
                  ) : remoteResult.hasUpdate ? (
                    <DownloadCloud className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div className="space-y-1 flex-1">
                    <p className="font-bold">{remoteResult.message}</p>
                    {remoteResult.pendingReleases.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {remoteResult.pendingReleases.slice(0, 2).map((rel) => (
                          <div
                            key={rel.version}
                            className="bg-white/70 dark:bg-slate-900/70 rounded-lg p-2 border border-blue-200/70 dark:border-blue-800/50"
                          >
                            <p className="font-bold text-[11px]">
                              v{rel.version} — {rel.title}
                            </p>
                            <ul className="list-disc list-inside text-[11px] mt-1 space-y-0.5 opacity-90">
                              {rel.changes.slice(0, 4).map((c, idx) => (
                                <li key={idx}>{c.text}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Build Signature:{" "}
              <code className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {buildInfo?.buildSignature || "-"}
              </code>
            </span>
            <span>Build Time: {formatWibDate(buildInfo?.builtAt)}</span>
          </div>
        </div>

        {/* Method 2: Upload Manual .zip */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <form onSubmit={handleInstallZip} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                  <FileArchive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Metode 2 · Paket File .zip
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Pasang Manual dari File .zip
                  </h2>
                </div>
              </div>
              {!isAdmin && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Khusus Admin
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Atau pasang manual dari file <code className="font-mono">.zip</code>{" "}
              (dipakai kalau server ini tidak bisa akses internet, atau file update dikirim
              langsung oleh developer).
            </p>

            {/* File + "Pasang Sekarang" unified bar matching user reference */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch rounded-xl border border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <label className="flex-1 flex items-center gap-3 px-3 py-2 cursor-pointer min-w-0 hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 shadow-2xs">
                    Pilih File
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                    {selectedFile
                      ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
                      : "Belum ada file .zip dipilih"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    disabled={!isAdmin || uploadingZip}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                      setUploadFeedback(null);
                    }}
                    className="sr-only"
                  />
                </label>

                <button
                  type="submit"
                  disabled={!isAdmin || !selectedFile || uploadingZip}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/55 text-white text-xs font-bold transition shrink-0"
                >
                  {uploadingZip ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingZip ? "Memproses..." : "Pasang Sekarang"}</span>
                </button>
              </div>

              <input
                type="text"
                value={zipVersion}
                onChange={(e) => setZipVersion(e.target.value)}
                disabled={!isAdmin || uploadingZip}
                placeholder="Versi update (opsional), misalnya 1.7.167"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />

              <div>
                <button
                  type="button"
                  onClick={() => setShowZipExtras(!showZipExtras)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                >
                  {showZipExtras ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  <span>Tambah judul & catatan perubahan fitur (opsional)</span>
                </button>

                {showZipExtras && (
                  <div className="mt-2.5 space-y-2.5 animate-fadeIn">
                    <input
                      type="text"
                      value={zipTitle}
                      onChange={(e) => setZipTitle(e.target.value)}
                      disabled={!isAdmin || uploadingZip}
                      placeholder="Judul update (contoh: Perbaikan export laporan & dark mode)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <textarea
                      rows={3}
                      value={zipNotes}
                      onChange={(e) => setZipNotes(e.target.value)}
                      disabled={!isAdmin || uploadingZip}
                      placeholder={
                        "Catatan perubahan (1 baris = 1 poin), contoh:\n[feat] Tambah menu monitoring VLAN\n[fix] Perbaiki upload PDF kop surat"
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            </div>

            {uploadFeedback && (
              <div
                className={`rounded-xl p-3.5 border text-xs space-y-2 ${
                  uploadFeedback.type === "error"
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200"
                    : uploadFeedback.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                <p className="font-semibold leading-relaxed">{uploadFeedback.message}</p>
                {uploadFeedback.vpsCommand && (
                  <div className="flex items-center justify-between gap-2 bg-slate-900 text-slate-100 rounded-lg px-3 py-2">
                    <code className="font-mono text-[11px] truncate">
                      {uploadFeedback.vpsCommand}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyCommand("feedback-cmd", uploadFeedback.vpsCommand!)
                      }
                      className="text-[11px] font-bold text-emerald-400 hover:underline shrink-0"
                    >
                      {copiedCmd === "feedback-cmd" ? "Tersalin" : "Salin"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>
              Mendukung{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                Offline Release Bundle
              </strong>{" "}
              (<code className="font-mono">npm run release:zip</code>, langsung terpasang +
              restart otomatis) maupun{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                Source Archive .zip
              </strong>{" "}
              (<code className="font-mono">./scripts/vps-update-zip.sh</code>).
            </span>
          </div>
        </div>
      </div>

      {/* Update History & Feature Changelog */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                History Perubahan Fitur & Riwayat Update
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan {filteredHistory.length} dari {history.length} catatan pembaruan sistem
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Method Filter */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {[
                { id: "ALL", label: "Semua" },
                { id: "GIT", label: "Git & Docker" },
                { id: "ZIP", label: "File ZIP" },
                { id: "NOTE", label: "Catatan / Rilis" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMethodFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    methodFilter === tab.id
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari versi, fitur, commit..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            Memuat riwayat pembaruan sistem...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            Belum ada catatan pembaruan yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => {
              const methodInfo = getMethodBadge(item.method);
              const statusInfo = getStatusBadge(item.status);
              const isExpanded = Boolean(expandedIds[item.id]);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border transition ${
                    item.isCurrent
                      ? "border-blue-300 dark:border-blue-800/70 bg-blue-50/20 dark:bg-blue-950/15"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      className="space-y-1.5 flex-1 cursor-pointer"
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black font-mono bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100">
                          v{item.version}
                        </span>
                        {item.isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                            <CheckCircle2 className="w-3 h-3" />
                            Aktif Saat Ini
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${methodInfo.className}`}
                        >
                          {methodInfo.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        {item.commit_hash && (
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            #{item.commit_hash}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatWibDate(item.applied_at || item.created_at)}
                        </span>
                        {item.installed_by && <span>Oleh: {item.installed_by}</span>}
                        {item.previous_version &&
                          item.previous_version !== item.version && (
                            <span className="font-mono">
                              v{item.previous_version} → v{item.version}
                            </span>
                          )}
                        {item.file_name && (
                          <span className="font-mono">
                            ZIP: {item.file_name}
                            {item.file_size_bytes
                              ? ` (${formatBytes(item.file_size_bytes)})`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget(item);
                            setEditTitle(item.title);
                            setEditNotesText(item.notes || "");
                          }}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
                          title="Edit Catatan Rilis"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        <span>
                          {item.changelog_items.length} perubahan
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                      {item.changelog_items.length > 0 && (
                        <ul className="space-y-1.5">
                          {item.changelog_items.map((change, idx) => {
                            const cat = getChangeCategoryBadge(change.type);
                            return (
                              <li
                                key={idx}
                                className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5 ${cat.className}`}
                                >
                                  {cat.icon}
                                  {cat.label}
                                </span>
                                <span className="leading-relaxed">{change.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-lg px-3 py-2 whitespace-pre-line">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Manual Changelog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Catat Perubahan Fitur / Update Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddChangelog} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Versi Rilis
                  </label>
                  <input
                    type="text"
                    required
                    value={noteVersion}
                    onChange={(e) => setNoteVersion(e.target.value)}
                    placeholder="1.1.0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori Default
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as ChangeCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="feat">Fitur Baru</option>
                    <option value="fix">Perbaikan Bug</option>
                    <option value="improve">Peningkatan</option>
                    <option value="security">Keamanan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Update *
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Contoh: Penambahan integrasi VLAN & penyesuaian laporan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daftar Poin Perubahan (1 baris = 1 item)
                </label>
                <textarea
                  rows={4}
                  value={noteChanges}
                  onChange={(e) => setNoteChanges(e.target.value)}
                  placeholder={
                    "[feat] Tambah menu Update & Changelog\n[fix] Perbaiki export voucher PDF\n[security] Validasi upload ZIP"
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
                >
                  {savingNote ? "Menyimpan..." : "Simpan ke History"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Notes Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Catatan Rilis v{editTarget.version}
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditNotes} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Update
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Operasional Tambahan
                </label>
                <textarea
                  rows={4}
                  value={editNotesText}
                  onChange={(e) => setEditNotesText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
                >
                  {savingEdit ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
