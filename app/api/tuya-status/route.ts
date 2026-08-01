import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ดึงค่า Credentials ของ Tuya จาก Environment Variables
const clientId = process.env.TUYA_CLIENT_ID?.trim() || '';
const secret = process.env.TUYA_CLIENT_SECRET?.trim() || process.env.TUYA_SECRET?.trim() || '';
const baseUrl = process.env.TUYA_ENDPOINT?.trim() || 'https://openapi.tuyaap.com';

// ฟังก์ชันขอ Access Token จาก Tuya
async function getTuyaToken() {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/v1.0/token?grant_type=1';
  
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const stringToSign = [method, contentHash, '', path].join('\n');
  const signStr = clientId + timestamp + stringToSign;
  const sign = crypto.createHmac('sha256', secret).update(signStr).digest('hex').toUpperCase();

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      client_id: clientId,
      sign: sign,
      t: timestamp,
      sign_method: 'HMAC-SHA256',
    },
    cache: 'no-store'
  });
  
  const data = await res.json();
  if (!data.success) throw new Error(data.msg || 'Failed to get Tuya token');
  return data.result.access_token;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'Missing deviceId' }, { status: 400 });
    }

    // 1. ขอ Token
    const token = await getTuyaToken();
    const timestamp = Date.now().toString();
    
    // 2. ยิงไปเช็คสถานะอุปกรณ์ (Device Status)
    const method = 'GET';
    const path = `/v1.0/devices/${deviceId}`;

    const contentHash = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign = [method, contentHash, '', path].join('\n');
    const signStr = clientId + token + timestamp + stringToSign;
    const sign = crypto.createHmac('sha256', secret).update(signStr).digest('hex').toUpperCase();

    const res = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        client_id: clientId,
        access_token: token,
        sign: sign,
        t: timestamp,
        sign_method: 'HMAC-SHA256',
      },
      cache: 'no-store'
    });

    const data = await res.json();
    
    if (data.success && data.result) {
      return NextResponse.json({
        success: true,
        isOnline: data.result.is_online // ส่งสถานะ true (ออนไลน์) หรือ false (ออฟไลน์) กลับไป
      });
    }

    return NextResponse.json({ success: false, message: data.msg || 'Device not found' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
