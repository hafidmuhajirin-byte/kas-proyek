import { redirect } from "next/navigation";

/** Middleware biasanya sudah mengalihkan; fallback aman ke login. */
export default function HomePage() {
  redirect("/login");
}
