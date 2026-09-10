/**
 * Jerarquía de errores de la aplicación.
 *
 * Todo error que llegue al manejador central se traduce a la misma forma de
 * respuesta: { error: { code, message, details? } }.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** true cuando el error es esperado (no un fallo del servidor). */
  readonly esOperacional: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    esOperacional = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.esOperacional = esOperacional;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Petición inválida", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos inválidos", details?: unknown) {
    super(422, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autenticado", details?: unknown) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No autorizado", details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado", details?: unknown) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "El recurso ya existe", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Demasiadas peticiones", details?: unknown) {
    super(429, "TOO_MANY_REQUESTS", message, details);
  }
}

/**
 * Marca el andamiaje pendiente de implementar. Los módulos que todavía no
 * tienen lógica de negocio devuelven este error (501).
 */
export class NotImplementedError extends AppError {
  constructor(message = "Funcionalidad no implementada todavía") {
    super(501, "NOT_IMPLEMENTED", message);
  }
}
