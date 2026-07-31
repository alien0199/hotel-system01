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

        // ✅ ยืนยันจาก Table Editor ของ Supabase แล้วว่าคอลัมน์จริงในตาราง rooms
        // คือ "room_num" (เห็นในภาพหน้าจอ) — คอลัมน์นี้มีอยู่จริงในฐานข้อมูล
        // แต่ error PGRST204 "Could not find the column ... in the schema cache"
        // ที่เจอ เกิดจาก PostgREST schema cache ค้าง (ยังไม่รู้จักคอลัมน์นี้)
        // ไม่ใช่เพราะคอลัมน์ไม่มีจริง วิธีแก้ต้อง reload schema cache ที่ฝั่ง
        // Supabase (รัน NOTIFY pgrst, 'reload schema'; ใน SQL editor) ไม่ใช่แก้ชื่อคอลัมน์ในโค้ด
        const ROOM_COLUMN = 'room_num';

        let { data: updated, error: updateErr } = await supabaseAdmin
          .from('rooms')
          .update(updatePayload)
          .eq(ROOM_COLUMN, roomStr)
          .select('id');

        if (updateErr) {
          console.error(`Update room "${roomStr}" error:`, updateErr);
        }

        if (!updateErr && (!updated || updated.length === 0)) {
          // ไม่มี error และไม่เจอห้องนี้จริงๆ -> เป็นห้องใหม่ ต้อง insert
          const { error: insertErr } = await supabaseAdmin
            .from('rooms')
            .insert({ [ROOM_COLUMN]: roomStr, ...updatePayload, status: 'available' });

          if (insertErr) {
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
