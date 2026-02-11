import cloudinary from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class ImageRepository {
  prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    mimetype: string,
    folder?: string,
    publicId?: string,
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
        },
      );

      // pipe buffer into upload stream
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async abortImageUpload(uploadedFilesByField: any[]) {
    const allUploaded = Object.values(uploadedFilesByField).flat();
    await Promise.allSettled(
      allUploaded.map((u: any) =>
        u && u.public_id
          ? cloudinary.v2.uploader.destroy(u.public_id, {
              // crear repo para cloudinary
              resource_type: "image",
            })
          : Promise.resolve(),
      ),
    );
  }

  async cloudinaryDelete(publicId: string) {
    try {
      await cloudinary.v2.uploader.destroy(publicId);
    } catch (err) {
      throw new Error("cloudinaryDelete caught error" + err);
    }
  }

  async findManyImagesDb(imageIds: any[], tx?: PrismaClient) {
    const model = tx ?? this.prisma;
    return await model.image.findMany({
      where: {
        id: { in: imageIds },
      },
    });
  }

  async deleteImageDb(imageId: number, tx?: PrismaClient) {
    const model = tx ?? this.prisma;
    return await model.image.delete({
      where: {
        id: imageId,
      },
    });
  }

  async withTransaction<R>(
    callback: (tx: PrismaClient) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(callback as any) as Promise<R>;
  }
}
