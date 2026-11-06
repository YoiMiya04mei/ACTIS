import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logout berhasil.",
  });

  response.cookies.set("actis_session", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}

