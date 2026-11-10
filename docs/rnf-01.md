# RNF-01 · Latencia del ranking de candidatos

> **Criterio (Cuadro IV del documento):** percentil 95 de la consulta del ranking por debajo
> de 2 s con 1.000 perfiles indexados.
>
> **Resultado (2026-11-10): se cumple.** p95 con recálculo completo:
> **117.2 ms**; leyendo el ranking guardado: **18.5 ms**.
>
> **Medición en local** (Apple M4, base de datos en la misma máquina), no en la infraestructura
> del despliegue. **Se repetirá en la infraestructura del despliegue antes de la sustentación**
> y el resultado sustituirá a éste.

Generado por `npm run rnf01 -w api` (`apps/api/scripts/rnf01.ts`). No editar a mano: se
reescribe en cada medición.

## Qué se mide

Cada petición recorre la API entera dentro del proceso (Express, autenticación, permisos,
validación, motor y base de datos), con `supertest` y sin red de por medio:

- **Con recálculo** (`POST /matching/ofertas/:id/recalcular`): el peor caso de una consulta.
  Comprueba los vectores obsoletos, recupera 200 vecinos del índice HNSW
  con `SET LOCAL hnsw.ef_search = 200`, les suma los postulantes, lee sus datos,
  puntúa las cinco dimensiones, reemplaza la instantánea en `Matching` y devuelve la primera página.
  **Es la cifra que se compara con el criterio.**
- **Leyendo la instantánea** (`GET /matching/ofertas/:id/ranking` sin cambios en los datos):
  comprueba que el ranking está al día y devuelve la página.

200 peticiones seguidas de cada tipo, tras 5 de calentamiento; página de 20 candidatos.

## Datos

- 1000 jugadores sintéticos, generados con semilla fija (`rnf01-*`) en la base `proplay_rnf01`:
  80 % con cuenta de Riot verificada y una captura (posición, rango, métricas y distribución de
  partidas aleatorias), 30 % sin ubicación, 10 % fuera de Colombia, la mitad de los de Colombia en
  el Caribe y 15 % sin horas declaradas.
- 1000 vectores de la versión 2 en `PerfilVector`, calculados en 511.8 ms
  (el coste de `npm run matching:revectorizar` para esta base).
- Una oferta presencial de MID en Atlántico (rango mínimo Diamante IV, 20 h, pesos del piloto) con
  30 postulantes. Cada ranking puntúa 223 candidatos.

## Resultados

| Escenario | n | Media | p50 | p95 | p99 | Máximo |
| --- | --- | --- | --- | --- | --- | --- |
| Con recálculo (criterio) | 200 | 111.4 ms | 109.9 ms | **117.2 ms** | 140.8 ms | 301.8 ms |
| Leyendo la instantánea | 200 | 17.4 ms | 17.3 ms | **18.5 ms** | 20.4 ms | 21.7 ms |

## Plan del recuperador

Consulta del recuperador con el vector de la oferta (`EXPLAIN ANALYZE`; el vector, abreviado),
tal como la ejecuta el motor:

```
Limit  (cost=286.22..286.72 rows=200 width=27) (actual time=0.580..0.599 rows=200 loops=1)
  ->  Sort  (cost=286.22..288.72 rows=1000 width=27) (actual time=0.580..0.587 rows=200 loops=1)
        Sort Key: ((embedding <=> '[…]'::vector))
        Sort Method: top-N heapsort  Memory: 48kB
        ->  Seq Scan on "PerfilVector" pv  (cost=0.00..243.00 rows=1000 width=27) (actual time=0.005..0.456 rows=1000 loops=1)
              Filter: (version = '2'::bigint)
Planning Time: 0.057 ms
Execution Time: 0.616 ms
```

Con 1000 vectores, **el planificador prefiere recorrer la tabla y ordenar** (resultado exacto) en lugar del índice HNSW: a este tamaño es más barato. El índice entra cuando la tabla crece. Para comparar, el mismo recorrido obligado a usar el índice (`SET LOCAL enable_seqscan = off`, como en `tests/matching.test.ts`):

```
Limit  (cost=275.50..457.90 rows=200 width=27) (actual time=0.385..0.514 rows=200 loops=1)
  ->  Index Scan using "PerfilVector_embedding_hnsw_idx" on "PerfilVector" pv  (cost=275.50..1187.50 rows=1000 width=27) (actual time=0.384..0.502 rows=200 loops=1)
        Order By: (embedding <=> '[…]'::vector)
        Filter: (version = '2'::bigint)
Planning Time: 0.030 ms
Execution Time: 0.528 ms
```

## Entorno

- CPU: Apple M4 (10 núcleos), 16 GB de RAM, Darwin 27.0.0
- Node v22.18.0
- PostgreSQL 17.11 (Homebrew) on aarch64-apple-darwin25.6.0 con pgvector 0.8.6, en la misma máquina

## Límites de la medición

- Las peticiones son secuenciales: mide la latencia de una consulta, no la carga concurrente.
- Es una medición **en local**: la base está en la misma máquina, sin latencia de red, y la
  máquina de desarrollo (Apple M4) no es la del despliegue. Antes de la sustentación se repite en
  la infraestructura del despliegue (API y base del proveedor) con el mismo script.
- Los datos son sintéticos. El tamaño (1.000 perfiles) es el del criterio; la distribución de
  rangos y métricas no pretende ser la del piloto.

## Cómo repetirla

```bash
npm run rnf01 -w api
```

Crea `proplay_rnf01` si no existe y reescribe este archivo. La base de desarrollo no se toca.
