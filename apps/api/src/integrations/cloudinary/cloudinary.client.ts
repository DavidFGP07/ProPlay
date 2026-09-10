import { v2 as cloudinary } from "cloudinary";
import { MAX_UPLOAD_BYTES } from "@proplay/shared";
import { env } from "../../config/env";
import { NotImplementedError } from "../../utils/errors";

/**
 * Cliente de Cloudinary para avatares, logos y media del feed.
 * Las credenciales son opcionales en desarrollo: si no están configuradas, el
 * cliente queda sin inicializar y cualquier subida falla de forma explícita.
 */
export const cloudinaryConfigurado = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigurado) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary, MAX_UPLOAD_BYTES };

// TODO: subir el buffer a la carpeta correspondiente y devolver la URL segura.
export async function subirImagen(
  _archivo: Buffer,
  _carpeta: "avatares" | "logos" | "publicaciones",
): Promise<string> {
  throw new NotImplementedError("La subida a Cloudinary no está implementada");
}
