/**
 * Builds an offline ACTIS release package (.zip) ready to upload via
 * ACTIS Web UI (/admin/updates -> "Pasang Sekarang").
 *
 * Usage:
 *   npm run release:zip
 *   node scripts/build-release-zip.js --skip-build
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const JSZip = require("jszip");

const projectRoot = path.resolve(__dirname, "..");

function addDirToZip(zip, srcDir, zipPrefix, shouldSkip) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(srcDir, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (shouldSkip && shouldSkip(zipPath, entry)) continue;
    if (entry.isDirectory()) {
      count += addDirToZip(zip, fullPath, zipPath, shouldSkip);
    } else if (entry.isFile()) {
      zip.file(zipPath, fs.readFileSync(fullPath));
      count++;
    }
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes("--skip-build");

  if (!skipBuild) {
    console.log("[release:zip] Building ACTIS standalone production bundle...");
    execSync("npx next build", {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        BUILD_STANDALONE: "true",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
  }

  // Always refresh build-info.json before packaging
  execSync("node scripts/sync-pdfjs-assets.js", { cwd: projectRoot, stdio: "inherit" });
  execSync("node scripts/sync-build-info.js", { cwd: projectRoot, stdio: "inherit" });

  const standaloneDir = path.join(projectRoot, ".next", "standalone");
  const staticDir = path.join(projectRoot, ".next", "static");
  if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
    throw new Error(
      "Missing .next/standalone/server.js. Run without --skip-build or set BUILD_STANDALONE=true."
    );
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const buildInfo = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "build-info.json"), "utf8")
  );
  const changelog = fs.existsSync(path.join(projectRoot, "CHANGELOG.json"))
    ? JSON.parse(fs.readFileSync(path.join(projectRoot, "CHANGELOG.json"), "utf8"))
    : { releases: [] };

  const versionArg = args.find((a) => a.startsWith("--version="));
  const version = versionArg ? versionArg.split("=")[1].trim() : String(pkg.version || "1.0.0");

  const matchingRelease =
    (changelog.releases || []).find((r) => r.version === version) ||
    (changelog.releases && changelog.releases[0]) ||
    null;

  const manifest = {
    app: "actis",
    format: "actis-release-bundle",
    schemaVersion: 1,
    version,
    title: matchingRelease?.title || `ACTIS Release v${version}`,
    commitHash: buildInfo.commitHash || matchingRelease?.commit || null,
    branch: buildInfo.branch || "main",
    buildSignature: buildInfo.buildSignature,
    builtAt: new Date().toISOString(),
    changelog: Array.isArray(matchingRelease?.changes) ? matchingRelease.changes : [],
    recentCommits: Array.isArray(buildInfo.recentCommits)
      ? buildInfo.recentCommits.slice(0, 8)
      : [],
  };

  const zip = new JSZip();
  let fileCount = 0;

  // Root metadata files
  zip.file("release-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  zip.file("package.json", fs.readFileSync(path.join(projectRoot, "package.json")));
  if (fs.existsSync(path.join(projectRoot, "CHANGELOG.json"))) {
    zip.file("CHANGELOG.json", fs.readFileSync(path.join(projectRoot, "CHANGELOG.json")));
  }
  zip.file("build-info.json", fs.readFileSync(path.join(projectRoot, "build-info.json")));
  if (fs.existsSync(path.join(projectRoot, "docker-entrypoint.sh"))) {
    zip.file(
      "docker-entrypoint.sh",
      fs.readFileSync(path.join(projectRoot, "docker-entrypoint.sh"), "utf8").replace(/\r\n/g, "\n")
    );
  }

  // Standalone runtime (server.js & .next, excluding node_modules / .env / uploads / data / updates)
  fileCount += addDirToZip(zip, standaloneDir, "", (zipPath) => {
    const normalized = zipPath.replace(/\\/g, "/");
    return (
      normalized === "node_modules" ||
      normalized.startsWith("node_modules/") ||
      normalized === ".env" ||
      normalized.startsWith(".env.") ||
      normalized.startsWith("public/uploads/") ||
      normalized.startsWith("data/") ||
      normalized.startsWith("updates/") ||
      normalized.startsWith("releases/") ||
      normalized === "package.json"
    );
  });

  // Compiled Next.js browser static assets -> .next/static
  fileCount += addDirToZip(zip, staticDir, ".next/static");

  // Public assets (excluding runtime uploads)
  fileCount += addDirToZip(zip, path.join(projectRoot, "public"), "public", (zipPath) => {
    const normalized = zipPath.replace(/\\/g, "/");
    return normalized === "public/uploads" || normalized.startsWith("public/uploads/");
  });

  // Prisma schema & seed
  fileCount += addDirToZip(zip, path.join(projectRoot, "prisma"), "prisma", (zipPath) => {
    return /\.db(-journal|-wal|-shm)?$/i.test(zipPath);
  });

  // Scripts
  fileCount += addDirToZip(zip, path.join(projectRoot, "scripts"), "scripts");

  const releasesDir = path.join(projectRoot, "releases");
  fs.mkdirSync(releasesDir, { recursive: true });
  const outName = `actis-release-v${version}.zip`;
  const outPath = path.join(releasesDir, outName);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  fs.writeFileSync(outPath, buffer);
  const mb = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`[release:zip] Created ${path.relative(projectRoot, outPath)} (${mb} MB, ${fileCount} files)`);
}

main().catch((err) => {
  console.error("[release:zip] Error:", err);
  process.exit(1);
});
