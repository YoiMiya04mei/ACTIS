import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security";
import { recordActivity } from "@/lib/activityLogService";
import {
  checkRemoteUpdates,
  ensureUpdateHistorySynced,
  getInstalledBuildMetadata,
  type ChangeCategory,
} from "@/lib/updateService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseStoredChanges(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    await ensureUpdateHistorySynced();
    const meta = getInstalledBuildMetadata();
    const rows = await prisma.systemUpdateHistory.findMany({
      orderBy: [{ applied_at: "desc" }, { created_at: "desc" }],
    });

    let foundCurrent = false;
    const history = rows.map((row) => {
      const parsedChanges = parseStoredChanges(row.changelog_items);
      const isCurrent =
        !foundCurrent &&
        row.status === "APPLIED" &&
        (row.build_signature === meta.buildSignature || row.version === meta.version);
      if (isCurrent) foundCurrent = true;
      return {
        ...row,
        changelog_items: parsedChanges,
        isCurrent,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        currentVersion: meta.version,
        buildInfo: {
          version: meta.version,
          commitHash: meta.commitHash,
          commitDate: meta.commitDate,
          branch: meta.branch,
          repository: meta.repository,
          buildSignature: meta.buildSignature,
          builtAt: meta.builtAt,
          runtimeMode: meta.runtimeMode,
          isDocker: meta.isDocker,
        },
        isAdmin: auth.user.role === "admin",
        history,
      },
    });
  } catch (err: any) {
    console.error("GET /api/system/updates error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat informasi pembaruan dan riwayat versi sistem." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "check_remote") {
      const result = await checkRemoteUpdates();
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "add_changelog") {
      const meta = getInstalledBuildMetadata();
      const version = String(body?.version || meta.version).trim().replace(/^v/i, "");
      const title = String(body?.title || "").trim();
      const notes = String(body?.notes || "").trim();
      const changesRaw = String(body?.changesText || "").trim();

      if (!version || !/^[a-zA-Z0-9._-]{1,32}$/.test(version)) {
        return NextResponse.json(
          { success: false, error: "Format versi tidak valid." },
          { status: 400 }
        );
      }
      if (!title) {
        return NextResponse.json(
          { success: false, error: "Judul perubahan fitur wajib diisi." },
          { status: 400 }
        );
      }

      const validTypes = new Set<ChangeCategory>(["feat", "fix", "improve", "security"]);
      const defaultType: ChangeCategory = validTypes.has(body?.defaultType)
        ? body.defaultType
        : "feat";

      const items = changesRaw
        ? changesRaw
            .split(/\r?\n/)
            .map((line) => line.replace(/^[-*•]\s*/, "").trim())
            .filter(Boolean)
            .map((text) => {
              const lower = text.toLowerCase();
              let type: ChangeCategory = defaultType;
              if (lower.startsWith("[fix]") || lower.startsWith("fix:")) type = "fix";
              else if (lower.startsWith("[improve]") || lower.startsWith("improve:"))
                type = "improve";
              else if (lower.startsWith("[security]") || lower.startsWith("[sec]"))
                type = "security";
              else if (lower.startsWith("[feat]") || lower.startsWith("feat:")) type = "feat";
              return {
                type,
                text: text.replace(/^\[(feat|fix|improve|security|sec)\]\s*/i, ""),
              };
            })
        : [{ type: defaultType, text: title }];

      const created = await prisma.systemUpdateHistory.create({
        data: {
          version,
          previous_version: meta.version,
          title,
          method: "MANUAL_NOTE",
          status: "APPLIED",
          branch: meta.branch,
          commit_hash: meta.commitHash,
          changelog_items: JSON.stringify(items),
          notes: notes || null,
          installed_by: auth.user.nama,
          installed_by_id: auth.user.id,
        },
      });

      recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
        tipe: "SYSTEM",
        aktifitas: `Menambahkan catatan perubahan fitur v${version}: ${title}`,
        detail: `${items.length} poin perubahan dicatat ke riwayat update`,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Catatan perubahan fitur berhasil ditambahkan ke riwayat update.",
        data: { ...created, changelog_items: items },
      });
    }

    return NextResponse.json(
      { success: false, error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("POST /api/system/updates error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memproses permintaan pembaruan sistem." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const notes = typeof body?.notes === "string" ? body.notes.trim() : undefined;
    const title = typeof body?.title === "string" ? body.title.trim() : undefined;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID riwayat update wajib disertakan." },
        { status: 400 }
      );
    }

    const updated = await prisma.systemUpdateHistory.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Catatan riwayat update berhasil diperbarui.",
      data: {
        ...updated,
        changelog_items: parseStoredChanges(updated.changelog_items),
      },
    });
  } catch (err: any) {
    console.error("PATCH /api/system/updates error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui catatan riwayat update." },
      { status: 500 }
    );
  }
}
