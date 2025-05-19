import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import RecordingInterface from "@/components/recording/recording-interface"

export default async function RecordPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth/signin")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  return (
    <>
      <DashboardHeader user={session.user} profile={profile} />
      <main className="flex-1 container px-4 py-8 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Record Your Recitation</CardTitle>
              <CardDescription>Recite Surah Al-Fatiha to receive personalized feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <RecordingInterface userId={session.user.id} />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
