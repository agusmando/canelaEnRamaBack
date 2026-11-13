import { ImageRepository } from "./../repository/image.repository.js";

export class ImageService {
  imageRepository: ImageRepository;
  constructor() {
    this.imageRepository = new ImageRepository();
  }

  async uploadBuffer(buffer: Buffer, mimetype: string, folder?: string, publicId?: string) {
    return this.imageRepository.uploadBuffer(buffer, mimetype, folder, publicId);
  }

  async abortImageUpload(uploadedFilesByField?: any[]) {
    if (!uploadedFilesByField) return;
    return this.imageRepository.abortImageUpload(uploadedFilesByField);
  }

  createImageQuery(images?: any) {
    const files: any[] = Array.isArray(images) ? images : [];
    if (files.length === 0) return {};
    return {
      images: {
        create: files.map((u: any) => ({ public_id: u.public_id, secure_url: u.secure_url })),
      },
    };
  }

  /**
   * Borra las imágenes de la base dentro de la transacción y devuelve los
   * public_id para eliminarlos de Cloudinary DESPUÉS del commit
   * (ver `deleteFromCloudinary`). Así un rollback no deja imágenes huérfanas.
   */
  async removeImagesDb(
    removeImages: { id: number }[] | undefined,
    variantId: number,
    tx?: any,
  ): Promise<string[]> {
    if (!removeImages?.length) return [];
    const ids = removeImages.map((image) => Number(image.id)).filter(Boolean);
    const found = await this.imageRepository.findManyImagesDb(ids, tx);
    const owned = found.filter((img: any) => img.productVariantId === variantId);
    await this.imageRepository.deleteManyImagesDb(
      owned.map((img: any) => img.id),
      variantId,
      tx,
    );
    return owned.map((img: any) => img.public_id);
  }

  async deleteFromCloudinary(publicIds: string[]) {
    await Promise.allSettled(publicIds.map((id) => this.imageRepository.cloudinaryDelete(id)));
  }
}
