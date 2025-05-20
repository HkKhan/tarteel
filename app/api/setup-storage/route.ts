import { setupStorage } from '@/lib/setup-storage'

/**
 * API route to set up required Supabase storage buckets
 * This should be called with an admin token
 */
export async function GET(request: Request) {
  // In a production environment, you would add authentication here
  // to prevent unauthorized access
  
  try {
    const result = await setupStorage()
    
    if (!result.success) {
      return Response.json({
        success: false,
        message: result.error || 'Failed to set up storage buckets'
      }, { status: 500 })
    }
    
    return Response.json({
      success: true,
      message: 'Storage buckets set up successfully'
    })
  } catch (error) {
    console.error('Error in setup storage API:', error)
    return Response.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 