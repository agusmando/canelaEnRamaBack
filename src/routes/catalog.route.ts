import express from "express";
import { catalogService } from "../services/catalog.service.js";
import { attachRoles, optionalSession } from "../middleware/auth.middleware.js";
import { hideCostForPublic, webOnlyForPublic } from "../middleware/publicView.js";
import { BaseResponse } from "../utils/responseFormat.js";

const router = express.Router();

/**
 * Catálogo de la tienda con búsqueda, filtros, orden y paginación del lado
 * del servidor (reemplaza al `GET /product?paginate=false` + filtrado en el
 * cliente). Devuelve `{ content, totalElements, facets }`.
 */
router.get(
  "/best-sellers",
  optionalSession,
  attachRoles,
  hideCostForPublic,
  webOnlyForPublic("product"),
  async (req, res, next) => {
    try {
      const data = await catalogService.bestSellers(req.query);
      res.status(200).json(new BaseResponse(200, "Más pedidos", data));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/",
  optionalSession,
  attachRoles,
  hideCostForPublic,
  webOnlyForPublic("product"),
  async (_req, res, next) => {
    try {
      const data = await catalogService.search(_req.query);
      res.status(200).json(new BaseResponse(200, "Catálogo obtenido", data));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
