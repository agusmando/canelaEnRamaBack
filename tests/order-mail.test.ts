import { describe, expect, it } from "vitest";
import { buildOrderMail, itemLabel, itemTotal } from "../src/services/order-mail.service.js";

const order = {
  id: 42,
  paymentType: "TRANSFER",
  paymentStatus: "PENDING",
  status: "PENDING",
  totalPrice: 6000,
  shippingCost: 1500,
  shippingMethod: "DELIVERY",
  shippingZone: "Godoy Cruz",
  user: { name: "Ana <script> Pérez", email: "ana@example.com" },
  shipment: { address: "San Martín 1234", city: "Godoy Cruz", trackingCode: "CER-ABC123", carrier: null, carrierTrackingUrl: null },
  orderItems: [
    { id: 1, productNameSnapshot: "Nueces", variantNameSnapshot: "Mariposa", quantity: 2, selectedBulkOption: 500, unitPriceSnapshot: 5000, discountAppliedSnapshot: 0, status: "FULFILLED", productVariant: { contentMeasure: "KG" } },
    { id: 2, productNameSnapshot: "Té", variantNameSnapshot: "", quantity: 1, selectedBulkOption: null, unitPriceSnapshot: 1000, discountAppliedSnapshot: 0, status: "CANCELLED", productVariant: { contentMeasure: "U" } },
  ],
};

describe("mails de pedido", () => {
  it("cantidades y totales por línea", () => {
    expect(itemLabel(order.orderItems[0])).toBe("2 × 500 g");
    expect(itemLabel({ quantity: 1500, productVariant: { contentMeasure: "KG" } })).toBe("1,5 kg");
    expect(itemTotal(order.orderItems[0])).toBe(5000);
    expect(itemTotal(order.orderItems[1])).toBe(0);
  });

  it("pedido recibido: detalle, envío, total y escape de HTML", () => {
    const m = buildOrderMail("received", order);
    expect(m.subject).toContain("#42");
    expect(m.html).toContain("Nueces");
    expect(m.html).not.toContain("Té"); // líneas canceladas no se listan
    expect(m.html).toContain("$7.500"); // 6000 + 1500 de envío
    expect(m.html).toContain("Transferencia");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("/mi-cuenta/pedidos/42");
  });

  it("en camino usa el seguimiento propio", () => {
    expect(buildOrderMail("onTheWay", order).html).toContain("/seguimiento/CER-ABC123");
  });

  it("cancelado por falta de pago en Mercado Pago lo explica", () => {
    const m = buildOrderMail("cancelled", { ...order, paymentType: "MERCADOPAGO", paymentStatus: "PENDING" });
    expect(m.html).toContain("No recibimos el pago a tiempo");
  });

  it("entregado distingue retiro en el local de envío", () => {
    expect(buildOrderMail("delivered", order).subject).toContain("Entregamos");
    expect(buildOrderMail("delivered", { ...order, shippingMethod: "PICKUP" }).subject).toContain("Retiraste");
  });

  it("entregado con reviewUrl pide la reseña en Google y mantiene el link al pedido", () => {
    const m = buildOrderMail("delivered", order, { reviewUrl: "https://search.google.com/local/writereview?placeid=abc" });
    expect(m.html).toContain("writereview?placeid=abc");
    expect(m.html).toContain("Calificar en Google");
    expect(m.html).toContain("/mi-cuenta/pedidos/42");
    const guest = { ...order, user: { ...order.user, supertokensId: "guest:x" }, shipment: { trackingCode: "CER-ABC123" } };
    expect(buildOrderMail("delivered", guest, { reviewUrl: "https://g.page/r/abc" }).html).toContain("/seguimiento/CER-ABC123");
    // Sin reviewUrl no hay CTA de Google
    expect(buildOrderMail("delivered", order).html).not.toContain("writereview");
  });

  it("cambios en el pedido lista lo que se sacó, lo devuelto y lo que espera reposición", () => {
    const m = buildOrderMail("updated", {
      ...order,
      estimatedReadyAt: "2026-12-01T15:00:00Z",
      orderItems: [
        ...order.orderItems,
        { ...order.orderItems[0], id: 3, productNameSnapshot: "Almendras", status: "AWAITING_STOCK", awaitingStockAt: "2026-12-01T15:00:00Z" },
        { ...order.orderItems[0], id: 4, productNameSnapshot: "Coco", status: "RETURNED" },
      ],
    });
    expect(m.subject).toContain("#42");
    expect(m.html).toContain("Los sacamos del pedido");
    expect(m.html).toContain("Té");
    expect(m.html).toContain("Los devolvimos");
    expect(m.html).toContain("Coco");
    expect(m.html).toContain("Esperando reposición");
    expect(m.html).toContain("Almendras");
    expect(m.html).toContain("diciembre");
  });

  it("cambios en el pedido con itemIds solo lista los ítems tocados", () => {
    const m = buildOrderMail(
      "updated",
      {
        ...order,
        orderItems: [
          order.orderItems[0],
          { ...order.orderItems[1], status: "PARTIALLY_RETURNED", quantity: 1 },
          { ...order.orderItems[0], id: 3, productNameSnapshot: "Almendras", status: "AWAITING_STOCK", awaitingStockAt: "2026-12-01T15:00:00Z" },
        ],
      },
      { itemIds: [2] },
    );
    expect(m.html).toContain("Cantidad reducida");
    expect(m.html).toContain("Té");
    // Las otras líneas no aparecen en la sección de cambios (sí en la tabla final)
    expect(m.html).not.toContain("Esperando reposición");
    expect(m.html).not.toContain("Los sacamos del pedido");
  });

  it("pedido recibido explica el ajuste por stock (sin stock y cantidad reducida)", () => {
    const m = buildOrderMail("received", {
      ...order,
      orderItems: [
        order.orderItems[0],
        { ...order.orderItems[0], id: 5, productNameSnapshot: "Almendras", status: "OUT_OF_STOCK", quantity: 0 },
        { ...order.orderItems[0], id: 6, productNameSnapshot: "Coco", status: "PARTIALLY_RETURNED", quantity: 1 },
      ],
    });
    expect(m.html).toContain("Sin stock, lo sacamos del pedido");
    expect(m.html).toContain("Almendras");
    expect(m.html).toContain("Ajustamos la cantidad al stock disponible");
    expect(m.html).toContain("Coco");
    // La línea cancelada no aparece en la tabla de ítems
    expect(m.html).not.toContain("Té");
  });

  it("mail de pago acreditado también explica el ajuste por stock", () => {
    const m = buildOrderMail("paid", {
      ...order,
      paymentType: "MERCADOPAGO",
      orderItems: [{ ...order.orderItems[0], status: "OUT_OF_STOCK", quantity: 0 }],
    });
    expect(m.html).toContain("Sin stock, lo sacamos del pedido");
  });

  it("reintegro: monto y si fue total o parcial", () => {
    const parcial = buildOrderMail("refunded", { ...order, paymentStatus: "APPROVED" }, { amount: 2500 });
    expect(parcial.subject).toContain("$2.500");
    expect(parcial.html).toContain("parte del pago");
    expect(buildOrderMail("refunded", { ...order, paymentStatus: "REFUNDED" }, { amount: 7500 }).html).toContain("el pago del pedido");
  });
});
