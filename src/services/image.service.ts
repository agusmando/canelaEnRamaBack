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
}
