import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllowedMenusForRole, getStoredAccessLevels } from "@/lib/accessLevelsStore";
import { resolveDefaultLandingHref } from "@/lib/accessLevels";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("actis_session")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const session = verifySessionToken(sessionToken);
  if (!session) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true },
  });

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role === "request_barang") {
    redirect("/request-barang");
  }

  const stored = await getStoredAccessLevels();
  const allowedMenus = getAllowedMenusForRole(stored.roles, dbUser.role);
  const landing = resolveDefaultLandingHref(allowedMenus) || "/dashboard";
  redirect(landing);
}



