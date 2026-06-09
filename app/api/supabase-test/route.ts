import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(1)
    
    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Connection failed',
          error: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Supabase connected successfully!',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )
  } catch (err) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
