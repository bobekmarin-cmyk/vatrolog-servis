-- Single active session marker for WORKSHOP account users.
ALTER TABLE "AccountUser" ADD COLUMN "currentSessionId" TEXT;
