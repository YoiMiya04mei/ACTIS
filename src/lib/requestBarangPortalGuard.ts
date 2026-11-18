import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RB_SESSION_COOKIE_NAME, verifySecureSessionToken } from "@/lib/security";
import { buildPortalSyntheticEmail } from "@/lib/requestBarangAuth";

export interface PortalAuthenticatedAccount {
  id: string;
  nama: string;
  username: string;
  email: string;
  is_active: boolean;
}

/**
 * Resolves the active isolated `/request-barang` account from `actis_rb_session` cookie.
 * Server-only helper (imports `@/lib/security`). Returns `null` when unauthenticated or missing.
 */
export async function getAuthenticatedPortalAccount(
  request: NextRequest
): Promise<PortalAuthenticatedAccount | null> {
  const rbToken = request.cookies.get(RB_SESSION_COOKIE_NAME)?.value;
  const session = verifySecureSessionToken(rbToken, "rb_session");
  if (!session) return null;

  const dbAccount = await prisma.requestBarangAccount.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      nama: true,
      username: true,
      is_active: true,
    },
  });

  if (!dbAccount) return null;

  return {
    id: dbAccount.id,
    nama: dbAccount.nama,
    username: dbAccount.username,
    email: buildPortalSyntheticEmail(dbAccount.username),
    is_active: dbAccount.is_active,
  };
}
