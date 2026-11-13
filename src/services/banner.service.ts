import { GenericServiceImpl } from "./generic-impl.service.js";
import { ImageService } from "./image.service.js";
import {
  BANNER_PLACEMENT_SPECS,
  BANNER_PLACEMENTS,
  BANNER_SIZES,
  BannerDto,
  type BannerInput,
  type BannerPlacement,
} from "../dto/banner/banner.dto.js";
import { BannerRepository } from "../repository/banner.repository.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";

type UploadedFile = { public_id: string; secure_url: string };
export type BannerFiles = { desktopImage?: UploadedFile[]; mobileImage?: UploadedFile[] } | undefined;

const TEXT_FIELDS: Record<string, number> = {
  name: 120,
  eyebrow: 80,
  headline: 160,
  text: 400,
  ctaLabel: 40,
  linkUrl: 500,
  backgroundColor: 40,
  textColor: 40,
};

// Colores CSS simples (#hex, rgb(), hsl(), nombres): sin ";" ni "url(" para no inyectar estilos
const CSS_COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%/a-z]+\)|[a-z]{3,20})$/i;

const isTrue = (v: unknown) => v === true || ["true", "1", "on"].includes(String(v).toLowerCase());

/** Quita los public_id internos de Cloudinary de la respuesta. */
const present = (banner: any) => {
  if (!banner) return banner;
  const { desktopImagePublicId, mobileImagePublicId, ...rest } = banner;
  return rest;
};

export class BannerService extends GenericServiceImpl<BannerDto, BannerInput, BannerInput> {
  constructor(
    private readonly bannerRepository = new BannerRepository(),
    private readonly imageService = new ImageService(),
  ) {
    super(bannerRepository);
  }

  placements() {
    return BANNER_PLACEMENT_SPECS;
  }

  async listPublic(placement?: unknown) {
    let filter: string | undefined;
    if (placement) {
      filter = String(placement).toUpperCase();
      if (!BANNER_PLACEMENTS.includes(filter as BannerPlacement)) {
        throw new ValidationError(`placement debe ser uno de ${BANNER_PLACEMENTS.join(", ")}`);
      }
    }
    return (await this.bannerRepository.listLive(filter)).map(present);
  }

  async getListedElements(filters: any, paginate = false, currentPage = 1, amountPerPage = 10) {
    const result = await this.bannerRepository.search(filters, paginate, currentPage, amountPerPage);
    return { ...result, entityList: result.entityList.map(present) };
  }

  async findOne(id: number) {
    const banner = await this.bannerRepository.findRaw(id);
    if (!banner) throw new NotFoundError();
    return present(banner);
  }

  async createBanner(body: BannerInput, files: BannerFiles) {
    try {
      const data = this.parse(body, true);
      const desktop = files?.desktopImage?.[0];
      const mobile = files?.mobileImage?.[0];
      if (desktop) Object.assign(data, { desktopImageUrl: desktop.secure_url, desktopImagePublicId: desktop.public_id });
      if (mobile) Object.assign(data, { mobileImageUrl: mobile.secure_url, mobileImagePublicId: mobile.public_id });
      this.validateComplete(data);
      if (data.position === undefined) data.position = await this.bannerRepository.nextPosition(data.placement);
      return present(await this.bannerRepository.createBanner(data));
    } catch (error) {
      await this.imageService.abortImageUpload(files as any);
      throw error;
    }
  }

  async updateBanner(id: number, body: BannerInput, files: BannerFiles) {
    const toDelete: string[] = [];
    let updated: any;
    try {
      const current: any = await this.bannerRepository.findRaw(id);
      if (!current) throw new NotFoundError();
      const data = this.parse(body, false);

      for (const kind of ["desktop", "mobile"] as const) {
        const file = files?.[`${kind}Image`]?.[0];
        const urlKey = `${kind}ImageUrl`;
        const idKey = `${kind}ImagePublicId`;
        const remove = isTrue((body as any)?.[`remove${kind === "desktop" ? "Desktop" : "Mobile"}Image`]);
        if (file || remove) {
          if (current[idKey]) toDelete.push(current[idKey]);
          data[urlKey] = file?.secure_url ?? null;
          data[idKey] = file?.public_id ?? null;
        }
      }

      const merged = { ...current, ...data };
      this.validateComplete(merged);
      if (merged.size !== (data.size ?? current.size)) data.size = merged.size;
      updated = await this.bannerRepository.updateBanner(id, data);
    } catch (error) {
      await this.imageService.abortImageUpload(files as any);
      throw error;
    }
    // Recién después de guardar se borran las imágenes reemplazadas
    await this.imageService.deleteFromCloudinary(toDelete);
    return present(updated);
  }

