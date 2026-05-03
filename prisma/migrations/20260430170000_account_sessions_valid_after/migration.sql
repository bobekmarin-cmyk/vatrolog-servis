-- Force-logout marker: sve sesije izdane prije ovog vremena su nevažeće.
ALTER TABLE "AccountUser" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);
