import { VERSION_AVISO_PRIVACIDAD } from '@proplay/shared'

/**
 * Aviso de privacidad y términos de uso (RNF-05, Ley 1581 de 2012).
 *
 * BORRADOR pendiente de revisión: lo que va entre corchetes son datos que hay
 * que completar antes de publicar. Al cambiar el texto, sube
 * VERSION_AVISO_PRIVACIDAD en @proplay/shared y la fecha de vigencia.
 *
 * Es texto, no interfaz: la vista sólo lo recorre (CLAUDE.md §6).
 */

export interface SeccionLegal {
  titulo: string
  parrafos: string[]
  lista?: string[]
  /** Párrafos que van después de la lista. */
  despues?: string[]
}

export interface DocumentoLegal {
  /** Ancla de la sección en /legal/privacidad. */
  id: 'privacidad' | 'terminos'
  titulo: string
  secciones: SeccionLegal[]
}

/**
 * Texto que Riot Games exige mostrar a las aplicaciones de terceros que usan
 * su API, en inglés y sin cambios salvo el nombre del producto. Fuente:
 * https://developer.riotgames.com/policies/general (actualizada el 29/05/2025).
 */
export const DESCARGO_RIOT =
  "ProPlay isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."

export const legal = {
  titulo: 'Aviso de privacidad y términos de uso',
  version: VERSION_AVISO_PRIVACIDAD,
  vigenteDesde: '[FECHA DE VIGENCIA]',
  documentos: [
    {
      id: 'privacidad',
      titulo: 'Aviso de privacidad',
      secciones: [
        {
          titulo: '1. Responsable del tratamiento',
          parrafos: [
            'El responsable del tratamiento de tus datos personales es [RESPONSABLE], con domicilio en [DIRECCIÓN]. Puedes contactarnos en [CORREO DE CONTACTO] para cualquier asunto relacionado con tus datos.',
            'ProPlay es un prototipo desarrollado como proyecto de grado en la Universidad del Norte. Este aviso cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.',
          ],
        },
        {
          titulo: '2. Qué datos recogemos',
          parrafos: ['Recogemos solo los datos necesarios para prestar el servicio:'],
          lista: [
            'Datos de la cuenta: nombre, correo electrónico, rol (jugador, equipo o scout) y contraseña, que guardamos cifrada con una función de hash y nunca en claro.',
            'Datos de tu perfil que tú mismo registras: biografía, región, disponibilidad, habilidades y experiencia.',
            'Si vinculas tu cuenta de League of Legends, los datos que nos entrega la API oficial de Riot Games: tu identificador de jugador, tu rango, tu historial de partidas y las estadísticas de esas partidas.',
            'Datos técnicos de uso, como registros de acceso y de auditoría, para la seguridad del servicio.',
          ],
        },
        {
          titulo: '3. Para qué los usamos',
          parrafos: ['Usamos tus datos para estas finalidades, y para ninguna otra sin pedirte autorización:'],
          lista: [
            'Construir tu perfil profesional verificable, con estadísticas que provienen de la fuente oficial y no de lo que se declara a mano.',
            'Calcular tu compatibilidad con las ofertas de los equipos y ordenar a los candidatos.',
            'Explicar en lenguaje natural por qué obtuviste un puntaje de compatibilidad.',
            'Realizar las pruebas piloto del proyecto académico y medir sus resultados de forma agregada.',
          ],
        },
        {
          titulo: '4. Quién ve tus datos',
          parrafos: [
            'Tu perfil público de jugador (nombre, región, estadísticas y habilidades) es visible para cualquier persona que tenga el enlace, para que puedas compartirlo como carta de presentación.',
            'Los equipos y scouts registrados pueden ver los perfiles de jugadores, su compatibilidad con sus ofertas y las postulaciones que reciben. Tu correo electrónico y tu contraseña nunca son públicos.',
          ],
        },
        {
          titulo: '5. Encargados y transferencias',
          parrafos: [
            'Para prestar el servicio nos apoyamos en terceros que tratan datos por nuestra cuenta y bajo nuestras instrucciones:',
          ],
          lista: [
            'Alojamiento en la nube: [PROVEEDOR DE ALOJAMIENTO], que guarda la base de datos y ejecuta la aplicación en [PAÍS DE ALOJAMIENTO].',
            'Riot Games, como fuente de las estadísticas de League of Legends cuando vinculas tu cuenta.',
            'Un proveedor de modelos de lenguaje, [PROVEEDOR DE MODELOS DE LENGUAJE], que genera las explicaciones del puntaje de compatibilidad a partir de tus estadísticas.',
          ],
          despues: [
            'Algunos de estos proveedores pueden estar fuera de Colombia, lo que implica una transferencia internacional de datos. Al aceptar este aviso autorizas esa transferencia, que se hace solo para las finalidades descritas.',
          ],
        },
        {
          titulo: '6. Tus derechos',
          parrafos: [
            'Como titular de tus datos puedes, en cualquier momento y sin costo: conocerlos, actualizarlos y rectificarlos; pedir prueba de la autorización que nos diste; saber qué uso les hemos dado; pedir que los suprimamos o revocar tu autorización cuando no haya un deber legal de conservarlos; y presentar quejas ante la Superintendencia de Industria y Comercio.',
            'Para ejercerlos escribe a [CORREO DE CONTACTO] indicando tu nombre, el correo de tu cuenta y tu solicitud.',
          ],
          lista: [
            'Consultas: las respondemos en un máximo de 10 días hábiles. Si no es posible, te avisamos antes del vencimiento y respondemos en los 5 días hábiles siguientes.',
            'Reclamos (corrección, actualización, supresión o incumplimiento): los atendemos en un máximo de 15 días hábiles. Si no es posible, te avisamos antes del vencimiento y respondemos en los 8 días hábiles siguientes.',
          ],
        },
        {
          titulo: '7. Solo para mayores de 18 años',
          parrafos: [
            'ProPlay está dirigido exclusivamente a personas mayores de 18 años. Al registrarte declaras que lo eres. Si detectamos una cuenta de un menor de edad, la eliminaremos junto con sus datos.',
          ],
        },
        {
          titulo: '8. Seguridad',
          parrafos: [
            'Guardamos las contraseñas con una función de hash, nunca en claro. Los tokens de acceso a tus cuentas de juego se guardan cifrados con AES-256-GCM. Las comunicaciones viajan cifradas con HTTPS y las operaciones sensibles quedan registradas en un registro de auditoría.',
          ],
        },
        {
          titulo: '9. Conservación y supresión',
          parrafos: [
            'Conservamos tus datos mientras tengas una cuenta activa y durante el proyecto piloto. Después los conservaremos como máximo [PLAZO DE CONSERVACIÓN], salvo que la ley exija guardarlos más tiempo.',
            'Puedes desvincular tu cuenta de Riot en cualquier momento: dejaremos de consultar sus datos y borraremos los tokens de acceso. También puedes pedir la supresión de tu cuenta y de tus datos escribiendo a [CORREO DE CONTACTO].',
          ],
        },
        {
          titulo: '10. Vigencia y cambios',
          parrafos: [
            'Este aviso rige desde la fecha indicada al inicio de esta página y lleva un número de versión. Si cambia de forma sustancial, publicaremos la nueva versión aquí con su fecha y te avisaremos dentro de la aplicación o por correo antes de que empiece a regir.',
          ],
        },
      ],
    },
    {
      id: 'terminos',
      titulo: 'Términos de uso',
      secciones: [
        {
          titulo: '1. Qué es ProPlay',
          parrafos: [
            'ProPlay es un prototipo académico y en fase piloto: una red profesional para el scouting de talento en eSports, desarrollada como proyecto de grado en la Universidad del Norte. No es un servicio comercial y puede tener errores, cambios o interrupciones.',
          ],
        },
        {
          titulo: '2. Uso aceptable',
          parrafos: ['Al usar ProPlay te comprometes a:'],
          lista: [
            'Ser mayor de 18 años y dar datos veraces sobre ti.',
            'Usar solo tus propias cuentas de juego y no suplantar a otras personas u organizaciones.',
            'No acosar, discriminar ni contactar a otros usuarios con fines ajenos al scouting.',
            'No intentar acceder a datos de otros usuarios, saturar el servicio ni eludir sus medidas de seguridad.',
          ],
        },
        {
          titulo: '3. Cuentas',
          parrafos: [
            'Eres responsable de mantener tu contraseña en secreto. Podemos suspender una cuenta que incumpla estos términos.',
          ],
        },
        {
          titulo: '4. Puntajes y recomendaciones',
          parrafos: [
            'Los puntajes de compatibilidad y sus explicaciones son una ayuda para la decisión, calculada a partir de los datos disponibles. No garantizan resultados ni sustituyen el criterio de los equipos.',
          ],
        },
        {
          titulo: '5. Relación con Riot Games',
          parrafos: [
            'ProPlay no está afiliado, respaldado ni patrocinado por Riot Games. League of Legends y Riot Games son marcas de Riot Games, Inc. El descargo que Riot Games exige a las aplicaciones de terceros figura, en inglés, al pie de esta página.',
          ],
        },
        {
          titulo: '6. Contacto',
          parrafos: ['Para cualquier duda sobre estos términos escribe a [CORREO DE CONTACTO].'],
        },
      ],
    },
  ] satisfies DocumentoLegal[],
} as const
