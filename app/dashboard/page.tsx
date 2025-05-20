"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, History, User, BookOpen } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [recitations, setRecitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Check if user is authenticated in localStorage
    try {
      const storedUser = localStorage.getItem('auth_user')
      const storedSession = localStorage.getItem('auth_session')
  
      if (!storedUser || !storedSession) {
        router.push('/auth/signin')
        return
      }
  
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
  
      // Fetch user profile and recitations
      const fetchData = async () => {
        try {
          // Fetch profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", parsedUser.id)
            .single()
  
          setProfile(profileData)
  
          // Fetch recitations
          const { data: recitationsData } = await supabase
            .from("recitations")
            .select(`
              *,
              reciters (
                name,
                image_url
              )
            `)
            .eq("user_id", parsedUser.id)
            .order("created_at", { ascending: false })
  
          setRecitations(recitationsData || [])
        } catch (error) {
          console.error("Error fetching data:", error)
        } finally {
          setLoading(false)
        }
      }
  
      fetchData()
    } catch (error) {
      console.error("Authentication error:", error)
      router.push('/auth/signin')
      setLoading(false)
    }
  }, [router, supabase])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Tajweed</span>
            <span className="text-xl font-bold text-emerald-600">Matcher</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => {
              localStorage.removeItem('auth_user')
              localStorage.removeItem('auth_session')
              router.push('/')
            }}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container px-4 py-8 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Welcome, {profile?.full_name || user?.email}</CardTitle>
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
              {recitations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No recitations yet. Start recording to see your history.</p>
                    <Button className="mt-4" variant="outline" asChild>
                      <Link href="/record">Record Now</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {recitations.map((recitation) => (
                    <Card key={recitation.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-emerald-600 font-arabic text-xl">ق</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">Surah {recitation.surah}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(recitation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{recitation.overall_score}%</p>
                            <p className="text-sm text-muted-foreground">
                              {recitation.reciters?.name || "Unknown"} match
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
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
    </div>
  )
}
