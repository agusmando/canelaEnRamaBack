/*import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newProduct = await prisma.product.create({
    data: {
      name: "Rubik's Cube",
      price: 10,
      description: "A Rubik's Cube.",
    },
  });

  console.log(newProduct);
}

const getProducts = async (value, paginaActual, cantidadPorPagina) => {
  const products = await prisma.product.findMany({
    where: { name: { contains: value } },
  });
  console.log(
    JSON.stringify(
      {
        message: "Se encontraron los productos",
        statusCode: 200,
        response: {
          contenido: [
            ...products.slice(
              (paginaActual - 1) * cantidadPorPagina,
              paginaActual * cantidadPorPagina
            ),
          ],
          paginado: {
            pagina: paginaActual,
            cantidadPorPagina: cantidadPorPagina,
            totalPaginas: products.length / cantidadPorPagina,
            totalElementos: products.length,
          },
        },
      },
      null,
      2
    )
  );
};

// main();
getProducts("u", 1, 1);
getProducts("u", 1, 2);

*/

const app = require("./app");
require("dotenv").config();

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
