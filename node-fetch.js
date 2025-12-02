import fetch from "node-fetch";

const BASE_URL = "http://localhost:8080/api";

async function create(endpoint, body) {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    console.log(catFrutosSecos, catHarinas);
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
      brandIds: [brandNature.response.id, brandLaCosecha.response.id],
    });

    await update(`supplier/${suppAgroSanJuan.response.id}/brands`, {
      brandIds: [brandLaCosecha.response.id],
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
