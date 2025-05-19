import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, History, User, BookOpen } from "lucide-react"
import Link from "next/link"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import RecitationHistory from "@/components/dashboard/recitation-history"

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth/signin")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  // Fetch user's recitation history
  const { data: recitations } = await supabase
    .from("recitations")
    .select(`
      *,
      reciters (
        name,
        image_url
      )
    `)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  return (
    <>
      <DashboardHeader user={session.user} profile={profile} />
      <main className="flex-1 container px-4 py-8 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Welcome, {profile?.full_name || session.user.email}</CardTitle>
              <CardDescription>Track your recitation progress and history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-4">
                <Button className="h-20 w-20 rounded-full bg-emerald-600 hover:bg-emerald-700" asChild>
                  <Link href="/record">
                    <Mic className="h-8 w-8" />
                    <span className="sr-only">Record Recitation</span>
                  </Link>
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground">Record a new recitation to get feedback</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Your Stats</CardTitle>
              <CardDescription>Your recitation progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-emerald-600">{recitations?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Recitations</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-emerald-600">
                    {recitations && recitations.length > 0
                      ? Math.round(
                          recitations.reduce((acc, rec) => acc + (rec.overall_score || 0), 0) / recitations.length,
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-emerald-600">
                    {recitations && recitations.length > 0
                      ? recitations.reduce((acc, rec) => Math.max(acc, rec.overall_score || 0), 0)
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">Best Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Tabs defaultValue="history">
            <TabsList className="mb-4">
              <TabsTrigger value="history">
                <History className="mr-2 h-4 w-4" />
                Recitation History
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="reciters">
                <BookOpen className="mr-2 h-4 w-4" />
                Reciters
              </TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              <RecitationHistory recitations={recitations || []} />
            </TabsContent>
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Your Profile</CardTitle>
                  <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{session.user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">{profile?.full_name || "Not set"}</p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href="/dashboard/profile">Edit Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="reciters">
              <Card>
                <CardHeader>
                  <CardTitle>Classical Reciters</CardTitle>
                  <CardDescription>Learn about the classical reciters you can be matched with</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Coming soon! Browse and listen to classical reciters.</p>
                    <Button className="mt-4" variant="outline" asChild>
                      <Link href="/reciters">View All Reciters</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  )
}
