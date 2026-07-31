import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // ป้องกัน Vercel จำ Cache เก่า

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

    // ดึงข้อมูลทั้งหมด (*) ตัดปัญหาหาชื่อคอลัมน์ไม่เจอ
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

    const { roomNumber, status } = await req.json();
    const roomStr = String(roomNumber).trim();
    
    // 🛠️ 1. ลองอัปเดตสถานะโดยใช้ชื่อคอลัมน์ room_num ก่อน
    let { data, error } = await supabaseAdmin
        .from('rooms')
        .update({ status })
        .eq('room_num', roomStr)
        .select();

    // 🛡️ 2. ถ้าระบบฟ้องว่าหา room_num ไม่เจอ (Cache ค้าง) ให้สลับไปใช้ room_number อัตโนมัติทันที
    if (error && error.message.includes('does not exist')) {
        console.log('🔄 ระบบ Cache ค้าง: กำลังสลับไปใช้คอลัมน์ room_number อัตโนมัติ...');
        const fallback = await supabaseAdmin
            .from('rooms')
            .update({ status })
            .eq('room_number', roomStr)
            .select();
        
        data = fallback.data;
        error = fallback.error;
    }

    // ถ้ายัง Error อีก ให้โยนออกไปแจ้งเตือน
    if (error) {
        throw new Error(`อัปเดตไม่สำเร็จ: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('POST Status Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
