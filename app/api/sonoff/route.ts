import { NextResponse } from 'next/server';
// ใช้ require เพื่อหลีกเลี่ยงปัญหาการคอมไพล์ของ Next.js
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    // 1. ตั้งค่าการเชื่อมต่อ Tuya (ชี้ไปที่เซิร์ฟเวอร์ Singapore/Asia Pacific)
    const tuya = new TuyaContext({
      baseUrl: 'https://openapi.tuyaap.com', 
      accessKey: process.env.TUYA_ACCESS_ID || '',
      secretKey: process.env.TUYA_ACCESS_SECRET || '',
    });

    // 2. กำหนดคำสั่งเปิดหรือปิด
    const isTurnOn = action === 'on';

    // 3. ยิงคำสั่งไปที่เบรกเกอร์ (ใช้โค้ด switch_1 สำหรับเบรกเกอร์)
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

    // เช็คผลลัพธ์
    if (!status.success) {
      throw new Error(status.msg || JSON.stringify(status));
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
