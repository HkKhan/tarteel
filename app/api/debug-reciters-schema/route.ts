import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient();
    
    // 1. Try to query a simple record
    const { data: existingReciters, error: queryError } = await supabase
      .from('reciters')
      .select('*')
      .limit(1);
    
    if (queryError) {
      return NextResponse.json({
        error: queryError.message,
        success: false
      }, { status: 500 });
    }
    
    // 2. Try to get table schema directly using system catalog
    const { data: schemaData, error: schemaError } = await supabase
      .rpc('debug_table_schema', { table_name: 'reciters' });
    
    // Fallback if RPC function doesn't exist
    let columns = [];
    if (schemaError) {
      // Extract columns from a sample record
      if (existingReciters && existingReciters.length > 0) {
        columns = Object.keys(existingReciters[0]);
      }
    } else {
      columns = schemaData;
    }
    
    return NextResponse.json({
      success: true,
      sample: existingReciters,
      columns: columns
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
} 