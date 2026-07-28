import { NextResponse } from 'next/server';

// บังคับให้ Route นี้ทำงานด้วย Node.js
export const runtime = 'nodejs';

// โหลด Tuya SDK แบบ CommonJS
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const deviceId = String(body.deviceId || '').trim();
    const action = String(body.action || '').trim().toLowerCase();

    // ตรวจสอบ Device ID
    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบ Device ID',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบคำสั่ง
    if (action !== 'on' && action !== 'off') {
      return NextResponse.json(
        {
          success: false,
          error: 'คำสั่งต้องเป็น on หรือ off',
        },
        { status: 400 }
      );
    }

    // อ่านกุญแจจาก Environment Variables ของ Vercel
    const accessKey = process.env.TUYA_ACCESS_ID;
    const secretKey = process.env.TUYA_ACCESS_SECRET;

    if (!accessKey || !secretKey) {
      throw new Error(
        'ไม่พบ TUYA_ACCESS_ID หรือ TUYA_ACCESS_SECRET ใน Vercel'
      );
    }

    // เชื่อมต่อ Singapore Data Center
    const tuya = new TuyaContext({
      baseUrl: 'https://openapi-sg.iotbing.com',
      accessKey,
      secretKey,
    });

    // ส่งคำสั่งเปิดหรือปิดอุปกรณ์
    const status: any = await tuya.request({
      path: `/v1.0/iot-03/devices/${deviceId}/commands`,
      method: 'POST',
      body: {
        commands: [
          {
            code: 'switch_1',
            value: action === 'on',
          },
        ],
      },
    });

    // ตรวจสอบคำตอบจาก Tuya
    if (!status?.success) {
      throw new Error(
        status?.msg ||
          status?.message ||
          JSON.stringify(status)
      );
    }

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error('Tuya API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
