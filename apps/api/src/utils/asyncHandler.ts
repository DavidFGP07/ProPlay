import type { NextFunction, Request, RequestHandler, Response } from "express";

type HandlerAsync<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Envuelve un handler asíncrono para que cualquier promesa rechazada llegue al
 * manejador de errores central en lugar de quedarse sin capturar.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: HandlerAsync<Req>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as Req, res, next)).catch(next);
  };
}
