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
