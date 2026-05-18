import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const STRIPE_PRICES = {
  INITIAL_REPORT: process.env.STRIPE_PRICE_INITIAL_REPORT ?? 'price_initial_report_placeholder',
  MONTHLY_SUB:    process.env.STRIPE_PRICE_MONTHLY_SUB    ?? 'price_monthly_sub_placeholder',
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
