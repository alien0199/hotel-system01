import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from('rooms').select('room_number, status, tuya_device_id');
    if (error) throw error;
    return NextResponse.json({ success: true, rooms: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { roomNumber, status } = await req.json();
    await supabaseAdmin.from('rooms').update({ status }).eq('room_number', roomNumber);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
