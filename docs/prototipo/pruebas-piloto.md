# Manual de pruebas piloto

Guía operativa para las pruebas piloto con equipos de eSports y jugadores
semiprofesionales de la región Caribe (OE4), y para la medición de los
indicadores de éxito del proyecto.

---

## 1. Objetivos de la validación

La validación contrasta las dos hipótesis de trabajo:

- **H1.** La plataforma ProPlay mejora la **eficiencia** del proceso de
  scouting: identificar candidatos adecuados con menor tiempo y esfuerzo.
- **H2.** La plataforma ProPlay mejora la **objetividad** de la evaluación:
  sustentarla en métricas estandarizadas y verificables, y no en contactos
  personales ni revisiones no estructuradas.

## 2. Composición de las sesiones

| Perfil | Cantidad mínima | Qué se valida |
| --- | --- | --- |
| Equipos de eSports amateur y semiprofesional | 3 | Publicación de vacantes, uso del ranking, utilidad de la explicación |
| Scouts | 2 | Búsqueda, filtrado, interpretación del desglose por dimensión |
| Jugadores semiprofesionales | 10 | Perfil verificable, postulación, interacción con la plataforma |

Las pruebas se realizan sobre el entorno desplegado, nunca sobre el modo
prototipo en memoria, para que la evidencia refleje tiempos de respuesta
reales.

## 3. Protocolo por sesión

### 3.1 Con el equipo (45 min)

1. **Publicación de una vacante** (5 min). La organización describe el rol,
   el rango mínimo, la región y las horas semanales, y opcionalmente los
   requisitos y la contraprestación.
   - *Observación:* tiempo hasta la publicación, dudas sobre los campos.
2. **Lectura del ranking** (15 min). La organización abre la vacante y revisa
   los candidatos ordenados por compatibilidad.
   - *Observación:* tiempo hasta identificar un candidato que la organización
     consideraría interesante; si el ranking es compatible con su criterio propio.
3. **Lectura de la explicación** (10 min). Se abre el desglose por dimensión y
   la explicación en lenguaje natural con sus fuentes.
   - *Observación:* si la explicación es comprensible sin asistencia; si la
     información resulta accionable; si identifican datos que no les aporta valor.
4. **Avance de un proceso** (10 min). Se revisa una postulación y se cambia su
   estado.
   - *Observación:* fricción percibida; si el estado refleja el proceso real.
5. **Cierre** (5 min). Preguntas abiertas yumerate de la sesión.

### 3.2 Con el scout (45 min)

1. **Búsqueda y filtrado** (15 min). Aplicar filtros de juego, rol, rango,
   región y disponibilidad.
   - *Observación:* número de filtros necesarios, tiempo hasta acotar el
     conjunto, si falta algún criterio útil.
2. **Comparación de candidatos** (15 min). Ordenar el ranking por puntaje,
   por similitud vectorial y por dimensión técnica.
   - *Observación:* si el orden por dimensión técnica reproduce el criterio
     experto del scout.
3. **Lectura del desglose** (10 min). Interpretar las cinco dimensiones de dos
   candidatos.
   - *Observación:* si la escala 0–100 % se interpreta sin ambigüedad.
4. **Cierre** (5 min).

### 3.3 Con el jugador (30 min)

1. **Vinculación de cuenta de juego** (10 min).
2. **Edición del perfil y registro de habilidades** (10 min).
3. **Postulación a una vacante y seguimiento del estado** (10 min).

## 4. Instrumentos de medición

### 4.1 Eficiencia (H1)

| Indicador | Cómo se mide | Meta |
| --- | --- | --- |
| Tiempo para encontrar candidatos | Cronómetro desde la apertura del ranking hasta la selección de un candidato | Reduction vs. el proceso manual equivalente |
| Coincidencias exitosas | Postulaciones que avanzan a `aceptada` | > 20 |
| Tasa de conversión | Coincidencias ÷ postulaciones recibidas | Reportable |
| Esfuerzo percibido | Escala Likert de 1 a 5 en la encuesta de salida | ≥ 4 |

**Contraste con el proceso manual.** En la misma sesión se pide al
participante que estime cuánto habría tardado en encontrar ese mismo
candidato por su método habitual (revisión de clasificaciones, observación de
transmisiones, contactos). La diferencia entre ambos tiempos es la evidencia
directa de H1.

### 4.2 Objetividad (H2)

| Indicador | Cómo se mide | Meta |
| --- | --- | --- |
| Precisión del matching | ¿El orden del ranking coincide con el criterio propio del equipo? | Concordancia alta |
| Perfiles con estadísticas verificadas | Proporción de perfiles del piloto con datos de API oficial | Alta |
| Percepción de objetividad | Ítem de la encuesta: *"El ranking se apoya en datos verificables, no en impresiones personales"* | ≥ 4 |
| Concordancia entre evaluadores | Dos evaluadores independientes ordenan el mismo conjunto | Kappa ≥ 0,6 |

### 4.3 Satisfacción y calidad de la interacción

| Indicador | Meta |
| --- | --- |
| NPS | > 50 |
| Usabilidad (RNF-07) | El scout alcanza un ranking en ≤ 3 interacciones |
| Latencia percibida del ranking | < 2 s en el percentil 95 |

## 5. Encuesta de salida

Escala Likert de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo):

1. *El tiempo que tardé en encontrar un candidato adecuado fue aceptable.*
2. *Los datos mostrados provienen de fuentes verificables.*
3. *La explicación del puntaje me ayudó a decidir.*
4. *El desglose por dimensión reflejó mi criterio propio.*
5. *Recomendaría esta herramienta a otras organizaciones.*
6. *Preferiría este proceso al scouting manual que uso habitualmente.*

Se añade una pregunta abierta: *¿Qué debería cambiar de ProPlay para que lo
usaras en tu próxima búsqueda de talento?*

El NPS se calcula como % promotores (5) − % detractores (1).

## 6. Registro de incidencias

Toda incidencia se registra con:

| Campo | Contenido |
| --- | --- |
| Sesión y participante | Código, rol, fecha |
| Módulo afectado | Requisito funcional o no funcional |
| Descripción | Qué esperaba y qué ocurrió |
| Gravedad | Bloqueante / grave / menor |
| Evidencia | Captura, traza de la consulta o registro de auditoría |

Las incidencias bloqueantes se corrigen antes de la siguiente sesión; las
graves, antes del cierre de la ronda; las menores, se priorizan para el sprint
siguiente.

## 7. Criterios de cierre de la validación

La validación se da por concluida cuando:

1. Se han realizado las sesiones con al menos 3 equipos, 2 scouts y 10
   jugadores.
2. Los indicadores de la tabla de indicadores del proyecto alcanzan su valor
   objetivo o se documenta la desviación y su causa.
3. No quedan incidencias bloqueantes abiertas.
4. El informe final incluye el contraste entre las hipótesis, el análisis por
   segmento regional (el Caribe frente al resto del país) y las conclusiones.
