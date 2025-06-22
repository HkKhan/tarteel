import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import ProfileForm from "@/components/dashboard/profile-form"

export default async function ProfilePage() {
  // Check if environment variables are available
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Missing Supabase configuration</p>
      </div>
    )
  }

  try {
    const supabase = await createClient()

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      redirect("/auth/signin")
    }

    // Fetch user profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

    return (
      <>
        <DashboardHeader user={session.user} profile={profile} />
        <main className="flex-1 container px-4 py-8 md:px-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm user={session.user} profile={profile} />
            </CardContent>
          </Card>
        </main>
      </>
    )
  } catch (error) {
    console.error("Profile page error:", error)
    redirect("/auth/signin")
  }
}
