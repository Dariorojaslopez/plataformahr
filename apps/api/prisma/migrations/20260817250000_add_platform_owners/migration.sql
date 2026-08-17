-- Provision the two explicitly authorized platform owners.
-- Passwords are stored only as independent Argon2id hashes.

INSERT INTO "users" (
  "id",
  "email",
  "passwordHash",
  "firstName",
  "lastName",
  "status",
  "isPlatformOwner",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
VALUES
  (
    '5af5ccc0-c3b2-4add-b68d-cc9ce786edca',
    'jfrojas012@hotmail.com',
    '$argon2id$v=19$m=65536,p=4,t=3$bgdrke8OLDJLnZ0d47RnNw$1u5AjRn+WtMjt2P3ma8sKwteTvf2BrpJ1ddf9nwqL40',
    'Jhon Fredy',
    'Rojas',
    'ACTIVE',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL
  ),
  (
    'e05f8da7-5440-451d-97a3-949d8b6b754d',
    'oscar.agudelo@live.com',
    '$argon2id$v=19$m=65536,p=4,t=3$qZkLYG6TTDvT3xCaOaDXOQ$xEftVULNpxODRSkr5mvYc4CL2WuvmTLPMW16/5NzjXM',
    'Oscar Julián',
    'Agudelo Castañeda',
    'ACTIVE',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL
  )
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "status" = 'ACTIVE',
  "isPlatformOwner" = true,
  "updatedAt" = CURRENT_TIMESTAMP,
  "deletedAt" = NULL;
