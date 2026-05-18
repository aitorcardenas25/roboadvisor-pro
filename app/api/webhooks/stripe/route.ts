import { NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { updateUserSubscription } from '@/lib/users';

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurat' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Signatura invàlida' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const product = session.metadata?.product;

    if (userId) {
      const plan = product === 'monthly_sub' ? 'active' : 'active';
      updateUserSubscription(userId, plan, 'active');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const userId = (sub.metadata as Record<string, string>)?.userId;
    if (userId) {
      updateUserSubscription(userId, 'free', 'inactive');
    }
  }

  return NextResponse.json({ received: true });
}
