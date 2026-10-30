# Provider cost and limits report

## Criteria

The Stage 1 stack aims for a $0 budget and avoids paid subscriptions or credit-card dependencies.

## Neon

- Official free tier includes no credit-card requirement and a zero-cost path for prototypes.
- Limits vary by project and usage, but free usage is suitable for low-volume prototype work.
- This project keeps media storage behind a replaceable interface so the app does not require Cloudinary or any paid file service.

## Clerk

- Clerk offers a free Hobby plan for smaller public apps with no credit card required.
- Capacity is measured in Monthly Retained Users.
- Free limitations include no MFA or branding removal and fixed short session lifetime.
- For a public app with low volume and a Stage 1 prototype, this remains a compliant option.

## Vercel

- Vercel has free-tier options suitable for small prototypes and preview deployments.
- No paid service is required for this Stage 1 foundation.

## If constraints change

If any provider fails the intended public-use and $0 budget requirements, the project should fall back to a self-hosted API or a service without a credit card requirement before adopting a paid plan.
