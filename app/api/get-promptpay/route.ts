import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛠️ 2 บรรทัดนี้สำคัญมาก! เป็นคำสั่งบังคับให้ Vercel ดึงข้อมูลใหม่สดๆ ทุกครั้ง ห้ามจำของเก่า
export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'promptpay')
      .maybeSingle();

    if (error) {
      console.error('Supabase GET Promptpay Error:', error);
      throw error;
    }

    return NextResponse.json({ 
        success: true, 
        promptpay: data?.value || '' 
    });

  } catch (error: any) {
    console.error('API GET Promptpay Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
