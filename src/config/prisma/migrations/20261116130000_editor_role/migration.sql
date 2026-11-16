-- Rol EDITOR del dashboard (RBAC). Espejo del rol de SuperTokens en "User".role.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDITOR';
