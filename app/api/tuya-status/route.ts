import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 💡 ดึง Base URL แบบเดียวกับที่ระบบ Sonoff ของคุณใช้
const TUYA_BASE_URL = (
  process.env.TUYA_BASE_URL?.trim() ||
  'https://openapi-sg.iotbing.com'
).replace(/\/+$/, '');

// ==========================================
// ฟังก์ชันเข้ารหัสมาตรฐานของ Tuya
// ==========================================
function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex').toUpperCase();
}

function createStringToSign(method: string, path: string, body: string = ''): string {
  return [method.toUpperCase(), sha256(body), '', path].join('\n');
}

function getTuyaCredentials() {
  const clientId = process.env.TUYA_ACCESS_ID?.trim();
  const clientSecret = process.env.TUYA_ACCESS_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('ไม่พบ TUYA_ACCESS_ID หรือ TUYA_ACCESS_SECRET ใน Vercel');
  }

  return { clientId, clientSecret };
}

// ==========================================
// ฟังก์ชันกลางสำหรับยิง Request ไปหา Tuya
// ==========================================
async function tuyaRequest({
  method,
  path,
  clientId,
  clientSecret,
  accessToken,
}: {
  method: 'GET';
  path: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
}) {
  const timestamp = Date.now().toString();
  const stringToSign = createStringToSign(method, path, '');
  
  const signPayload = clientId + (accessToken || '') + timestamp + stringToSign;

  const headers: Record<string, string> = {
    client_id: clientId,
    sign: hmacSha256(signPayload, clientSecret),
    sign_method: 'HMAC-SHA256',
    t: timestamp,
    lang: 'en',
  };

  if (accessToken) {
    headers.access_token = accessToken;
  }

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    method,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Tuya API error: Response is not JSON');
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.msg || 'Tuya API Request Failed');
  }

  return data;
}

// ==========================================
// API หลัก: ตรวจสอบสถานะ Online / Offline
// ==========================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'Missing deviceId' }, { status: 400 });
    }

    const { clientId, clientSecret } = getTuyaCredentials();

    // 1. ขอ Token แบบใหม่
    const tokenData = await tuyaRequest({
      method: 'GET',
      path: '/v1.0/token?grant_type=1',
      clientId,
      clientSecret,
    });

    const accessToken = tokenData.result?.access_token;
    if (!accessToken) throw new Error('ไม่สามารถดึง Access Token จาก Tuya ได้');

    // 2. ดึงข้อมูลสถานะอุปกรณ์ (เพื่อดูค่า is_online)
    const deviceData = await tuyaRequest({
      method: 'GET',
      path: `/v1.0/devices/${deviceId}`,
      clientId,
      clientSecret,
      accessToken,
    });

    // ส่งสถานะกลับไปให้หน้าแอดมินแสดงผล
    return NextResponse.json({
      success: true,
      isOnline: deviceData.result?.is_online || false
    });

  } catch (error: any) {
    console.error('Tuya Status Check Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
