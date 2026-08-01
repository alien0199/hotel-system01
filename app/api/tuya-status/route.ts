import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TUYA_BASE_URL = (
  process.env.TUYA_BASE_URL?.trim() ||
  'https://openapi-sg.iotbing.com'
).replace(/\/+$/, '');

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
    console.error('Tuya API Request Failed:', data);
    throw new Error(data?.msg || 'Tuya API Request Failed');
  }

  return data;
}

async function getValidToken(clientId: string, clientSecret: string) {
  const now = Date.now();
  if (cachedAccessToken && tokenExpireTime > now + 300000) {
    return cachedAccessToken;
  }

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
    const accessToken = await getValidToken(clientId, clientSecret);

    // 💡 ใช้ Path ให้ตรงกับระบบ IoT Core
    const deviceData = await tuyaRequest({
      method: 'GET',
      path: `/v1.0/iot-03/devices/${deviceId}`,
      clientId,
      clientSecret,
      accessToken,
    });

    // ดึงสถานะการเชื่อมต่อ (รองรับทั้งฟอร์แมต is_online และ online)
    const isOnline = deviceData.result?.is_online === true || deviceData.result?.online === true;

    return NextResponse.json({
      success: true,
      isOnline: isOnline,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('Tuya Status Check Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
