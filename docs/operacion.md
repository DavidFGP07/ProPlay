# Operación

Procedimientos que se ejecutan a mano sobre un entorno, fuera de la aplicación.

> **La aplicación no se ha desplegado todavía** (tarea 2.13 del plan). Los pasos «en el
> servidor» describen cómo se hará con la imagen de `apps/api/Dockerfile`; no se han
> probado en una plataforma real.

---

## Alta del primer administrador

`ADMIN` no es un rol registrable (`ROLES_REGISTRABLES`) y todavía no hay endpoint
para cambiar roles: llega con el módulo `admin` en el S4. Mientras tanto, un
administrador se da de alta con un script que **promueve a `ADMIN` una cuenta ya
registrada**. Es la tarea 1.4 del plan (RF-01).

### Antes de ejecutarlo

1. **La persona se registra en la aplicación como scout**, con su propio correo y su
   contraseña. Así la contraseña la define ella y nunca pasa por la terminal ni por
   su historial.
2. Tiene que ser una cuenta propia para administrar. El script **se niega** con:
   - una cuenta de jugador o de equipo: su perfil público quedaría huérfano y la
     persona desaparecería de las búsquedas;
   - una cuenta desactivada;
   - un correo que no corresponde a ninguna cuenta.

### En local

Desde la raíz del monorepo, con la base de `apps/api/.env` levantada:

```bash
npm run admin:promover -w api -- persona@dominio.com
```

### En el servidor desplegado

La imagen de producción no trae `tsx` ni el código fuente, sólo el compilado. Abre
una consola en el contenedor de la API (la «shell» o el comando de una sola vez de
Railway o Render), que ya tiene `DATABASE_URL` y el resto de variables, y ejecuta
desde `/app`:

```bash
node apps/api/dist/cli/promoverAdministrador.js persona@dominio.com
```

El script carga la misma configuración que la API, así que falla al arrancar si
falta alguna variable obligatoria.

### Qué hace y qué responde

| Situación | Salida | Código |
| --- | --- | --- |
| Cuenta de scout activa | Pasa a `ADMIN` y se registra en `AuditLog` | `0` |
| Ya era administrador | No cambia nada ni duplica la traza | `0` |
| Cuenta de jugador o de equipo, desactivada o inexistente, o correo mal formado | No cambia nada; explica el motivo | `1` |
| Sin correo o con más de un argumento | Muestra el uso | `2` |

- El cambio de rol y su traza se guardan en la **misma transacción**. La traza es
  una fila de `AuditLog` con `accion: "ROL_CAMBIADO"`, `entidad: "Usuario"`, el id
  de la cuenta y `metadata: { rolAnterior, rolNuevo: "ADMIN", origen: "cli" }`.
- El correo se recorta y se pasa a minúsculas, igual que en el registro.
- **No cierra las sesiones abiertas.** El access token ya emitido conserva el rol
  anterior hasta que caduca (15 minutos como máximo); el siguiente refresco lee el
  rol de la base y entrega uno con `ADMIN`. Si la persona tenía la sesión abierta,
  basta con esperar ese refresco o volver a entrar.

### Comprobar el resultado

```sql
SELECT email, rol, activo FROM "Usuario" WHERE email = 'persona@dominio.com';

SELECT "creadoEn", accion, metadata
FROM "AuditLog"
WHERE accion = 'ROL_CAMBIADO'
ORDER BY "creadoEn" DESC
LIMIT 5;
```

### Lo que no hace

- No crea cuentas ni recibe contraseñas.
- No quita el rol de administrador. Mientras no exista el módulo `admin`, revertirlo
  exige un `UPDATE` manual que también debe dejarse en `AuditLog`.
- No sustituye al seed: `npm run db:seed` crea `admin@proplay.gg` con la contraseña
  de demostración y **nunca debe ejecutarse en producción**.

## Ingesta de Riot

