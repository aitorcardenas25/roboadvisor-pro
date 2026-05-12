import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/lib/newsletter';
import { validateBody } from '@/lib/validate';
import { SubscribeSchema } from '@/lib/schemas';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = rateLimit(`newsletter:${ip}`, LIMITS.publicApi.maxRequests, LIMITS.publicApi.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

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
