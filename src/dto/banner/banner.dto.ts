export const BANNER_PLACEMENTS = [
  "HOME_HERO",
  "HOME_RECOMMENDATION",
  "CATALOG_STRIP",
  "ANNOUNCEMENT_BAR",
] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export const BANNER_SIZES = ["SQUARE", "WIDE"] as const;
export type BannerSize = (typeof BANNER_SIZES)[number];

type Dimensions = { width: number; height: number };

export interface BannerPlacementSpec {
  key: BannerPlacement;
  label: string;
  description: string;
  desktop: Dimensions | null;
  mobile: Dimensions | null;
  sizes?: Record<BannerSize, Dimensions>;
  imageRequired: boolean;
  textRequired: boolean;
  maxActive: number | null;
}

/** Espacios de banner de la web y las medidas recomendadas de cada imagen. */
export const BANNER_PLACEMENT_SPECS: BannerPlacementSpec[] = [
  {
    key: "HOME_HERO",
    label: "Carrusel principal (home)",
    description:
      "Slides del carrusel de la home. Sin imagen se muestra un fondo de color con el texto.",
    desktop: { width: 1920, height: 600 },
    mobile: { width: 800, height: 800 },
    imageRequired: false,
    textRequired: false,
    maxActive: null,
  },
  {
    key: "HOME_RECOMMENDATION",
    label: "Recomendaciones (home)",
    description: "Grilla de la sección 'Nuestras recomendaciones': tiles cuadrados y anchos.",
    desktop: null,
    mobile: null,
    sizes: { SQUARE: { width: 600, height: 600 }, WIDE: { width: 1200, height: 420 } },
    imageRequired: true,
    textRequired: false,
    maxActive: null,
  },
  {
    key: "CATALOG_STRIP",
    label: "Franja de catálogo y ofertas",
    description: "Banner angosto arriba de /productos y /ofertas.",
    desktop: { width: 1600, height: 300 },
    mobile: { width: 800, height: 300 },
    imageRequired: true,
    textRequired: false,
    maxActive: null,
  },
  {
    key: "ANNOUNCEMENT_BAR",
    label: "Barra de anuncio",
    description: "Banda delgada sobre el header. Se muestra solo el primer anuncio vigente.",
    desktop: null,
    mobile: null,
    imageRequired: false,
    textRequired: true,
    maxActive: 1,
  },
];

export class BannerDto {
  id!: number;
  placement!: BannerPlacement;
  name!: string;
  eyebrow!: string | null;
  headline!: string | null;
  text!: string | null;
  ctaLabel!: string | null;
  linkUrl!: string | null;
  size!: BannerSize | null;
  desktopImageUrl!: string | null;
  mobileImageUrl!: string | null;
  backgroundColor!: string | null;
  textColor!: string | null;
  position!: number;
  startsAt!: Date | null;
  endsAt!: Date | null;
  active!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

/** Llega como multipart/form-data: todos los valores son strings. */
export type BannerInput = Partial<Record<keyof BannerDto, any>> & {
  removeDesktopImage?: string | boolean;
  removeMobileImage?: string | boolean;
};
