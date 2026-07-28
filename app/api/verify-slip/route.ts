import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. ดึงกุญแจฐานข้อมูลจาก Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    // 2. รับไฟล์สลิปและเลขห้องที่ลูกค้ากดส่งมาจากหน้าเว็บ
    const formData = await request.formData();
    const slipImage = formData.get('slipImage') as File;
    const roomNumber = formData.get('roomNumber') as string;

    if (!slipImage || !roomNumber) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // 3. ส่งรูปไปให้ Slip2Go ตรวจสอบ
    const slip2goData = new FormData();
    slip2goData.append('files', slipImage); 

    // หมายเหตุ: URL ตรงนี้อาจจะต้องอัปเดตตามคู่มือของ Slip2Go 
    const slip2goResponse = await fetch('https://api.slip2go.com/api/verify-slip', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLIP2GO_SECRET}`,
      },
      body: slip2goData,
    });

    const slipResult = await slip2goResponse.json();

    // หากระบบ Slip2Go บอกว่าสลิปปลอม, ยอดเงินไม่ตรง หรือสแกนไม่ได้
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
      // ถ้าเจอเลขซ้ำในระบบ ให้เด้งออกทันที (กันลูกค้านำสลิปเดิมมาเปิดไฟซ้ำ)
      return NextResponse.json({ success: false, message: 'สลิปนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
    }

    // 6. ถ้าสลิปสดใหม่ ไม่เคยใช้ ให้บันทึกเลขลงในตาราง used_slips เพื่อกันการใช้ซ้ำในอนาคต
    const { error: insertError } = await supabase
      .from('used_slips')
      .insert([{ transRef: transRef }]);

    if (insertError) {
      throw new Error('บันทึกข้อมูลสลิปลงฐานข้อมูลไม่สำเร็จ');
    }

    // 7. สั่งเปิดเบรกเกอร์ Tuya (เดี๋ยวเราจะมาใส่โค้ดเชื่อม Tuya ในจุดนี้ทีหลัง)
    console.log(`✅ เตรียมเปิดเบรกเกอร์ให้ห้อง: ${roomNumber}`);

    return NextResponse.json({ success: true, message: `เปิดไฟห้อง ${roomNumber} สำเร็จ!` });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
const slipResult = await slip2goResponse.json();

    // 🌟 เพิ่มบรรทัดนี้เข้าไป เพื่อให้ระบบโชว์เหตุผลที่ Slip2Go ปฏิเสธ
    console.log('Slip2Go Response:', slipResult);

    // หากระบบ Slip2Go บอกว่าสลิปปลอม, ยอดเงินไม่ตรง หรือสแกนไม่ได้
    if (!slipResult.success) {
