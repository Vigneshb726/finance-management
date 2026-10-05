import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(403, message);
  }
  static notFound(resource = 'Resource') {
    return new AppError(404, `${resource} not found`);
  }
  static conflict(message: string) {
    return new AppError(409, message);
  }
}

export interface FieldError {
  field: string;
  message: string;
}

/** The error shape every transport (HTTP, Electron IPC, in-process) hands to the UI. */
export interface ApiErrorBody {
  message: string;
  errors?: FieldError[];
  details?: unknown;
}

export interface NormalizedError {
  status: number;
  body: ApiErrorBody;
  /** True for errors we did not anticipate (logged, message hidden in production). */
  unexpected: boolean;
}

/** Unique-constraint violations from PostgreSQL (23505) or SQLite. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    return true;
  }
  return typeof e.message === 'string' && e.message.includes('UNIQUE constraint failed');
}

/** Maps any thrown value to a status code and a client-safe body. */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof ZodError) {
    return {
      status: 400,
      unexpected: false,
      body: {
        message: err.issues[0]?.message ?? 'Validation failed',
        errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    };
  }
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      unexpected: false,
      body: { message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    };
  }
  if (isUniqueViolation(err)) {
    return { status: 409, unexpected: false, body: { message: 'A record with these details already exists' } };
  }
  return { status: 500, unexpected: true, body: { message: 'Something went wrong. Please try again.' } };
}
