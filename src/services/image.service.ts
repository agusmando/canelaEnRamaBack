import { ImageRepository } from "./../repository/image.repository.ts";

export class ImageService {
  imageRepository: ImageRepository;
  constructor() {
    this.imageRepository = new ImageRepository();
  }

  async uploadBuffer(
    buffer: Buffer,
    mimetype: string,
    folder?: string,
    publicId?: string
  ) {
    return this.imageRepository.uploadBuffer(
      buffer,
      mimetype,
      folder,
      publicId
    );
  }

  async abortImageUpload(uploadedFilesByField?: Record<string, any[]>) {
    if (!uploadedFilesByField) return;
    return this.imageRepository.abortImageUpload(uploadedFilesByField);
  }

  createImageQuery(images?: any) {
    let result: any;
    const filesForEntity: any[] = Array.isArray(images) ? images : [];
    // Si tiene imágenes disponibles, las gestiona
    if (filesForEntity.length > 0) {
      const imagesToCreate =
        filesForEntity.length > 0
          ? filesForEntity.map((u: any) => ({
              public_id: u.public_id,
              secure_url: u.secure_url,
            }))
          : undefined;

      result = imagesToCreate ? { images: { create: imagesToCreate } } : {};
    }
    return result;
  }

  async cloudinaryDelete(publicId: string) {
    return this.imageRepository.cloudinaryDelete(publicId);
  }
}
