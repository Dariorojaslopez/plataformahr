-- Marks a vacancy as confidential. Public links hide the company name; Home omits it from open listings.

ALTER TABLE "vacancies" ADD COLUMN "confidential" BOOLEAN NOT NULL DEFAULT false;
