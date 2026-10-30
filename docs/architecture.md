# Architecture

## Runtime model

- Mobile app: React Native + TypeScript with a native shell for Android and iOS.
- API: Express + TypeScript + PostgreSQL.
- Auth: Clerk free-tier compatibility check + direct email/password + Google OAuth logic.
- Data: Neon PostgreSQL with `pg` and pooling.
- Deploy: Vercel for API/web admin and GitHub Codespaces for development.

## Core security principles

- Validate input on the server.
- Require auth on protected routes.
- Keep secrets in environment variables.
- Avoid storing raw provider secrets or tokens in the database.
- Log security-sensitive events in the audit log without storing password or message content.

## Stage 1 boundaries

This repository intentionally avoids fake production messaging flows. It lays a real foundation for Stage 2 implementation.
