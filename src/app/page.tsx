import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";

export default async function Home() {
  const session = await getServerAuthSession();
  redirect(session ? "/panel" : "/login");
}
