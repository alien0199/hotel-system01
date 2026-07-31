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
    const roomResults: any[] = [];
    let promptpayError: string | null = null;

    // 1. บันทึกพร้อมเพย์
    if (promptpay !== undefined) {
      const { error: ppErr } = await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });

      if (ppErr) {
        console.error('Save promptpay error:', ppErr);
        promptpayError = ppErr.message;
      }
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
        const { data: existingRooms, error: findErr } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_number', roomStr);

        if (findErr) {
          // ⚠️ จุดนี้คือจุดที่หายไปเงียบๆ ก่อนหน้านี้ — ถ้า select พังตรงนี้
          // existingRooms จะเป็น undefined ทำให้โค้ดคิดว่า "ไม่เจอห้อง" ทั้งที่จริง
          // แค่ query ล้มเหลว แล้วมันจะไม่ insert/update อะไรเลยเงียบๆ (ตรงกับอาการที่เจอ)
          console.error(`Find room "${roomStr}" error:`, findErr);
          roomResults.push({ room: roomStr, ok: false, error: findErr.message });
          continue;
        }

        if (existingRooms && existingRooms.length > 0) {
          // 🛡️ ถ้ามีห้องนี้อยู่แล้ว: ให้อัปเดตเจาะจงผ่าน 'id' ทุกแถวที่เจอ
          let updateFailed: string | null = null;
          for (const row of existingRooms) {
            const { error: updateErr } = await supabaseAdmin
              .from('rooms')
              .update(updatePayload)
              .eq('id', row.id);

            if (updateErr) {
              console.error(`Update room "${roomStr}" (id=${row.id}) error:`, updateErr);
              updateFailed = updateErr.message;
            }
          }

          if (updateFailed) {
            roomResults.push({ room: roomStr, ok: false, error: updateFailed });
          } else {
            roomResults.push({ room: roomStr, ok: true, action: 'updated', rowsUpdated: existingRooms.length });
          }
        } else {
          // 🛡️ ถ้าหาไม่เจอจริงๆ ค่อยสร้างใหม่แค่แถวเดียว
          const { error: insertErr } = await supabaseAdmin
            .from('rooms')
            .insert({ room_number: roomStr, ...updatePayload, status: 'available' });

          if (insertErr) {
            console.error(`Insert room "${roomStr}" error:`, insertErr);
            roomResults.push({ room: roomStr, ok: false, error: insertErr.message });
            continue;
          }

          roomResults.push({ room: roomStr, ok: true, action: 'inserted' });
        }
      }
    }

    const anyFailed = roomResults.some((r) => !r.ok) || !!promptpayError;

    return NextResponse.json({
      success: !anyFailed,
      message: anyFailed ? 'บันทึกไม่สำเร็จบางส่วน ดูรายละเอียดใน details' : 'บันทึกข้อมูลสำเร็จ',
      promptpayError,
      details: roomResults,
    });
  } catch (error: any) {
    console.error('Update Rooms Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
