import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";

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

  redirect("/queue");
}



