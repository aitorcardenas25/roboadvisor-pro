import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurat' }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const body = await req.json().catch(() => ({}));
  const { product } = body as { product?: string };

  const priceId = product === 'monthly_sub'
    ? STRIPE_PRICES.MONTHLY_SUB
    : STRIPE_PRICES.INITIAL_REPORT;

  const origin = req.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: product === 'monthly_sub' ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: session?.user?.email ?? undefined,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    metadata: {
      userId: session?.user?.id ?? '',
      product: product ?? 'initial_report',
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
