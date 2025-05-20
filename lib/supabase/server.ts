import { createClient as createServerClient } from '@supabase/supabase-js'
import type { Database } from "@/lib/database.types"

// Create a Supabase client for server components without using cookies
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createServerClient<Database>(supabaseUrl, supabaseKey)
}
