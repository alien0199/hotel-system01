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

    // 1. บันทึกข้อมูลห้อง (Device ID และ Price) ลงตาราง rooms
    if (rooms && Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomNum = String(room.name || '').trim();
        if (!roomNum) continue;

        // ค้นหาว่ามีห้องนี้อยู่แล้วหรือยัง (เช็คทั้ง room_number และ room_num)
        const { data: existingRooms, error: findError } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .or(`room_number.eq.${roomNum},room_num.eq.${roomNum}`);

        if (findError) {
          console.error(`Find room error (room ${roomNum}):`, findError);
          throw new Error(`ค้นหาห้อง ${roomNum} ไม่สำเร็จ: ${findError.message}`);
        }

        const existingRoom = existingRooms && existingRooms.length > 0 ? existingRooms[0] : null;

        const updateData = {
          tuya_device_id: room.deviceId || '',
          price: Number(room.price) || 350,
        };

        if (existingRoom) {
          const { error: updateError } = await supabaseAdmin
            .from('rooms')
            .update(updateData)
            .eq('id', existingRoom.id);

          if (updateError) {
            console.error(`Update room error (room ${roomNum}):`, updateError);
            throw new Error(`บันทึกห้อง ${roomNum} ไม่สำเร็จ: ${updateError.message}`);
          }
        } else {
          // ถ้ายังไม่มี ให้สร้างแถวใหม่ในฐานข้อมูล
          const { error: insertError } = await supabaseAdmin
            .from('rooms')
            .insert({
              room_number: roomNum,
              room_num: roomNum,
              tuya_device_id: room.deviceId || '',
              price: Number(room.price) || 350,
              status: 'available'
            });

          if (insertError) {
            console.error(`Insert room error (room ${roomNum}):`, insertError);
            throw new Error(`สร้างห้อง ${roomNum} ไม่สำเร็จ: ${insertError.message}`);
          }
        }
      }
    }

    // 2. บันทึกเบอร์พร้อมเพย์ลงตาราง settings กลาง
    if (promptpay !== undefined) {
      const { error: promptpayError } = await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });

      if (promptpayError) {
        console.error('Update promptpay error:', promptpayError);
        throw new Error(`บันทึกเบอร์พร้อมเพย์ไม่สำเร็จ: ${promptpayError.message}`);
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลทั้งหมดสำเร็จ' });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
