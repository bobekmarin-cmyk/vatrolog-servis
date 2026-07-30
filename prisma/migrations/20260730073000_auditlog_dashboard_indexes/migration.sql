-- Platform dashboard radi `ORDER BY "createdAt" DESC LIMIT 15` bez WHERE filtera.
-- Postojeći @@index([companyId, createdAt]) ne može poslužiti globalnom sortu,
-- pa je Postgres skenirao cijelu AuditLog tablicu na svaki render.
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Health strip: count(actorType = 'PLATFORM' AND action IN (...) AND createdAt >= now() - 24h)
CREATE INDEX IF NOT EXISTS "AuditLog_actorType_action_createdAt_idx"
  ON "AuditLog"("actorType", "action", "createdAt");
