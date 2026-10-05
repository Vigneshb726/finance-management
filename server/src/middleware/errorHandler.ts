import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, normalizeError } from '@finora/core';
import { isProduction } from '../config/env';

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Malformed or oversized JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'Invalid JSON payload' });
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ message: 'Request is too large' });
    return;
  }

  // Validation, AppError and unique-constraint errors share one mapping with the offline apps
  const { status, body, unexpected } = normalizeError(err);
  if (unexpected) {
    console.error(err);
    res.status(status).json({
      ...body,
      ...(isProduction ? {} : { error: err instanceof Error ? err.message : String(err) }),
    });
    return;
  }
  res.status(status).json(body);
};
