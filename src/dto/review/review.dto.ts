export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export class ReviewDto {
  id!: number;
  productId!: number;
  productVariantId!: number;
  rating!: number;
  title!: string | null;
  comment!: string | null;
  status!: ReviewStatus;
  verifiedPurchase!: boolean;
  reply!: string | null;
  repliedAt!: Date | null;
  moderatedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  authorName!: string;
  rejectionReason?: string | null;
  user?: { name: string | null; email: string | null };
}

export class CreateReviewDto {
  productVariantId!: number;
  rating!: number;
  title?: string | null;
  comment?: string | null;
}

export class UpdateReviewDto {
  rating?: number;
  title?: string | null;
  comment?: string | null;
}

export class ModerateReviewDto {
  status!: "APPROVED" | "REJECTED";
  reply?: string | null;
  rejectionReason?: string | null;
}
