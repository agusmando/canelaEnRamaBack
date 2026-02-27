
// add_component_to_variant
// * productVariantId INT
// * mixVariantId INT
// * quantity INT
BEGIN
    INSERT INTO "Dependency" ("productVariantId", "mixVariantId", "quantity")
    VALUES (productvariantid, mixvariantid, quantity)
    ON CONFLICT ("productVariantId", "mixVariantId")
    DO UPDATE SET
        "quantity" = EXCLUDED."quantity";
END;
// recalculate_all_mixes_from_product
// * p_variant_component_id INT
BEGIN
    UPDATE "ProductVariant" AS mix_product
    SET "price" = subquery.new_price
    FROM (
        SELECT
            d."mixVariantId",
            ROUND(SUM(
                ((pv.price * pv."profitMargin" + pv.price) * (CASE WHEN pv.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END))
            )) AS new_price
        FROM
            "Dependency" AS d
        JOIN
            "ProductVariant" AS pv ON d."productVariantId" = pv.id
        WHERE
            d."mixVariantId" IN (
                SELECT DISTINCT "mixVariantId" FROM "Dependency" WHERE "productVariantId" = p_variant_component_id
            )
        GROUP BY
            d."mixVariantId"
    ) AS subquery
    WHERE mix_product.id = subquery."mixVariantId";
END;

//recalculate_mix_price
// * mix_variant_id INT
BEGIN
  UPDATE "ProductVariant" AS mix_variant
    SET "price" = subquery.new_price, "profitMargin" = 0
    FROM (
        SELECT
            d."mixVariantId", -- Usamos d.mixVariantId para mayor claridad
            ROUND(SUM(
                ((p.price * p."profitMargin" + p.price) * (CASE WHEN p.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END))
            )) AS new_price
        FROM
            "Dependency" AS d
        JOIN
            "ProductVariant" AS p ON d."productVariantId" = p.id
        WHERE d."mixVariantId" = mix_variant_id
        GROUP BY
            d."mixVariantId"
    ) AS subquery
    WHERE mix_variant.id = subquery.mix_variant_id;
END;

//create_stock_movement
// * product_id INT
// * quantity INT
// * movement_type TEXT 
DECLARE current_stock INT;
BEGIN
  -- Validación opcional del tipo
  IF movement_type NOT IN ('IN', 'OUT', 'ADJUSTMENT', 'PRODUCTION') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', movement_type;
  END IF;

  SELECT pv."currentStock" INTO current_stock 
  FROM "ProductVariant" pv
  WHERE pv.id = product_id;

  IF (current_stock + quantity) < 0 THEN
    RAISE EXCEPTION 'No hay suficiente stock para el producto %: %', product_id, quantity;
  END IF;

  INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
  VALUES (
    product_id,
    quantity,
    movement_type::"MovementType",
    NOW(),
    (SELECT pv.price + (pv.price * pv."profitMargin")  FROM "ProductVariant" pv WHERE pv.id = product_id)
  );

  UPDATE "ProductVariant" 
  SET "currentStock" = (current_stock + quantity)
  WHERE id = product_id;
END;


//process_mix_production
// * p_mix_variant_id INT
// * p_production_amount DOUBLE
-- process_mix_production
DECLARE
    v_total_recipe_weight FLOAT;
    v_insufficient_component TEXT;
