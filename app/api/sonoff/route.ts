import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    // 🔴 ไม้ตายสุดยอด: ใช้ require และบังคับ type เป็น any ไปเลย จะได้เลิกตรวจ 100%
    const ewelink: any = require('ewelink-api');
    const EwelinkClass = ewelink.default || ewelink;

    const connection = new EwelinkClass({
      email: process.env.EWELINK_EMAIL || '',
      password: process.env.EWELINK_PASSWORD || '',
      region: 'as', 
    } as any);

    const status = await connection.setDevicePowerState(deviceId, action);
    
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
