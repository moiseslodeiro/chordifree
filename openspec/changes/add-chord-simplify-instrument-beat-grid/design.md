# Design

## Context

Ver `proposal.md` para la motivación. El cambio en curso ya dejó implementados los pulsos en el analizador y el servidor, la simplificación de calidad, las preferencias de presentación, los diagramas de instrumento, el reloj con dos índices y una primera parrilla de cuatro tiempos. Los tests unitarios de esas piezas pasan.

Estado actual relevante:

- `apps/web/src/grid/beats.ts` agrupa los pulsos en filas de dos compases de cuatro celdas y `BeatGrid` renderiza cada fila con canal lateral de tiempo y compás.
- `apps/web/src/components/SongView.tsx` apila cabecera, controles de notación, controles de presentación, reproductor, acorde activo y rejilla en una sola columna.
- `DisplayControls` solo ofrece simplificación de calidad e instrumento; no existe reducción de densidad.
- `packages/chords/src/simplify.ts` reduce la calidad, pero no agrupa segmentos ni descarta acordes de paso.
- Las preferencias viven en `chordifree:v1:preferences` con un validador tolerante que ya acepta campos ausentes.
- El fixture E2E no incluye `beats`, así que hoy la parrilla cae a la vista de lista en las pruebas de extremo a extremo.

## Goals / Non-Goals

**Goals:**

- Presentar la parrilla en filas de ocho pulsos (dos compases de 4/4) sin perder la referencia de compás.
- Reducir la densidad de acordes con una transformación pura, explicable y reversible, separada de la simplificación de calidad.
- Dar prioridad visual a la rejilla con un layout de dos columnas y un video que ocupe el ancho de su columna.
- Ofrecer tema claro (por defecto) y oscuro, y unificar la marca como Chordifree.
- Mantener la compatibilidad con canciones antiguas sin pulsos, preferencias ya guardadas y datos locales de la marca anterior.

**Non-Goals:**

- Inferir armonía, tonalidad o acordes "importantes" a partir del audio; la reducción usa duración y repetición de los segmentos detectados.
- Detección de downbeat, compases distintos de 4/4 o cambios de compás.
- Edición manual del tempo, de la cuadrícula de pulsos o de la línea de tiempo reducida.
- Reproducción o síntesis del voicing mostrado.
- Cobertura exhaustiva de digitaciones para todas las inversiones y tensiones.

## Decisions

### 1. Contrato de pulsos en el analizador

La respuesta de `POST /analyze` mantiene:

```json
{
  "segments": [ { "start": 0, "end": 4.2, "label": "C", "confidence": 0.8 } ],
  "duration": 213.4,
  "beats": [0.42, 0.91, 1.38, 1.87],
  "beatsPerBar": 4,
  "analyzerVersion": "essentia-1.2"
}
```

- `beats` son segundos, finitos, estrictamente crecientes y recortados a `[0, duration]`; puede ser `[]`.
- `beatsPerBar` es `4` en esta versión.
- Los pulsos se extraen una sola vez en `analyze_file` y se pasan a la detección; si falla el extractor, `beats` queda vacío y el análisis sigue siendo válido.
- `ANALYZER_VERSION` sube a `essentia-1.2` para invalidar cachés sin pulsos.

*Alternativa descartada*: calcular los pulsos en el cliente con Web Audio. No hay acceso fiable a las muestras del video de YouTube y duplicaría el trabajo del analizador.

*Alternativa descartada*: detectar downbeats con Essentia. Añade dependencia y fragilidad; para una parrilla 4/4 basta con agrupar desde el primer pulso.

### 2. Validación y propagación en el servidor

- `RawAnalysis` y `AnalysisResult` incluyen `beats?: number[]` y `beatsPerBar?: number`.
- El servidor descarta pulsos no finitos, duplicados, desordenados o fuera de `[0, duration]`; si el resultado no es utilizable, expone `beats: []`.
- `beatsPerBar` solo acepta `4`; cualquier otro valor cae a `4`.
- La caché se indexa por `analyzerVersion`, así que el cambio de versión invalida los resultados antiguos sin tocar las claves ni la LRU.
- Los resultados guardados antes del cambio se tratan como lista vacía de pulsos.

*Alternativa descartada*: rechazar el análisis entero si los pulsos son inválidos. La detección de acordes sigue siendo útil aunque el ritmo no sea fiable.

### 3. Simplificación como función pura en `packages/chords`

`simplifyChord(chord)` reduce las tensiones, extensiones y suspensiones y elimina el bajo invertido:

```
mayor:    major, maj7, maj9, 6, 6/9, add9, 9, 11, 13, 7sus4, sus2, sus4 → major
dominante: 7                                                             → 7
menor:    minor, m7, m9, m11, m13, m6                                  → minor
dism.:    dim, dim7, m7b5                                              → dim
aument.:  aug                                                          → aug
power:    power                                                        → power
```

