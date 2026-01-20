
// add_component_to_variant
// * productVariantId
// * mixVariantId
// * quantity
BEGIN
    INSERT INTO "Dependency" ("productVariantId", "mixVariantId", "quantity")
    VALUES (productvariantid, mixvariantid, quantity)
    ON CONFLICT ("productVariantId", "mixVariantId")
    DO UPDATE SET
        "quantity" = EXCLUDED."quantity";
END;
// recalculate_all_mixes_from_product
// * p_variant_component_id
BEGIN
    UPDATE "ProductVariant" AS mix_product
    SET "price" = subquery.new_price
    FROM (
        SELECT
            d."mixVariantId",
            -- Cálculo de la suma de (Precio del Componente * Cantidad Requerida)
            ROUND(SUM(((pv.price * pv."profitMargin" + pv.price)* d.quantity)) )AS new_price
        FROM
            "Dependency" AS d
        JOIN
            "ProductVariant" AS pv ON d."productVariantId" = pv.id -- Component Product
        WHERE
            -- Filtrar solo los Mixes que contienen el componente modificado
            d."mixVariantId" IN (
                SELECT DISTINCT "mixVariantId" FROM "Dependency" WHERE "productVariantId" = p_variant_component_id
            )
        GROUP BY
            d."mixVariantId"
    ) AS subquery
    WHERE mix_product.id = subquery."mixVariantId";
END;

//recalculate_mix_price
// * mix_variant_id
BEGIN
  UPDATE "ProductVariant" AS mix_variant
    SET "price" = subquery.new_price, "profitMargin" = 0
    FROM (
        SELECT
            mix_variant_id,
            ROUND(SUM(((p.price * p."profitMargin" + p.price)* d.quantity))) AS new_price
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
// * product_id
// * quantity
// * movement_type
BEGIN
  IF movement_type NOT IN ('IN', 'OUT', 'ADJUSTMENT', 'PRODUCTION') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', movement_type;
  END IF;

  INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
  VALUES (
    product_id,
    quantity,
    movement_type::"MovementType",  -- Usas el parámetro directamente
    NOW(),
    (SELECT price FROM "ProductVariant" pv WHERE pv.id = product_id)
  );
END;


//process_mix_production
// * p_mix_variant_id
// * p_production_amount
DECLARE
    v_total_recipe_weight FLOAT;
BEGIN
    -- 1. Calcular el peso total de la receta base
    SELECT SUM(quantity) 
    INTO v_total_recipe_weight
    FROM "Dependency"
    WHERE "mixVariantId" = p_mix_variant_id -- Ajustado a tu schema: mixId
      AND active = true;

    -- Validación
    IF v_total_recipe_weight IS NULL OR v_total_recipe_weight = 0 THEN
        RAISE EXCEPTION 'Error: La receta para el Mix ID % no existe o suma 0.', p_mix_variant_id;
    END IF;

    -- 2. Insertar historial en StockMovement para cada insumo
    -- Aquí traemos el "price" actual de ProductVariant para congelarlo en el historial
    INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
    SELECT 
        d."productVariantId", -- En tu schema de Dependency usas productId
        -1 * ROUND((d.quantity / v_total_recipe_weight) * p_production_amount),
        'PRODUCTION'::"MovementType",
        NOW(),
        pv.price -- <--- Capturamos el precio/costo actual de la variante
    FROM "Dependency" d
    JOIN "ProductVariant" pv ON d."productVariantId" = pv.id
    WHERE d."mixVariantId" = p_mix_variant_id
      AND d.active = true;

    -- 3. Restar del Stock Actual de los insumos
    UPDATE "ProductVariant" pv
    SET "currentStock" = "currentStock" - subquery.calculated_deduction
    FROM (
        SELECT 
            d."productVariantId",
            ROUND((d.quantity / v_total_recipe_weight) * p_production_amount) as calculated_deduction
        FROM "Dependency" d
        WHERE d."mixVariantId" = p_mix_variant_id
          AND d.active = true
    ) AS subquery
    WHERE pv.id = subquery."productVariantId";

    -- 4. OPCIONAL: Aumentar el stock del Mix terminado
    -- Si también quieres que el SP maneje la entrada del producto final:
    -- UPDATE "ProductVariant"
    --SET "currentStock" = "currentStock" + p_production_amount
    --WHERE id = p_mix_variant_id;

    -- Insertar el movimiento de entrada del Mix (su costo es la suma proporcional o su precio actual)
    INSERT INTO "StockMovement" ("productVariantId", quantity, type, "createdAt", "priceAtTime")
    SELECT id, p_production_amount, 'PRODUCTION'::"MovementType", NOW(), price
    FROM "ProductVariant"
    WHERE id = p_mix_variant_id;

END;