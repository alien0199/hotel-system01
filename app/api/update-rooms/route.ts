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

    // 1. บันทึกเบอร์พร้อมเพย์ (แยกทำก่อนเลย จะได้ชัวร์ว่าเซฟติดแน่นอน)
    if (promptpay !== undefined) {
      const { error: ppError } = await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });
      
      if (ppError) console.error('PromptPay Save Error:', ppError);
    }

    // 2. บันทึกข้อมูลห้อง (ราคา และ Device ID)
    if (rooms && Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomNum = String(room.name || '').trim();
        if (!roomNum) continue;

        // 🛠️ แก้ไข: ใช้ชื่อคอลัมน์ room_num ให้ตรงกับใน Supabase ของคุณเป๊ะๆ
        const { data: existingRoom } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_num', roomNum)
          .maybeSingle();

        if (existingRoom) {
          const { error: updateErr } = await supabaseAdmin
            .from('rooms')
            .update({
              tuya_device_id: room.deviceId || '',
              price: Number(room.price) || 350
            })
            .eq('id', existingRoom.id);
            
          if (updateErr) console.error(`Update Room ${roomNum} Error:`, updateErr);
        } else {
          const { error: insertErr } = await supabaseAdmin
            .from('rooms')
            .insert({
              room_num: roomNum,
              tuya_device_id: room.deviceId || '',
              price: Number(room.price) || 350,
              status: 'available'
            });
            
          if (insertErr) console.error(`Insert Room ${roomNum} Error:`, insertErr);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกสำเร็จ' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
