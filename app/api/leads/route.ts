import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLead } from '@/lib/leads';
import { sendLeadNotification, sendAccessRequestConfirmation } from '@/lib/emails';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';
import { createNotification } from '@/lib/notifications';

const Schema = z.object({
  name:        z.string().min(2).max(100),
  lastName:    z.string().max(100).optional(),
  email:       z.email(),
  phone:       z.string().max(20).optional(),
  interest:    z.string().min(1).max(200),
  profile:     z.string().max(100).optional(),
  message:     z.string().max(1000).optional(),
  gdprConsent: z.boolean().default(false),
  source:      z.string().max(50).optional(),
  type:        z.string().max(50).optional(),
});

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(`leads:${ip}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades invàlides' }, { status: 400 });

  const { name, lastName, email, phone, interest, profile, message, gdprConsent, source, type } = parsed.data;
  const lead = await createLead({
    name, lastName, email, phone, interest, profile, message,
    gdprConsent, source: source ?? 'unknown', type,
  });
  sendLeadNotification({ name, lastName, email, phone, interest, type, profile, source }).catch(() => {});
  sendAccessRequestConfirmation(email, name).catch(() => {});
  createNotification({
    type:    'new_lead',
    title:   `Nou lead: ${[name, lastName].filter(Boolean).join(' ')}`,
    message: `${email} · ${interest}`,
    link:    '/admin',
  });
  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
