-- Preferencias del comprador (favoritos, vistos recientemente) sincronizadas desde la tienda.
ALTER TABLE "User" ADD COLUMN "prefs" JSONB;
