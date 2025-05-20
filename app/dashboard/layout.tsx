"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation" 
import type React from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Client-side auth check happens in the page components
  // This layout no longer performs server-side auth checks
  return <div className="flex min-h-screen flex-col">{children}</div>
}
