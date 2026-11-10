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
 * Un servicio externo (la API de Riot) respondió mal o no respondió: el fallo
 * no es del cliente ni de nuestra lógica.
 */
export class ServicioExternoError extends AppError {
  constructor(message = "El servicio externo no está disponible", details?: unknown) {
    super(502, "SERVICIO_EXTERNO", message, details);
  }
}

/** Falta configuración para atender la petición (p. ej. RIOT_API_KEY vacía). */
export class ServicioNoConfiguradoError extends AppError {
  constructor(message = "El servicio no está configurado", details?: unknown) {
    super(503, "SERVICIO_NO_CONFIGURADO", message, details);
  }
}

/**
 * No hay cupo en la cuota de Riot (de toda la aplicación) ni se liberará
 * pronto. No es un fallo: quien llama decide si reintenta, reprograma o
 * responde «mucha demanda». Si llega al usuario, es un 503 con la espera.
 */
export class CuotaRiotAgotadaError extends AppError {
  readonly esperaMs: number;

  constructor(esperaMs: number) {
    super(
      503,
      "MUCHA_DEMANDA",
      "Hay mucha demanda en este momento; inténtalo en un momento",
      { reintentarEnSegundos: Math.max(1, Math.ceil(esperaMs / 1000)) },
    );
    this.esperaMs = esperaMs;
  }
}

/**
 * La clave de Riot falta, caducó o Riot la rechazó. El detalle va a los
 * registros; al usuario sólo se le pide volver más tarde.
 */
export class IntegracionRiotNoDisponibleError extends AppError {
  constructor() {
    super(
      503,
      "RIOT_NO_DISPONIBLE",
      "La conexión con Riot no está disponible en este momento; inténtalo más tarde",
    );
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
