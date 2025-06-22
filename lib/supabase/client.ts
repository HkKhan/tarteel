"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/database.types"

// Create a single instance of the Supabase client to be used across the client components
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
