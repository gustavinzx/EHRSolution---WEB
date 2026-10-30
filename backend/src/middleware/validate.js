const { validationResult } = require('express-validator');

const sanitizeError = (err) => {
  const isPasswordField = (err.path && err.path.toLowerCase().includes('password')) ||
                          (err.param && err.param.toLowerCase().includes('password'));
  if (isPasswordField && 'value' in err) {
    const { value, ...rest } = err;
    return rest;
  }
  return err;
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const rawList = errors.array();
    const sanitizedErrors = rawList.map(sanitizeError);
    const first = sanitizedErrors[0];
    return res.status(400).json({ error: first.msg, errors: sanitizedErrors });
  }
  next();
};

module.exports = validate;

