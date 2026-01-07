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

  async deleteImage(publicId: string) {
    return this.imageRepository.cloudinaryDelete(publicId);
  }
  
  async removeImages(removeImages?: { id: number }[]) {
    let imagePromises: any[] = [];
    if (removeImages && removeImages.length > 0) {
      const imageIds = removeImages.map((image: any) => image.id);
      console.log("imageIds", imageIds);
      const foundImages = await this.imageRepository.findManyImagesDb(imageIds);
      console.log("foundImages", foundImages);
      foundImages.forEach((image: any) => {
        imagePromises.push(
          this.deleteImage(image.public_id)
        );
      });
      await Promise.all(imagePromises);
    }
  }
}
