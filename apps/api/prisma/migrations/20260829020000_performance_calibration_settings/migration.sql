ALTER TABLE "companies"
  ADD COLUMN "goalsCascadeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showNineBoxOnMyResults" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "calibration_sessions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calibration_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calibration_nine_box_cells" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "row" INTEGER NOT NULL,
  "col" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calibration_nine_box_cells_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calibration_session_invitees" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "calibration_session_invitees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calibration_session_leaders" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "calibration_session_leaders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calibration_sessions_companyId_idx"
  ON "calibration_sessions"("companyId");

CREATE UNIQUE INDEX "calibration_nine_box_cells_sessionId_row_col_key"
  ON "calibration_nine_box_cells"("sessionId", "row", "col");

CREATE INDEX "calibration_nine_box_cells_companyId_idx"
  ON "calibration_nine_box_cells"("companyId");

CREATE INDEX "calibration_nine_box_cells_sessionId_idx"
  ON "calibration_nine_box_cells"("sessionId");

CREATE UNIQUE INDEX "calibration_session_invitees_sessionId_employeeId_key"
  ON "calibration_session_invitees"("sessionId", "employeeId");

CREATE INDEX "calibration_session_invitees_companyId_idx"
  ON "calibration_session_invitees"("companyId");

CREATE INDEX "calibration_session_invitees_employeeId_idx"
  ON "calibration_session_invitees"("employeeId");

CREATE UNIQUE INDEX "calibration_session_leaders_sessionId_employeeId_key"
  ON "calibration_session_leaders"("sessionId", "employeeId");

CREATE INDEX "calibration_session_leaders_companyId_idx"
  ON "calibration_session_leaders"("companyId");

CREATE INDEX "calibration_session_leaders_employeeId_idx"
  ON "calibration_session_leaders"("employeeId");

ALTER TABLE "calibration_sessions"
  ADD CONSTRAINT "calibration_sessions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calibration_nine_box_cells"
  ADD CONSTRAINT "calibration_nine_box_cells_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "calibration_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calibration_session_invitees"
  ADD CONSTRAINT "calibration_session_invitees_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "calibration_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calibration_session_invitees"
  ADD CONSTRAINT "calibration_session_invitees_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calibration_session_leaders"
  ADD CONSTRAINT "calibration_session_leaders_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "calibration_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calibration_session_leaders"
  ADD CONSTRAINT "calibration_session_leaders_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "company_features" (
  "id", "companyId", "feature", "enabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  company."id",
  feature.code,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
INNER JOIN "company_modules" AS mod
  ON mod."companyId" = company."id"
  AND mod."module" = 'PERFORMANCE'
  AND mod."enabled" = true
CROSS JOIN (
  VALUES
    ('performance.population'),
    ('performance.calibration')
) AS feature(code)
WHERE company."deletedAt" IS NULL
ON CONFLICT ("companyId", "feature") DO UPDATE SET
  "enabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
