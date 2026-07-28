import { NextResponse } from 'next/server';
// เปลี่ยนมาใช้ import แบบมาตรฐาน เพื่อแก้ปัญหา Vercel บีบอัดโค้ดพัง
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    // 1. ตั้งค่าการเชื่อมต่อ Tuya
    const tuya = new TuyaContext({
      baseUrl: 'https://openapi.tuyaap.com', 
      accessKey: process.env.TUYA_ACCESS_ID || '',
      secretKey: process.env.TUYA_ACCESS_SECRET || '',
    });

    // 2. กำหนดคำสั่งเปิดหรือปิด
    const isTurnOn = action === 'on';

    // 3. ยิงคำสั่งไปที่เบรกเกอร์
    const status = await tuya.request({
      path: `/v1.0/iot-03/devices/${deviceId}/commands`,
      method: 'POST',
      body: {
        commands: [
          {
            code: 'switch_1',
            value: isTurnOn,
          },
        ],
      },
    });

    // เช็คผลลัพธ์จาก Tuya
    if (!status.success) {
      throw new Error(status.msg || JSON.stringify(status));
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    // พิมพ์ Error ลงใน Log ของ Vercel เพื่อให้เราหาจุดพังได้ง่ายขึ้น
    console.error('Tuya API Error:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
