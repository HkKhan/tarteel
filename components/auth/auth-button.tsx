"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LogOut } from "lucide-react"

interface AuthButtonProps {
  user: any | null
}

export function AuthButton({ user }: AuthButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push("/")
  }

  return user ? (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-4">
      <Button variant="outline" size="sm" asChild>
        <Link href="/auth/signin">Sign In</Link>
      </Button>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
        <Link href="/auth/signin?tab=signup">Sign Up</Link>
      </Button>
    </div>
  )
}
