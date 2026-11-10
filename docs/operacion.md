# Operación

Procedimientos que se ejecutan a mano sobre un entorno, fuera de la aplicación.

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

La API sincroniza sola, cada 6 horas, las estadísticas de los jugadores con cuenta de Riot
verificada, y atiende las sincronizaciones que piden los jugadores. Todo pasa por una cola en
Redis (BullMQ) y por la cuota de Riot, que es de toda la aplicación. El porqué está en
`docs/decisiones.md`, «Cuota de Riot e ingesta».

### Dónde corre

- **En local**: `npm run dev` levanta la API y, dentro de ella, el worker y el planificador.
  No hay que arrancar nada más. Sin `RIOT_API_KEY` la cola queda en pausa y el resto funciona.
- **En el servidor**: igual, dentro del contenedor de la API (`INGESTA_ACTIVA=true`, el valor
  por defecto). Si algún día se separa, se arranca otro servicio con la misma imagen y
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
aplicación**. Vincular gasta 2 peticiones, cada comprobación del icono 1 (la vista comprueba
sola cada 45 s) y cada sincronización hasta 24. En la sesión de arranque del piloto,
**organiza las vinculaciones en tandas de unos 10 jugadores**: que una tanda termine de
vincular (unos minutos, lo que tarda Riot en reflejar el icono) antes de que empiece la
siguiente. Con más a la vez nadie ve un error, pero las comprobaciones dirán «Mucha demanda,
reintentando» y las sincronizaciones esperarán en la cola.

Las sincronizaciones de los recién vinculados pueden esperar: la periódica los recoge en las
siguientes horas, o pueden pedirla desde «Cuentas vinculadas» cuando acabe la sesión.
