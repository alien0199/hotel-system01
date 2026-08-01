import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0; // บังคับไม่ให้ Vercel จำค่าแคช

const TUYA_BASE_URL = (
  process.env.TUYA_BASE_URL?.trim() ||
  'https://openapi-sg.iotbing.com'
).replace(/\/+$/, '');

// 💡 ตัวแปรสำหรับจำ Token ไว้ในหน่วยความจำ (ไม่ให้ขอใหม่ทุก 15 วินาทีจนโดนบล็อก)
let cachedAccessToken = '';
let tokenExpireTime = 0;

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
    throw new Error('ไม่พบ TUYA_ACCESS_ID หรือ TUYA_ACCESS_SECRET');
  }

  return { clientId, clientSecret };
}

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

  if (accessToken) headers.access_token = accessToken;

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

// 💡 ฟังก์ชันดึง Token แบบฉลาด (ถ้ายังไม่หมดอายุ จะใช้ของเดิม)
async function getValidToken(clientId: string, clientSecret: string) {
  const now = Date.now();
  // ถ้ามี Token เดิมและยังไม่หมดอายุ (เผื่อเวลาไว้ 5 นาที) ให้ใช้ของเดิม
  if (cachedAccessToken && tokenExpireTime > now + 300000) {
    return cachedAccessToken;
  }

  // ถ้าหมดอายุ ค่อยส่งไปขอใหม่
  const tokenData = await tuyaRequest({
    method: 'GET',
    path: '/v1.0/token?grant_type=1',
    clientId,
    clientSecret,
  });

  if (!tokenData.result?.access_token) {
     throw new Error('ไม่สามารถดึง Access Token ได้');
  }

  cachedAccessToken = tokenData.result.access_token;
  // Tuya ให้เวลา Token มา (ปกติคือ 7200 วินาที หรือ 2 ชั่วโมง)
  const expireInSeconds = tokenData.result.expire_time || 7200;
  tokenExpireTime = now + (expireInSeconds * 1000);

  return cachedAccessToken;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    
    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'Missing deviceId' }, { status: 400 });
    }

    const { clientId, clientSecret } = getTuyaCredentials();

    // 1. ดึง Token แบบฉลาด (ดึงจากความจำ Cache ก่อน)
    const accessToken = await getValidToken(clientId, clientSecret);

    // 2. ถามสถานะอุปกรณ์ล่าสุด
    const deviceData = await tuyaRequest({
      method: 'GET',
      path: `/v1.0/devices/${deviceId}`,
      clientId,
      clientSecret,
      accessToken,
    });

    return NextResponse.json({
      success: true,
      isOnline: deviceData.result?.is_online || false,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('Tuya Status Check Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
