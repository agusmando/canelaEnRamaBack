import Multer from "multer";
import { ImageService } from "../services/image.service.js";
import { errInfo, getLogger } from "../config/logger.js";

const log = getLogger("upload");

const storage = Multer.memoryStorage();
export const upload = Multer({ storage }); // usar upload.single('file'), upload.array('files'), upload.fields([...]) según necesidad

const imageService = new ImageService();

const describe = (files: any[]) => ({
  count: files.length,
  bytes: files.reduce((sum, f) => sum + (f?.buffer?.length ?? 0), 0),
  types: [...new Set(files.map((f) => f?.mimetype))],
});

export function cloudinaryUpload(folderOrFn?: string | ((req: any) => string)) {
  return async (req: any, _res: any, next: any) => {
    let folder: string | undefined;
    try {
      // req.files es un array con upload.array() y un objeto { campo: [archivos] }
      // con upload.fields() (banners): ambos casos cuentan como "hay archivos".
      const hasFiles =
        !!req.file ||
        (Array.isArray(req.files)
          ? req.files.length > 0
          : !!req.files && Object.values(req.files).some((arr: any) => arr?.length));
      if (!hasFiles) {
        return next();
      }

      folder = typeof folderOrFn === "function" ? folderOrFn(req) : folderOrFn;
      const start = Date.now();

      // Single file (req.file)
      if (req.file && req.file.buffer) {
        const info = describe([req.file]);
        req.file = await imageService.uploadBuffer(req.file.buffer, req.file.mimetype, folder);
        log.info({ folder, ...info, ms: Date.now() - start }, "Imagen subida a Cloudinary");
        return next();
      }

      // Multer array -> req.files is array
      if (Array.isArray(req.files)) {
        const info = describe(req.files);
        req.files = await Promise.all(
          req.files.map((f: any) => imageService.uploadBuffer(f.buffer, f.mimetype, folder)),
        );
        log.info({ folder, ...info, ms: Date.now() - start }, `${info.count} imagen(es) subidas a Cloudinary`);
        return next();
      }

      // Multer fields -> req.files is an object { fieldName: [file, ...], ... }
      if (req.files && typeof req.files === "object") {
        const keys = Object.keys(req.files);
        const info = describe(keys.flatMap((k) => req.files[k]));
        const result: any = {};
        for (const key of keys) {
          result[key] = await Promise.all(
            req.files[key].map((f: any) => imageService.uploadBuffer(f.buffer, f.mimetype, folder)),
          );
        }
        req.files = result;
        log.info({ folder, fields: keys, ...info, ms: Date.now() - start }, `${info.count} imagen(es) subidas a Cloudinary`);
        return next();
      }

      return next();
    } catch (err) {
      log.error({ folder, ...errInfo(err) }, "Falló la subida de imágenes a Cloudinary");
      return next(err);
    }
  };
}