BEGIN
    -- 1. Calcular el peso total de la receta base (considerando KG)
    SELECT SUM(CASE WHEN pv.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END) 
    INTO v_total_recipe_weight
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON d."productVariantId" = pv.id
    WHERE d."mixVariantId" = p_mix_variant_id 
      AND d.active = true;

    IF v_total_recipe_weight IS NULL OR v_total_recipe_weight = 0 THEN
        RAISE EXCEPTION 'Error: La receta para el Mix ID % no existe o suma 0.', p_mix_variant_id;
    END IF;

    -- 2. VALIDACIÓN: Verificar stock insuficiente
    SELECT pv.name
    INTO v_insufficient_component
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON d."productVariantId" = pv.id
    WHERE d."mixVariantId" = p_mix_variant_id
      AND d.active = true
      AND pv."currentStock" < ROUND(((CASE WHEN pv.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END) / v_total_recipe_weight) * p_production_amount)
    LIMIT 1;

    IF v_insufficient_component IS NOT NULL THEN
        RAISE EXCEPTION 'Stock insuficiente para el componente: %. No se puede producir el Mix.', v_insufficient_component;
    END IF;

    -- 3. Insertar historial en StockMovement
    INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
    SELECT 
        d."productVariantId", 
        -1 * ROUND(((CASE WHEN pv.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END) / v_total_recipe_weight) * p_production_amount),
        'PRODUCTION'::"MovementType",
        NOW(),
        pv.price 
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON d."productVariantId" = pv.id
    WHERE d."mixVariantId" = p_mix_variant_id
      AND d.active = true;

    -- 4. Restar del Stock Actual
    UPDATE "ProductVariant" pv
    SET "currentStock" = "currentStock" - subquery.calculated_deduction
    FROM (
        SELECT 
            d."productVariantId",
            ROUND(((CASE WHEN pv2.measure = 'KG' THEN d.quantity / 1000.0 ELSE d.quantity END) / v_total_recipe_weight) * p_production_amount) as calculated_deduction
        FROM "Dependency" d
        JOIN "ProductVariant" pv2 ON d."productVariantId" = pv2.id
        WHERE d."mixVariantId" = p_mix_variant_id
          AND d.active = true
    ) AS subquery
    WHERE pv.id = subquery."productVariantId";

    -- 5 y 6 (Se mantienen igual ya que actúan sobre el producto Mix terminado)
    INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
    SELECT id, p_production_amount, 'PRODUCTION'::"MovementType", NOW(), price
    FROM "ProductVariant"
    WHERE id = p_mix_variant_id;

    UPDATE "ProductVariant"
    SET "currentStock" = "currentStock" + p_production_amount
    WHERE id = p_mix_variant_id;
END;

//add_item_to_cart
// * cart_token VARCHAR
// * product_variant_id INT
// * quantity INT
DECLARE
    cart_id INT;
BEGIN
    -- 1. Obtener el ID numérico del carrito del invitado
    SELECT id INTO cart_id 
    FROM "Cart" 
    WHERE "sessionId" = cart_token;

    IF cart_id IS NULL THEN 
        SELECT id INTO cart_id 
        FROM "Cart" 
        WHERE "userSuperTokensId" = cart_token;
    END IF;

    INSERT INTO "CartItem" ("cartId", "productVariantId", quantity, "createdAt")
    VALUES (cart_id, product_variant_id, quantity)
    ON CONFLICT ("cartId", "productVariantId")
    DO UPDATE SET 
        quantity = "CartItem"."quantity" + EXCLUDED."quantity";
END;

//merge_session_cart_to_user_cart
// * session_id VARCHAR
// * user_supertokens_id VARCHAR
DECLARE
    guest_cart_id INT;
    user_cart_id INT;
BEGIN
    -- 1. Obtener el ID numérico del carrito del invitado
    SELECT id INTO guest_cart_id 
    FROM "Cart" 
    WHERE "sessionId" = session_id;

    -- Si no hay carrito de invitado, no hay nada que mergear
    IF guest_cart_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Obtener el ID numérico del carrito del usuario logueado
    SELECT id INTO user_cart_id 
    FROM "Cart" 
    WHERE "userSuperTokensId" = user_supertokens_id;

    -- Si el usuario no tiene carrito previo, simplemente transferimos el de invitado
    IF user_cart_id IS NULL THEN
        UPDATE "Cart" 
        SET "userSuperTokensId" = user_supertokens_id, 
            "sessionId" = NULL 
        WHERE id = guest_cart_id;
        RETURN;
    END IF;

    -- 3. Merge de ítems: Insertar del invitado al usuario
    INSERT INTO "CartItem" ("cartId", "productVariantId", "quantity", "createdAt")
    SELECT 
        user_cart_id,  -- El destino es el carrito del usuario
        "productVariantId", 
        "quantity", 
        NOW()
    FROM "CartItem"
    WHERE "cartId" = guest_cart_id
    ON CONFLICT ("cartId", "productVariantId") 
    DO UPDATE SET 
        "quantity" = "CartItem"."quantity" + EXCLUDED."quantity";

    -- 4. Limpieza: Borrar los ítems del invitado y luego su carrito
    DELETE FROM "CartItem" WHERE "cartId" = guest_cart_id;
    DELETE FROM "Cart" WHERE "id" = guest_cart_id;

END;