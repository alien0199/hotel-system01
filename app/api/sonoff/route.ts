import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    // 🔴 เปลี่ยนมาใช้ require ไว้ด้านใน เพื่อป้องกันการสับสนของระบบบีบอัดโค้ด
    // @ts-ignore
    const Ewelink = require('ewelink-api');

    const connection = new Ewelink({
      email: process.env.EWELINK_EMAIL || '',
      password: process.env.EWELINK_PASSWORD || '',
      region: 'as', 
    } as any);

    const status = await connection.setDevicePowerState(deviceId, action);
    
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
