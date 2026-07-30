import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export async function GET() {
  try {
    // 🛠️ ดึงข้อมูลทั้งหมด (*) ตัดปัญหาหาชื่อคอลัมน์ไม่เจอ
    const { data, error } = await supabaseAdmin.from('rooms').select('*');
    if (error) throw error;
    return NextResponse.json({ success: true, rooms: data });
  } catch (error: any) {
    console.error('GET Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { roomNumber, status } = await req.json();
    // 🛠️ อัปเดตโดยอิงจาก room_num
    await supabaseAdmin.from('rooms').update({ status }).eq('room_num', roomNumber);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST Status Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
