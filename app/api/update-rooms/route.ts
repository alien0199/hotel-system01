import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน Vercel'
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseKey,
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

    if (!Array.isArray(rooms)) {
      return NextResponse.json(
        {
          success: false,
          message: 'ข้อมูลห้องไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // 1. บันทึกหมายเลขพร้อมเพย์
    if (promptpay !== undefined) {
      const { error: promptpayError } =
        await supabaseAdmin
          .from('settings')
          .upsert(
            {
              key: 'promptpay',
              value: String(promptpay).trim(),
            },
            {
              onConflict: 'key',
            }
          );

      if (promptpayError) {
        throw new Error(
          `บันทึกพร้อมเพย์ไม่สำเร็จ: ${promptpayError.message}`
        );
      }
    }

    // 2. บันทึกข้อมูลแต่ละห้อง
    for (const room of rooms) {
      const roomNum = String(room.name || '').trim();

      if (!roomNum) {
        continue;
      }

      const convertedPrice = Number(room.price);

      const roomData = {
        room_num: roomNum,
        tuya_device_id:
          String(room.deviceId || '').trim() || null,
        price:
          Number.isFinite(convertedPrice) &&
          convertedPrice >= 0
            ? convertedPrice
            : 350,
      };

      /*
       * ถ้า id เป็น UUID จาก Supabase
       * ให้อัปเดตด้วย id โดยตรง
       * ทำให้สามารถเปลี่ยนหมายเลขห้องได้โดยไม่สร้างแถวซ้ำ
       */
      const isDatabaseId =
        typeof room.id === 'string' &&
        !room.id.startsWith('room_');

      if (isDatabaseId) {
        const { data: updatedRoom, error: updateByIdError } =
          await supabaseAdmin
            .from('rooms')
            .update(roomData)
            .eq('id', room.id)
            .select('id')
            .maybeSingle();

        if (updateByIdError) {
          throw new Error(
            `อัปเดตห้อง ${roomNum} ไม่สำเร็จ: ${updateByIdError.message}`
          );
        }

        if (updatedRoom) {
          continue;
        }
      }

      // กรณียังไม่มี Database ID ให้ค้นหาด้วย room_num
      const {
        data: existingRoom,
        error: findRoomError,
      } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('room_num', roomNum)
        .limit(1)
        .maybeSingle();

      if (findRoomError) {
        throw new Error(
          `ค้นหาห้อง ${roomNum} ไม่สำเร็จ: ${findRoomError.message}`
        );
      }

      if (existingRoom) {
        const { error: updateError } =
          await supabaseAdmin
            .from('rooms')
            .update({
              tuya_device_id: roomData.tuya_device_id,
              price: roomData.price,
            })
            .eq('id', existingRoom.id);

        if (updateError) {
          throw new Error(
            `บันทึกห้อง ${roomNum} ไม่สำเร็จ: ${updateError.message}`
          );
        }
      } else {
        const { error: insertError } =
          await supabaseAdmin
            .from('rooms')
            .insert({
              ...roomData,
              status: 'available',
              expire_time: null,
            });

        if (insertError) {
          throw new Error(
            `เพิ่มห้อง ${roomNum} ไม่สำเร็จ: ${insertError.message}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลลง Supabase สำเร็จ',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    console.error('Update Rooms Error:', error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
