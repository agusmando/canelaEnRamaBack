// import { PrismaClient } from "@prisma/client/extension";
import cloudinary from "cloudinary";
import Multer from "multer";
import { ImageService } from "../services/image.service.ts";


const storage = Multer.memoryStorage();
export const upload = Multer({ storage }); // usar upload.single('file'), upload.array('files'), upload.fields([...]) según necesidad


const imageService = new ImageService();


export function cloudinaryUpload(folderOrFn?: string | ((req: any) => string)) {
  return async (req: any, _res: any, next: any) => {
    try {
      // debugging: ensure multer ran
      console.log(
        "cloudinaryUpload middleware hit; has req.file?",
        !!req.file,
        "has req.files?",
        !!req.files
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
        const res = await imageService.uploadBufferToCloudinary(
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
            imageService.uploadBufferToCloudinary(f.buffer, f.mimetype, folder)
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
              imageService.uploadBufferToCloudinary(f.buffer, f.mimetype, folder)
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




