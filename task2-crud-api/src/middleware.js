const { z } = require('zod');

const productSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    price: z.number().nonnegative(),
    stock: z.number().int().nonnegative().default(0),
  })
  .strict();

// Validates req.body against a zod schema
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  req.body = result.data;
  next();
};

// Validates :id route param
const validateId = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  req.id = id;
  next();
};

// Requires X-API-Key header on write operations
const requireApiKey = (req, res, next) => {
  const key = process.env.API_KEY || 'dev-key'; // default for local/demo use; set API_KEY in production
  if (req.get('x-api-key') !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

module.exports = { productSchema, validate, validateId, requireApiKey };
