import { BaseResponse } from "../utils/responseFormat.ts";

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  if (err.statusCode && err.message) {
    res
      .status(err.statusCode)
      .json(new BaseResponse(err.statusCode, err.message, {}));
  }
};
