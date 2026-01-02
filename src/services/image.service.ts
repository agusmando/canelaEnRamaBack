import cloudinary from "cloudinary";
import streamifier from "streamifier";

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class ImageService {
  constructor() {}

  async uploadBufferToCloudinary(
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

  async cloudinaryDelete(publicId: string) {
    try {
      await cloudinary.v2.uploader.destroy(publicId);
    } catch (err) {
      throw new Error("cloudinaryDelete caught error" + err);
    }
  }
}
