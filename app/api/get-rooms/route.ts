import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // 🛠️ ป้องกัน Vercel จำ Cache เก่า

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

    // ดึงข้อมูลทั้งหมด 
    const { data, error } = await supabaseAdmin.from('rooms').select('*');
    
    if (error) {
        throw error;
    }
    
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
    
    // 🛠️ อัปเดตพร้อมดักจับ Error และใช้ String().trim() ป้องกันการเว้นวรรคเกิน
    const { data, error } = await supabaseAdmin
        .from('rooms')
        .update({ status })
        .eq('room_num', String(roomNumber).trim())
        .select(); // ใส่ select() เพื่อขอดูผลลัพธ์ว่าบันทึกสำเร็จจริงๆ

    // ถ้ามี Error จาก Supabase ให้โยนออกไปแจ้งเตือนทันที
    if (error) {
        throw new Error(`อัปเดตไม่สำเร็จ: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('POST Status Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
