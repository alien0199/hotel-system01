import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';

export const runtime = 'nodejs';

const TUYA_BASE_URL = 'https://openapi-sg.iotbing.com';

function sha256(value: string): string {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(value, 'utf8')
    .digest('hex')
    .toUpperCase();
}

function createStringToSign(
  method: string,
  path: string,
  body: string
): string {
  const bodyHash = sha256(body);

  return [
    method.toUpperCase(),
    bodyHash,
    '',
    path,
  ].join('\n');
}

async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const method = 'GET';
  const path = '/v1.0/token?grant_type=1';
  const body = '';
  const timestamp = Date.now().toString();

  const stringToSign = createStringToSign(
    method,
    path,
    body
  );

  const sign = hmacSha256(
    clientId + timestamp + stringToSign,
    clientSecret
  );

  const response = await fetch(
    `${TUYA_BASE_URL}${path}`,
    {
      method,
      headers: {
        client_id: clientId,
        sign,
        sign_method: 'HMAC-SHA256',
        t: timestamp,
      },
      cache: 'no-store',
    }
  );

  const data: any = await response.json();

  if (
    !response.ok ||
    !data?.success ||
    !data?.result?.access_token
  ) {
    throw new Error(
      `ขอ Tuya Token ไม่สำเร็จ: ${
        data?.msg || JSON.stringify(data)
      }`
    );
  }

  return data.result.access_token;
}

async function sendDeviceCommand(
  clientId: string,
  clientSecret: string,
  accessToken: string,
  deviceId: string,
  action: 'on' | 'off'
) {
  const method = 'POST';
  const path =
    `/v1.0/iot-03/devices/${deviceId}/commands`;

  const commandCode =
    process.env.TUYA_SWITCH_CODE || 'switch_1';

  const body = JSON.stringify({
    commands: [
      {
        code: commandCode,
        value: action === 'on',
      },
    ],
  });

  const timestamp = Date.now().toString();

  const stringToSign = createStringToSign(
    method,
    path,
    body
  );

  const sign = hmacSha256(
    clientId +
      accessToken +
      timestamp +
      stringToSign,
    clientSecret
  );

  const response = await fetch(
    `${TUYA_BASE_URL}${path}`,
    {
      method,
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        sign_method: 'HMAC-SHA256',
        t: timestamp,
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
    }
  );

  const data: any = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(
      `สั่งอุปกรณ์ไม่สำเร็จ: ${
        data?.msg || JSON.stringify(data)
      }`
    );
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();

    const deviceId = String(
      requestBody?.deviceId || ''
    ).trim();

    const action = String(
      requestBody?.action || ''
    )
      .trim()
      .toLowerCase();

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบ Device ID',
        },
        { status: 400 }
      );
    }

    if (action !== 'on' && action !== 'off') {
      return NextResponse.json(
        {
          success: false,
          error: 'คำสั่งต้องเป็น on หรือ off',
        },
        { status: 400 }
      );
    }

    const clientId =
      process.env.TUYA_ACCESS_ID?.trim();

    const clientSecret =
      process.env.TUYA_ACCESS_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new Error(
        'ไม่พบ TUYA_ACCESS_ID หรือ TUYA_ACCESS_SECRET ใน Vercel'
      );
    }

    const accessToken = await getAccessToken(
      clientId,
      clientSecret
    );

    const result = await sendDeviceCommand(
      clientId,
      clientSecret,
      accessToken,
      deviceId,
      action as 'on' | 'off'
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Tuya API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      },
      { status: 500 }
    );
  }
}
