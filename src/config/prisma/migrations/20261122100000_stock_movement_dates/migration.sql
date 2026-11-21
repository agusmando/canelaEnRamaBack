-- Permite conservar la fecha elegida al registrar movimientos manuales.
DROP FUNCTION IF EXISTS public.create_stock_movement(INT, INT, TEXT);

CREATE FUNCTION public.create_stock_movement(
  p_variant_id INT,
  p_quantity   INT,
  p_type       TEXT,
  p_created_at TIMESTAMPTZ DEFAULT NOW()
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
  VALUES (
    p_variant_id,
    p_quantity,
    p_type::"MovementType",
    COALESCE(p_created_at, NOW()),
    COALESCE(v_sale_price, 0)
  );

  UPDATE "ProductVariant"
     SET "currentStock" = v_stock + p_quantity
   WHERE id = p_variant_id;

  RETURN v_stock + p_quantity;
END;
$$;
