import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@proplay/shared";

export interface OpcionesPaginacion {
  page?: number;
  pageSize?: number;
}

export interface RangoPrisma {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

/** Traduce page/pageSize a los skip/take que espera Prisma. */
export function calcularRango(opciones: OpcionesPaginacion = {}): RangoPrisma {
  const page = Math.max(1, Math.trunc(opciones.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(opciones.pageSize ?? DEFAULT_PAGE_SIZE)),
  );

  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

/** Envuelve un listado con los metadatos de paginación del contrato. */
export function paginar<T>(
  data: T[],
  total: number,
  rango: Pick<RangoPrisma, "page" | "pageSize">,
) {
  return {
    data,
    meta: {
      page: rango.page,
      pageSize: rango.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / rango.pageSize)),
    },
  };
}