La API sincroniza sola, cada `INGESTA_INTERVALO_HORAS` horas (6 por defecto), las
estadísticas de los jugadores con cuenta de Riot verificada, y atiende las sincronizaciones que piden los jugadores. Todo pasa por una cola en
Redis (BullMQ) y por la cuota de Riot, que es de toda la aplicación. El porqué está en
`docs/decisiones.md`, «Cuota de Riot e ingesta».

Las cuentas del seed (`puuid` `seed-…`) quedan fuera: ni el planificador ni el botón
«Sincronizar» las encolan, y no se pide nada a Riot por ellas. Muestran la fecha de
sincronización que les puso el seed (la de su última captura). Una cuenta real vinculada
durante la demostración se sincroniza con normalidad.

### Dónde corre

- **En local**: `npm run dev` levanta la API y, dentro de ella, el worker y el planificador.
  No hay que arrancar nada más. Sin `RIOT_API_KEY` la cola queda en pausa y el resto funciona.
- **En el servidor**: igual, dentro del contenedor de la API (`INGESTA_ACTIVA=true`, el valor
  por defecto). Por eso la API tiene que estar siempre encendida: en un plan que suspenda el
  servicio por inactividad, la sincronización periódica se detiene mientras duerme. Si algún
  día se separa, se arranca otro servicio con la misma imagen y
  `node apps/api/dist/ingesta/main.js`, y se pone `INGESTA_ACTIVA=false` en la API.

### Ver el estado

```bash
npm run ingesta:estado -w api
```

En el servidor: `node apps/api/dist/cli/estadoIngesta.js` desde `/app`. Dice si la clave es
válida, si la cola está en pausa, cuántos trabajos hay en espera, en curso, reprogramados y
fallidos, y el uso de cada ventana de la cuota. `GET /api/v1/health` sólo dice
`riot: "ok"` o `"no disponible"`, sin el motivo, porque es público.

### Renovar la clave de desarrollo (cada día)

La clave de desarrollo de Riot **caduca a las 24 horas**. Cuando caduca, Riot responde 403:
la API la marca como caducada, **pausa la cola** (no gasta reintentos), deja en el registro
`Riot rechazó RIOT_API_KEY…`, y vincular o sincronizar responde «inténtalo más tarde».

1. Entra en <https://developer.riotgames.com> con la cuenta del proyecto y pulsa
   **Regenerate API Key**.
2. Pon la clave nueva en `RIOT_API_KEY`:
   - en local, en `apps/api/.env`;
   - en Railway o Render, en las variables del servicio de la API.
3. **Reinicia la API** (en local, para y vuelve a lanzar `npm run dev`; en la plataforma, el
   cambio de variable ya redespliega).
4. Comprueba con `npm run ingesta:estado -w api` que dice «Clave de Riot: válida» y
   «Cola de ingesta: activa». Al arrancar con una clave distinta de la caducada, la cola se
   reanuda sola y procesa lo que quedó pendiente.

Reiniciar con la **misma** clave caducada no reanuda nada: la API la reconoce por su huella.

### Piloto: vinculaciones en tandas

Con la clave de desarrollo, la cuota es de **100 peticiones cada 2 minutos para toda la
aplicación** (`RIOT_LIMITES`, por defecto `20:1,100:120`, con el `RIOT_RESERVA_ALTA` % de cada
ventana reservado a vincular y comprobar el icono). Vincular gasta 2 peticiones, cada comprobación del icono 1 (la vista comprueba
sola cada 45 s) y cada sincronización hasta 24. En la sesión de arranque del piloto,
**organiza las vinculaciones en tandas de unos 10 jugadores**: que una tanda termine de
vincular (unos minutos, lo que tarda Riot en reflejar el icono) antes de que empiece la
siguiente. Con más a la vez nadie ve un error, pero las comprobaciones dirán «Mucha demanda,
reintentando» y las sincronizaciones esperarán en la cola.

