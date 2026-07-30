import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export async function GET() {
  try {
    const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'promptpay').maybeSingle();
    return NextResponse.json({ success: true, promptpay: data?.value || '' });
  } catch (error: any) {
    return NextResponse.json({ success: false, promptpay: '' });
  }
}
