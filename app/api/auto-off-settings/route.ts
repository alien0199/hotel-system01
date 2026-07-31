import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('auto_off_hours')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      // ถ้ายังไม่เคยตั้งค่ามาก่อน ใช้ 2 ชั่วโมงเป็นค่าเริ่มต้น
      autoOffHours: data?.auto_off_hours ?? 2,
    });
  } catch (error: any) {
    console.error('GET auto-off-settings Error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { autoOffHours } = await req.json();
    const hours = Number(autoOffHours);

    if (!Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'จำนวนชั่วโมงต้องเป็นตัวเลขมากกว่า 0',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ id: 1, auto_off_hours: hours });

    if (error) throw error;

    return NextResponse.json({ success: true, autoOffHours: hours });
  } catch (error: any) {
    console.error('POST auto-off-settings Error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
