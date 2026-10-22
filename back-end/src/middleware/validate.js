/**
 * Joi validation middleware.
 * Validates and sanitizes the given request source (body | query | params):
 * - strips unknown keys (prevents field injection)
 * - escapes HTML-sensitive characters in strings (XSS-safe storage)
 * - rejects timestamps, aborts early never (all errors reported)
 *
 * Body is written back to req.body; query and params are exposed as
 * req.validatedQuery / req.validatedParams (Express 5 makes the originals
 * read-only).
 */
const escapeHtml = (value) =>
  value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitize = (value) => {
  if (typeof value === 'string') return escapeHtml(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitize(v)]),
    );
  }
  return value;
};

export const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      message: 'Validation error',
      errors: error.details.map((d) => d.message),
    });
  }

  const cleaned = sanitize(value);
  if (source === 'body') req.body = cleaned;
  else if (source === 'query') req.validatedQuery = cleaned;
  else req.validatedParams = cleaned;

  return next();
};

export default validate;
