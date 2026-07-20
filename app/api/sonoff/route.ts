import { NextResponse } from 'next/server';
// @ts-ignore
import ewelink from 'ewelink-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    // 🔴 ไม้ตาย: เช็คว่า Vercel เอา Class ไปซ่อนไว้ใน .default หรือไม่ ถ้าใช่ให้ดึงออกมา
    const EwelinkClass = typeof ewelink === 'function' ? ewelink : ewelink.default;

    if (!EwelinkClass) {
      throw new Error("โหลดไลบรารี Sonoff ไม่สำเร็จ");
    }

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
