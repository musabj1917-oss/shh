# Database setup

The Stage 1 schema creates the foundation for users, auth provider linkage, friendships, conversations, groups, moderation, media, and account deletion workflows.

## PostgreSQL

Use a Neon PostgreSQL database. Keep a direct connection for migrations; use connection pooling for normal app traffic.

## Apply migration

```bash
psql "$DATABASE_URL" -f database/migrations/001_initial_schema.sql
```

## Notes

- Use `gen_random_uuid()` and explicit foreign keys.
- Prefer `ON DELETE CASCADE` for user-owned relationship tables.
- Keep secrets out of the database and only store provider IDs, not access tokens.
