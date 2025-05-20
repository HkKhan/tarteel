import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = createClient()
    // Process the auth code
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session && data.user) {
      // Redirect to a page that will set localStorage via client-side script
      return NextResponse.redirect(
        new URL(`/auth/set-session?session=${encodeURIComponent(JSON.stringify(data.session))}&user=${encodeURIComponent(JSON.stringify(data.user))}`, 
        request.url)
      )
    }
  }

  // Fallback redirect if something goes wrong
  return NextResponse.redirect(new URL("/dashboard", request.url))
}
