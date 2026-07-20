import { NextResponse } from 'next/server';
import ewelink from 'ewelink-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body; // action จะส่งมาเป็น 'on' หรือ 'off'

    // เชื่อมต่อบัญชี eWeLink จากรหัสที่ตั้งไว้ใน Vercel
    const connection = new ewelink({
      email: process.env.EWELINK_EMAIL,
      password: process.env.EWELINK_PASSWORD,
      region: 'as', // 'as' คือโซนเอเชีย
    });

    // สั่งเปิดหรือปิดปลั๊ก
    const status = await connection.setDevicePowerState(deviceId, action);
    
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
