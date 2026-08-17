-- Require newly provisioned tenant administrators to replace temporary passwords.
-- Existing users keep their current authentication behavior.

ALTER TABLE "users"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
