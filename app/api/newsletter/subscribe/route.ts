import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/lib/newsletter';
import { validateBody } from '@/lib/validate';
import { SubscribeSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  const v = await validateBody(req, SubscribeSchema);
  if (!v.ok) return v.response;

  try {
    const result = await subscribe(v.data.email, v.data.name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, message: 'Subscripció confirmada!' });
  } catch {
    return NextResponse.json({ error: 'Error intern.' }, { status: 500 });
  }
}
