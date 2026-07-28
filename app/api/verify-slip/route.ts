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

    // 1. ส่งไฟล์รูปภาพไปตรวจสอบกับ Slip2Go (ใช้ endpoint สำหรับอัปโหลดไฟล์สลิปโดยตรง)
    const slip2GoFormData = new FormData();
    slip2GoFormData.append('file', slipImage);

    const slip2goResponse = await fetch('https://api.slip2go.com/api/v1/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLIP2GO_SECRET!}`,
      },
      body: slip2GoFormData,
    });

    const slipResult = await slip2goResponse.json();
    console.log('Slip2Go Response:', slipResult);

    if (!slipResult.success || !slipResult.data) {
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

    // 3. สั่งเปิดเบรกเกอร์ผ่าน API ของเรา (Tuya)
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
