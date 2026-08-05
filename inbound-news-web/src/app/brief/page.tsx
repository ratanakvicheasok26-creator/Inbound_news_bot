import { redirect } from "next/navigation"
import { todayPhnomPenhYmd } from "@/lib/posts"

export const revalidate = 60

/** /brief → today's Phnom Penh calendar brief. */
export default function BriefIndexPage() {
  redirect(`/brief/${todayPhnomPenhYmd()}`)
}
