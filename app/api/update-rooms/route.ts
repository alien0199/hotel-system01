import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // ป้องกัน Vercel จำ Cache เก่า

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

    const body = await req.json();
    const rooms = body.rooms;
    const promptpay = body.promptpay;

    // 1. บันทึกพร้อมเพย์
    if (promptpay !== undefined) {
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });
    }

    // 2. บันทึกข้อมูลแต่ละห้อง (Device ID และ ราคา)
    if (Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomStr = String(room.name || '').trim();
        if (!roomStr) continue;

        // 🛠️ สิ่งที่ต้องการอัปเดต (ตัดชื่อคอลัมน์ room_num ออกจาก Payload เพื่อเลี่ยง Error)
        const updatePayload = {
          tuya_device_id: String(room.deviceId || '').trim() || null,
          price: Number(room.price) || 350,
        };

        // ลองค้นหาและอัปเดตโดยใช้คอลัมน์ room_num
        let { data: updated, error: updateErr } = await supabaseAdmin
          .from('rooms')
          .update(updatePayload)
          .eq('room_num', roomStr)
          .select('id');

        // 🛡️ ระบบสลับอัตโนมัติ: ถ้า Cache ค้าง (หาคอลัมน์ไม่เจอ) ให้สลับไปใช้ room_number ทันที
        if (updateErr && updateErr.message.includes('does not exist')) {
          const fallback = await supabaseAdmin
            .from('rooms')
            .update(updatePayload)
            .eq('room_number', roomStr)
            .select('id');
            
          updated = fallback.data;
        }

        // กรณีเป็นห้องใหม่ที่ไม่เคยมีในฐานข้อมูลเลย ให้สร้างแถวใหม่
        if (!updated || updated.length === 0) {
           const { error: insertErr } = await supabaseAdmin
             .from('rooms')
             .insert({ room_num: roomStr, ...updatePayload, status: 'available' });
             
           // ถ้าตอนสร้างใหม่ยังติด Cache Error อีก ก็สลับคอลัมน์สร้างให้
           if (insertErr && insertErr.message.includes('does not exist')) {
               await supabaseAdmin
                 .from('rooms')
                 .insert({ room_number: roomStr, ...updatePayload, status: 'available' });
           }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
