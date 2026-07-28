import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ตั้งค่าการเชื่อมต่อฐานข้อมูล Supabase
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

    // 1. เตรียมรูปภาพเพื่อส่งไปให้ Slip2Go ตรวจ
    const slip2GoFormData = new FormData();
    slip2GoFormData.append('files', slipImage);

    // 2. ส่งไปที่ API ของ Slip2Go
    const slip2goResponse = await fetch('https://api.slip2go.com/api/v1/verify', {
      method: 'POST',
      headers: {
        'x-authorization': process.env.SLIP2GO_SECRET!,
      },
      body: slip2GoFormData,
    });

    const slipResult = await slip2goResponse.json();

    // 🌟 บรรทัดนี้ที่เพิ่มเข้าไปเพื่อคายข้อมูล Error จาก Slip2Go ออกมาดู
    console.log('Slip2Go Response:', slipResult);

    // 3. หากระบบ Slip2Go บอกว่าสลิปปลอม, ยอดเงินไม่ตรง หรือสแกนไม่ได้
    if (!slipResult.success) {
      return NextResponse.json({ success: false, message: 'สลิปไม่ถูกต้อง หรือไม่สามารถอ่านข้อมูลได้' }, { status: 400 });
    }

    // 4. ดึงเลขที่อ้างอิงสลิป (Transaction Ref) ที่ตรวจผ่านแล้วออกมา
    const transRef = slipResult.data.transRef;

    // 5. เช็คว่าสลิปนี้เคยใช้เปิดห้องไปแล้วหรือยัง? (ค้นหาในตาราง used_slips)
    const { data: existingSlip, error: checkError } = await supabase
      .from('used_slips')
      .select('transRef')
      .eq('transRef', transRef)
      .single();

    if (existingSlip) {
      // ถ้าเจอเลขซ้ำในระบบ ให้เด้งออกทันที
      return NextResponse.json({ success: false, message: 'สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
    }

    // 6. ถ้าสลิปสดใหม่ ไม่เคยใช้ ให้บันทึกเลขลงในตาราง used_slips เพื่อกันการใช้ซ้ำในอนาคต
    const { error: insertError } = await supabase
      .from('used_slips')
      .insert([{ transRef: transRef }]);

    if (insertError) {
      throw new Error('บันทึกข้อมูลสลิปลงฐานข้อมูลไม่สำเร็จ');
    }

    // 7. สั่งเปิดเบรกเกอร์ Tuya 
    console.log(`✅ เตรียมเปิดเบรกเกอร์ให้ห้อง: ${roomNumber}`);

    return NextResponse.json({ success: true, message: `เปิดไฟห้อง ${roomNumber} สำเร็จ!` });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
