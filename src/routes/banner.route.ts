import express from "express";
import Multer from "multer";
import { BannerController } from "../controllers/banner.controller.js";
import { isAuthenticated, requireRole, STAFF_ROLES } from "../middleware/auth.middleware.js";
import { cloudinaryUpload } from "../middleware/fileUploader.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";

const router = express.Router();
const bannerController = new BannerController();

const MAX_FILE_MB = 5;
const bannerUpload = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
    cb(new BadRequestError("Solo se aceptan imágenes JPG, PNG, WEBP, GIF o AVIF"));
  },
}).fields([
  { name: "desktopImage", maxCount: 1 },
  { name: "mobileImage", maxCount: 1 },
]);

/** Multer + traducción de sus errores (tamaño, campos) a 400. */
const parseImages = (req: any, res: any, next: any) =>
  bannerUpload(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof Multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `Cada imagen puede pesar como máximo ${MAX_FILE_MB} MB`
          : `Archivo inválido (${err.code}): usá los campos desktopImage y mobileImage`;
      return next(new BadRequestError(message));
    }
    next(err);
  });

const staff = [isAuthenticated, requireRole(STAFF_ROLES)];
// Orden: auth -> rol -> multer (parsea) -> cloudinary (sube)
const staffWithImages = [...staff, parseImages, cloudinaryUpload("banners")];

// Rutas fijas antes de "/:id"
router.get("/placements", bannerController.placements.bind(bannerController));
router.get("/public", bannerController.listPublic.bind(bannerController));
router.put("/reorder", ...staff, bannerController.reorder.bind(bannerController));

router
  .route("/")
  .get(...staff, bannerController.findAll.bind(bannerController))
  .post(...staffWithImages, bannerController.create.bind(bannerController));
router
  .route("/:id")
  .get(...staff, bannerController.findOne.bind(bannerController))
  .put(...staffWithImages, bannerController.update.bind(bannerController))
  .delete(...staff, bannerController.remove.bind(bannerController));
router
  .route("/:id/active")
  .put(...staff, bannerController.activate.bind(bannerController))
  .delete(...staff, bannerController.deactivate.bind(bannerController));

export default router;
