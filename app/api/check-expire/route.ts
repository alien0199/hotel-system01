import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // ---------------------------------------------------------
  // 1. ระบบรักษาความปลอดภัย: ป้องกันคนนอกแอบรัน API
  // ---------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const CRON_SECRET = process.env.CRON_SECRET || 'SG_SECRET_1234'; // รหัสผ่านสำหรับ cron-job

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, message: 'ไม่อนุญาตให้เข้าถึง (Unauthorized)' },
      { status: 401 }
    );
  }

  try {
    // หา Base URL ของเว็บตัวเองเพื่อใช้เรียก API ภายใน (รองรับทั้งตอนเทสและตอนขึ้น Vercel)
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // ---------------------------------------------------------
    // 2. ดึงข้อมูลห้องทั้งหมดจากฐานข้อมูลมาตรวจสอบ
    // ---------------------------------------------------------
    const roomsResponse = await fetch(`${baseUrl}/api/get-rooms?t=${Date.now()}`, { cache: 'no-store' });
    
    if (!roomsResponse.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลสถานะห้องได้');
    }
    
    const roomsData = await roomsResponse.json();
    if (!roomsData.success || !Array.isArray(roomsData.rooms)) {
      return NextResponse.json({ success: false, message: 'รูปแบบข้อมูลห้องไม่ถูกต้อง' });
    }

    const now = Date.now();
    const actionsTaken = []; // เก็บประวัติการทำงานเพื่อส่งกลับไปดู log

    // ---------------------------------------------------------
    // 3. วนลูปหาเฉพาะห้องที่ "มีลูกค้า" และ "หมดเวลาแล้ว"
    // ---------------------------------------------------------
    for (const room of roomsData.rooms) {
      // เช็คว่าสถานะห้องถูกใช้งานอยู่ และมีเวลาหมดอายุตั้งไว้
      if (room.status === 'occupied' && room.expire_time) {
        const expireTimeMs = new Date(room.expire_time).getTime();
        
        // ถ้าเวลาปัจจุบัน เลยเวลาหมดอายุไปแล้ว
        if (now >= expireTimeMs) {
          const roomNameStr = String(room.room_num ?? room.room_number ?? room.name).trim();
          
          if (room.tuya_device_id) {
            // ---------------------------------------------------------
            // 4. สำคัญมาก (Critical Fix): ต้องปิดไฟให้สำเร็จก่อน ค่อยเคลียร์ห้องเป็น "ว่าง"
            // ---------------------------------------------------------
            try {
              // 4.1 สั่งปิดเบรกเกอร์ Tuya
              const tuyaResponse = await fetch(`${baseUrl}/api/sonoff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  roomNumber: roomNameStr, 
                  deviceId: room.tuya_device_id, 
                  action: 'turn-off' 
                })
              });
              
              const tuyaData = await tuyaResponse.json();

              // 4.2 ตรวจสอบว่าปิดไฟสำเร็จจริงหรือไม่
              if (tuyaResponse.ok && tuyaData.success) {
                // ปิดไฟสำเร็จ -> เปลี่ยนสถานะห้องในฐานข้อมูลเป็น "ว่าง" (available)
                await fetch(`${baseUrl}/api/get-rooms`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    roomNumber: roomNameStr, 
                    status: 'available' 
                  })
                });
                
                actionsTaken.push(`[สำเร็จ] ห้อง ${roomNameStr}: ปิดไฟและเคลียร์สถานะเป็นว่างเรียบร้อย`);
              } else {
                // ปิดไฟไม่สำเร็จ (เช่น เน็ตหลุด, Token หมด) -> ห้ามเคลียร์ห้อง!
                console.error(`Tuya Error สำหรับห้อง ${roomNameStr}:`, tuyaData.message);
                actionsTaken.push(`[ล้มเหลว] ห้อง ${roomNameStr}: ปิดไฟจาก Tuya ไม่สำเร็จ ระงับการเปลี่ยนสถานะเป็นห้องว่าง`);
              }
            } catch (error) {
               console.error(`ระบบขัดข้องขณะติดต่อ Tuya สำหรับห้อง ${roomNameStr}:`, error);
               actionsTaken.push(`[ขัดข้อง] ห้อง ${roomNameStr}: ไม่สามารถส่งคำสั่งไป Tuya ได้ ระงับการเปลี่ยนสถานะ`);
            }
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 5. ส่งผลลัพธ์กลับไปให้ระบบ Cron-job ทราบ
    // ---------------------------------------------------------
    return NextResponse.json({ 
      success: true, 
      message: 'รันระบบตรวจเช็คเวลาหมดอายุเสร็จสิ้น',
      actions: actionsTaken.length > 0 ? actionsTaken : 'ไม่มีห้องที่หมดเวลา'
    });

  } catch (error) {
    console.error('Check expire error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดร้ายแรงในระบบตรวจเช็คเวลา' }, 
      { status: 500 }
    );
  }
}
