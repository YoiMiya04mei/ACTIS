/**
 * Helper CLI to record a new timestamped release entry in CHANGELOG.json,
 * bump package.json version, and refresh build-info.json.
 *
 * Example:
 *   npm run release:log -- --version=1.2.1 --title="Judul Perubahan" --feat="Fitur baru A" --fix="Perbaikan B"
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

function formatWibIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
}

function incrementPatchVersion(ver) {
  const clean = String(ver || "1.0.0").replace(/^v/i, "").split("-")[0];
  const parts = clean.split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}

function main() {
  const args = process.argv.slice(2);
  const pkgPath = path.join(projectRoot, "package.json");
  const changelogPath = path.join(projectRoot, "CHANGELOG.json");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const changelog = fs.existsSync(changelogPath)
    ? JSON.parse(fs.readFileSync(changelogPath, "utf8"))
    : {
        app: "ACTIS",
        repository: "YoiMiya04mei/ACTIS",
        branch: "main",
        releases: [],
      };

  let version = "";
  let title = "";
  let commit = "";
  const changes = [];

  for (const arg of args) {
    if (arg.startsWith("--version=")) version = arg.slice(10).trim().replace(/^v/i, "");
    else if (arg.startsWith("--title=")) title = arg.slice(8).trim();
    else if (arg.startsWith("--commit=")) commit = arg.slice(9).trim();
    else if (arg.startsWith("--feat=")) changes.push({ type: "feat", text: arg.slice(7).trim() });
    else if (arg.startsWith("--fix=")) changes.push({ type: "fix", text: arg.slice(6).trim() });
    else if (arg.startsWith("--improve=")) changes.push({ type: "improve", text: arg.slice(10).trim() });
    else if (arg.startsWith("--security=")) changes.push({ type: "security", text: arg.slice(11).trim() });
  }

  if (!version) {
    version = incrementPatchVersion(pkg.version);
  }
  if (!title) {
    console.error("[release:log] Error: --title=\"...\" wajib diisi.");
    process.exit(1);
  }
  if (changes.length === 0) {
    changes.push({ type: "feat", text: title });
  }

  const nowIso = formatWibIso(new Date());
  const entry = {
    version,
    date: nowIso,
    ...(commit ? { commit } : {}),
    title,
    changes,
  };

  changelog.releases = Array.isArray(changelog.releases) ? changelog.releases : [];
  const existingIdx = changelog.releases.findIndex((r) => r.version === version);
  if (existingIdx >= 0) {
    changelog.releases[existingIdx] = entry;
  } else {
    changelog.releases.unshift(entry);
  }

  pkg.version = version;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + "\n", "utf8");
  execSync("node scripts/sync-build-info.js", { cwd: projectRoot, stdio: "inherit" });

  console.log(`[release:log] Recorded v${version} (${nowIso}) -> CHANGELOG.json & package.json`);
}

main();
