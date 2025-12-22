// import { PrismaClient } from "@prisma/client/extension";
import cloudinary from "cloudinary";
import Multer from "multer";

import streamifier from "streamifier";
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = Multer.memoryStorage();
export const upload = Multer({ storage }); // usar upload.single('file'), upload.array('files'), upload.fields([...]) según necesidad

async function uploadBufferToCloudinary(
  buffer: Buffer,
  mimetype: string,
  folder?: string,
  publicId?: string
) {
  return new Promise((resolve, reject) => {
    const opts: any = { resource_type: "auto" };
    if (folder) opts.folder = folder;
    if (publicId) opts.public_id = publicId;

    console.log("cloudinary upload opts:", {
      folder,
      publicId,
      mimetype,
      size: buffer?.length,
    });

    const uploadStream = cloudinary.v2.uploader.upload_stream(
      opts,
      (error: any, result: any) => {
        if (error) {
          console.error("cloudinary upload error:", error);
          return reject(error);
        }
        console.log("cloudinary upload result:", {
          public_id: result?.public_id,
          url: result?.secure_url,
        });
        resolve(result);
      }
    );

    // pipe buffer into upload stream
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

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
        const res = await uploadBufferToCloudinary(
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
            uploadBufferToCloudinary(f.buffer, f.mimetype, folder)
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
              uploadBufferToCloudinary(f.buffer, f.mimetype, folder)
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
