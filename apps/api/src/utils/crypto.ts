import crypto from "node:crypto";
import { env } from "../config/env";

/**
 * Cifrado simétrico AES-256-GCM para los tokens de las cuentas gaming.
 *
 * Nunca guardamos en la base de datos un access/refresh token de Riot, Steam,
 * Twitch o YouTube en claro: se cifran con ENCRYPTION_KEY antes de persistir.
 *
 * Formato del texto cifrado: `v1.<iv>.<authTag>.<ciphertext>` en base64url,
 * con el prefijo de versión para poder rotar el algoritmo más adelante.
 */

const ALGORITMO = "aes-256-gcm";
const LONGITUD_IV = 12; // recomendado para GCM
const VERSION = "v1";

const clave = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function cifrar(textoPlano: string): string {
  const iv = crypto.randomBytes(LONGITUD_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    cifrado.toString("base64url"),
  ].join(".");
}

export function descifrar(textoCifrado: string): string {
  const partes = textoCifrado.split(".");
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error("Texto cifrado con formato desconocido");
  }

  const [, ivB64, authTagB64, datosB64] = partes as [
    string,
    string,
    string,
    string,
  ];

  const decipher = crypto.createDecipheriv(
    ALGORITMO,
    clave,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(datosB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cifra sólo si hay valor (los tokens son opcionales en el modelo). */
export function cifrarOpcional(valor?: string | null): string | null {
  return valor ? cifrar(valor) : null;
}

export function descifrarOpcional(valor?: string | null): string | null {
  return valor ? descifrar(valor) : null;
}

/** Token aleatorio para enlaces de verificación o restablecimiento. */
export function tokenAleatorio(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
