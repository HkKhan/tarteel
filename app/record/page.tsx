"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import RecordingInterface from "@/components/recording/recording-interface"
import GuestRecordingInterface from "@/components/recording/guest-recording-interface"

export default function RecordPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated in localStorage
    try {
      const storedUser = localStorage.getItem('auth_user')
      const storedSession = localStorage.getItem('auth_session')
  
      if (storedUser && storedSession) {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      }
    } catch (error) {
      console.error("Authentication error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <span className="text-xl font-bold">Tajweed</span>
            <span className="text-xl font-bold text-emerald-600">Matcher</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm">{user.email}</span>
                <Button variant="outline" size="sm" onClick={() => {
                  localStorage.removeItem('auth_user')
                  localStorage.removeItem('auth_session')
                  router.push('/')
                }}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container px-4 py-8 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Record Your Recitation</CardTitle>
              <CardDescription>Recite Surah Al-Fatiha to receive personalized feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <RecordingInterface userId={user.id} />
              ) : (
                <GuestRecordingInterface />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
