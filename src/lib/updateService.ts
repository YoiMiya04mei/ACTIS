import fs from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activityLogService";

export type ChangeCategory = "feat" | "fix" | "improve" | "security";

export interface ChangelogItem {
  type: ChangeCategory;
  text: string;
}

export interface ChangelogRelease {
  version: string;
  date?: string;
  commit?: string;
  title: string;
  changes: ChangelogItem[];
}

export interface BuildMetadata {
  app: string;
  version: string;
  commitHash: string | null;
  commitDate: string | null;
  branch: string;
  repository: string;
  buildSignature: string;
  builtAt: string;
  recentCommits: { hash: string; date: string; message: string }[];
  releases: ChangelogRelease[];
  runtimeMode: "docker" | "standalone" | "node-server";
  isDocker: boolean;
}

const MAX_ZIP_BYTES = 150 * 1024 * 1024; // 150 MB max release ZIP
const MAX_ZIP_ENTRIES = 25000;
const MAX_UNCOMPRESSED_BYTES = 450 * 1024 * 1024; // Anti-Zip-Bomb budget

const ALLOWED_BUNDLE_TOP_LEVEL = new Set([
  "server.js",
  "package.json",
  "CHANGELOG.json",
  "build-info.json",
  "release-manifest.json",
  "docker-entrypoint.sh",
  ".next",
  "public",
  "prisma",
  "scripts",
]);

