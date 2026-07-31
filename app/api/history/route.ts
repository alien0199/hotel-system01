import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    // ดึงประวัติทั้งหมด เรียงจากล่าสุดไปเก่า
    const { data, error } = await supabase
      .from('history_logs')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return NextResponse.json({ success: true, logs: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    
    // คำสั่งเพิ่มข้อมูล
    if (body.action === 'add') {
      const { error } = await supabase.from('history_logs').insert([{
        room_name: body.room,
        price: body.price,
        check_in: body.checkIn,
        check_out: body.checkOut
      }]);
      if (error) throw error;
      return NextResponse.json({ success: true });
    } 
    
    // คำสั่งเคลียร์ข้อมูล (รีเซ็ต 30 วัน)
    if (body.action === 'clear') {
      const { error } = await supabase.from('history_logs').delete().not('id', 'is', null);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
