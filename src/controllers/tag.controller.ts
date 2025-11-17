import { TagService } from "../services/tag.service.ts";

const tagService = new TagService();

const getAllTags = async (req: any, res: any, next: any) => {
  const { currentPage = 1, amountPerPage = 10, detalle } = req.query;
  try {
    const response = await tagService.getPaginatedTags(
      req.query,
      Number(currentPage),
      Number(amountPerPage),
      detalle
    );
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const createTag = async (req: any, res: any, next: any) => {
  try {
    const TagData = req.body;
    const response = await tagService.createTag(TagData);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const updateTag = async (req: any, res: any, next: any) => {
  try {
    const TagId: number = req.params.id;
    const response = await tagService.updateTag(TagId, req.body);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const getOneTag = async (req: any, res: any, next: any) => {
  try {
    const TagId = req.params.id;
    const response = await tagService.getOneTag(TagId);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

export {
  getAllTags,
  createTag,
  updateTag,
  getOneTag,
};
