# PayPal Subscriptions Setup

This project supports the four public plans:

- Free
- Standard
- Premium
- Max

## Required Vercel variables

Add these in Vercel Project Settings > Environment Variables:

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_STANDARD_PLAN_ID=
PAYPAL_PREMIUM_PLAN_ID=
PAYPAL_MAX_PLAN_ID=
PAYPAL_WEBHOOK_ID=
PUBLIC_SITE_URL=https://your-domain.com
```

Use `PAYPAL_MODE=live` only after a successful sandbox payment test.

## Supabase SQL order

Run:

```sql
supabase/schema.sql
supabase/qlo_billing_bridge.sql
supabase/qlo_events.sql
```

## PayPal webhook URL

Add this URL in PayPal Developer Dashboard:

```txt
https://your-domain.com/api/paypal-webhook
```

Recommended events:

- BILLING.SUBSCRIPTION.ACTIVATED
- BILLING.SUBSCRIPTION.CANCELLED
- BILLING.SUBSCRIPTION.SUSPENDED
- BILLING.SUBSCRIPTION.EXPIRED
- BILLING.SUBSCRIPTION.PAYMENT.FAILED

## Flow

User selects paid plan -> API creates PayPal subscription -> user approves -> PayPal sends webhook -> database plan and limits update.
