-- Add SUBACCOUNT_PASSWORD_SETUP value to AuthTokenType enum.
-- Used when vendor creates a new XX-usrN sub-account from the company page
-- and emails the admin a tenant-side link to set that sub-account's password.

ALTER TYPE "AuthTokenType" ADD VALUE 'SUBACCOUNT_PASSWORD_SETUP';
