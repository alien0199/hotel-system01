import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// เชื่อมต่อ Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: Request) {
  try {
    const { rooms } = await req.json();

    for (const room of rooms) {
      if (room.deviceId) {
        // เช็คว่ามีข้อมูลห้องนี้ในระบบหรือยัง
        const { data: existingRoom } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_number', room.name)
          .maybeSingle();

        if (existingRoom) {
          // ถ้ามีแล้ว ให้อัปเดต Device ID ใหม่เข้าไป
          await supabaseAdmin
            .from('rooms')
            .update({ tuya_device_id: room.deviceId })
            .eq('room_number', room.name);
        } else {
          // ถ้ายังไม่มี ให้เพิ่มห้องใหม่ลงฐานข้อมูล
          await supabaseAdmin
            .from('rooms')
            .insert({ 
              room_number: room.name, 
              tuya_device_id: room.deviceId 
            });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึก Device ID สำเร็จ' });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
