import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: Request) {
  try {
    const { rooms } = await req.json();

    for (const room of rooms) {
      if (room.deviceId) {
        const { data: existingRoom } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('room_number', room.name)
          .maybeSingle();

        if (existingRoom) {
          await supabaseAdmin
            .from('rooms')
            .update({ tuya_device_id: room.deviceId })
            .eq('room_number', room.name);
        } else {
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
