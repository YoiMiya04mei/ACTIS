/**
 * Generates build-info.json before dev/build so runtime has accurate version,
 * git commit/recent commit history (when .git is available), and deterministic build signature.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

function safeExecGit(cmd) {
  try {
    return execSync(cmd, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    })
      .toString("utf8")
      .trim();
  } catch {
    return "";
  }
}

function collectFilesRecursive(dirPath, exts, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, exts, out);
    } else if (entry.isFile()) {
      if (!exts || exts.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  return out;
}

function computeSourceDigest() {
  const hash = crypto.createHash("sha256");
  const candidateFiles = [
    path.join(projectRoot, "package.json"),
    path.join(projectRoot, "CHANGELOG.json"),
    path.join(projectRoot, "next.config.ts"),
    path.join(projectRoot, "prisma", "schema.prisma"),
    ...collectFilesRecursive(path.join(projectRoot, "src"), [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".css",
    ]),
  ];

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) continue;
    const rel = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    hash.update(rel);
    hash.update("\0");
    hash.update(fs.readFileSync(filePath));
    hash.update("\0");
  }

  return hash.digest("hex").slice(0, 16);
}

function main() {
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const version = String(pkg.version || "1.0.0");

  const changelogPath = path.join(projectRoot, "CHANGELOG.json");
  let changelog = {
    app: "ACTIS",
    repository: "YoiMiya04mei/ACTIS",
    branch: "main",
    releases: [],
  };
  if (fs.existsSync(changelogPath)) {
    try {
      changelog = JSON.parse(fs.readFileSync(changelogPath, "utf8"));
    } catch (err) {
      console.warn("[sync-build-info] Failed parsing CHANGELOG.json:", err.message);
    }
  }

  const envCommit = (process.env.ACTIS_GIT_COMMIT || process.env.GIT_COMMIT || "").trim();
  const envBranch = (process.env.ACTIS_GIT_BRANCH || process.env.GIT_BRANCH || "").trim();

  const gitCommit = envCommit || safeExecGit("git rev-parse --short HEAD");
  const gitBranch =
    envBranch || safeExecGit("git rev-parse --abbrev-ref HEAD") || changelog.branch || "main";
  const gitDate = safeExecGit("git log -1 --format=%cI");

  const recentCommitsRaw = safeExecGit('git log -15 --pretty=format:"%h|%cI|%s"');
  const recentCommits = recentCommitsRaw
    ? recentCommitsRaw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [hash, date, ...subjectParts] = line.split("|");
          return {
            hash: (hash || "").trim(),
            date: (date || "").trim(),
            message: subjectParts.join("|").trim(),
          };
        })
    : [];

  const latestRelease =
    Array.isArray(changelog.releases) && changelog.releases.length > 0
      ? changelog.releases[0]
      : null;

  const effectiveCommit = gitCommit || (latestRelease && latestRelease.commit) || "";
  const sourceDigest = computeSourceDigest();

  const signatureSeed = JSON.stringify({
    version,
    commit: effectiveCommit,
    sourceDigest,
    releaseTitle: latestRelease?.title || "",
    releaseVersion: latestRelease?.version || "",
    releaseDate: latestRelease?.date || "",
    changesCount: Array.isArray(latestRelease?.changes) ? latestRelease.changes.length : 0,
    changesDigest: Array.isArray(latestRelease?.changes)
      ? latestRelease.changes.map((c) => `${c.type}:${c.text}`).join("|")
      : "",
  });
  const buildSignature = crypto
    .createHash("sha256")
    .update(signatureSeed)
    .digest("hex")
    .slice(0, 16);

  const existingPath = path.join(projectRoot, "build-info.json");
  let existingBuiltAt = null;
  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
      if (existing.buildSignature === buildSignature && existing.builtAt) {
        existingBuiltAt = existing.builtAt;
      }
    } catch {
      // ignore invalid existing build-info
    }
  }

  const buildInfo = {
    app: pkg.name || "actis",
    version,
    commitHash: effectiveCommit || null,
    commitDate: gitDate || (latestRelease && latestRelease.date) || null,
    branch: gitBranch,
    repository: changelog.repository || "YoiMiya04mei/ACTIS",
    sourceDigest,
    buildSignature,
    builtAt: existingBuiltAt || new Date().toISOString(),
    recentCommits,
  };

  fs.writeFileSync(existingPath, JSON.stringify(buildInfo, null, 2) + "\n", "utf8");
  console.log(
    `[sync-build-info] v${buildInfo.version} (commit: ${buildInfo.commitHash || "docker-ctx"}, sig: ${buildInfo.buildSignature})`
  );
}

main();
