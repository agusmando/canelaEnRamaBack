import { AppError } from "../errors/AppError.ts";
import { ErrorsEnum } from "../errors/ErrorsEnum.ts";
import { prismaQueryBuilder } from "../utils/prismaQueryBuilder.ts";
import { GenericRepositoryInterface } from "./generic-repository.interface.ts";

export class GenericRepositoryImpl<T, U, V>
  implements GenericRepositoryInterface<T, U, V>
{
  model: any;
  constructor(
    private prisma: any,
    private prismaName: string,
    private mappingPromise: any
  ) {
    this.model = this.ensureModel();
  }

  private async ensureModel(type: "search" | "create" | "update" = "search") {
    if (this.model) return this.model;
    const mapping = this.mappingPromise
      ? await this.mappingPromise[type]
      : undefined;
    const modelName = mapping?.modelName || this.prismaName;
    const m = (this.prisma as any)[modelName];
    if (!m) throw new AppError(ErrorsEnum.SERVER_ERROR);
    this.model = m;
    return this.model;
  }
  create(data: any): Promise<any> {
    throw new Error("Method not implemented.");
  }
  update(data: any): Promise<any> {
    throw new Error("Method not implemented.");
  }
  async search(
    data: any[],
    paginate: boolean,
    currentPage: number,
    amountPerPage: number,
    detalle: boolean
  ): Promise<{
    entityList?: T[];
    currentPage: number;
    amountPerPage: number;
    totalElements: number;
  }> {
    //Recibe las reglas de mapeo para construir el query
    const mapping = this.mappingPromise
      ? await this.mappingPromise.search
      : undefined;
    const postMapping = this.mappingPromise
      ? await this.mappingPromise.post
      : undefined;
    const where = prismaQueryBuilder(data, mapping);

    let totalElements, entityList;

    // const model = await this.ensureModel("search");
    let query: { where: any; select?: any; take?: number; skip?: number } = {
      where: { ...where },
    };
    let select: Record<string, any> = {};
    let pagination = {};

    //Permite armar el select dinámicamente según si se solicita el detalle
    if (detalle && mapping) {
      let amount = 0;
      Object.keys(mapping).forEach((key: string) => {
        const field = mapping[key]?.field;
        if (field) {
          const expandFields = mapping[key]?.expand;
          if (expandFields) {
            // ensure select[field] is an object before assigning child fields
            if (typeof select[field] !== "object") {
              select[field] = {};
            }
            amount++;
            // support both array and single string for expand
            if (Array.isArray(expandFields)) {
              select[field] = { include: {} };
              expandFields.forEach((childField: string) => {
                if (childField) {
                  (select[field].include as Record<string, boolean>)[
                    childField
                  ] = true;
                }
              });
            } else if (typeof expandFields === "string") {
              select[field] = { include: { [expandFields]: true } };
            } else {
              // fallback: treat as single key
              select[field] = { include: { [String(expandFields)]: true } };
            }
          } else {
            amount++;
            select[field] = true;
          }
        }
      });
      if (amount > 0) {
        query = { ...query, select: { ...select } };
      }
    }

    if (paginate) {
      pagination = {
        take: Number(amountPerPage),
        skip: (Number(currentPage) - 1) * Number(amountPerPage),
      };
      query = { ...query, ...pagination };
    }

    // console.log(query);
    //Busca los elementos con paginación
    [totalElements, entityList] = await Promise.all([
      this.model.count({ where }),
      this.model.findMany(query),
    ]);
    console.log(entityList);
    //Post processing mapping
    if (postMapping && entityList && entityList.length > 0) {
      entityList = entityList.map((entity: any) => {
        const newEntity: any = postMapping(entity);
        return newEntity;
      });
    }

    return { entityList, currentPage, amountPerPage, totalElements };
  }
  post(data: any): Promise<any> {
    throw new Error("Method not implemented.");
  }
}
