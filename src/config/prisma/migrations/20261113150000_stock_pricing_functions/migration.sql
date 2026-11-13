-- =============================================================================
-- Funciones de stock, precios de mixes y carrito.
--
-- Reemplaza las funciones creadas a mano (src/sql_sp/functions.sql). Se borran
-- todas las sobrecargas existentes porque las firmas previas no están
-- versionadas y CREATE OR REPLACE no permite cambiar nombres/tipos de params.
--
-- Convenciones:
--   * ProductVariant.price          -> costo (por KG si contentMeasure = 'KG')
--   * ProductVariant.profitMargin   -> fracción (0.35 = 35%)
--   * precio de venta               -> price * (1 + profitMargin)
--   * currentStock / quantity       -> gramos si contentMeasure = 'KG', si no unidades
--   * Dependency.quantity           -> gramos (componente KG) o unidades
--   * Toda modificación de stock deja un registro en StockMovement y bloquea
--     la fila de la variante (SELECT ... FOR UPDATE) para evitar sobreventa.
--   * Los errores de negocio se lanzan con RAISE EXCEPTION (SQLSTATE P0001):
--     la API los devuelve como HTTP 409 con el mensaje.
-- =============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_stock_movement',
        'set_stock_level',
        'process_mix_production',
        'recalculate_mix_price',
        'recalculate_all_mixes_from_product',
        'add_component_to_variant',
        'add_item_to_cart',
        'merge_session_cart_to_user_cart'
      )
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- create_stock_movement: aplica un delta de stock y registra el movimiento.
-- Devuelve el stock resultante.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.create_stock_movement(
  p_variant_id INT,
  p_quantity   INT,
  p_type       TEXT
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  v_stock INT;
  v_name  TEXT;
  v_sale_price DOUBLE PRECISION;
BEGIN
  IF p_type IS NULL OR NOT (p_type = ANY (enum_range(NULL::"MovementType")::TEXT[])) THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_type;
  END IF;

  SELECT pv."currentStock", pv.name, pv.price * (1 + pv."profitMargin")
    INTO v_stock, v_name, v_sale_price
  FROM "ProductVariant" pv
  WHERE pv.id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La variante % no existe', p_variant_id;
  END IF;

  IF COALESCE(p_quantity, 0) = 0 THEN
    RETURN v_stock;
  END IF;

  IF v_stock + p_quantity < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para "%": disponible %, solicitado %',
      v_name, v_stock, -p_quantity;
  END IF;

  INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
  VALUES (p_variant_id, p_quantity, p_type::"MovementType", NOW(), COALESCE(v_sale_price, 0));

  UPDATE "ProductVariant"
     SET "currentStock" = v_stock + p_quantity
   WHERE id = p_variant_id;

  RETURN v_stock + p_quantity;
END;
$$;

-- -----------------------------------------------------------------------------
-- set_stock_level: fija el stock a un valor absoluto (inventario físico).
-- Registra un ADJUSTMENT por la diferencia. Devuelve el stock resultante.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.set_stock_level(
  p_variant_id INT,
  p_target     INT
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  v_stock INT;
BEGIN
  IF p_target IS NULL OR p_target < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo (%).', p_target;
  END IF;

  SELECT "currentStock" INTO v_stock
  FROM "ProductVariant"
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La variante % no existe', p_variant_id;
  END IF;

  RETURN public.create_stock_movement(p_variant_id, p_target - v_stock, 'ADJUSTMENT');
END;
$$;

-- -----------------------------------------------------------------------------
-- process_mix_production: produce `p_amount` (g o u) de un mix consumiendo sus
-- componentes en proporción a la receta (Dependency).
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.process_mix_production(
  p_mix_variant_id INT,
  p_amount         INT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_total_recipe_weight DOUBLE PRECISION;
  v_insufficient TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'La cantidad a producir debe ser mayor a 0 (recibido %).', p_amount;
  END IF;

  -- Bloquea mix + componentes en orden de id (evita deadlocks)
  PERFORM 1
  FROM "ProductVariant" pv
  WHERE pv.id = p_mix_variant_id
     OR pv.id IN (SELECT d."productVariantId" FROM "Dependency" d
                  WHERE d."mixVariantId" = p_mix_variant_id AND d.active = true)
  ORDER BY pv.id
  FOR UPDATE;

  -- 1. Peso total de la receta
  SELECT SUM(CASE WHEN pv."contentMeasure" = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END)
    INTO v_total_recipe_weight
  FROM "Dependency" d
  JOIN "ProductVariant" pv ON pv.id = d."productVariantId"
  WHERE d."mixVariantId" = p_mix_variant_id
    AND d.active = true;

  IF v_total_recipe_weight IS NULL OR v_total_recipe_weight = 0 THEN
    RAISE EXCEPTION 'La receta del mix % no existe o suma 0.', p_mix_variant_id;
  END IF;

  -- 2. Validación de stock (consumo proporcional a la receta)
  SELECT format('%s (disponible %s, necesario %s)', c.name, c.stock, c.deduction)
    INTO v_insufficient
  FROM (
    SELECT pv.name, pv."currentStock" AS stock,
           ROUND(((CASE WHEN pv."contentMeasure" = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END)
                  / v_total_recipe_weight) * p_amount)::INT AS deduction
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON pv.id = d."productVariantId"
    WHERE d."mixVariantId" = p_mix_variant_id
      AND d.active = true
  ) c
  WHERE c.stock < c.deduction
  LIMIT 1;

  IF v_insufficient IS NOT NULL THEN
    RAISE EXCEPTION 'Stock insuficiente para el componente %. No se puede producir el mix.', v_insufficient;
  END IF;

  -- 3 y 4. Movimientos y descuento de componentes
  WITH consumption AS (
    SELECT pv.id AS variant_id, pv.price AS cost,
           ROUND(((CASE WHEN pv."contentMeasure" = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END)
                  / v_total_recipe_weight) * p_amount)::INT AS deduction
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON pv.id = d."productVariantId"
    WHERE d."mixVariantId" = p_mix_variant_id
      AND d.active = true
  ), movements AS (
    INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
    SELECT variant_id, -deduction, 'PRODUCTION'::"MovementType", NOW(), cost
    FROM consumption
    WHERE deduction > 0
  )
  UPDATE "ProductVariant" pv
     SET "currentStock" = pv."currentStock" - c.deduction
    FROM consumption c
   WHERE pv.id = c.variant_id;

  -- 5. Alta del mix producido
  INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
  SELECT id, p_amount, 'PRODUCTION'::"MovementType", NOW(), price
  FROM "ProductVariant"
  WHERE id = p_mix_variant_id;

  UPDATE "ProductVariant"
     SET "currentStock" = "currentStock" + p_amount
   WHERE id = p_mix_variant_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- recalculate_mix_price: price del mix = suma del precio de venta de cada
-- componente activo por su cantidad en la receta. El margen del mix queda en 0
-- (el margen ya está incluido en el precio de venta de los componentes).
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.recalculate_mix_price(
  p_mix_variant_id INT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_new_price DOUBLE PRECISION;
BEGIN
  SELECT ROUND(SUM(
           (pv.price * (1 + pv."profitMargin"))
           * (CASE WHEN pv."contentMeasure" = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END)
         )::NUMERIC, 2)
    INTO v_new_price
  FROM "Dependency" d
  JOIN "ProductVariant" pv ON pv.id = d."productVariantId"
  WHERE d."mixVariantId" = p_mix_variant_id
    AND d.active = true;

  -- Sin componentes activos: no tocamos el precio
  IF v_new_price IS NULL THEN
    RETURN;
  END IF;

  UPDATE "ProductVariant"
     SET price = v_new_price,
         "profitMargin" = 0
   WHERE id = p_mix_variant_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- recalculate_all_mixes_from_product: tras cambiar el precio de un componente,
-- recalcula todos los mixes que lo usan (y en cascada, los mixes de mixes).
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.recalculate_all_mixes_from_product(
  p_variant_component_id INT,
  p_depth INT DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_mix_id INT;
BEGIN
  IF p_depth > 5 THEN
    RAISE EXCEPTION 'Dependencia circular detectada entre mixes (variante %).', p_variant_component_id;
  END IF;

  FOR v_mix_id IN
    SELECT DISTINCT d."mixVariantId"
    FROM "Dependency" d
    WHERE d."productVariantId" = p_variant_component_id
      AND d.active = true
  LOOP
    PERFORM public.recalculate_mix_price(v_mix_id);
    PERFORM public.recalculate_all_mixes_from_product(v_mix_id, p_depth + 1);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- add_component_to_variant: agrega (o actualiza) un componente de un mix.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.add_component_to_variant(
  p_component_variant_id INT,
  p_mix_variant_id       INT,
  p_quantity             DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_component_variant_id = p_mix_variant_id THEN
    RAISE EXCEPTION 'Un mix no puede ser componente de sí mismo (variante %).', p_mix_variant_id;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad del componente debe ser mayor a 0.';
  END IF;

  INSERT INTO "Dependency" ("productVariantId", "mixVariantId", quantity, active)
  VALUES (p_component_variant_id, p_mix_variant_id, p_quantity, true)
  ON CONFLICT ("mixVariantId", "productVariantId")
  DO UPDATE SET quantity = EXCLUDED.quantity, active = true;
END;
$$;

-- -----------------------------------------------------------------------------
-- add_item_to_cart: suma un ítem al carrito (de invitado o de usuario).
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.add_item_to_cart(
  p_cart_token VARCHAR,
  p_variant_id INT,
  p_quantity   INT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_cart_id INT;
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

  IF NOT EXISTS (
    SELECT 1 FROM "ProductVariant"
    WHERE id = p_variant_id AND active = true AND "availableWeb" = true
  ) THEN
    RAISE EXCEPTION 'La variante % no está disponible para la venta web.', p_variant_id;
  END IF;

  INSERT INTO "CartItem" ("cartId", "productVariantId", quantity, "createdAt")
  VALUES (v_cart_id, p_variant_id, p_quantity, NOW())
  ON CONFLICT ("cartId", "productVariantId")
  DO UPDATE SET quantity = "CartItem".quantity + EXCLUDED.quantity;

  UPDATE "Cart" SET "updatedAt" = NOW() WHERE id = v_cart_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- merge_session_cart_to_user_cart: al loguearse, pasa el carrito de invitado
-- al carrito del usuario (sumando cantidades) y borra el de invitado.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.merge_session_cart_to_user_cart(
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

  -- El usuario no tenía carrito: se adueña del de invitado
  IF v_user_cart_id IS NULL THEN
    UPDATE "Cart"
       SET "userSuperTokensId" = p_user_supertokens_id,
           "sessionId" = NULL,
           "updatedAt" = NOW()
     WHERE id = v_guest_cart_id;
    RETURN;
  END IF;

  INSERT INTO "CartItem" ("cartId", "productVariantId", quantity, "createdAt")
  SELECT v_user_cart_id, "productVariantId", quantity, NOW()
  FROM "CartItem"
  WHERE "cartId" = v_guest_cart_id
  ON CONFLICT ("cartId", "productVariantId")
  DO UPDATE SET quantity = "CartItem".quantity + EXCLUDED.quantity;

  DELETE FROM "CartItem" WHERE "cartId" = v_guest_cart_id;
  DELETE FROM "Cart" WHERE id = v_guest_cart_id;
  UPDATE "Cart" SET "updatedAt" = NOW() WHERE id = v_user_cart_id;
END;
$$;
