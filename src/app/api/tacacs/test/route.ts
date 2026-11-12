import { NextRequest, NextResponse } from "next/server";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { runTacacsSimulation } from "@/lib/tacacs/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const clientIp = String(body.client_ip || "127.0.0.1").trim();
    const command = body.command ? String(body.command) : undefined;
    const authenMode =
      body.authen_mode === "CHAP" || body.authen_mode === "ASCII" ? body.authen_mode : "PAP";

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username wajib diisi untuk simulasi AAA." },
        { status: 400 }
      );
    }

    const result = await runTacacsSimulation({
      username,
      password,
      clientIp,
      command,
      authenMode,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("POST /api/tacacs/test error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menjalankan simulasi AAA." },
      { status: 500 }
    );
  }
}

