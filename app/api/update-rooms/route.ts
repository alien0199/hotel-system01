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

    const roomResults: any[] = [];
    let promptpayError: string | null = null;

    // 1. บันทึกพร้อมเพย์
    if (promptpay !== undefined) {
      const { error: ppErr } = await supabaseAdmin
        .from('settings')
        .upsert({ key: 'promptpay', value: String(promptpay).trim() }, { onConflict: 'key' });

      if (ppErr) {
        // เดิมโค้ดไม่เช็ค error ตรงนี้เลย ทำให้พร้อมเพย์เงียบๆ ไม่ถูกบันทึก
        // โดยไม่มี error โผล่ให้เห็นที่ไหนเลย
        console.error('Save promptpay error:', ppErr);
        promptpayError = ppErr.message;
      }
    }

    // 2. บันทึกข้อมูลแต่ละห้อง (Device ID และ ราคา)
    if (Array.isArray(rooms)) {
      for (const room of rooms) {
        const roomStr = String(room.name || '').trim();
        if (!roomStr) continue;

        const updatePayload = {
          tuya_device_id: String(room.deviceId || '').trim() || null,
          price: Number(room.price) || 350,
        };

        // ลองอัปเดตด้วย room_num ก่อน
        let { data: updated, error: updateErr } = await supabaseAdmin
          .from('rooms')
          .update(updatePayload)
          .eq('room_num', roomStr)
          .select('id');

        // ถ้าคอลัมน์ room_num ไม่มีจริง (schema cache ค้าง) ค่อยสลับไปใช้ room_number
        if (updateErr && updateErr.message.includes('does not exist')) {
          const fallback = await supabaseAdmin
            .from('rooms')
            .update(updatePayload)
            .eq('room_number', roomStr)
            .select('id');

          updated = fallback.data;
          updateErr = fallback.error;
        }

        // ⚠️ จุดสำคัญที่ทำให้ข้อมูล "รีเซ็ตกลับเป็นค่าเริ่มต้น":
        // โค้ดเดิมเช็คแค่ error message ที่มีคำว่า "does not exist" เท่านั้น
        // ถ้า error เป็นสาเหตุอื่น (เช่น type mismatch, RLS, network) มันจะถูก "กลืน" หายไปเงียบๆ
        // แล้วโค้ดจะเห็นว่า updated ว่าง (เพราะ error ทำให้ data เป็น null)
        // จึงคิดว่า "ห้องนี้ยังไม่มีในฐานข้อมูล" แล้วไป INSERT แถวใหม่
        // ซึ่ง INSERT นั้นจะตั้ง status: 'available' เสมอ
        // -> ห้องที่มีลูกค้าค้างอยู่ (status ไม่ใช่ available) จะถูกสร้างซ้ำเป็นแถวใหม่
        //    ที่มีสถานะ available และค่า default ทั้งหมด แทนที่จะอัปเดตแถวเดิม
        // ทำให้ดูเหมือนข้อมูล "หายกลับไปเริ่มต้น" ทุกครั้งที่กด save

        if (updateErr) {
          console.error(`Update room "${roomStr}" error:`, updateErr);
        }

        if (!updateErr && (!updated || updated.length === 0)) {
          // เข้ามาตรงนี้ได้ก็ต่อเมื่อ "ไม่มี error จริงๆ" และหาแถวไม่เจอจริงๆ เท่านั้น
          // (กันไม่ให้ error อื่นๆ ที่ไม่ใช่ "หาห้องไม่เจอ" ถูกตีความเป็น insert ใหม่)
          const { error: insertErr } = await supabaseAdmin
            .from('rooms')
            .insert({ room_num: roomStr, ...updatePayload, status: 'available' });

          if (insertErr && insertErr.message.includes('does not exist')) {
            const fb = await supabaseAdmin
              .from('rooms')
              .insert({ room_number: roomStr, ...updatePayload, status: 'available' });
            if (fb.error) {
              console.error(`Insert room "${roomStr}" error:`, fb.error);
              roomResults.push({ room: roomStr, ok: false, error: fb.error.message });
              continue;
            }
          } else if (insertErr) {
            console.error(`Insert room "${roomStr}" error:`, insertErr);
            roomResults.push({ room: roomStr, ok: false, error: insertErr.message });
            continue;
          }

          roomResults.push({ room: roomStr, ok: true, action: 'inserted' });
        } else if (updateErr) {
          // มี error จริง (ไม่ใช่ "does not exist") -> ต้องรายงานออกไป ห้ามเงียบ
          roomResults.push({ room: roomStr, ok: false, error: updateErr.message });
        } else {
          roomResults.push({ room: roomStr, ok: true, action: 'updated' });
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
