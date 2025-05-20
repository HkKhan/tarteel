"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import GuestRecordingInterface from "@/components/recording/guest-recording-interface"

export default function TryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Tajweed</span>
            <span className="text-xl font-bold text-emerald-600">Matcher</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container px-4 py-8 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Try it out!</CardTitle>
              <CardDescription>
                Recite Surah Al-Fatiha and see how your voice compares to renowned Quran reciters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GuestRecordingInterface />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 