- Conserva `root` y, si existe, `raw`.
- La séptima de dominante se mantiene porque define la función armónica; el resto de
  extensiones se reducen a la tríada.
- No toca los segmentos: la transformación se aplica en la capa de render.

*Alternativa descartada*: guardar una segunda línea de tiempo simplificada. Duplica datos y contradice la reversibilidad.

### 4. Reducción de acordes a los importantes

Se añade `reduceChordSegments(segments, beats, beatsPerBar): ChordSegment[]` como función pura en `packages/chords`:

1. **Simplificar**: aplica `simplifyChord` a cada acorde no nulo. La reducción siempre implica simplificación de calidad.
2. **Agrupar**: fusiona segmentos consecutivos cuyo acorde sea equivalente (`chordEquals`, incluido `null`), extendiendo el `end` del primero hasta el `start` del siguiente distinto.
3. **Calcular umbral**: un pulso equivale a la mediana de los intervalos entre pulsos; si no hay pulsos utilizables, se usa `1.5 s`. Un acorde es de paso si dura una pulsación o menos y está rodeado por acordes que duran más de una pulsación (o por el mismo acorde a ambos lados). Los acordes de más de una pulsación nunca se absorben y las progresiones con cambios en cada pulsación se conservan.
4. **Absorber**: un acorde de paso se integra en el vecino no nulo más largo que supere una pulsación; en empate se elige el anterior. Si ningún vecino es más largo, se conserva. Los segmentos por debajo de medio pulso (ventana fija) mantienen la regla anterior y se absorben con un solo vecino estable.
5. **Proteger el resultado**: si la absorción dejaría la lista sin acordes, se conserva el acorde de mayor duración. Los silencios se conservan como segmentos explícitos y no absorben acordes.
6. **Reagrupar**: tras absorber, se vuelven a fusionar vecinos equivalentes y se recalculan los límites.

Propiedades:

- Es idempotente: aplicar la reducción dos veces produce el mismo resultado.
- No muta la entrada y devuelve segmentos nuevos.
- Solo se usa para pintar; el editor y `song.segments` siguen viendo la línea de tiempo completa.
- El resultado se calcula una vez por canción y preferencias con `useMemo`, no en cada tick de reproducción.

*Alternativa descartada*: limitar la rejilla a los N acordes más frecuentes. Rompe la secuencia temporal y hace que la parrilla no coincida con la canción.

*Alternativa descartada*: hacer la reducción en el servidor. Es una preferencia de presentación reversible y no debe alterar el análisis cacheado ni los datos guardados.

### 5. Modelo de preferencias

`Preferences` gana `reduceChords: boolean` con valor por defecto `false`. `simplifyChords` se mantiene como control independiente:

- `simplifyChords` solo reduce la calidad.
- `reduceChords` aplica simplificación y reducción de densidad; su efecto visual incluye al de `simplifyChords`.
- El validador mezcla los valores ausentes con los defaults, de modo que las preferencias antiguas siguen siendo válidas. No se sube `schemaVersion` porque el cambio es aditivo.
- Desactivar `reduceChords` recupera todos los segmentos; desactivar `simplifyChords` recupera las calidades originales.

*Alternativa descartada*: reutilizar `simplifyChords` para la reducción. Cambiaría el significado de una preferencia ya guardada y haría imposible distinguir ambos modos.

### 6. Diagramas de instrumento

- `apps/web/src/chords/shapes.ts` define formas móviles para guitarra y ukelele por calidad simplificada (`major`, `minor`, `dim`, `aug`, `power` y `7`) y calcula el traste según la fundamental.
- El piano genera el voicing a partir de los intervalos del acorde simplificado y lo pinta en un teclado SVG.
- `ChordDiagram` y `PianoVoicing` son SVG con `role="img"` y `aria-label` que describe acorde, instrumento y posiciones/notas.
- Si no hay forma disponible, se muestra el nombre y el aviso de "sin digitación"; la vista no se rompe.
- No se añade ninguna librería de diagramas.

### 7. Pipeline de presentación

En `SongView`:

```
song.segments
  → transposeChord(segment.chord, song.transpose)
  → [si simplifyChords || reduceChords] simplifyChord(chord)
  → [si reduceChords] reduceChordSegments(segmentos, beats, beatsPerBar)
  → ChordGrid / BeatGrid / ActiveChordDiagram
```

- La tonalidad estimada se calcula sobre los segmentos transpuestos sin simplificar.
- El editor sigue leyendo `song.segments` originales; nunca ve la reducción.
- `ActiveChordDiagram` usa los mismos segmentos de presentación que la rejilla para que el diagrama y la celda activa coincidan.
- La reducción conserva los `start`/`end` dentro de `[0, duration]` y no genera huecos: cada acorde absorbido extiende un vecino.

