"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function SetSessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const session = searchParams.get("session")
    const user = searchParams.get("user")
    
    if (session && user) {
      try {
        localStorage.setItem('auth_session', session)
        localStorage.setItem('auth_user', user)
        router.push("/dashboard")
      } catch (error) {
        console.error("Failed to set session:", error)
        router.push("/auth/signin")
      }
    } else {
      router.push("/auth/signin")
    }
  }, [router, searchParams])
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Setting up your session...</p>
    </div>
  )
}

export default function SetSessionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <SetSessionContent />
    </Suspense>
  )
} 