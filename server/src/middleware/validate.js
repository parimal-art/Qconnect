const ApiError = require('../utils/ApiError');

const validate = schema => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
  }
  req.validated = result.data;
  next();
};

module.exports = validate;
