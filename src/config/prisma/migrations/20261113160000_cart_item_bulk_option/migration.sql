-- =============================================================================
-- CartItem guarda la presentación elegida (selectedBulkOption).
-- 0 = venta suelta (quantity en g o u). > 0 = quantity es cantidad de paquetes.
-- La PK incluye la presentación para permitir 2x250g + 1x500g del mismo producto.
-- Los ítems existentes quedan con 0 (mismo significado que tenían).
-- =============================================================================

ALTER TABLE "CartItem" ADD COLUMN "selectedBulkOption" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_pkey";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_pkey"
  PRIMARY KEY ("cartId", "productVariantId", "selectedBulkOption");

-- -----------------------------------------------------------------------------
-- add_item_to_cart: ahora recibe la presentación y valida que exista.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_item_to_cart(VARCHAR, INT, INT);

CREATE FUNCTION public.add_item_to_cart(
  p_cart_token   VARCHAR,
  p_variant_id   INT,
  p_quantity     INT,
  p_bulk_option  DOUBLE PRECISION DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_cart_id   INT;
  v_packaging DOUBLE PRECISION[];
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0.';
  END IF;

  SELECT id INTO v_cart_id
  FROM "Cart"
  WHERE "sessionId" = p_cart_token OR "userSuperTokensId" = p_cart_token
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'Carrito no encontrado.';
  END IF;

  SELECT "packagingOptions" INTO v_packaging
  FROM "ProductVariant"
  WHERE id = p_variant_id AND active = true AND "availableWeb" = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La variante % no está disponible para la venta web.', p_variant_id;
  END IF;

  v_packaging := COALESCE(v_packaging, '{}');
  IF COALESCE(p_bulk_option, 0) > 0 AND NOT (p_bulk_option = ANY (v_packaging)) THEN
    RAISE EXCEPTION 'La presentación % no existe para la variante % (opciones: %).',
      p_bulk_option, p_variant_id, COALESCE(NULLIF(array_to_string(v_packaging, ', '), ''), 'venta suelta');
  END IF;

  INSERT INTO "CartItem" ("cartId", "productVariantId", "selectedBulkOption", quantity, "createdAt")
  VALUES (v_cart_id, p_variant_id, COALESCE(p_bulk_option, 0), p_quantity, NOW())
  ON CONFLICT ("cartId", "productVariantId", "selectedBulkOption")
  DO UPDATE SET quantity = "CartItem".quantity + EXCLUDED.quantity;

  UPDATE "Cart" SET "updatedAt" = NOW() WHERE id = v_cart_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- merge_session_cart_to_user_cart: el ON CONFLICT ahora incluye la presentación.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_session_cart_to_user_cart(
  p_session_id          VARCHAR,
  p_user_supertokens_id VARCHAR
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_guest_cart_id INT;
  v_user_cart_id  INT;
BEGIN
  SELECT id INTO v_guest_cart_id FROM "Cart" WHERE "sessionId" = p_session_id FOR UPDATE;
  IF v_guest_cart_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_user_cart_id FROM "Cart" WHERE "userSuperTokensId" = p_user_supertokens_id FOR UPDATE;

  IF v_user_cart_id IS NULL THEN
    UPDATE "Cart"
       SET "userSuperTokensId" = p_user_supertokens_id,
           "sessionId" = NULL,
           "updatedAt" = NOW()
     WHERE id = v_guest_cart_id;
    RETURN;
  END IF;

  INSERT INTO "CartItem" ("cartId", "productVariantId", "selectedBulkOption", quantity, "createdAt")
  SELECT v_user_cart_id, "productVariantId", "selectedBulkOption", quantity, NOW()
  FROM "CartItem"
  WHERE "cartId" = v_guest_cart_id
  ON CONFLICT ("cartId", "productVariantId", "selectedBulkOption")
  DO UPDATE SET quantity = "CartItem".quantity + EXCLUDED.quantity;

  DELETE FROM "CartItem" WHERE "cartId" = v_guest_cart_id;
  DELETE FROM "Cart" WHERE id = v_guest_cart_id;
  UPDATE "Cart" SET "updatedAt" = NOW() WHERE id = v_user_cart_id;
END;
$$;
