import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { parseCommandRules, parseServiceAttrs } from "@/lib/tacacs/policy";
import { seedDefaultTacacsGroupsIfEmpty } from "@/lib/tacacs/settings";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

function formatGroup(g: any) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    privilege_level: g.privilege_level,
    default_policy: g.default_policy,
    command_rules: parseCommandRules(g.command_rules),
    service_attrs: parseServiceAttrs(g.service_attrs),
    is_active: g.is_active,
    user_count: g._count?.users ?? 0,
    created_at: g.created_at,
    updated_at: g.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    await seedDefaultTacacsGroupsIfEmpty().catch(() => {});

    const groups = await prisma.tacacsGroup.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ privilege_level: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: groups.map(formatGroup),
    });
  } catch (err: any) {
    console.error("GET /api/tacacs/groups error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memuat grup TACACS+." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body?.action === "seed_presets") {
      const count = await seedDefaultTacacsGroupsIfEmpty();
      return NextResponse.json({
        success: true,
        message:
          count > 0
            ? `${count} grup preset default berhasil dibuat.`
            : "Grup sudah tersedia di database.",
      });
    }

    const name = String(body.name || "").trim();
    if (!name || !/^[a-zA-Z0-9._-]{2,64}$/.test(name)) {
      return NextResponse.json(
        { success: false, error: "Nama grup wajib 2-64 karakter (alfanumerik, titik, strip, underscore)." },
        { status: 400 }
      );
    }

    const dup = await prisma.tacacsGroup.findUnique({ where: { name } });
    if (dup) {
      return NextResponse.json(
        { success: false, error: `Grup '${name}' sudah ada.` },
        { status: 409 }
      );
    }

    const priv = Number(body.privilege_level ?? 15);
    if (!Number.isInteger(priv) || priv < 0 || priv > 15) {
      return NextResponse.json(
        { success: false, error: "Privilege level harus antara 0 hingga 15." },
        { status: 400 }
      );
    }

    const defaultPolicy = body.default_policy === "permit" ? "permit" : "deny";
    const rules = Array.isArray(body.command_rules) ? body.command_rules : [];
    const attrs = Array.isArray(body.service_attrs) ? body.service_attrs : [];

    const created = await prisma.tacacsGroup.create({
      data: {
        name,
        description: body.description ? String(body.description).trim() : null,
        privilege_level: priv,
        default_policy: defaultPolicy,
        command_rules: JSON.stringify(rules),
        service_attrs: JSON.stringify(attrs),
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      },
      include: { _count: { select: { users: true } } },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_GROUP",
      aktifitas: `Membuat grup TACACS+ '${created.name}' (priv ${created.privilege_level})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: `Grup TACACS+ '${created.name}' berhasil dibuat.`,
        data: formatGroup(created),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/tacacs/groups error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal membuat grup TACACS+." },
      { status: 500 }
    );
  }
}

