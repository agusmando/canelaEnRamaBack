// // import { CategoryService } from "../services/category.service.ts";

// const categoryService = new CategoryService();

// const getAllCategories = async (req: any, res: any, next: any) => {
//   const { currentPage = 1, amountPerPage = 10, detalle } = req.query;
//   try {
//     const response = await categoryService.getPaginatedCategories(
//       req.query,
//       Number(currentPage),
//       Number(amountPerPage),
//       detalle
//     );
//     res.status(response.statusCode).json({ ...response });
//   } catch (error) {
//     next(error);
//   }
// };

// const createCategory = async (req: any, res: any, next: any) => {
//   try {
//     const CategoryData = req.body;
//     const response = await categoryService.createCategory(CategoryData);
//     res.status(response.statusCode).json({ ...response });
//   } catch (error) {
//     next(error);
//   }
// };

// const updateCategory = async (req: any, res: any, next: any) => {
//   try {
//     const CategoryId: number = req.params.id;
//     const response = await categoryService.updateCategory(CategoryId, req.body);
//     res.status(response.statusCode).json({ ...response });
//   } catch (error) {
//     next(error);
//   }
// };

// const getOneCategory = async (req: any, res: any, next: any) => {
//   try {
//     const CategoryId = req.params.id;
//     const response = await categoryService.getOneCategory(CategoryId);
//     res.status(response.statusCode).json({ ...response });
//   } catch (error) {
//     next(error);
//   }
// };

// export {
//   getAllCategories,
//   createCategory,
//   updateCategory,
//   getOneCategory,
// };
