import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id requerit' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe no configurat' }, { status: 503 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === 'paid' || session.status === 'complete') {
    return NextResponse.json({ status: 'success', session: { id: session.id, customer_email: session.customer_email } });
  }

  return NextResponse.json({ status: 'pending' }, { status: 402 });
}