### 8. Parrilla de ocho pulsos

`apps/web/src/grid/beats.ts` mantiene `BeatBar` (cuatro celdas) y añade el agrupador de filas:

```ts
interface BeatRow {
  index: number;
  start: number;
  bars: BeatBar[];        // hasta dos compases
  cells: (BeatCell | null)[]; // siempre ocho posiciones con 4/4
  barStarts: number[];    // inicio de cada compás visible
}
buildBeatRows(segments, beats, beatsPerBar, barsPerRow = 2, duration?): BeatRow[]
```

- Cada fila agrupa dos compases de `beatsPerBar` (ocho celdas con 4/4).
- La fila imita la lectura de Chordify: un canal lateral estrecho muestra el tiempo de inicio y el número del primer compás (`C<n>`), el cuerpo mantiene ocho celdas con separadores verticales marcados cada cuatro y la etiqueta del acorde aparece solo en la celda donde cambia.
- La última fila rellena con `null` hasta ocho posiciones; las celdas vacías no son focusables.
- Si los pulsos guardados terminan antes de la duración, `buildBeatGrid` los prolonga con la mediana de los intervalos para que la línea de tiempo no se corte.
- Los compases siguen siendo la unidad de `activeBeatDescription` y de la navegación vertical; la fila es la unidad de scroll.
- El resaltado del pulso activo y el autoscroll reutilizan `PlaybackClock`; la fila activa se calcula a partir del índice global del pulso.
- En pantallas de escritorio las ocho columnas se reparten todo el ancho disponible y la parrilla no tiene scroll horizontal; el video se limita a una columna compacta para ceder el espacio a la rejilla.
- En pantallas estrechas (por debajo de `sm`) la fila conserva ocho columnas con un ancho mínimo y scroll horizontal; las etiquetas se recortan antes que deformar las celdas.
- `ChordGrid` recibe la vista y muestra el contador de compases; la parrilla conserva el aviso y el fallback a lista cuando no hay pulsos.

*Alternativa descartada*: doce compases por fila. Cada celda dejaría de representar un pulso y se perdería la alineación con la reproducción.

### 9. Layout de dos columnas

`SongView` pasa a:

- Cabecera y controles de notación a ancho completo.
- Cuerpo en `lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4`.
- Columna izquierda: `ChordGrid` o `EditorPanel` durante la edición, ocupando todo el ancho libre.
- Columna derecha: `PlayerHost` en variante compacta, `Transport`, `DisplayControls` (simplificación, reducción e instrumento) y `ActiveChordDiagram`. La columna mide 18rem para que el video sea más pequeño que la rejilla y la parrilla gane espacio.
- La columna derecha es `lg:sticky lg:top-4` para que el video y el transporte sigan visibles mientras se recorre la rejilla.
- En pantallas estrechas se apila en una columna; el bloque de video y herramientas se coloca visualmente antes de la rejilla (orden CSS) para que el transporte quede accesible sin recorrer una parrilla larga. Las secciones mantienen encabezados y etiquetas para conservar la orientación.
- `PlayerHost` gana una variante compacta que ocupa todo el ancho de la columna derecha (`w-full`) sin cambiar la relación de aspecto del video: se prioriza el ancho y la altura se deriva, en lugar de limitar por altura.
- El modo de edición solo sustituye la columna izquierda; la derecha sigue disponible.

*Alternativa descartada*: mantener todo apilado y hacer la rejilla más pequeña. El video seguiría ocupando el ancho completo y la rejilla perdería casillas visibles.

### 10. Tema claro y oscuro

- `Preferences` gana `theme: 'light' | 'dark'` con default `'light'`; el validador tolerante ignora valores desconocidos y las preferencias antiguas sin tema conservan el resto de campos.
- Los colores de Tailwind (`page`, `ink`, `panel`, `line`, `accent`) se declaran como `rgb(var(--color-*) / <alpha-value>)` y cada tema define sus variables en `index.css`; `color-scheme` acompaña al tema para los controles nativos.
- `App` aplica `document.documentElement.dataset.theme` en un efecto y `index.html` arranca con `data-theme="light"` para evitar el destello de tema oscuro.
- Un botón en la cabecera alterna el tema con etiqueta explícita y `aria-pressed`; la preferencia se persiste con el resto.
- Los estilos heredados que usaban clases de texto claro reciben equivalentes oscuros en el tema claro mediante reglas acotadas por `[data-theme='light']`, sin duplicar componentes.

*Alternativa descartada*: usar solo `prefers-color-scheme`. El usuario debe poder elegir y el tema claro es el original; la preferencia explícita manda.

### 11. Renombrado a Chordifree

