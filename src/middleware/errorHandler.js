const { BaseResponse } = require("../utils/responseFormat");

const errorHandler = (req, res, next, err) => {
  if (err.statusCode && err.message) {
    res
      .status(err.statusCode)
      .json(new BaseResponse(err.message, err.statusCode, null));
  }
};

module.exports = errorHandler;
