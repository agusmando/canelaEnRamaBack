import Multer from "multer";
import { ImageService } from "../services/image.service.js";
import { errInfo, getLogger } from "../config/logger.js";
import { BadRequestError } from "../errors/application/BadRequestError.js";
import { ExternalServiceError } from "../errors/infra/ExternalServiceError.js";
import { assertImageBuffer } from "../utils/imageSignature.js";

const log = getLogger("upload");

/**
 * Tope por imagen. Cloudinary (plan gratuito) rechaza archivos de más de 10 MB;
 * el dashboard ya las achica antes de subirlas, esto es el resguardo.
 */
export const MAX_IMAGE_MB = 10;

const storage = Multer.memoryStorage();
const multerUpload = Multer({
  storage,
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
    cb(new BadRequestError("Solo se aceptan imágenes JPG, PNG, WEBP, GIF o AVIF"));
  },
});

/** Errores de Multer (tamaño, cantidad, campo) → 400 con un mensaje claro. */
const translateMulter = (mw: any) => (req: any, res: any, next: any) =>
  mw(req, res, (err: any) => {
    if (!err || !(err instanceof Multer.MulterError)) return next(err);
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Cada imagen puede pesar como máximo ${MAX_IMAGE_MB} MB`
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? `Demasiadas imágenes o campo inválido (${err.field ?? err.code})`
          : `Archivo inválido (${err.code})`;
    next(new BadRequestError(message));
  });

export const upload = {
  single: (field: string) => translateMulter(multerUpload.single(field)),
  array: (field: string, max?: number) => translateMulter(multerUpload.array(field, max)),
  fields: (fields: Multer.Field[]) => translateMulter(multerUpload.fields(fields)),
};

const imageService = new ImageService();

const describe = (files: any[]) => ({
  count: files.length,
  bytes: files.reduce((sum, f) => sum + (f?.buffer?.length ?? 0), 0),
  types: [...new Set(files.map((f) => f?.mimetype))],
});

/** Error de Cloudinary → error de la app (el más común: imagen demasiado pesada). */
const translateCloudinary = (err: any): Error => {
  const msg = String(err?.message ?? "");
  if (/file size too large/i.test(msg)) {
    return new BadRequestError(`La imagen es demasiado pesada (máximo ${MAX_IMAGE_MB} MB). Achicala y volvé a intentar.`);
  }
  if (err?.http_code && err.http_code >= 400 && err.http_code < 500) {
    return new BadRequestError(`No se pudo procesar la imagen: ${msg}`);
  }
  return new ExternalServiceError("cloudinary", msg || undefined);
};

/**
 * Sube todos los archivos; si alguno falla, borra de Cloudinary los que sí
 * subieron (para no dejar huérfanos) y tira el error traducido.
 */
async function uploadAll(files: any[], folder?: string) {
  for (const file of files) assertImageBuffer(file);
  const results = await Promise.allSettled(
    files.map((f: any) => imageService.uploadBuffer(f.buffer, f.mimetype, folder)),
  );
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) {
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    await imageService.abortImageUpload(ok);
    throw translateCloudinary(failed.reason);
  }
  return results.map((r) => (r as PromiseFulfilledResult<any>).value);
}

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
        const [res] = await uploadAll([req.file], folder);
        req.file = res;
        log.info({ folder, ...info, ms: Date.now() - start }, "Imagen subida a Cloudinary");
        return next();
      }

      // Multer array -> req.files is array
      if (Array.isArray(req.files)) {
        const info = describe(req.files);
        req.files = await uploadAll(req.files, folder);
        log.info({ folder, ...info, ms: Date.now() - start }, `${info.count} imagen(es) subidas a Cloudinary`);
        return next();
      }

      // Multer fields -> req.files is an object { fieldName: [file, ...], ... }
      if (req.files && typeof req.files === "object") {
        const keys = Object.keys(req.files);
        const info = describe(keys.flatMap((k) => req.files[k]));
        // Se suben todos juntos para que un fallo limpie también los de otros campos
        const flat = keys.flatMap((key) => req.files[key].map((f: any) => ({ key, f })));
        const uploaded = await uploadAll(flat.map((x) => x.f), folder);
        const result: any = Object.fromEntries(keys.map((k) => [k, []]));
        flat.forEach((x, i) => result[x.key].push(uploaded[i]));
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