let syncPromise: Promise<void> | null = null;
let syncedBuildSignature: string | null = null;

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function compareVersions(a: string, b: string): number {
  const cleanA = String(a || "0.0.0").replace(/^v/i, "").split("-")[0];
  const cleanB = String(b || "0.0.0").replace(/^v/i, "").split("-")[0];
  const partsA = cleanA.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length, 3);
  for (let i = 0; i < len; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function getWritableDataUpdatesDir(): string {
  const dataUpdates = path.join(process.cwd(), "data", "updates");
  try {
    fs.mkdirSync(dataUpdates, { recursive: true });
    fs.accessSync(dataUpdates, fs.constants.W_OK);
    return dataUpdates;
  } catch {
    const hostUpdates = path.join(process.cwd(), "updates");
    fs.mkdirSync(hostUpdates, { recursive: true });
    return hostUpdates;
  }
}

function getHostUpdatesDirIfWritable(): string | null {
  const hostUpdates = path.join(process.cwd(), "updates");
  try {
    fs.mkdirSync(hostUpdates, { recursive: true });
    fs.accessSync(hostUpdates, fs.constants.W_OK);
    const probe = path.join(hostUpdates, ".write-probe");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return hostUpdates;
  } catch {
    return null;
  }
}

function normalizeChangelogItems(raw: unknown): ChangelogItem[] {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set<ChangeCategory>(["feat", "fix", "improve", "security"]);
  return raw
    .map((entry: any) => {
      if (typeof entry === "string") {
        return { type: "improve" as ChangeCategory, text: entry.trim() };
      }
      if (entry && typeof entry.text === "string" && entry.text.trim()) {
        const t = String(entry.type || "feat").toLowerCase();
        return {
          type: validTypes.has(t as ChangeCategory) ? (t as ChangeCategory) : "feat",
          text: entry.text.trim(),
        };
      }
      return null;
    })
    .filter((item): item is ChangelogItem => item !== null);
}

export function getInstalledBuildMetadata(): BuildMetadata {
  const root = process.cwd();
  const pkg = readJsonSafe<{ name?: string; version?: string }>(
    path.join(root, "package.json"),
    { name: "actis", version: "1.1.0" }
  );
  const changelog = readJsonSafe<{
    repository?: string;
    branch?: string;
    releases?: any[];
  }>(path.join(root, "CHANGELOG.json"), {
    repository: "YoiMiya04mei/ACTIS",
    branch: "main",
    releases: [],
  });
  const buildInfo = readJsonSafe<Partial<BuildMetadata>>(
    path.join(root, "build-info.json"),
    {}
  );

  // Check if an offline ZIP bundle specified a custom version override
  const dataMarkerPath = path.join(root, "data", "updates", "applied-override.json");
  const overrideInfo = readJsonSafe<{
    version?: string;
    buildSignature?: string;
    appliedAt?: string;
  } | null>(dataMarkerPath, null);

  const releases: ChangelogRelease[] = Array.isArray(changelog.releases)
    ? changelog.releases.map((r: any) => ({
        version: String(r?.version || "1.0.0"),
        date: typeof r?.date === "string" ? r.date : undefined,
        commit: typeof r?.commit === "string" ? r.commit : undefined,
        title: String(r?.title || `Update v${r?.version || "1.0.0"}`),
        changes: normalizeChangelogItems(r?.changes),
      }))
    : [];

  const baseVersion = String(pkg.version || releases[0]?.version || "1.1.0");
  const effectiveVersion =
    overrideInfo?.version &&
    overrideInfo.buildSignature === buildInfo.buildSignature
      ? overrideInfo.version
      : baseVersion;

  const isDocker = fs.existsSync("/.dockerenv");
  const hasServerJs = fs.existsSync(path.join(root, "server.js"));

  const fallbackSignature = crypto
    .createHash("sha256")
    .update(`${effectiveVersion}:${releases[0]?.title || ""}:${releases.length}`)
    .digest("hex")
    .slice(0, 16);

  return {
    app: pkg.name || "actis",
    version: effectiveVersion,
    commitHash: buildInfo.commitHash || releases[0]?.commit || null,
    commitDate: buildInfo.commitDate || releases[0]?.date || null,
    branch: buildInfo.branch || changelog.branch || "main",
    repository: changelog.repository || "YoiMiya04mei/ACTIS",
    buildSignature: buildInfo.buildSignature || fallbackSignature,
    builtAt: buildInfo.builtAt || new Date().toISOString(),
    recentCommits: Array.isArray(buildInfo.recentCommits) ? buildInfo.recentCommits : [],
    releases,
    isDocker,
    runtimeMode: isDocker ? "docker" : hasServerJs ? "standalone" : "node-server",
  };
}

/**
 * Synchronizes current build version & CHANGELOG.json releases with SystemUpdateHistory
 * on container startup / git pull + docker rebuild / offline ZIP restart.
 */
export async function ensureUpdateHistorySynced(): Promise<void> {
  const meta = getInstalledBuildMetadata();
  if (syncedBuildSignature === meta.buildSignature && syncPromise) {
    return syncPromise;
  }

  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      const root = process.cwd();

      // 1. Complete any pending offline release bundle that just restarted cleanly
      const pendingStatePath = path.join(root, "data", "updates", "last-applied.json");
      const pendingState = readJsonSafe<{
        historyId?: string;
        version?: string;
        buildSignature?: string;
        appliedVersionOverride?: string;
        appliedAt?: string;
      } | null>(pendingStatePath, null);

      if (pendingState?.historyId) {
        const existingRow = await prisma.systemUpdateHistory.findUnique({
          where: { id: pendingState.historyId },
        });
        if (existingRow) {
          await prisma.systemUpdateHistory.update({
            where: { id: existingRow.id },
            data: {
              status: "APPLIED",
              applied_at: new Date(),
              build_signature: meta.buildSignature,
              commit_hash: existingRow.commit_hash || meta.commitHash,
            },
          });

          if (pendingState.appliedVersionOverride) {
            fs.writeFileSync(
              path.join(root, "data", "updates", "applied-override.json"),
              JSON.stringify(
                {
                  version: pendingState.appliedVersionOverride,
                  buildSignature: meta.buildSignature,
                  appliedAt: new Date().toISOString(),
                },
                null,
                2
              )
            );
          }
        }
        try {
          fs.unlinkSync(pendingStatePath);
        } catch {
          // ignore
        }
      }

      // 2. If a source-ZIP rebuild was staged on VPS and container was rebuilt with newer buildSignature, mark staged row completed
      const stagedRows = await prisma.systemUpdateHistory.findMany({
        where: { status: "STAGED_FOR_REBUILD" },
        orderBy: { created_at: "desc" },
      });
      for (const staged of stagedRows) {
        if (
          staged.version === meta.version ||
          compareVersions(meta.version, staged.version) >= 0
        ) {
          if (staged.build_signature !== meta.buildSignature) {
            await prisma.systemUpdateHistory.update({
              where: { id: staged.id },
              data: {
                status: "APPLIED",
                build_signature: meta.buildSignature,
                commit_hash: meta.commitHash || staged.commit_hash,
                applied_at: new Date(),
                notes: `${staged.notes ? `${staged.notes}\n` : ""}Container berhasil di-rebuild & diaktifkan pada versi v${meta.version}.`,
              },
            });
          }
        }
      }

      const existingHistory = await prisma.systemUpdateHistory.findMany({
        orderBy: { created_at: "desc" },
      });

      // 3. Initial seed from CHANGELOG.json if database has zero update records yet
      if (existingHistory.length === 0) {
        const orderedOldestFirst = [...meta.releases].reverse();
        let prevVer: string | null = null;
        for (let i = 0; i < orderedOldestFirst.length; i++) {
          const rel = orderedOldestFirst[i];
          const isLatest = i === orderedOldestFirst.length - 1;
          await prisma.systemUpdateHistory.create({
            data: {
              version: rel.version,
              previous_version: prevVer,
              title: rel.title,
              method: isLatest ? "GIT_DOCKER" : "BASELINE",
              status: "APPLIED",
              commit_hash: rel.commit || (isLatest ? meta.commitHash : null),
              branch: meta.branch,
              build_signature: isLatest ? meta.buildSignature : null,
              changelog_items: JSON.stringify(rel.changes),
              notes: isLatest
                ? "Terdeteksi otomatis saat inisialisasi / build aplikasi."
                : "Catatan rilis historis sistem ACTIS.",
              installed_by: isLatest
                ? "Sistem (Git Pull / Docker Rebuild)"
                : "ACTIS Release Archive",
              applied_at: rel.date ? new Date(`${rel.date}T12:00:00+07:00`) : new Date(),
            },
          });
          prevVer = rel.version;
        }
        syncedBuildSignature = meta.buildSignature;
        return;
      }

      // 4. Subsequent updates: record any newly added release in CHANGELOG.json after git pull + rebuild
      const existingAppliedVersions = new Set(
        existingHistory
          .filter((r) => r.status === "APPLIED")
          .map((r) => r.version)
      );
      const existingSignatures = new Set(
        existingHistory
          .map((r) => r.build_signature)
          .filter((s): s is string => Boolean(s))
      );

      const previousAppliedVersion =
        existingHistory.find((r) => r.status === "APPLIED")?.version || null;

      const missingReleases = [...meta.releases]
        .filter((rel) => !existingAppliedVersions.has(rel.version))
        .reverse();

      let newlyRecordedTitle: string | null = null;
      let newlyRecordedVersion: string | null = null;
      let rollingPrev = previousAppliedVersion;

      for (const rel of missingReleases) {
        await prisma.systemUpdateHistory.create({
          data: {
            version: rel.version,
            previous_version: rollingPrev,
            title: rel.title,
            method: "GIT_DOCKER",
            status: "APPLIED",
            commit_hash:
              rel.commit || (rel.version === meta.version ? meta.commitHash : null),
            branch: meta.branch,
            build_signature:
              rel.version === meta.version ? meta.buildSignature : null,
            changelog_items: JSON.stringify(rel.changes),
            notes: "Terdeteksi otomatis dari git pull / rebuild container Docker.",
            installed_by: "Sistem (Git Pull / Docker Rebuild)",
            applied_at: new Date(),
          },
        });
        newlyRecordedVersion = rel.version;
        newlyRecordedTitle = rel.title;
        rollingPrev = rel.version;
      }

      // 5. Even if package.json version stayed the same across commits (hotfix git pull + rebuild), record new build signature
      if (
        missingReleases.length === 0 &&
        meta.buildSignature &&
        !existingSignatures.has(meta.buildSignature)
      ) {
        const latestRel =
          meta.releases.find((r) => r.version === meta.version) || meta.releases[0];
        const commitBullets: ChangelogItem[] =
          meta.recentCommits.length > 0
            ? meta.recentCommits.slice(0, 5).map((c) => ({
                type: c.message.toLowerCase().startsWith("fix")
                  ? "fix"
                  : c.message.toLowerCase().startsWith("feat")
                  ? "feat"
                  : "improve",
                text: `${c.message} (${c.hash})`,
              }))
            : latestRel?.changes || [
                {
                  type: "improve",
                  text: `Rebuild container ACTIS v${meta.version}${meta.commitHash ? ` (${meta.commitHash})` : ""}`,
                },
              ];

        await prisma.systemUpdateHistory.create({
          data: {
            version: meta.version,
            previous_version: previousAppliedVersion,
            title:
              meta.recentCommits[0]?.message ||
              latestRel?.title ||
              `Update Build v${meta.version}`,
            method: "GIT_DOCKER",
            status: "APPLIED",
            commit_hash: meta.commitHash,
            branch: meta.branch,
            build_signature: meta.buildSignature,
            changelog_items: JSON.stringify(commitBullets),
            notes: "Rebuild otomatis terdeteksi via Docker / Git.",
            installed_by: "Sistem (Git Pull / Docker Rebuild)",
            applied_at: new Date(),
          },
        });
        newlyRecordedVersion = meta.version;
        newlyRecordedTitle = meta.recentCommits[0]?.message || `Build ${meta.buildSignature}`;
      }

      if (newlyRecordedVersion) {
        recordActivity({
          nama_lengkap: "Sistem ACTIS",
          email: "system@actis.local",
          ip_address: "127.0.0.1",
          tipe: "SYSTEM",
          aktifitas: `Pembaruan sistem v${newlyRecordedVersion} berhasil diaktifkan (${newlyRecordedTitle || "Git/Docker Rebuild"})`,
          detail: `Build signature: ${meta.buildSignature}${meta.commitHash ? ` | Commit: ${meta.commitHash}` : ""}`,
        }).catch(() => {});
      }

      syncedBuildSignature = meta.buildSignature;
    } catch (err) {
      console.error("[SystemUpdate] Startup history sync skipped/error:", err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export async function checkRemoteUpdates() {
  const meta = getInstalledBuildMetadata();
  const repoValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(meta.repository);
  const branchValid = /^[A-Za-z0-9_.-]+$/.test(meta.branch);

  if (!repoValid || !branchValid) {
    return {
      online: false,
      hasUpdate: false,
      currentVersion: meta.version,
      remoteVersion: null as string | null,
      pendingReleases: [] as ChangelogRelease[],
      recentCommits: [] as { sha: string; message: string; date: string }[],
      message: "Konfigurasi repository/branch pada CHANGELOG.json tidak valid.",
    };
  }

  const rawBase = `https://raw.githubusercontent.com/${meta.repository}/${meta.branch}`;

  try {
    const [pkgRes, changelogRes] = await Promise.all([
      fetch(`${rawBase}/package.json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${rawBase}/CHANGELOG.json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!pkgRes.ok) {
      return {
        online: false,
        hasUpdate: false,
        currentVersion: meta.version,
        remoteVersion: null as string | null,
        pendingReleases: [] as ChangelogRelease[],
        recentCommits: [] as { sha: string; message: string; date: string }[],
        message: `Repository remote mengembalikan status ${pkgRes.status}. Server tetap aman digunakan secara offline.`,
      };
    }

    const remotePkg = (await pkgRes.json()) as { version?: string };
    const remoteChangelog = changelogRes.ok
      ? ((await changelogRes.json()) as { releases?: any[] })
      : { releases: [] };

    const remoteVersion = String(remotePkg.version || meta.version);
    const hasNewerVersion = compareVersions(remoteVersion, meta.version) > 0;

    const remoteReleases: ChangelogRelease[] = Array.isArray(remoteChangelog.releases)
      ? remoteChangelog.releases.map((r: any) => ({
          version: String(r?.version || "1.0.0"),
          date: r?.date,
          commit: r?.commit,
          title: String(r?.title || `Update v${r?.version}`),
          changes: normalizeChangelogItems(r?.changes),
        }))
      : [];

    const pendingReleases = remoteReleases.filter(
      (r) => compareVersions(r.version, meta.version) > 0
    );

    let recentCommits: { sha: string; message: string; date: string }[] = [];
    try {
      const commitsRes = await fetch(
        `https://api.github.com/repos/${meta.repository}/commits?sha=${meta.branch}&per_page=5`,
        {
          headers: { Accept: "application/vnd.github+json" },
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        }
      );
      if (commitsRes.ok) {
        const commitsJson = (await commitsRes.json()) as any[];
        recentCommits = commitsJson.map((c) => ({
          sha: String(c?.sha || "").slice(0, 7),
          message: String(c?.commit?.message || "").split("\n")[0],
          date: String(c?.commit?.author?.date || ""),
        }));
      }
    } catch {
      // Optional GitHub API commit check; ignore rate limits/offline
    }

    const latestRemoteSha = recentCommits[0]?.sha || null;
    const hasNewCommit =
      Boolean(latestRemoteSha && meta.commitHash && latestRemoteSha !== meta.commitHash) &&
      hasNewerVersion;

    return {
      online: true,
      hasUpdate: hasNewerVersion || hasNewCommit,
      currentVersion: meta.version,
      remoteVersion,
      pendingReleases,
      recentCommits,
      message: hasNewerVersion
        ? `Tersedia versi baru v${remoteVersion}. Jalankan perintah git pull + docker compose up -d --build actis-app di VPS Anda.`
        : `ACTIS sudah berada di versi terbaru (v${meta.version}).`,
    };
  } catch {
    return {
      online: false,
      hasUpdate: false,
      currentVersion: meta.version,
      remoteVersion: null as string | null,
      pendingReleases: [] as ChangelogRelease[],
      recentCommits: [] as { sha: string; message: string; date: string }[],
      message:
        "Server tidak dapat menghubungi GitHub (mode offline / firewall). Gunakan metode upload file .zip manual di bawah.",
    };
  }
}

function validateSafeZipEntryPath(entryPath: string): string | null {
  const normalized = entryPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) return null;
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null;
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === "..") return null;
  }
  return normalized.replace(/\/+$/, "");
}

function unwrapSingleTopDirectory(paths: string[]): string {
  const nonEmpty = paths.filter(Boolean);
  if (nonEmpty.length === 0) return "";
  const hasRootManifest = nonEmpty.some(
    (p) => p === "release-manifest.json" || p === "package.json"
  );
  if (hasRootManifest) return "";

  const firstSegments = new Set(nonEmpty.map((p) => p.split("/")[0]));
  if (firstSegments.size === 1) {
    const [prefix] = [...firstSegments];
    const hasSubManifest = nonEmpty.some(
      (p) => p === `${prefix}/release-manifest.json` || p === `${prefix}/package.json`
    );
    if (hasSubManifest) {
      return `${prefix}/`;
    }
  }
  return "";
}

function parseNotesToChangelogItems(notes: string | undefined): ChangelogItem[] {
  if (!notes || !notes.trim()) return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((text) => {
      const lower = text.toLowerCase();
      let type: ChangeCategory = "feat";
      if (lower.startsWith("[fix]") || lower.includes("perbaikan") || lower.startsWith("fix:")) {
        type = "fix";
      } else if (lower.startsWith("[sec]") || lower.includes("keamanan") || lower.startsWith("security:")) {
        type = "security";
      } else if (lower.startsWith("[improve]") || lower.startsWith("improve:")) {
        type = "improve";
      }
      return {
        type,
        text: text.replace(/^\[(feat|fix|improve|security|sec)\]\s*/i, ""),
      };
    });
}

export async function processUploadedUpdateZip(params: {
  buffer: Buffer;
  fileName: string;
  fileSizeBytes: number;
  versionOverride?: string;
  customTitle?: string;
  customNotes?: string;
  actor: { id: string; nama: string; email: string };
}) {
  const { buffer, fileName, fileSizeBytes, versionOverride, customTitle, customNotes, actor } =
    params;

  if (!fileName.toLowerCase().endsWith(".zip")) {
    throw new Error("Format file tidak valid: hanya file berekstensi .zip yang diperbolehkan.");
  }
  if (buffer.length === 0 || fileSizeBytes > MAX_ZIP_BYTES) {
    throw new Error("Ukuran file .zip melebihi batas maksimal 150 MB atau kosong.");
  }

  // ZIP Magic Bytes validation (PK\x03\x04 or empty PK\x05\x06)
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) || (buffer[2] === 0x05 && buffer[3] === 0x06));
  if (!isZipMagic) {
    throw new Error("Validasi magic bytes gagal: file yang diunggah bukan arsip ZIP yang valid.");
  }

  if (versionOverride && !/^[a-zA-Z0-9._-]{1,32}$/.test(versionOverride.trim())) {
    throw new Error(
      "Format versi tidak valid. Gunakan huruf, angka, titik, atau strip (contoh: 1.7.167)."
    );
  }

  const zip = await JSZip.loadAsync(buffer);
  const fileEntries = Object.values(zip.files).filter((f) => !f.dir);
  if (fileEntries.length === 0) {
    throw new Error("Arsip ZIP kosong dan tidak memiliki file.");
  }
  if (fileEntries.length > MAX_ZIP_ENTRIES) {
    throw new Error("Jumlah file di dalam ZIP melebihi batas keamanan (25.000 file).");
  }

  // Security validation (Zip Slip + symlink check + decompression budget)
  const safeEntries: { relPath: string; entry: JSZip.JSZipObject }[] = [];
  let estimatedTotalBytes = 0;

  for (const entry of fileEntries) {
    // Unix symlink mode check (0120000 >> 16 = 0o120000)
    if (typeof (entry as any).unixPermissions === "number") {
      const fileTypeBits = ((entry as any).unixPermissions >> 12) & 0xf;
      if (fileTypeBits === 0xa) {
        throw new Error(`Keamanan ZIP: symbolic link tidak diperbolehkan (${entry.name}).`);
      }
    }

    const safePath = validateSafeZipEntryPath(entry.name);
    if (!safePath) {
      throw new Error(`Keamanan ZIP: path tidak aman terdeteksi (${entry.name}).`);
    }

    const uncompressedSize = Number((entry as any)._data?.uncompressedSize || 0);
    if (uncompressedSize > 0) {
      estimatedTotalBytes += uncompressedSize;
      if (estimatedTotalBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("Total ukuran ekstrak ZIP melebihi batas keamanan 450 MB.");
      }
    }

    safeEntries.push({ relPath: safePath, entry });
  }

  const wrapperPrefix = unwrapSingleTopDirectory(safeEntries.map((s) => s.relPath));
  const normalizedEntries = safeEntries.map((s) => ({
    relPath: wrapperPrefix && s.relPath.startsWith(wrapperPrefix)
      ? s.relPath.slice(wrapperPrefix.length)
      : s.relPath,
    entry: s.entry,
  }));

  const entryMap = new Map<string, JSZip.JSZipObject>();
  for (const item of normalizedEntries) {
    if (item.relPath) entryMap.set(item.relPath, item.entry);
  }

  const currentMeta = getInstalledBuildMetadata();
  const manualChangelog = parseNotesToChangelogItems(customNotes);

  const manifestEntry = entryMap.get("release-manifest.json");
  const pkgEntry = entryMap.get("package.json");
  const hasServerJs = entryMap.has("server.js");
  const hasDotNext = normalizedEntries.some((e) => e.relPath.startsWith(".next/"));
  const hasSrcDir = normalizedEntries.some((e) => e.relPath.startsWith("src/"));

  // =========================================================================
  // CASE A: Offline Compiled Release Bundle (auto-extract + container restart)
  // =========================================================================
  if (manifestEntry && hasServerJs && hasDotNext) {
    let manifest: any;
    try {
      manifest = JSON.parse(await manifestEntry.async("string"));
    } catch {
      throw new Error("release-manifest.json di dalam ZIP rusak atau bukan JSON valid.");
    }

    if (manifest?.app !== "actis" || manifest?.format !== "actis-release-bundle") {
      throw new Error(
        "File ZIP bukan Offline Release Bundle ACTIS yang sah (release-manifest.json tidak cocok)."
      );
    }

    const targetVersion = (versionOverride?.trim() || String(manifest.version || currentMeta.version)).replace(
      /^v/i,
      ""
    );
    const title =
      customTitle?.trim() ||
      String(manifest.title || `Manual Update v${targetVersion}`);

    const manifestChanges = normalizeChangelogItems(manifest.changelog);
    const combinedChanges =
      manualChangelog.length > 0 ? manualChangelog : manifestChanges;

    const stagingRoot = getWritableDataUpdatesDir();
    const stagingId = `bundle-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const stagingDir = path.join(stagingRoot, "staging", stagingId);
    fs.mkdirSync(stagingDir, { recursive: true });

    let actualUncompressed = 0;
    let extractedCount = 0;

    for (const { relPath, entry } of normalizedEntries) {
      if (!relPath) continue;
      const topSegment = relPath.split("/")[0];
      if (!ALLOWED_BUNDLE_TOP_LEVEL.has(topSegment)) continue;
      if (
        relPath === "public/uploads" ||
        relPath.startsWith("public/uploads/") ||
        relPath.startsWith(".env") ||
        relPath.startsWith("node_modules/")
      ) {
        continue;
      }

      const fileBuf = await entry.async("nodebuffer");
      actualUncompressed += fileBuf.length;
      if (actualUncompressed > MAX_UNCOMPRESSED_BYTES) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw new Error("Total ukuran file ekstrak melewati batas 450 MB.");
      }

      const destPath = path.resolve(stagingDir, relPath);
      if (!destPath.startsWith(stagingDir + path.sep)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw new Error(`Keamanan ZIP: upaya traversal terdeteksi pada ${relPath}`);
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, fileBuf);
      extractedCount++;
    }

    const canAutoRestartInDocker = currentMeta.isDocker || currentMeta.runtimeMode === "standalone";

    const historyRow = await prisma.systemUpdateHistory.create({
      data: {
        version: targetVersion,
        previous_version: currentMeta.version,
        title,
        method: "MANUAL_ZIP_BUNDLE",
        status: canAutoRestartInDocker ? "APPLYING" : "STAGED_FOR_REBUILD",
        commit_hash: manifest.commitHash || null,
        branch: manifest.branch || currentMeta.branch,
        build_signature: manifest.buildSignature || null,
        file_name: path.basename(fileName),
        file_size_bytes: fileSizeBytes,
        changelog_items: JSON.stringify(
          combinedChanges.length > 0
            ? combinedChanges
            : [{ type: "feat", text: `Pemasangan manual paket offline ${path.basename(fileName)}` }]
        ),
        notes: customNotes?.trim() || `Offline Release Bundle (${extractedCount} file divalidasi).`,
        installed_by: actor.nama,
        installed_by_id: actor.id,
      },
    });

    // Write pending release markers for docker-entrypoint.sh
    fs.writeFileSync(path.join(stagingRoot, ".pending-release"), stagingDir, "utf8");
    fs.writeFileSync(
      path.join(stagingRoot, "last-applied.json"),
      JSON.stringify(
        {
          historyId: historyRow.id,
          version: targetVersion,
          buildSignature: manifest.buildSignature || null,
          appliedVersionOverride: versionOverride?.trim() ? targetVersion : undefined,
        },
        null,
        2
      ),
      "utf8"
    );

    recordActivity({
      nama_lengkap: actor.nama,
      email: actor.email,
      ip_address: "127.0.0.1",
      tipe: "SYSTEM",
      aktifitas: `Memasang Offline Release Bundle v${targetVersion} (${path.basename(fileName)})`,
      detail: `${extractedCount} file diekstrak ke staging${canAutoRestartInDocker ? "; merestart container" : ""}`,
    }).catch(() => {});

    if (canAutoRestartInDocker) {
      // Docker `restart: unless-stopped` boots docker-entrypoint.sh cleanly to apply stagingDir before node starts
      setTimeout(() => {
        console.log(`[SystemUpdate] Exiting cleanly to apply staged bundle v${targetVersion}...`);
        process.exit(0);
      }, 900);
    }

    return {
      mode: canAutoRestartInDocker ? ("BUNDLE_RESTARTING" as const) : ("BUNDLE_STAGED_DEV" as const),
      historyId: historyRow.id,
      version: targetVersion,
      title,
      extractedCount,
      willRestart: canAutoRestartInDocker,
      message: canAutoRestartInDocker
        ? `Paket Offline Bundle v${targetVersion} (${extractedCount} file) valid! Aplikasi sedang restart otomatis (sekitar 3–10 detik) untuk mengaktifkan pembaruan.`
        : `Paket Offline Bundle v${targetVersion} tervalidasi & di-staging di ${path.relative(process.cwd(), stagingDir)}. Karena saat ini berjalan dalam mode development (` +
          "`next dev`" +
          `), restart server manual atau jalankan di Docker agar diterapkan otomatis saat startup.`,
    };
  }

  // =========================================================================
  // CASE B: Source Code ZIP (contains package.json for ACTIS + src/)
  // =========================================================================
  if (pkgEntry && hasSrcDir) {
    let uploadedPkg: any;
    try {
      uploadedPkg = JSON.parse(await pkgEntry.async("string"));
    } catch {
      throw new Error("package.json di dalam file ZIP tidak dapat dibaca.");
    }

    if (uploadedPkg?.name !== "actis") {
      throw new Error(
        `Paket source bukan proyek ACTIS (package.json name: "${uploadedPkg?.name || "unknown"}").`
      );
    }

    let zipChangelogReleases: ChangelogRelease[] = [];
    const changelogEntry = entryMap.get("CHANGELOG.json");
    if (changelogEntry) {
      try {
        const parsedChangelog = JSON.parse(await changelogEntry.async("string"));
        if (Array.isArray(parsedChangelog?.releases)) {
          zipChangelogReleases = parsedChangelog.releases.map((r: any) => ({
            version: String(r?.version || "1.0.0"),
            date: r?.date,
            commit: r?.commit,
            title: String(r?.title || ""),
            changes: normalizeChangelogItems(r?.changes),
          }));
        }
      } catch {
        // ignore invalid optional changelog
      }
    }

    const targetVersion = (
      versionOverride?.trim() ||
      String(uploadedPkg.version || currentMeta.version)
    ).replace(/^v/i, "");

    const matchedRelease =
      zipChangelogReleases.find((r) => r.version === targetVersion) || zipChangelogReleases[0];

    const title =
      customTitle?.trim() ||
      matchedRelease?.title ||
      `Update Source ZIP v${targetVersion}`;

    const changes =
      manualChangelog.length > 0
        ? manualChangelog
        : matchedRelease?.changes || [
            {
              type: "improve" as ChangeCategory,
              text: `Unggahan source package ${path.basename(fileName)} (v${targetVersion})`,
            },
          ];

    const hostDir = getHostUpdatesDirIfWritable();
    const targetRoot = hostDir || getWritableDataUpdatesDir();
    const pendingDir = path.join(targetRoot, "source-pending");
    fs.mkdirSync(pendingDir, { recursive: true });

    const safeFileName = `actis-source-v${targetVersion}-${Date.now()}.zip`;
    const savedZipPath = path.join(pendingDir, safeFileName);
    fs.writeFileSync(savedZipPath, buffer);

    const historyRow = await prisma.systemUpdateHistory.create({
      data: {
        version: targetVersion,
        previous_version: currentMeta.version,
        title,
        method: "MANUAL_ZIP_SOURCE",
        status: "STAGED_FOR_REBUILD",
        commit_hash: matchedRelease?.commit || null,
        branch: currentMeta.branch,
        file_name: path.basename(fileName),
        file_size_bytes: fileSizeBytes,
        changelog_items: JSON.stringify(changes),
        notes:
          customNotes?.trim() ||
          `Source ZIP tersimpan di ${hostDir ? "./updates/source-pending/" : "volume data container"}. Jalankan ./scripts/vps-update-zip.sh di server VPS untuk mem-build ulang actis-app.`,
        installed_by: actor.nama,
        installed_by_id: actor.id,
      },
    });

    recordActivity({
      nama_lengkap: actor.nama,
      email: actor.email,
      ip_address: "127.0.0.1",
      tipe: "SYSTEM",
      aktifitas: `Menyiapkan Source Update ZIP v${targetVersion} (${path.basename(fileName)})`,
      detail: `Disimpan ke ${path.relative(process.cwd(), savedZipPath)} (menunggu rebuild container VPS)`,
    }).catch(() => {});

    return {
      mode: "SOURCE_STAGED" as const,
      historyId: historyRow.id,
      version: targetVersion,
      title,
      willRestart: false,
      stagedRelativePath: hostDir
        ? `updates/source-pending/${safeFileName}`
        : `data/updates/source-pending/${safeFileName}`,
      vpsCommand: hostDir
        ? "./scripts/vps-update-zip.sh"
        : `docker cp actis-web:/app/data/updates/source-pending/${safeFileName} ./updates/source-pending/ && ./scripts/vps-update-zip.sh`,
      message: `Source ZIP v${targetVersion} tervalidasi dan tersimpan! Karena ini paket source code (bukan Release Bundle hasil build), jalankan perintah helper di VPS untuk menerapkan & build ulang Docker.`,
    };
  }

  throw new Error(
    "Struktur file ZIP tidak dikenali sebagai paket update ACTIS. Pastikan file berasal dari hasil `npm run release:zip` (Offline Bundle) atau arsip source code ACTIS yang memiliki `package.json` dan folder `src/`."
  );
}
