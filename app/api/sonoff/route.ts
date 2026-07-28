import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';

export const runtime = 'nodejs';

const TUYA_BASE_URL =
  process.env.TUYA_BASE_URL?.trim() ||
  'https://openapi-sg.iotbing.com';

type TuyaResponse<T> = {
  success: boolean;
  result?: T;
  code?: number | string;
  msg?: string;
  t?: number;
};

type DeviceFunction = {
  code: string;
  type: string;
  name?: string;
  desc?: string;
  values?: string;
};

type DeviceFunctionsResult = {
  category?: string;
  functions?: DeviceFunction[];
};

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
  return [
    method.toUpperCase(),
    sha256(body),
    '',
    path,
  ].join('\n');
}

function getTuyaCredentials() {
  const clientId = process.env.TUYA_ACCESS_ID?.trim();
  const clientSecret =
    process.env.TUYA_ACCESS_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      'ไม่พบ TUYA_ACCESS_ID หรือ TUYA_ACCESS_SECRET ใน Vercel'
    );
  }

  return { clientId, clientSecret };
}

function formatTuyaError<T>(
  data: TuyaResponse<T> | null,
  fallback: string
): string {
  if (!data) return fallback;

  const details = [
    data.code !== undefined ? `code=${data.code}` : '',
    data.msg ? `msg=${data.msg}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return details ? `${fallback} (${details})` : fallback;
}

async function tuyaRequest<T>({
  method,
  path,
  clientId,
  clientSecret,
  accessToken,
  body = '',
}: {
  method: 'GET' | 'POST';
  path: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  body?: string;
}): Promise<TuyaResponse<T>> {
  const timestamp = Date.now().toString();
  const stringToSign = createStringToSign(
    method,
    path,
    body
  );

  const signPayload =
    clientId +
    (accessToken || '') +
    timestamp +
    stringToSign;

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

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    `${TUYA_BASE_URL}${path}`,
    {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      cache: 'no-store',
    }
  );

  const text = await response.text();
  let data: TuyaResponse<T> | null = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Tuya ส่งข้อมูลกลับมาไม่ใช่ JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      formatTuyaError(
        data,
        `เรียก Tuya API ไม่สำเร็จ: ${method} ${path}`
      )
    );
  }

  return data;
}

async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const data = await tuyaRequest<{
    access_token?: string;
  }>({
    method: 'GET',
    path: '/v1.0/token?grant_type=1',
    clientId,
    clientSecret,
  });

  const accessToken = data.result?.access_token;

  if (!accessToken) {
    throw new Error('Tuya ไม่ได้ส่ง access_token กลับมา');
  }

  return accessToken;
}

async function getDeviceFunctions(
  clientId: string,
  clientSecret: string,
  accessToken: string,
  deviceId: string
): Promise<DeviceFunctionsResult> {
  const path =
    `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/functions`;

  const data = await tuyaRequest<DeviceFunctionsResult>({
    method: 'GET',
    path,
    clientId,
    clientSecret,
    accessToken,
  });

  return data.result || {};
}

function selectSwitchCode(
  functions: DeviceFunction[]
): string {
  const configuredCode =
    process.env.TUYA_SWITCH_CODE?.trim();

  if (configuredCode) {
    return configuredCode;
  }

  const booleanFunctions = functions.filter(
    (item) =>
      item.type?.toLowerCase() === 'boolean'
  );

  const preferredCodes = [
    'switch_1',
    'switch',
    'switch_led',
    'switch_usb1',
    'switch_usb2',
    'switch_usb3',
  ];

  for (const code of preferredCodes) {
    if (
      booleanFunctions.some(
        (item) => item.code === code
      )
    ) {
      return code;
    }
  }

  const switchLike = booleanFunctions.find(
    (item) => /^switch(?:_|$)/i.test(item.code)
  );

  if (switchLike) {
    return switchLike.code;
  }

  const supported = functions
    .map((item) => `${item.code}:${item.type}`)
    .join(', ');

  throw new Error(
    `ไม่พบคำสั่งเปิด/ปิดชนิด Boolean ของอุปกรณ์ ` +
      `(functions: ${supported || 'ไม่มีข้อมูล'})`
  );
}

async function sendDeviceCommand(
  clientId: string,
  clientSecret: string,
  accessToken: string,
  deviceId: string,
  commandCode: string,
  action: 'on' | 'off'
) {
  const path =
    `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`;

  const body = JSON.stringify({
    commands: [
      {
        code: commandCode,
        value: action === 'on',
      },
    ],
  });

  const data = await tuyaRequest<boolean>({
    method: 'POST',
    path,
    clientId,
    clientSecret,
    accessToken,
    body,
  });

  return data;
}

// ใช้ตรวจสอบคำสั่งที่อุปกรณ์รองรับ:
// GET /api/.../route?deviceId=YOUR_DEVICE_ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId =
      url.searchParams.get('deviceId')?.trim() || '';

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบ deviceId ใน query string',
        },
        { status: 400 }
      );
    }

    const { clientId, clientSecret } =
      getTuyaCredentials();
    const accessToken = await getAccessToken(
      clientId,
      clientSecret
    );
    const specification = await getDeviceFunctions(
      clientId,
      clientSecret,
      accessToken,
      deviceId
    );

    return NextResponse.json({
      success: true,
      category: specification.category,
      functions: specification.functions || [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    console.error('Tuya GET Error:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
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
        { success: false, error: 'ไม่พบ Device ID' },
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

    const { clientId, clientSecret } =
      getTuyaCredentials();
    const accessToken = await getAccessToken(
      clientId,
      clientSecret
    );

    const specification = await getDeviceFunctions(
      clientId,
      clientSecret,
      accessToken,
      deviceId
    );

    const commandCode = selectSwitchCode(
      specification.functions || []
    );

    const result = await sendDeviceCommand(
      clientId,
      clientSecret,
      accessToken,
      deviceId,
      commandCode,
      action
    );

    return NextResponse.json({
      success: true,
      commandCode,
      result: result.result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    console.error('Tuya POST Error:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
