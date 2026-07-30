import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TUYA_BASE_URL = (
  process.env.TUYA_BASE_URL?.trim() ||
  'https://openapi-sg.iotbing.com'
).replace(/\/+$/, '');

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

type ControlAction = 'on' | 'off';

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
  const clientSecret = process.env.TUYA_ACCESS_SECRET?.trim();

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
  const path = `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/functions`;

  const data = await tuyaRequest<DeviceFunctionsResult>({
    method: 'GET',
    path,
    clientId,
    clientSecret,
    accessToken,
  });

  return data.result || {};
}

function normalizeRoomKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readRoomDeviceMap(): Record<string, string> {
  const raw = process.env.TUYA_ROOM_DEVICES?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ต้องเป็น JSON object');
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        .map(([key, value]) => [normalizeRoomKey(key), String(value).trim()])
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON ไม่ถูกต้อง';
    throw new Error(`ค่า TUYA_ROOM_DEVICES ไม่ถูกต้อง: ${message}`);
  }
}

async function resolveDeviceId(
  deviceIdInput: unknown,
  roomNumberInput: unknown
): Promise<{ deviceId: string; roomNumber: string; }> {
  const directDeviceId = String(deviceIdInput || '').trim();
  const roomNumber = String(roomNumberInput || '').trim();

  if (directDeviceId) {
    return { deviceId: directDeviceId, roomNumber };
  }

  if (!roomNumber) {
    throw new Error('ต้องส่ง deviceId หรือ roomNumber อย่างน้อยหนึ่งค่า');
  }

  const roomKey = normalizeRoomKey(roomNumber);
  const roomMap = readRoomDeviceMap();
  const mappedDeviceId = roomMap[roomKey];
  if (mappedDeviceId) {
    return { deviceId: mappedDeviceId, roomNumber };
  }

  const perRoomEnv = process.env[`TUYA_DEVICE_ID_ROOM_${roomKey}`]?.trim();
  if (perRoomEnv) {
    return { deviceId: perRoomEnv, roomNumber };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

  // 🛠️ อัปเกรด: แจ้งเตือนถ้าระบบหาตัวแปรใน Vercel ไม่เจอ
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Vercel Error: หาตัวแปร NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SECRET_KEY ไม่เจอ กรุณาตรวจสอบใน Vercel Settings');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('tuya_device_id')
    .eq('room_num', roomNumber)
    .maybeSingle();

  // 🛠️ อัปเกรด: แจ้งเตือนแบบเจาะจงถ้า Database มีปัญหาการค้นหา (เช่น ชนิดข้อมูลไม่ตรงกัน)
  if (error) {
    throw new Error(`Supabase Error: มีปัญหาตอนค้นหาข้อมูลห้อง ${roomNumber} (รายละเอียด: ${error.message})`);
  }

  if (data && data.tuya_device_id) {
    return { deviceId: data.tuya_device_id, roomNumber };
  }

  throw new Error(`ไม่พบ Device ID ของห้อง ${roomNumber} กรุณาตั้งค่าที่หน้า Admin หรือ Vercel`);
}

function getConfiguredSwitchCode(roomNumber: string): string {
  const roomKey = normalizeRoomKey(roomNumber);
  if (roomKey) {
    const perRoomCode = process.env[`TUYA_SWITCH_CODE_ROOM_${roomKey}`]?.trim();
    if (perRoomCode) return perRoomCode;
  }
  return process.env.TUYA_SWITCH_CODE?.trim() || '';
}

function selectSwitchCode(functions: DeviceFunction[]): string {
  const booleanFunctions = functions.filter(
    (item) => item.type?.toLowerCase() === 'boolean'
  );

  const preferredCodes = [
    'switch_1', 'switch', 'switch_2', 'switch_3',
    'switch_led', 'switch_usb1', 'switch_usb2', 'switch_usb3',
  ];

  for (const code of preferredCodes) {
    if (booleanFunctions.some((item) => item.code === code)) {
      return code;
    }
  }

  const switchLike = booleanFunctions.find((item) => /^switch(?:_|$)/i.test(item.code));
  if (switchLike) return switchLike.code;

  const supported = functions.map((item) => `${item.code}:${item.type}`).join(', ');
  throw new Error(`ไม่พบคำสั่งเปิด/ปิดชนิด Boolean ของอุปกรณ์ (functions: ${supported || 'ไม่มีข้อมูล'})`);
}

async function sendDeviceCommand(
  clientId: string,
  clientSecret: string,
  accessToken: string,
  deviceId: string,
  commandCode: string,
  action: ControlAction
) {
  const path = `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`;
  const body = JSON.stringify({
    commands: [{ code: commandCode, value: action === 'on' }],
  });

  return tuyaRequest<boolean>({
    method: 'POST',
    path,
    clientId,
    clientSecret,
    accessToken,
    body,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resolved = await resolveDeviceId(
      url.searchParams.get('deviceId'),
      url.searchParams.get('roomNumber')
    );

    const { clientId, clientSecret } = getTuyaCredentials();
    const accessToken = await getAccessToken(clientId, clientSecret);
    const specification = await getDeviceFunctions(clientId, clientSecret, accessToken, resolved.deviceId);

    return NextResponse.json({
      success: true,
      roomNumber: resolved.roomNumber || undefined,
      deviceId: resolved.deviceId,
      category: specification.category,
      functions: specification.functions || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    console.error('Tuya GET Error:', error);
    return NextResponse.json({ success: false, message: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const resolved = await resolveDeviceId(
      requestBody?.deviceId,
      requestBody?.roomNumber
    );

    let rawAction = String(requestBody?.action || 'on').trim().toLowerCase();
    if (rawAction === 'turn-on') rawAction = 'on';
    if (rawAction === 'turn-off') rawAction = 'off';

    if (rawAction !== 'on' && rawAction !== 'off') {
      return NextResponse.json(
        { success: false, message: 'คำสั่งต้องเป็น on หรือ off' },
        { status: 400 }
      );
    }

    const action = rawAction as ControlAction;
    const { clientId, clientSecret } = getTuyaCredentials();
    const accessToken = await getAccessToken(clientId, clientSecret);

    let commandCode = getConfiguredSwitchCode(resolved.roomNumber);
    if (!commandCode) {
      const specification = await getDeviceFunctions(clientId, clientSecret, accessToken, resolved.deviceId);
      commandCode = selectSwitchCode(specification.functions || []);
    }

    const result = await sendDeviceCommand(clientId, clientSecret, accessToken, resolved.deviceId, commandCode, action);

    return NextResponse.json({
      success: true,
      roomNumber: resolved.roomNumber || undefined,
      deviceId: resolved.deviceId,
      action,
      commandCode,
      result: result.result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    console.error('Tuya POST Error:', error);
    return NextResponse.json({ success: false, message: message }, { status: 500 });
  }
}
