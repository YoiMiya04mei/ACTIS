import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  isSharedStorageKey,
  isSharedDocumentKey,
  isSharedTemplateKey,
} from "@/lib/sharedDocumentKeys";
import {
  getSharedStorageEntry,
  upsertDocumentItem,
  deleteDocumentItem,
  mergeDocumentItems,
  replaceDocumentCollection,
  saveTemplateValue,
} from "@/lib/sharedDocumentStore";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

type RouteContext = {
  params: Promise<{ key: string }>;
};

function decodeSafeKey(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { key: rawKey } = await context.params;
  const key = decodeSafeKey(rawKey);

  if (!isSharedStorageKey(key)) {
    return NextResponse.json(
      { success: false, error: `Storage key '${key}' tidak diizinkan.` },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const entry = await getSharedStorageEntry(key);
    return NextResponse.json(
      {
        success: true,
        ...entry,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error(`GET /api/storage/${key} error:`, err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data dari server." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { key: rawKey } = await context.params;
  const key = decodeSafeKey(rawKey);

  if (!isSharedStorageKey(key)) {
    return NextResponse.json(
      { success: false, error: `Storage key '${key}' tidak diizinkan.` },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  // Templates may only be modified/reset by Administrators
  const auth = isSharedTemplateKey(key)
    ? await requireAuth(request, { requireAdmin: true })
    : await requireAuth(request);
  if (!auth.ok) return auth.response;

  const actor = {
    id: auth.user.id,
    nama: auth.user.nama,
  };

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Payload JSON tidak valid." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const action = typeof body.action === "string" ? body.action : undefined;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    if (isSharedTemplateKey(key)) {
      const templatePayload =
        (body.value && typeof body.value === "object" ? body.value : null) ||
        (body.template && typeof body.template === "object" ? body.template : null);

      if (!templatePayload || Array.isArray(templatePayload)) {
        return NextResponse.json(
          { success: false, error: "Data template harus berupa objek JSON." },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const result = await saveTemplateValue(
        key,
        templatePayload as Record<string, unknown>,
        {
          isDefaultSeed: Boolean(body.isDefaultSeed),
          onlyIfUnsetOrSeed: Boolean(body.onlyIfUnsetOrSeed),
        },
        actor
      );

      if (result.overwritten && !body.isDefaultSeed) {
        recordActivity({
          nama_lengkap: auth.user.nama,
          email: auth.user.email,
          ip_address: clientIp,
          tipe: "SETTING_UPDATE",
          aktifitas: `Memperbarui template surat [${key}]`,
          detail: `Versi server v${result.version}`,
          user_agent: userAgent,
        }).catch(() => {});
      }

      return NextResponse.json(
        {
          success: true,
          ...result,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Shared document collections
    if (!isSharedDocumentKey(key)) {
      return NextResponse.json(
        { success: false, error: "Key tidak didukung." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (action === "upsert_item") {
      const item = body.item;
      if (!item || typeof item !== "object" || typeof item.id !== "string") {
        return NextResponse.json(
          { success: false, error: "Field 'item' dengan 'id' wajib diisi." },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      const result = await upsertDocumentItem(key, item, actor);
      recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: clientIp,
        tipe: "DOCUMENT_GENERATE",
        aktifitas: `Menyimpan dokumen [${key}]`,
        detail: `ID: ${item.id} (v${result.version})`,
        user_agent: userAgent,
      }).catch(() => {});
      return NextResponse.json({ success: true, ...result }, { headers: NO_CACHE_HEADERS });
    }

    if (action === "delete_item") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Field 'id' dokumen wajib diisi." },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      const result = await deleteDocumentItem(key, id, actor);
      if (result.deleted) {
        recordActivity({
          nama_lengkap: auth.user.nama,
          email: auth.user.email,
          ip_address: clientIp,
          tipe: "DELETE_DATA",
          aktifitas: `Menghapus dokumen [${key}]`,
          detail: `ID: ${id} (v${result.version})`,
          user_agent: userAgent,
        }).catch(() => {});
      }
      return NextResponse.json({ success: true, ...result }, { headers: NO_CACHE_HEADERS });
    }

    if (action === "merge") {
      const items = Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.value)
        ? body.value
        : [];
      const result = await mergeDocumentItems(
        key,
        items,
        {
          isDefaultSeed:
            typeof body.isDefaultSeed === "boolean" ? body.isDefaultSeed : undefined,
        },
        actor
      );
      return NextResponse.json({ success: true, ...result }, { headers: NO_CACHE_HEADERS });
    }

    // Legacy setItem compatibility ({ value: [...] })
    if (Array.isArray(body.value)) {
      const result = await replaceDocumentCollection(
        key,
        body.value,
        { isDefaultSeed: Boolean(body.isDefaultSeed) },
        actor
      );
      return NextResponse.json({ success: true, ...result }, { headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json(
      { success: false, error: "Aksi atau format payload tidak valid." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error(`POST /api/storage/${key} error:`, err);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan data ke database server." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const { key: rawKey } = await context.params;
  const key = decodeSafeKey(rawKey);

  if (!isSharedStorageKey(key)) {
    return NextResponse.json(
      { success: false, error: `Storage key '${key}' tidak diizinkan.` },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    await prisma.sharedDocumentEntry.deleteMany({ where: { key } });
    return NextResponse.json(
      { success: true, key },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error(`DELETE /api/storage/${key} error:`, err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus entry dari server." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
