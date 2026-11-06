import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';
import { z } from 'zod';
import { RECOMMENDATIONS_ENABLED } from '@/lib/featureFlags';

const Schema = z.object({
  name:  z.string().min(1).max(200),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  // Cobrar per un informe amb cartera personalitzada = assessorament remunerat.
  if (!RECOMMENDATIONS_ENABLED) {
    return NextResponse.json({ error: 'Producte no disponible.' }, { status: 403 });
  }
  if (!stripe) {
    return NextResponse.json({ error: 'Pagament no configurat', demo: true }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { name, email } = parsed.data;
  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode:          'payment',
    customer_email: email,
    line_items: [{ price: STRIPE_PRICES.INITIAL_REPORT, quantity: 1 }],
    metadata:      { clientName: name, type: 'report' },
    success_url:   `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=report`,
    cancel_url:    `${origin}/`,
  });

  return NextResponse.json({ url: session.url });
}
