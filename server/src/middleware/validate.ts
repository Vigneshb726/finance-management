import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Validates and replaces `req.body` with the parsed (sanitised) value. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };

/** Parses query-string parameters; ZodErrors are turned into 400s by the error handler. */
export const parseQuery = <T extends ZodTypeAny>(schema: T, query: unknown): z.infer<T> => schema.parse(query);
