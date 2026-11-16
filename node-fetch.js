import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "http://localhost:8080/api";
let headers = { "Content-Type": "application/json" };

async function login() {
  const email = process.env.LOGIN_CREDENTIALS;
  const password = process.env.LOGIN_PASSWORD;
  const res = await fetch(`${BASE_URL}/auth/signin`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      formFields: [
        { id: "email", value: email },
        { id: "password", value: password },
      ],
    }),
  });
  // Clone the response if you need to consume the body multiple times
  const clonedResponse = res.clone();

  // Consume the body as JSON
  const data = await res.json();

  // If needed, consume the cloned response body as text for logging or error handling
  const rawText = await clonedResponse.text();
  if (data.status !== "OK") {
    const error = await res.text();
    throw new Error(`Error POST /auth/signin: ${error}`);
  } else {
    console.log("🌱 Login exitoso");
    const accessToken = res.headers.get("st-access-token");
    headers = {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }
}

async function create(endpoint, body) {
  console.log(headers);
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error POST /${endpoint}: ${error}`);
  }

  return res.json();
}

async function update(endpoint, body) {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error PUT /${endpoint}: ${error}`);
  }

  return res.json();
}

async function main() {
  try {
    console.log("🌱 Iniciando seed...");

    await login();
    // ==========================
    // 1) TAGS
    // ==========================
    const tagSecos = await create("tag", { name: "Secos" });
    const tagPremium = await create("tag", { name: "Premium" });
    const tagOrganico = await create("tag", { name: "Orgánico" });

    // ==========================
    // 2) CATEGORY
    // ==========================
    const catFrutosSecos = await create("category", {
      name: "Frutos secos",
      description: "Frutos secos de gran calidad",
    });

    const catHarinas = await create("category", {
      name: "Harinas",
      description: "Harinas integrales y refinadas",
    });

    // ==========================
    // 3) BRAND
    // ==========================
    const brandNature = await create("brand", {
      name: "Nature Foods",
      description: "Alimentos naturales",
    });

    const brandLaCosecha = await create("brand", {
      name: "La Cosecha",
      description: "Productos nacionales",
    });

    // ==========================
    // 4) SUPPLIER
    // ==========================
    const suppIndias = await create("supplier", {
      name: "Indias",
      description: "Proveedor nacional",
      contact: "2643728977",
    });

    const suppAgroSanJuan = await create("supplier", {
      name: "Agro San Juan",
      description: "Mayorista provincial",
      contact: "2644002020",
    });

    // ==========================
    // 5) PRODUCT
    // ==========================
    const prodMani = await create("product", {
      name: "Maní tostado",
      description: "Maní natural sin sal",
      price: 20.5,
      categoryId: catFrutosSecos.response.id,
      brandId: brandNature.response.id,
      Tags: [{ id: tagSecos.response.id }, { id: tagOrganico.response.id }],
      currentStock: 100,
      movements: { quantity: 100, type: "IN" },
      measure: "KG",
    });

    const prodHarinaInt = await create("product", {
      name: "Harina Integral",
      description: "Harina natural de molienda fina",
      price: 15.25,
      categoryId: catHarinas.response.id,
      brandId: brandLaCosecha.response.id,
      Tags: [{ id: tagPremium.response.id }],
      currentStock: 80,
      movements: { quantity: 80, type: "IN" },
      measure: "KG",
    });

    // ==========================
    // 6) RELACIONES: Supplier ↔ Brands
    // ==========================
    await update(`supplier/${suppIndias.response.id}/brands`, {
      brandsId: [
        { id: brandNature.response.id },
        { id: brandLaCosecha.response.id },
      ],
    });

    await update(`supplier/${suppAgroSanJuan.response.id}/brands`, {
      brandsId: [{ id: brandLaCosecha.response.id }],
    });

    // ==========================
    // 7) RELACIONES: Brand ↔ Products
    // ==========================
    // await update(`brand/${brandNature.response.id}/products`, {
    //   productIds: [prodMani.response.id],
    // });

    // await update(`brand/${brandLaCosecha.response.id}/products`, {
    //   productIds: [prodHarinaInt.response.id],
    // });

    console.log("🌱 Seed finalizado con éxito.");
  } catch (e) {
    console.error("❌ Error en seed:", e);
  }
}

main();
