# Protocolo de validación propuesto

**Trabajo futuro.** En el marco de la tesis no hubo piloto con usuarios: el código se cerró
el 2026-11-20 y la sustentación es el 2026-11-27. Este protocolo es el **diseño de la
validación**, listo para ejecutarse sobre la aplicación tal como está. Sustituye al manual
del prototipo (`docs/prototipo/pruebas-piloto.md`), que se conserva como histórico.

Las hipótesis son las del documento (Sección VI-D): **H1**, eficiencia del scouting, y
**H2**, objetividad de la evaluación. Con la muestra prevista (Cuadro VII: más de 50
jugadores y más de 3 equipos), los resultados se presentarían como **evidencia descriptiva,
siempre con su n**, y no como contraste estadístico.

## Requisitos previos

| Requisito | Tarea del plan |
| --- | --- |
| Aplicación desplegada, con HTTPS | 2.13 |
| Clave de Riot: de producción o, si no, la de desarrollo renovada cada día (`docs/operacion.md`) | 0.1 |
| Línea base del scouting manual medida y cargada en `LINEA_BASE_SCOUTING_MANUAL` | 0.2 |
| Sin vistas simuladas: menú depurado y `VITE_DEMO_DATA=false` | 1.7, 4.12 |
| Reclutamiento de equipos, scouts y jugadores | 0.7 |
| Encuestas redactadas | 0.8 |
| Aval del comité de ética, si la facultad lo exige, y consentimiento informado del estudio (aparte del aviso de privacidad que se acepta al registrarse) | 0.9 |

## Fases

1. **Línea base.** Entrevistas con los equipos para medir, con su método actual, lo mismo
   que medirá la plataforma (`docs/arquitectura.md`, «Línea base»): días naturales desde
   que abren la búsqueda hasta que aceptan a un jugador, y hasta el primer tryout, incluidas
   las búsquedas que llegaron a tryout sin cubrirse.
2. **Arranque.**
   - Los jugadores se registran aceptando el aviso y vinculan su cuenta de Riot por icono, en
     **tandas de unos 10** por la cuota de la clave de desarrollo (`docs/operacion.md`).
   - Completan ubicación, horas y disposición a relocalizarse en Mi perfil.
   - Los equipos completan los datos de su organización.
3. **Periodo de uso.** Los equipos publican vacantes reales con sus pesos, revisan el ranking
   y el detalle de cada candidato, y mueven las postulaciones (revisión, tryout, aceptada o
   rechazada) hasta cubrir o cerrar la oferta. Los jugadores se postulan desde Explorar
   oportunidades. La duración se fija al planificar el piloto: tiene que bastar para que se
   cubran varias vacantes.
4. **Sesiones observadas**, una por rol, sobre funciones que existen:
   - **Equipo:** crear una oferta con pesos, leer el ranking y el detalle de un candidato, y
     cambiar el estado de una postulación.
   - **Scout:** buscar por posición, rango mínimo y departamento; abrir el ranking de una
     oferta y leer el desglose; consultar el mapa del talento.
   - **Jugador:** vincular la cuenta, sincronizar, revisar Mis estadísticas y postularse.
5. **Cierre.** Encuestas y exportación de las métricas de la plataforma.

## Métricas e instrumentos

| Hipótesis | Métrica | Instrumento |
| --- | --- | --- |
| H1 | Días hasta cubrir la vacante (publicación → primera aceptación): mediana, media y n, frente a la línea base | Plataforma: `resumen_h1.csv`, `tiempo_hasta_cubrir.csv` |
| H1 | Días hasta el primer tryout, frente a la línea base | Plataforma: los mismos archivos |
| H1 | Coincidencias exitosas, conversión y tasa de cobertura | Plataforma: `resumen_h1.csv`, `embudo_por_oferta.csv` |
| H1 | Tiempo en cada etapa del embudo | Plataforma: `tiempos_por_etapa.csv` |
| H2 | Proporción de perfiles verificados | Plataforma: `talento_verificado.csv`, `resumen_h1.csv` |
| H2 | Dimensión que decide cada ranking | Plataforma: `dimension_decisiva.csv` |
| H2 | Percepción de objetividad y concordancia del ranking con el criterio del equipo | Encuesta (tarea 0.8, **sin redactar**) |
| Contexto | El Caribe frente al resto de Colombia | Plataforma: `talento_verificado.csv` |
| Cuadro VII | Adopción (registros por rol) | Plataforma: `resumen_h1.csv` |
| Cuadro VII | Engagement | **No lo mide la plataforma todavía** |
| Cuadro VII | NPS y satisfacción | Encuesta (tarea 0.8, **sin redactar**) |
| RNF-07 | Interacciones del scout desde el inicio de sesión hasta un ranking | Observación en la sesión del scout |

Las definiciones exactas de cada métrica están en `docs/arquitectura.md`, «Analítica».

## Exportación

Al cerrar el periodo de uso, en el servidor (procedimiento en `docs/operacion.md`,
«Métricas del piloto»):

```bash
node apps/api/dist/cli/metricasPiloto.js --desde AAAA-MM-DD --hasta AAAA-MM-DD --salida /tmp/metricas
```

- **`--excluir-prueba`, activa por defecto**, deja fuera las cuentas del seed.
- **El mapa del talento** sale con el umbral de privacidad aplicado.
- **Mientras la línea base no esté cargada**, sus filas salen como «pendiente».

## Criterios de cierre

1. Se alcanza al menos el mínimo de 3 equipos, 2 scouts y 10 jugadores. Si no se llega a las
   metas del Cuadro VII, se documenta la desviación.
2. Hay vacantes cubiertas suficientes para informar el tiempo hasta cubrir con su n.
3. No quedan incidencias bloqueantes abiertas. Cada incidencia se registra con sesión, rol,
   requisito afectado, descripción, gravedad y evidencia.
4. El informe presenta las métricas de forma descriptiva, frente a la línea base y por
   segmento (el Caribe frente al resto).
