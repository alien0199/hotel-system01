import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export async function POST(req: Request) {
  try {
    const { rooms, promptpay } = await req.json();

    // 1. บันทึกพร้อมเพย์
    if (promptpay !== undefined) {
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });
    }

    // 2. บันทึกข้อมูลห้อง (ราคา และ Device ID)
    if (rooms && Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomNum = String(room.name || '').trim();
        if (!roomNum) continue;

        // เช็คว่ามีห้องนี้ในฐานข้อมูลหรือยัง
        const { data: existingRoom } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_num', roomNum)
          .maybeSingle();

        if (existingRoom) {
          // ถ้ามีแล้ว ให้อัปเดต
          await supabaseAdmin
            .from('rooms')
            .update({
              tuya_device_id: room.deviceId || '',
              price: Number(room.price) || 350
            })
            .eq('id', existingRoom.id);
        } else {
          // 🛠️ ถ้ายังไม่มี ให้สร้างใหม่ (ใช้คอลัมน์ room_num ให้ตรงเป๊ะ)
          await supabaseAdmin
            .from('rooms')
            .insert({
              room_num: roomNum,
              tuya_device_id: room.deviceId || '',
              price: Number(room.price) || 350,
              status: 'available'
            });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
