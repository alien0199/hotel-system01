import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

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

    const { rooms, promptpay } = await req.json();

    // 1. บันทึกพร้อมเพย์ (อัปเดตอย่างเดียว ปลอดภัย 100%)
    if (promptpay !== undefined) {
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });
    }

    // 2. บันทึกข้อมูลแต่ละห้อง (เน้นอัปเดตผ่าน ID เพื่อแก้ปัญหาคอลัมน์ค้างและแถวซ้ำ)
    if (Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomStr = String(room.name || '').trim();
        if (!roomStr) continue;

        const updatePayload = {
          tuya_device_id: String(room.deviceId || '').trim() || null,
          price: Number(room.price) || 350,
        };

        // ค้นหาแถวที่มีชื่อห้องนี้อยู่ก่อน (ดึงมาแค่ ID)
        const { data: existingRooms } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_num', roomStr);

        if (existingRooms && existingRooms.length > 0) {
          // 🛡️ ถ้ามีห้องนี้อยู่แล้ว: ให้อัปเดตเจาะจงผ่าน 'id' ทุกแถวที่เจอ (แก้ปัญหาหลงไปสร้างใหม่)
          for (const row of existingRooms) {
            await supabaseAdmin
              .from('rooms')
              .update(updatePayload)
              .eq('id', row.id);
          }
        } else {
          // 🛡️ ถ้าหาไม่เจอจริงๆ ค่อยสร้างใหม่แค่แถวเดียว
          await supabaseAdmin
            .from('rooms')
            .insert({ room_num: roomStr, ...updatePayload, status: 'available' });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
