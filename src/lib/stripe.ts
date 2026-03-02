import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe: Stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover', // verify current version from stripe.com/docs/api/versioning
  });

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe;
}