- La marca visible, el título de la página, el README, Docker, el analizador y los metadatos pasan de `freechords` a `chordifree`.
- Los paquetes internos cambian de `@freechords/*` a `@chordifree/*`, incluidos imports, `tsconfig.base.json`, `package.json` y `pnpm-lock.yaml`.
- El prefijo de almacenamiento pasa a `chordifree:v1`; al arrancar, `migrateLegacyKeys` copia las claves `freechords:v1:*` a `chordifree:v1:*` sin sobrescribir claves nuevas y elimina las antiguas.
- Los documentos históricos de OpenSpec de cambios ya cerrados conservan la marca antigua como registro; no se reescriben.

*Alternativa descartada*: cambiar solo los textos visibles. Dejaría dos marcas conviviendo en imports, almacenamiento y documentación, y el usuario pidió un renombrado completo.

### 12. Pruebas

- `packages/chords`: simplificación, agrupación de duplicados, absorción de acordes de paso, conservación de acordes de medio pulso, umbral sin pulsos, protección del último acorde, silencios e idempotencia.
- `apps/web`: `buildBeatRows` con filas completas/incompletas y límites de compás; render de ocho celdas con canal lateral, ensanchado sin scroll horizontal en escritorio, resaltado y navegación; preferencias antiguas con `reduceChords` o `theme` ausentes; controles de reducción y tema; migración de claves; layout de dos columnas y orden responsive.
- `apps/web` E2E: fixture con `beats`, parrilla de ocho casillas sin desbordamiento horizontal en escritorio, reducción, cambio de instrumento, alternancia parrilla/lista, navegación por pulsos, tema y layout de dos columnas.
- `services/analyzer` y `apps/server`: se mantienen las pruebas existentes de pulsos y saneado.

## Risks / Trade-offs

- **Pulsos inestables o tempo variable** → la parrilla puede desalinearse; mitigación: vista de lista siempre disponible, aviso cuando no hay pulsos y agrupación documentada en 4/4.
- **Sin detección de downbeat** → el primer compás puede empezar a contratiempo; mitigación: agrupar desde el primer pulso y no afirmar que el compás musical empieza ahí.
- **Reducción demasiado agresiva** → se pueden perder cambios armónicos reales; mitigación: umbral de medio pulso, conservar los acordes de medio pulso o más, conservar el acorde de mayor duración y permitir desactivar el modo en un clic. La lista sigue mostrando la línea completa.
- **Reducción y edición desincronizadas** → el editor debe seguir usando los segmentos originales; mitigación: la reducción solo vive en `displaySegments` y no se persiste.
- **Filas de ocho en pantallas estrechas** → las celdas pueden quedar demasiado pequeñas; mitigación: ancho mínimo y scroll horizontal solo por debajo de `sm`, y etiquetas truncadas sin deformar la rejilla.
- **Rejilla y video compitiendo por el ancho** → el video puede quedar demasiado pequeño o la rejilla demasiado estrecha; mitigación: columna derecha fija de 18rem, columna izquierda fluida y contenedor de página más ancho (`90rem`) para que la parrilla no necesite scroll horizontal en escritorio.
- **Dos columnas en pantallas medianas** → el video puede quedar estrecho al ocupar el ancho de la columna; mitigación: punto de ruptura `lg`, apilado por debajo y ancho fijo de la columna derecha.
- **Tema claro con estilos heredados** → algunas clases de color oscuro podrían quedar con poco contraste; mitigación: tokens de color y reglas de tema claro revisadas con `axe` y pruebas visuales.
- **Renombrado de almacenamiento** → los datos antiguos podrían perderse; mitigación: migración idempotente al arrancar, sin sobrescribir claves nuevas y con test dedicado.
- **Invalidación de caché por `essentia-1.2`** → el primer análisis tras el despliegue vuelve a llamar al servidor; es el coste esperado de añadir pulsos.
- **Preferencias antiguas** → el validador tolerante evita perder notación/transposición; `reduceChords` toma `false`.

## Migration Plan

1. Desplegar el analizador con `beats`, `beatsPerBar` y `ANALYZER_VERSION=essentia-1.2`.
2. Desplegar el servidor que sanea y propaga los pulsos; las respuestas antiguas siguen siendo aceptables porque `beats` es opcional.
3. Desplegar la web; las cachés anteriores se invalidan por versión y las canciones guardadas sin pulsos abren en vista de lista.
4. Las preferencias existentes se leen con `reduceChords: false` y `theme: 'light'`; no hay migración destructiva.
5. Al arrancar, las claves `freechords:v1:*` se copian a `chordifree:v1:*` y se eliminan las antiguas; la operación no sobrescribe claves nuevas.
6. Rollback: restaurar la versión anterior del analizador, del servidor y de la web; la web ignora `beats` ausentes y la reducción es solo de presentación. Las claves de la marca anterior ya migradas no se revierten automáticamente.

## Open Questions

Ninguna pendiente que cambie el alcance, el enfoque o el desglose de tareas.