Las sincronizaciones de los recién vinculados pueden esperar: la periódica los recoge en las
siguientes horas, o pueden pedirla desde «Cuentas vinculadas» cuando acabe la sesión.

## Explicador con modelo de lenguaje

El detalle del candidato muestra, sobre la tabla de aportes, el bloque «Por qué encaja
(generado con IA)»: un texto que redacta Claude Haiku 5.5 a partir del desglose (RF-11). Si
el explicador está desactivado o falla, el bloque se sustituye por una nota y queda la
explicación determinista: el ranking y el puesto nunca dependen de él. El porqué, en
`docs/decisiones.md`, «Explicador con modelo de lenguaje».

### Activarlo

1. Crea una clave en la consola de Anthropic (<https://platform.claude.com>, **API Keys**).
2. Ponla en `ANTHROPIC_API_KEY`:
   - en local, en `apps/api/.env`;
   - en Railway o Render, en las variables del servicio de la API.

   **Nunca** en `apps/web/.env` ni en ninguna variable `VITE_*`: se empaquetaría en el
   cliente y sería pública. El registro de la API la oculta.
3. Deja `EXPLICADOR_ACTIVO=true` (el valor por defecto) y reinicia la API.

### Desactivarlo

Pon `EXPLICADOR_ACTIVO=false` (o quita la clave) y reinicia la API. Las peticiones responden
`NO_DISPONIBLE` con el motivo `DESACTIVADO`, sin llamar a nadie, y la vista enseña la nota.

### Ajustes

| Variable | Por defecto | Qué cambia |
| --- | --- | --- |
| `EXPLICADOR_MODELO` | `claude-haiku-5-5` | Modelo que redacta |
| `EXPLICADOR_TIMEOUT_MS` | `4000` | Espera máxima de una generación; pasada, se degrada |
| `EXPLICADOR_LIMITE_USUARIO_HORA` | `30` | Generaciones nuevas por usuario y hora |
| `EXPLICADOR_LIMITE_DIARIO` | `300` | Generaciones nuevas al día en toda la aplicación |

Los textos se guardan en Redis 30 días por contenido: abrir otra vez el mismo candidato, sin
cambios en su desglose, no vuelve a llamar al modelo ni gasta los límites.

### Registros

Con el explicador activo, cada petición deja una línea `Explicación del candidato` (módulo
`explicador`) con el
modelo, la versión del prompt, los milisegundos y, si llamó al modelo, `tokensEntrada`,
`tokensSalida` y `costeUsd` (estimado). Si se degradó, lleva `motivo` y, para la fidelidad,
`causa` y el elemento que falló. **Nunca** lleva la entrada ni el texto generado.

### Prueba manual con la clave real

Es la comprobación que no hace el CI (que nunca llama al proveedor real). Con el seed y la
oferta «ADC para la liga en línea»:

1. Pon la clave en `apps/api/.env` como en «Activarlo».
2. Desde la raíz del monorepo:

   ```bash
   docker compose up -d
   npm run db:deploy
   npm run db:seed
   npm run dev
   ```

3. Entra en <http://localhost:5173> con `equipo@caribeesports.gg` y la contraseña de
   demostración del seed.
4. Ve a **Vacantes** → «ADC para la liga en línea» → **Ver ranking de candidatos**.
5. Abre el **puesto 1**. En unos segundos aparece «Por qué encaja (generado con IA)» sobre
   la tabla de aportes. Copia el texto.
6. Repite con los **puestos 2 y 3** (con «Candidato siguiente», al pie del detalle).
7. En la terminal de `npm run dev`, comprueba que hay tres líneas `Explicación del
   candidato` con `tokensEntrada`, `tokensSalida` y `costeUsd`, y ninguna con `motivo`.
8. Vuelve a abrir el puesto 1 recargando la página: la línea nueva dice `deCache: true` y no
   lleva tokens.

Qué revisar en cada texto: 2 o 3 frases (4 si hay requisitos sin cumplir); primero lo que más
suma y después lo que más resta, sin repetirlo; en el puesto 1, que la técnica sume por la
posición y el rango y reste por el rendimiento (`mismaDimension`), sin contradecirse; una
última frase que empiece por «No cumple» con cada requisito que falte (en el puesto 1, las
horas: 15 frente a 20); ninguna cifra que no esté en la tabla, ni la escala de las métricas, ni
nombres de campo como «winRate»; ningún juicio sobre la persona.

**Si sale la nota en vez del texto**, la línea del registro dice el motivo (o la respuesta de
la API, en la pestaña Red del navegador):

| `motivo` | Qué hacer |
| --- | --- |
| Ninguna línea (`DESACTIVADO`) | La API no leyó la clave o `EXPLICADOR_ACTIVO` es `false`: revisa `apps/api/.env` y reinicia `npm run dev` |
| `ERROR` | Clave inválida o sin saldo (la línea no trae el mensaje de Anthropic: pruébala en la consola), o Redis caído (`docker compose ps`) |
| `TIEMPO_AGOTADO` | Sube `EXPLICADOR_TIMEOUT_MS` (por ejemplo, a `8000`) y reinicia |
| `FIDELIDAD` | El modelo escribió algo que no estaba en la entrada, o calló un requisito que el candidato no cumple (`causa` `REQUISITOS_OMITIDOS`); `causa` y `detalle` dicen qué. No se guarda: recarga la página para pedir otro |
| `LIMITE` | Se agotó un límite; espera a la hora siguiente o súbelo |

Para volver a generar los textos desde cero (por ejemplo, tras cambiar el prompt sin subir
su versión), borra la caché:

```bash
docker exec proplay-redis sh -c "redis-cli --scan --pattern 'explicador:texto:*' | xargs -r redis-cli del"
```

## Vectores del motor de matching

El motor de matching (RF-09) guarda un vector de 64 dimensiones por jugador en `PerfilVector`.
Se recalcula solo: tras cada ingesta con estadísticas nuevas y, antes de cada ranking, el de
todo jugador cuyo vector esté obsoleto. El motor no llama a Riot: con la clave caducada, los
rankings siguen funcionando con los datos guardados.

Hay que recalcularlos todos a mano sólo **al subir `PERFIL_VECTOR_VERSION`** (cambio del
vectorizador), para que la primera consulta de ranking no pague el recálculo de todos:

- **Local**: `npm run matching:revectorizar -w api`
- **Servidor**: `node apps/api/dist/cli/revectorizar.js`

Escribe cuántos vectores recalculó y en cuánto tiempo. Se puede repetir sin riesgo.

## Métricas del piloto (informe de la tesis)

Las métricas de todo el piloto no tienen vista: el panel de administración quedó fuera
del alcance (decisión 0.10). Salen de un script que escribe seis CSV con **las mismas
definiciones que la analítica de la aplicación** (`docs/arquitectura.md`, «Analítica»).
Es RF-13 y las tareas 4.14 y 4.16 del plan.

### En local

```bash
npm run metricas:piloto -w api -- --desde 2026-11-20 --hasta 2026-12-20 --salida ./metricas
```

### En el servidor desplegado

Desde una consola del servicio de la API, que ya tiene `DATABASE_URL`:

```bash
node apps/api/dist/cli/metricasPiloto.js --desde 2026-11-20 --hasta 2026-12-20 --salida /tmp/metricas
```

### Opciones

| Opción | Qué hace |
| --- | --- |
| `--desde AAAA-MM-DD` | Primer día de publicación de las ofertas, incluido, en la fecha de Colombia |
| `--hasta AAAA-MM-DD` | Último día de publicación, incluido |
| `--salida <carpeta>` | Dónde escribir los CSV. Por defecto, `./metricas-piloto` |
| `--excluir-prueba` | **Activa por defecto.** Deja fuera las cuentas del seed: sus correos fijos, los `jugadorN@proplay.gg` y las cuentas de Riot con `puuid` `seed-…` (`apps/api/src/utils/datosDePrueba.ts`). Quita sus ofertas, sus postulaciones, sus filas de los rankings y sus registros |
| `--no-excluir-prueba` | Las incluye (o `--excluir-prueba=false`) |

La ventana de fechas filtra las **ofertas**. El mapa del talento y los registros por rol
son de toda la base, porque no dependen de cuándo se publicó una oferta.

### Qué escribe

| Archivo | Contenido |
| --- | --- |
| `resumen_h1.csv` | Tiempo hasta cubrir y hasta el primer tryout (mediana, media y n) frente a la línea base, que sale como `pendiente` mientras no exista. También: coincidencias exitosas, conversión, cobertura, registros por rol, proporción de verificados y los parámetros con que se generó |
| `tiempo_hasta_cubrir.csv` | Una fila por oferta: equipo, estado, fechas en Colombia, postulaciones y sus tiempos |
| `embudo_por_oferta.csv` | Por etapa: alcanzaron, conversión, siguen, rechazadas y rechazadas al cerrar. Una fila `TOTAL` por etapa y luego las de cada oferta |
| `tiempos_por_etapa.csv` | Días transcurridos en cada etapa (n, mediana y media), en total y por oferta |
| `dimension_decisiva.csv` | Por oferta: candidatos, dimensión decisiva y ventaja de cada dimensión. Pone al día el ranking de las ofertas abiertas; las cubiertas o cerradas conservan su instantánea |
| `talento_verificado.csv` | El mapa del talento con el umbral de privacidad aplicado: una celda oculta dice `oculto` |

Formato: CSV según RFC 4180, con coma como separador, punto decimal, UTF-8 y hasta 4
decimales. Un dato que no existe (una oferta sin tiempo hasta cubrir, por ejemplo) es una
celda vacía, no un 0.

Las cifras son **evidencia descriptiva con su n**, no un contraste estadístico: con el
tamaño del piloto no hay potencia para una prueba de hipótesis (`docs/decisiones.md`,
«Analítica»).

---

## Demostración en local

### Reiniciar la base de la demostración

```bash
npm run demo:reiniciar
```

Deja la base de `DATABASE_URL` exactamente como la crea el seed: borra la base entera, le
aplica todas las migraciones (el índice HNSW incluido) y ejecuta `prisma/seed.ts`. No queda
nada de los ensayos: ni postulaciones, ni ofertas, ni cambios de etapa, ni notificaciones,
ni cuentas creadas a mano. Volver a sembrar con `npm run db:seed` **no** basta para eso: el
seed pone al día sus propias filas, pero no borra las que se crearon después.

Sólo se ejecuta contra una base local de desarrollo. Se niega con `NODE_ENV=production`,
contra un servidor de base de datos que no sea `localhost`, `127.0.0.1` o `::1` y contra la
base de las pruebas (`*_test`), que gestiona `npm test`.

Después, reinicia la API si estaba en marcha: el contador del límite de peticiones vive en
su memoria. Los navegadores que tuvieran una sesión abierta la pierden al recargar, porque
su cuenta se creó de nuevo.

### Antes de la demostración

1. `npm run demo:reiniciar`.
2. En `apps/api/.env`, `LIMITE_GLOBAL_PETICIONES=100000`: en local todas las peticiones
   salen de la misma IP y un recorrido por los tres roles agota las 300 por defecto en
   unos 20 minutos. `/auth/logout` no cuenta nunca para ese límite.
3. Renueva `RIOT_API_KEY` («Renovar la clave de desarrollo») si vas a vincular una cuenta
   real; las cuentas del seed no la necesitan.
4. Comprueba el explicador con la clave real («Prueba manual con la clave real»). Sin
   ella, el detalle del candidato muestra sólo la explicación determinista.
5. Arranca con `npm run dev`.
