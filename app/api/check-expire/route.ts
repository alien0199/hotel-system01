import { NextResponse } from 'next/server';

// บังคับให้ Vercel ประมวลผลใหม่ทุกครั้ง ห้ามจำค่าเก่า (Cache) เด็ดขาด
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // ใช้โดเมนของเว็บไซต์ตัวเอง
    const baseUrl = 'https://hotel-system01.vercel.app';
    
    // 1. ดึงข้อมูลห้องทั้งหมดจากฐานข้อมูล เพื่อเช็คว่ามีห้องไหนหมดเวลาไหม
    const res = await fetch(`${baseUrl}/api/get-rooms?t=${Date.now()}`, { 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
    const data = await res.json();

    if (!data.success || !Array.isArray(data.rooms)) {
       return NextResponse.json({ success: false, message: 'ข้อมูลห้องไม่ถูกต้อง' });
    }

    const now = Date.now();
    const results = [];

    // 2. วนลูปตรวจสอบทุกห้อง
    for (const room of data.rooms) {
      // ตรวจสอบเฉพาะห้องที่มีลูกค้า และมีการตั้งเวลาหมดอายุไว้
      if (room.status === 'occupied' && room.expire_time) {
        const expireTime = new Date(room.expire_time).getTime();
        
        // 3. ถ้าเวลาปัจจุบัน "เลย" หรือ "เท่ากับ" เวลาหมดอายุแล้ว (หมดเวลา)
        if (now >= expireTime) {
          
          // 3.1 สั่งปิดไฟ Tuya ผ่าน API ที่เรามีอยู่แล้ว
          if (room.tuya_device_id) {
            await fetch(`${baseUrl}/api/sonoff`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({
                roomNumber: room.room_num || room.room_number,
                deviceId: room.tuya_device_id,
                action: 'turn-off'
              })
            }).catch(e => console.error('Tuya Turn off error:', e));
          }
          
          // 3.2 อัปเดตสถานะห้องในฐานข้อมูลให้กลับมาเป็น "ว่าง" (available) และเคลียร์เวลา
          await fetch(`${baseUrl}/api/get-rooms`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             cache: 'no-store',
             body: JSON.stringify({
               roomNumber: room.room_num || room.room_number,
               status: 'available'
             })
          }).catch(e => console.error('Database Update error:', e));

          // เก็บประวัติไว้ดูว่าห้องไหนเพิ่งถูกระบบตัดไฟไปบ้าง
          results.push({ room: room.room_num || room.room_number, status: 'Turned Off Success' });
        }
      }
    }

    // ส่งผลลัพธ์กลับไปให้ Cron-Job.org ทราบว่าทำงานเรียบร้อย
    return NextResponse.json({ 
      success: true, 
      processedRooms: results, 
      timestamp: new Date().toISOString() 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
