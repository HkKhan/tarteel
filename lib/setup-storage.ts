import { createClient } from '@supabase/supabase-js'

/**
 * Setup required storage buckets for the application
 * Can be run from a script or admin panel
 */
export async function setupStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    return { success: false, error: 'Missing Supabase credentials' }
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    // Check if audio bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets()
      
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`)
    }
    
    const audioBucketExists = buckets.some(bucket => bucket.name === 'audio')
    
    if (!audioBucketExists) {
      // Create the audio bucket
      const { data, error } = await supabase
        .storage
        .createBucket('audio', { 
          public: true,
          fileSizeLimit: 50000000 // 50MB limit
        })
        
      if (error) {
        throw new Error(`Failed to create audio bucket: ${error.message}`)
      }
      
      console.log('Created audio bucket successfully')
    } else {
      console.log('Audio bucket already exists')
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error setting up storage:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 