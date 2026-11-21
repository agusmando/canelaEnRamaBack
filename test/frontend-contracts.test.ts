import assert from "node:assert/strict";
import test from "node:test";
import { permissionsForRoles, primaryStaffRole } from "../src/config/rbac.js";
import { parsePaymentType } from "../src/services/order.service.js";
import { quoteShippingZone } from "../src/services/shipping.service.js";
import { productSearchQueryMapping } from "../src/mappings/products/product-search.mapping.js";
import { prismaQueryBuilder } from "../src/utils/prismaQueryBuilder.js";

test("payment methods match the operational checkout methods", () => {
  assert.equal(parsePaymentType("cash"), "CASH");
  assert.equal(parsePaymentType("TRANSFER"), "TRANSFER");
  assert.throws(() => parsePaymentType("DEBIT"), /paymentType debe ser uno de CASH, TRANSFER, MERCADOPAGO/);
  assert.throws(() => parsePaymentType("CREDIT"), /paymentType debe ser uno de CASH, TRANSFER, MERCADOPAGO/);
});

test("role permissions match the dashboard role matrix", () => {
  assert.equal(permissionsForRoles(["ADMIN"]).includes("users.manage"), true);
  assert.equal(permissionsForRoles(["EDITOR"]).includes("content.edit"), true);
  assert.equal(permissionsForRoles(["EDITOR"]).includes("orders.manage"), false);
  assert.equal(permissionsForRoles(["EMPLOYEE"]).includes("orders.manage"), true);
  assert.equal(permissionsForRoles(["EMPLOYEE"]).includes("users.manage"), false);
  assert.equal(primaryStaffRole(["EMPLOYEE", "ADMIN"]), "ADMIN");
});

test("shipping quote only exposes an active configured own-carrier zone", () => {
  assert.deepEqual(
    quoteShippingZone({ name: "Godoy Cruz", price: 250, etaMinutes: 120 }, "Godoy Cruz"),
    {
      available: true,
      provider: "own",
      price: 250,
      currency: "ARS",
      etaMinutes: 120,
      zone: "Godoy Cruz",
      providerQuoteId: null,
      reason: null,
    },
  );
  assert.equal(quoteShippingZone(null, "Godoy Cruz").available, false);
  assert.equal(quoteShippingZone(null, null).zone, null);
});

test("product q searches product and related catalog names instead of being ignored", () => {
  assert.deepEqual(
    prismaQueryBuilder(
      { q: "almendra tostada", currentPage: "1", amountPerPage: "20" },
      productSearchQueryMapping,
    ),
    {
      AND: [
        {
          OR: [
            { name: { contains: "almendra", mode: "insensitive" } },
            { description: { contains: "almendra", mode: "insensitive" } },
            { Category: { name: { contains: "almendra", mode: "insensitive" } } },
            { Brand: { name: { contains: "almendra", mode: "insensitive" } } },
            { Tags: { some: { name: { contains: "almendra", mode: "insensitive" } } } },
            { variants: { some: { name: { contains: "almendra", mode: "insensitive" } } } },
          ],
        },
        {
          OR: [
            { name: { contains: "tostada", mode: "insensitive" } },
            { description: { contains: "tostada", mode: "insensitive" } },
            { Category: { name: { contains: "tostada", mode: "insensitive" } } },
            { Brand: { name: { contains: "tostada", mode: "insensitive" } } },
            { Tags: { some: { name: { contains: "tostada", mode: "insensitive" } } } },
            { variants: { some: { name: { contains: "tostada", mode: "insensitive" } } } },
          ],
        },
      ],
    },
  );
});
