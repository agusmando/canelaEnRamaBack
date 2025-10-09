import { ProductService } from "../services/product.service.ts";

const productService = new ProductService();

const getAllProducts = async (req: any, res: any, next: any) => {
  try {
    const { value = "", currentPage = 1, amountPerPage = 10 } = req.query;
    console.log(req.query);
    const response = await productService.getAllProducts(
      value,
      Number(currentPage),
      Number(amountPerPage)
    );
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req: any, res: any, next: any) => {
  try {
    const productData = req.body;
    const response = await productService.createProduct(productData);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const getOneProduct = async (req: any, res: any, next: any) => {
  try {
    const productId = req.params.id;
    const response = await productService.getOneProduct(productId);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req: any, res: any, next: any) => {
  try {
    const productId: number = req.params.id;
    const response = await productService.deactivateProduct(productId);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};
const activateProduct = async (req: any, res: any, next: any) => {
  try {
    const productId: number = req.params.id;
    const response = await productService.activateProduct(productId);
    res.status(response.statusCode).json({ ...response });
  } catch (error) {
    next(error);
  }
};

export {
  getAllProducts,
  createProduct,
  getOneProduct,
  deleteProduct,
  activateProduct,
};
