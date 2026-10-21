/** Validates req[part] with a zod schema; replaces it with parsed data. */
export function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid request',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    req[part] = result.data;
    return next();
  };
}
