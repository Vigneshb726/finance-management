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