  async deleteBanner(id: number) {
    const banner: any = await this.bannerRepository.findRaw(id);
    if (!banner) throw new NotFoundError();
    await this.bannerRepository.deleteBanner(id);
    await this.imageService.deleteFromCloudinary(
      [banner.desktopImagePublicId, banner.mobileImagePublicId].filter(Boolean),
    );
  }

  /** Reordena los banners de UN espacio: position = índice en `ids`. */
  async reorder(body: { ids?: unknown }) {
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
    if (ids.length === 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      throw new ValidationError("ids debe ser una lista de ids de banners");
    }
    if (new Set(ids).size !== ids.length) throw new ValidationError("ids repetidos");
    const banners = await this.bannerRepository.findMany(ids);
    if (banners.length !== ids.length) throw new NotFoundError("Algún banner no existe");
    if (new Set(banners.map((b: any) => b.placement)).size > 1) {
      throw new ValidationError("Solo se pueden reordenar banners del mismo espacio");
    }
    const result = await this.bannerRepository.reorder(ids);
    return result.map(present);
  }

  /** Convierte el multipart (strings) en datos validados. '' en un texto lo borra. */
  private parse(body: BannerInput, isCreate: boolean) {
    const src: any = body ?? {};
    const out: Record<string, any> = {};

    if (isCreate || src.placement !== undefined) {
      const placement = String(src.placement ?? "").toUpperCase();
      if (!BANNER_PLACEMENTS.includes(placement as BannerPlacement)) {
        throw new ValidationError(`placement debe ser uno de ${BANNER_PLACEMENTS.join(", ")}`);
      }
      out.placement = placement;
    }

    for (const [key, max] of Object.entries(TEXT_FIELDS)) {
      if (!(key in src)) continue;
      const value = src[key] === null ? "" : String(src[key]).trim();
      if (value.length > max) throw new ValidationError(`${key} no puede superar ${max} caracteres`);
      out[key] = value || null;
    }
    if (isCreate && !out.name) throw new ValidationError("name es obligatorio");
    if ("name" in out && !out.name) throw new ValidationError("name no puede quedar vacío");

    if (out.linkUrl && !/^(\/(?!\/)|https?:\/\/)/i.test(out.linkUrl)) {
      throw new ValidationError("linkUrl debe ser una ruta interna (/productos) o una URL http(s)");
    }
    for (const key of ["backgroundColor", "textColor"]) {
      if (out[key] && !CSS_COLOR.test(out[key])) throw new ValidationError(`${key} no es un color válido`);
    }

    if ("size" in src) {
      const size = src.size ? String(src.size).toUpperCase() : null;
      if (size && !BANNER_SIZES.includes(size as any)) {
        throw new ValidationError(`size debe ser uno de ${BANNER_SIZES.join(", ")}`);
      }
      out.size = size;
    }

    if (src.position !== undefined && src.position !== "") {
      const position = Number(src.position);
      if (!Number.isInteger(position) || position < 0) throw new ValidationError("position inválida");
      out.position = position;
    }
    if (src.active !== undefined && src.active !== "") out.active = isTrue(src.active);

    for (const key of ["startsAt", "endsAt"]) {
      if (!(key in src)) continue;
      if (!src[key]) {
        out[key] = null;
        continue;
      }
      const date = new Date(src[key]);
      if (Number.isNaN(date.getTime())) throw new ValidationError(`${key} inválido`);
      out[key] = date;
    }
    return out;
  }

  /** Reglas sobre el banner completo (resultado final de create/update). */
  private validateComplete(b: Record<string, any>) {
    const spec = BANNER_PLACEMENT_SPECS.find((s) => s.key === b.placement)!;
    if (spec.imageRequired && !b.desktopImageUrl) {
      throw new ValidationError(`"${spec.label}" requiere una imagen`);
    }
    if (spec.textRequired && !b.text) {
      throw new ValidationError(`"${spec.label}" requiere un texto`);
    }
    if (b.placement === "HOME_RECOMMENDATION") {
      if (!b.size) throw new ValidationError("Elegí el tamaño del tile (SQUARE o WIDE)");
    } else if (b.size) {
      b.size = null; // el tamaño solo aplica a recomendaciones
    }
    if (b.startsAt && b.endsAt && new Date(b.endsAt) < new Date(b.startsAt)) {
      throw new ValidationError("La fecha de fin no puede ser anterior a la de inicio");
    }
  }
}
