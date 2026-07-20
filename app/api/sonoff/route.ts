import { NextResponse } from 'next/server';
// @ts-ignore
import ewelink from 'ewelink-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    const connection = new ewelink({
      email: process.env.EWELINK_EMAIL,
      password: process.env.EWELINK_PASSWORD,
      region: 'as', 
    });

    const status = await connection.setDevicePowerState(deviceId, action);
    
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
