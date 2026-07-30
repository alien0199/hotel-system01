import { NextResponse } from 'next/server';
import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SLIP2GO_API_URL =
  'https://connect.slip2go.com/api/verify-slip/qr-image/info';

type Slip2GoData = {
  referenceId?: string;
  decode?: string;
  transRef?: string;
  dateTime?: string;
  amount?: number;
};

type Slip2GoResponse = {
  code?: string | number;
  message?: string;
  data?: Slip2GoData;
};

function getSlip2GoConfig() {
  const secret = process.env.SLIP2GO_SECRET?.trim();

  const apiUrl =
    process.env.SLIP2GO_API_URL?.trim() ||
    DEFAULT_SLIP2GO_API_URL;

  if (!secret) {
    throw new Error(
      'ไม่พบ SLIP2GO_SECRET ใน Vercel Environment Variables'
    );
  }

  return { secret, apiUrl };
}

function getSupabaseClient(): {
  supabase: SupabaseClient;
  transRefColumn: string;
} {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  )?.trim();

  const transRefColumn =
    process.env.SUPABASE_TRANS_REF_COLUMN?.trim() ||
    'transRef';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ ' +
        'SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY'
    );
  }

  return {
    supabase: createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
    transRefColumn,
  };
}

function isUploadedFile(
  value: FormDataEntryValue | null
): value is File {
  return (
    value !== null &&
    typeof value !== 'string' &&
    typeof value.arrayBuffer === 'function'
  );
}

async function readJsonResponse<T>(
  response: Response,
  providerName: string
): Promise<T> {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `${providerName} ไม่ได้ส่งข้อมูลตอบกลับ`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${providerName} ส่งข้อมูลกลับมาไม่ใช่ JSON: ` +
        text.slice(0, 300)
    );
  }
}

function slip2GoErrorMessage(
  result: Slip2GoResponse,
  fallback: string
): string {
  const code =
    result.code !== undefined
      ? `code=${String(result.code)}`
      : '';

  const message = result.message?.trim() || '';

  const details = [code, message]
    .filter(Boolean)
    .join(', ');

  return details ? `${fallback} (${details})` : fallback;
}

async function rollbackSlipReservation(
  supabase: SupabaseClient,
  transRefColumn: string,
  transRef: string
) {
  const { error } = await supabase
    .from('used_slips')
    .delete()
    .eq(transRefColumn, transRef);

  if (error) {
    console.error(
      'Rollback used_slips failed:',
      error
    );
  }
}

export async function POST(request: Request) {
  let reservedTransRef = '';
  let rollbackContext:
    | {
        supabase: SupabaseClient;
        transRefColumn: string;
      }
    | undefined;

  try {
    const formData = await request.formData();

    const slipEntry =
      formData.get('slipImage') ||
      formData.get('file');

    const roomNumber = String(
      formData.get('roomNumber') || ''
    ).trim();

    if (!isUploadedFile(slipEntry)) {
      return NextResponse.json(
        {
          success: false,
          message: 'กรุณาอัปโหลดรูปสลิป',
        },
        { status: 400 }
      );
    }

    if (!roomNumber) {
      return NextResponse.json(
        {
          success: false,
          message: 'กรุณาระบุหมายเลขห้อง',
        },
        { status: 400 }
      );
    }

    if (slipEntry.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'ไฟล์สลิปไม่มีข้อมูล',
        },
        { status: 400 }
      );
    }

    const maxFileSize = 10 * 1024 * 1024;

    if (slipEntry.size > maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          message: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 10 MB',
        },
        { status: 400 }
      );
    }

    const { secret, apiUrl } =
      getSlip2GoConfig();

    const slip2GoFormData = new FormData();
    slip2GoFormData.append(
      'file',
      slipEntry,
      slipEntry.name || 'slip.jpg'
    );

    const slip2GoResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        // Slip2Go กำหนดให้ใส่ Secret ตรง ๆ
        // ไม่ต้องเติมคำว่า Bearer
        Authorization: secret,
      },
      body: slip2GoFormData,
      cache: 'no-store',
    });

    const slipResult =
      await readJsonResponse<Slip2GoResponse>(
        slip2GoResponse,
        'Slip2Go'
      );

    console.log('Slip2Go Response:', slipResult);

    const slipCode = String(
      slipResult.code ?? ''
    );

    if (
      !slip2GoResponse.ok ||
      slipCode !== '200000' ||
      !slipResult.data
    ) {
      return NextResponse.json(
        {
          success: false,
          message: slip2GoErrorMessage(
            slipResult,
            'ตรวจสอบสลิปไม่ผ่าน'
          ),
        },
        { status: 400 }
      );
    }

    const transRef =
      slipResult.data.transRef?.trim();

    if (!transRef) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Slip2Go ตรวจสลิปได้ แต่ไม่ส่ง transRef กลับมา',
        },
        { status: 502 }
      );
    }

    const { supabase, transRefColumn } =
      getSupabaseClient();

    rollbackContext = {
      supabase,
      transRefColumn,
    };

    const {
      data: existingSlip,
      error: checkError,
    } = await supabase
      .from('used_slips')
      .select(transRefColumn)
      .eq(transRefColumn, transRef)
      .maybeSingle();

    if (checkError) {
      throw new Error(
        `ตรวจสอบสลิปซ้ำใน Supabase ไม่สำเร็จ: ` +
          checkError.message
      );
    }

    if (existingSlip) {
      return NextResponse.json(
        {
          success: false,
          message: 'สลิปนี้ถูกใช้งานไปแล้ว',
        },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from('used_slips')
      .insert([
        {
          [transRefColumn]: transRef,
        },
      ]);

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: 'สลิปนี้ถูกใช้งานไปแล้ว',
          },
          { status: 400 }
        );
      }

      throw new Error(
        `บันทึกสลิปลง Supabase ไม่สำเร็จ: ` +
          insertError.message
      );
    }

    reservedTransRef = transRef;

    const sonoffUrl = new URL(
      '/api/sonoff',
      request.url
    );

    const tuyaResponse = await fetch(
      sonoffUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomNumber,
          action: 'on',
        }),
        cache: 'no-store',
      }
    );

    const tuyaResult =
      await readJsonResponse<{
        success?: boolean;
        error?: string;
        commandCode?: string;
      }>(tuyaResponse, 'Tuya API ภายในระบบ');

    if (!tuyaResponse.ok || !tuyaResult.success) {
      await rollbackSlipReservation(
        supabase,
        transRefColumn,
        transRef
      );

      reservedTransRef = '';

      return NextResponse.json(
        {
          success: false,
          message:
            'สลิปถูกต้อง แต่สั่งเปิดไฟไม่สำเร็จ',
          detail:
            tuyaResult.error ||
            'Tuya API ไม่ได้ระบุสาเหตุ',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        `ตรวจสอบสลิปสำเร็จ และเปิดไฟห้อง ` +
        `${roomNumber} เรียบร้อยแล้ว`,
      transRef,
      commandCode: tuyaResult.commandCode,
    });
  } catch (error: unknown) {
    if (
      reservedTransRef &&
      rollbackContext
    ) {
      await rollbackSlipReservation(
        rollbackContext.supabase,
        rollbackContext.transRefColumn,
        reservedTransRef
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    console.error('Verify Slip API Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
        detail: message,
      },
      { status: 500 }
    );
  }
}
