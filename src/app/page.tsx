import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function Home() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  redirect(token ? "/dashboard" : "/login");
}
