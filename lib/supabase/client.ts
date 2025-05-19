"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/database.types"

// Create a single instance of the Supabase client to be used across the client components
export const createClient = () => {
  return createClientComponentClient<Database>()
}
