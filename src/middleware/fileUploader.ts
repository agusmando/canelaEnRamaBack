import Multer from "multer";
import { ImageService } from "../services/image.service.js";

const storage = Multer.memoryStorage();
export const upload = Multer({ storage }); // usar upload.single('file'), upload.array('files'), upload.fields([...]) según necesidad

const imageService = new ImageService();

export function cloudinaryUpload(folderOrFn?: string | ((req: any) => string)) {
  return async (req: any, _res: any, next: any) => {
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
      // debugging: ensure multer ran
      console.log(
        "cloudinaryUpload middleware hit; has req.file?",
        !!req.file,
        "has req.files?",
        !!req.files,
        "isArray",
        Array.isArray(req.files),
        "is object",
        typeof req.files === "object"
      );

      const folder =
        typeof folderOrFn === "function" ? folderOrFn(req) : folderOrFn;

      // Single file (req.file)
      if (req.file && req.file.buffer) {
        console.log("Uploading single file:", {
          fieldname: req.file.fieldname,
          mimetype: req.file.mimetype,
          size: req.file.buffer.length,
        });
        const res = await imageService.uploadBuffer(
          req.file.buffer,
          req.file.mimetype,
          folder
        );
        req.file = res;
        return next();
      }

      // Multer array -> req.files is array
      if (Array.isArray(req.files)) {
        console.log("Uploading array of files, count:", req.files.length);
        const uploads = await Promise.all(
          req.files.map((f: any) =>
            imageService.uploadBuffer(f.buffer, f.mimetype, folder)
          )
        );
        req.files = uploads;
        return next();
      }

      // Multer fields -> req.files is an object { fieldName: [file, ...], ... }
      if (req.files && typeof req.files === "object") {
        const keys = Object.keys(req.files);
        console.log("Uploading fields:", keys);
        const result: any = {};
        for (const key of keys) {
          const arr = req.files[key];
          result[key] = await Promise.all(
            arr.map((f: any) =>
              imageService.uploadBuffer(f.buffer, f.mimetype, folder)
            )
          );
        }
        req.files = result;
        return next();
      }

      console.log("No files found to upload.");
      return next();
    } catch (err) {
      console.error("cloudinaryUpload caught error:", err);
      return next(err);
    }
  };
}
