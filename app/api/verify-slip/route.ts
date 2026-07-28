import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const slipImage = formData.get('slipImage') as File;
    const roomNumber = formData.get('roomNumber') as string;

    if (!slipImage || !roomNumber) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // 1. ส่งรูปไปตรวจที่ Slip2Go ด้วยลิงก์ที่ถูกต้อง
    const slip2GoFormData = new FormData();
    slip2GoFormData.append('files', slipImage);

    const slip2goResponse = await fetch('https://connect.slip2go.com/api/queue/verify-slip/qr-code', {
      method: 'POST',
      headers: {
        'x-authorization': process.env.SLIP2GO_SECRET!,
      },
      body: slip2GoFormData,
    });

    const slipResult = await slip2goResponse.json();
    console.log('Slip2Go Response:', slipResult);

    if (!slipResult.success) {
      return NextResponse.json({ success: false, message: 'สลิปไม่ถูกต้อง หรือไม่สามารถอ่านข้อมูลได้' }, { status: 400 });
    }

    const transRef = slipResult.data.transRef;

    // 2. เช็คสลิปซ้ำใน Supabase
    const { data: existingSlip } = await supabase
      .from('used_slips')
      .select('transRef')
      .eq('transRef', transRef)
      .single();

    if (existingSlip) {
      return NextResponse.json({ success: false, message: 'สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
    }

    const { error: insertError } = await supabase
      .from('used_slips')
      .insert([{ transRef: transRef }]);

    if (insertError) {
      throw new Error('บันทึกข้อมูลสลิปลงฐานข้อมูลไม่สำเร็จ');
    }

    // 3. สั่งเปิดเบรกเกอร์ผ่าน API ภายในของเราเอง (Sonoff/Tuya)
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    
    const tuyaResponse = await fetch(`${protocol}://${host}/api/sonoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNumber }),
    });

    const tuyaResult = await tuyaResponse.json();

    if (!tuyaResponse.ok || !tuyaResult.success) {
      return NextResponse.json({ success: false, message: 'สลิปถูกต้อง แต่สั่งเปิดไฟไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `ตรวจสอบสลิปสำเร็จ และเปิดไฟห้อง ${roomNumber} เรียบร้อยครับ!` });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
