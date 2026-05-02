import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/lib/newsletter';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email obligatori.' }, { status: 400 });
    const result = subscribe(email, name ?? '');
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, message: 'Subscripció confirmada!' });
  } catch {
    return NextResponse.json({ error: 'Error intern.' }, { status: 500 });
  }
}
