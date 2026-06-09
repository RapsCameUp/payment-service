module.exports = {
  port: process.env.PORT || 3003,
  stripeKey: process.env.STRIPE_KEY || 'sk_test_placeholder',
  webhookSecret: process.env.WEBHOOK_SECRET || 'whsec_placeholder',
};
