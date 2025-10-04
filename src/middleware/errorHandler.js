const { BaseResponse } = require("../utils/responseFormat");

const errorHandler = (err, req, res, next) => {
  if (err.statusCode && err.message) {
    res
      .status(err.statusCode)
      .json(new BaseResponse(err.statusCode, err.message, null));
  }
};

module.exports = errorHandler;
