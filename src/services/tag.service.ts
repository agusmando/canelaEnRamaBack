import { TagDto } from '../dto/tags/tag.dto.ts'; 
import { UpdateTagDto } from '../dto/tags/update-tag.dto.ts'; 
import { BaseResponse } from "../utils/responseFormat.ts";
import { PrismaClient } from "@prisma/client";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { AppError } from "../errors/AppError.ts";
import { prismaQueryBuilder } from '../utils/prismaQueryBuilder.ts';
import { tagQueryMapping } from '../mappings/tag.mapping.ts';
import { CreateTagDto } from '../dto/tags/create-tag.dto.ts';
export class TagService {
  private prisma: PrismaClient;
  //private searchCriteriaHandler: SearchCriteriaHandler;
  constructor(
  ) {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  
  getPaginatedTags: (
    receivedDto: TagDto[],
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ) => Promise<BaseResponse<TagDto[]>> = async (  
    receivedDto: TagDto[]
  ) => {
    const where = prismaQueryBuilder(receivedDto, tagQueryMapping);

    console.log("Where clause:", where)
    let totalElements, tags;
    try {
      [totalElements, tags] = await Promise.all([
        this.prisma.tag.count({
          where,
        }),
        this.prisma.tag.findMany({
          where,
        }),
      ]);
      console.log("Total elements:", totalElements, tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (totalElements === 0 || tags.length === 0) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new BaseResponse(
      200,
      "Tags obtenidos con éxito",
      tags as TagDto[]
    );
  };

  createTag: (tagData: CreateTagDto) => Promise<BaseResponse<CreateTagDto>> = async (
    tagData: CreateTagDto
  ) => {
    try {
      const newTag = await this.prisma.tag.create({
        data: {
          ...tagData,
        }
      });
      return new BaseResponse(201, "Etiqueta creado con éxito", newTag);
    } catch (error) {
      console.error("Error creating tag:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
  };

  getOneTag: (tagId: number) => Promise<BaseResponse<TagDto>> = async (
    tagId: number
  ) => {
    let tag;
    try {
      tag = await this.prisma.tag.findFirst({
        where: { id: Number(tagId) },
      });
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw new AppError(ErrorsEnum.SERVER_ERROR);
    }
    if (!tag) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
    return new BaseResponse(200, "Etiqueta obtenido con éxito", tag);
  };

  updateTag: (tagId: number, tagData: UpdateTagDto) => Promise<BaseResponse<TagDto>> = async (
    tagId: number, 
    tagData: UpdateTagDto
  ) => {
    try {
      const updatedProduct = await this.prisma.tag.update({
        where: { id: Number(tagId) },
        data: ({ 
          ...tagData,
        }),
      });
      return new BaseResponse(200, "Etiqueta editado correctamente", updatedProduct);
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };

  deactivateTag: (tagId: number) => Promise<BaseResponse<{}>> = async (
    tagId: number
  ) => {
    try {
      await this.prisma.tag.update({
        where: { id: Number(tagId) },
        data: ({ active: false } as any),
      });
      return new BaseResponse(200, "Etiqueta dado de baja correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
  
  activateTag: (tagId: number) => Promise<BaseResponse<{}>> = async (
    tagId: number
  ) => {
    try {
      await this.prisma.tag.update({
        where: { id: Number(tagId) },
        data: ({ active: true } as any),
      });
      return new BaseResponse(200, "Etiqueta activado correctamente", {});
    } catch (error) {
      throw new AppError(ErrorsEnum.NOT_FOUND);
    }
  };
}
