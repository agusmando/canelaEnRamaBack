
// add_component_to_product (se podría llamar variant)
// * productId
// * mixId
// * quantity
BEGIN
    INSERT INTO "Dependency" ("productId", "mixId", "quantity")
    VALUES (productId, mixId, quantity)
    ON CONFLICT ("productId", "mixId")
    DO UPDATE SET
        "quantity" = EXCLUDED."quantity";
END;

// recalculate_all_mixes_from_product
// * p_component_id
BEGIN
    -- 1. Actualizar la tabla Product:
    --    - Busca todos los Mixes (mixId) que dependen del producto p_component_id.
    --    - Para cada Mix, calcula la SUMA del (precio del componente * cantidad requerida)
    --    - Actualiza el precio del Mix con esta nueva suma.

    UPDATE "Product" AS mix_product
    SET "price" = subquery.new_price
    FROM (
        SELECT
            d."mixId",
            -- Cálculo de la suma de (Precio del Componente * Cantidad Requerida)
            ROUND(SUM(((cp.price * cp."profitMargin" + cp.price)* d.quantity)) )AS new_price
        FROM
            "Dependency" AS d
        JOIN
            "Product" AS cp ON d."productId" = cp.id -- Component Product
        WHERE
            -- Filtrar solo los Mixes que contienen el componente modificado
            d."mixId" IN (
                SELECT DISTINCT "mixId" FROM "Dependency" WHERE "productId" = p_component_id
            )
        GROUP BY
            d."mixId"
    ) AS subquery
    WHERE mix_product.id = subquery."mixId";

    -- Opcional: Agregar lógica para recalcular el stock virtual si el precio de compra cambia.
END;

//recalculate_mix_price
// * mixId
BEGIN
  UPDATE "Product" AS mix_product
    SET "price" = subquery.new_price
    FROM (
        SELECT
            "mixId",
            ROUND(SUM(((p.price * p."profitMargin" + p.price)* d.quantity))) AS new_price
        FROM
            "Dependency" AS d
        JOIN
            "Product" AS p ON d."productId" = p.id
        WHERE d."mixId" = "mixId"
        GROUP BY
            d."mixId"

    ) AS subquery
    WHERE mix_product.id = subquery."mixId";

END;