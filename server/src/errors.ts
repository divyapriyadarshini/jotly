// An error that carries the HTTP status and a machine-readable code with it.
// Throw one anywhere in a route and the error handler turns it into the right response.
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
