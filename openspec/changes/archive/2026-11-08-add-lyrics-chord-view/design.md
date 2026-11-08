# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el diseño:

- `Song` vive completo en la biblioteca local (`chordifree:v1:song:<id>`), se valida con `isSong` y se incluye entero en las copias JSON.
- `GridView` solo admite `beats` y `list`, y se persiste en preferencias.
- `ChordGrid` concentra el selector Parrilla/Lista y renderiza la parrilla o la lista; recibe ya los segmentos de presentación (transporte, capo, simplificación y reducción).
- `SongView` calcula `displaySegments`, la tonalidad, el reloj de reproducción y los metadatos; el editor de acordes existente se muestra en la columna de la línea de tiempo.
- La reproducción expone índice de segmento y de pulso, no tiempo continuo, para evitar re-renderizar en cada frame.

## Goals / Non-Goals

**Goals:**

- Guardar letra opcional por canción sin romper canciones, preferencias ni copias existentes.
- Ofrecer una tercera vista Letra con edición manual y acordes alineados de forma determinista.
- Reutilizar la presentación de acordes y el reloj existentes.
- Mantener la alineación como lógica pura y testeable, separada de React.

**Non-Goals:**

- Descargar letras o subtítulos de servicios externos.
- Sincronización exacta palabra a palabra o edición manual de tiempos.
- Incluir la letra en la hoja imprimible o en la exportación de imagen.
- Cambiar el analizador, la API o el modelo de segmentos.

## Decisions

### 1. La letra vive en `Song.lyrics?: string`

Se añade un campo opcional de texto plano al modelo de canción. La biblioteca, el borrado, la copia JSON y la importación ya trabajan con la canción completa, así que la letra viaja con ella sin una clave nueva.

- **Ventaja**: una sola fuente de verdad, copias completas y borrado coherente.
- **Alternativa descartada**: almacenar la letra en una clave separada por canción (como la práctica). Ahorraría tocar `Song`, pero la copia JSON dejaría de ser una restauración completa y habría que limpiar otra clave al borrar.
- La ausencia del campo representa «sin letra»; un texto vacío o solo espacios también se normaliza a ausencia.
- `isSong` acepta `undefined` o `string`. No se sube la versión del sobre: es un campo aditivo y las canciones antiguas siguen siendo válidas.

### 2. `GridView` gana `'lyrics'`

La vista se suma al enum existente y al validador de preferencias. El valor por defecto sigue siendo `beats`; las preferencias antiguas con `beats` o `list` se siguen leyendo igual.

- **Alternativa descartada**: un booleano independiente `showLyrics`. Duplicaría el estado de vista y permitiría combinaciones imposibles (parrilla y letra a la vez).

### 3. La vista Letra se integra en `ChordGrid`

`ChordGrid` ya es el panel de la línea de tiempo y el dueño del selector de vistas. Se amplía con `lyrics` y callbacks de edición, y renderiza un componente `LyricsChordView` cuando la vista es `lyrics`.

- `Parrilla` sigue deshabilitada sin pulsos; `Letra` está siempre disponible.
- Si no hay letra, la vista muestra un estado vacío con la acción «Añadir letra».
- **Alternativa descartada**: mover el selector a `SongView` y renderizar la letra fuera de `ChordGrid`. Obliga a duplicar el encabezado y el selector, y separa vistas que comparten el mismo espacio.

### 4. Editor de letra en la columna de la línea de tiempo

`SongView` mantiene `editingLyrics` y `lyricsDraft`, igual que el editor de acordes mantiene su estado. Al pulsar «Editar letra» o el estado vacío, la columna muestra `LyricsEditor` en lugar de la vista de letra. Guardar actualiza la canción (`onChange`) y la persiste (`onSave`); cancelar descarta el borrador.

- **Ventaja**: el borrador sobrevive a cambios de vista y el patrón es el mismo que el editor de acordes.
- **Alternativa descartada**: un modal. Añade gestión de foco y una capa visual que no existe en el resto de la edición.

### 5. Alineación por tramo musical y reparto uniforme de líneas

El cálculo se encapsula en `apps/web/src/lyrics/align.ts` y no depende de React ni del formato de los acordes.

Entradas:

- Texto de la letra.
- Eventos de acorde con tiempo, índice de segmento y etiqueta ya formateada.
- Duración de la canción.

Reglas:

1. Se conservan todas las líneas; las vacías actúan como separadores.
2. El tramo musical va del inicio del primer acorde al final del último. Si no hay acordes, se usa `0..duration` para que las líneas sigan siendo navegables.
3. Las `N` líneas no vacías se reparten en intervalos iguales dentro del tramo.
4. Cada evento se asigna a la línea que contiene su tiempo; fuera del tramo se recorta a la primera o a la última línea no vacía.
5. Dentro de la línea, el desplazamiento horizontal es `(tiempo - inicio) / (fin - inicio)`, acotado a `[0, 1]`.
6. Los eventos se ordenan por tiempo. La UI los pinta como una fila flexible de botones sobre el texto, con separación mínima y salto de línea si hace falta, de modo que nunca se solapan aunque el reparto sea aproximado.

- **Ventaja**: determinista, barato y testeable sin DOM.
- **Alternativa descartada**: medir palabras y calcular posiciones absolutas. Requiere medir el DOM, se rompe con el cambio de ancho y no mejora la precisión temporal, que sigue siendo aproximada.

### 6. Los acordes de la letra salen de la línea de tiempo real

La letra usa una copia de los segmentos con transporte, capo, simplificación y reducción normal, pero **nunca la reducción máxima**. La reducción máxima colapsa los acordes a compases y mueve sus inicios; usarla en la letra haría que las etiquetas dejaran de coincidir con el momento en que suena el acorde. Los eventos se construyen colapsando cambios consecutivos al mismo acorde, igual que la hoja imprimible, para que la letra y la parrilla compartan la representación sin compartir el colapso de compases.

- **Ventaja**: la letra mantiene los tiempos reales aunque la parrilla se muestre en modo máximo.
- **Alternativa descartada**: aplicar la reducción máxima también a la letra. Mueve los acordes al inicio del compás y desalinea el texto.

### 7. Línea y acorde activos con tiempo de reproducción

La vista Letra lee el tiempo actual del reproductor con una frecuencia baja (250 ms) y localiza la línea por sus intervalos de tiempo. No depende de que el índice de segmento cambie, así que funciona igual con la parrilla normal o máxima y avanza aunque un segmento dure varios compases.

- Si no hay reloj, la vista sigue siendo legible y navegable.
- Pulsar una línea busca su inicio; pulsar un acorde busca el tiempo del evento.

### 8. Renderizado seguro y accesible

- La letra se pinta como nodos de texto, nunca con `dangerouslySetInnerHTML`.
- Cada línea es un elemento de lista con su texto y sus botones de acorde.
- La línea activa usa `aria-current` además del color.
- Cada acorde es un botón con etiqueta accesible que incluye el acorde y su tiempo; el editor tiene `label` y un contador de líneas.

### 9. Detección conservadora de tramos instrumentales

El analizador no devuelve actividad vocal ni secciones. Para no inventar una fiabilidad que no existe, la detección usa la estructura armónica:

1. Se agrupan los pulsos en compases y se etiqueta cada compás con su acorde dominante.
2. Se busca la frase de cuatro compases que más se repite sin solaparse. Debe aparecer al menos dos veces para considerarse fiable.
3. La intro es el tramo anterior a la primera aparición; el outro, el posterior a la última, ambos con al menos dos compases.
4. Un hueco interno solo se marca como interludio si dura al menos cuatro compases y contiene como mucho dos acordes distintos, señal de un vamp o pedal instrumental. Un puente con armonía propia no se marca para no ocultar letra que sí existe.
5. Sin una frase principal fiable, no se detecta nada y se mantiene el reparto uniforme.

Los tramos detectados se excluyen del reparto y de la asignación de acordes a líneas. La vista no inventa texto para ellos; si el usuario quiere una referencia visual, puede añadir una línea vacía o anclar la línea siguiente.

*Alternativa descartada*: detectar voces con el analizador actual. No devuelve actividad vocal y añadir separación de fuentes o un detector de canto quedaría fuera de este cambio y no sería fiable.

### 10. Anclas de tiempo explícitas

Una línea puede empezar por `[mm:ss]`. El ancla fija su inicio y no se muestra como texto. Las anclas dividen la letra en bloques: las líneas sin ancla se reparten entre el bloque anterior y el siguiente, excluyendo los tramos instrumentales que caigan dentro.

- Las anclas tienen prioridad sobre la heurística para el inicio de su línea: si el usuario fija una línea dentro de un tramo que la heurística marcó como instrumental, se respeta el ancla.
- El editor incorpora «Anclar línea» (tiempo del reproductor al inicio de la línea del cursor) y «Anclar inicio» (primera línea con texto), pensado para marcar dónde empieza la voz tras una intro.
- Las anclas forman parte del texto guardado, así que viajan con la canción y las copias sin cambiar el modelo de datos.

*Alternativa descartada*: guardar las anclas como una lista de índices y tiempos separada. Duplicaría la fuente de verdad y complicaría la edición y las copias.

## Risks / Trade-offs

- **Alineación aproximada en canciones con intro, interludios o estribillos de distinta duración** → la heurística conservadora evita repartir letra sobre intros y vamps instrumentales; las anclas manuales corrigen los casos que la estructura armónica no permite distinguir.
- **La heurística confunde un puente con un interludio** → solo se marcan huecos internos con como mucho dos acordes distintos; un puente con progresión propia se conserva. Las anclas permiten ajustar el inicio de las líneas.
- **El usuario no conoce la sintaxis de anclas** → los botones «Anclar línea» y «Anclar inicio» insertan el marcador sin escribirlo a mano, y el editor explica el formato.
- **Acordes amontonados en líneas con muchos cambios** → fila flexible con separación mínima y salto de línea; nunca se solapan.
- **Borrador de letra perdido al cambiar de canción** → el borrador vive en `SongView` y se descarta al cambiar de canción, igual que el editor de acordes; cancelar es explícito.
- **Crecimiento del almacenamiento por letras largas** → es texto pequeño frente a segmentos y audio; los errores de cuota ya se gestionan al guardar.
- **Copias antiguas o nuevas** → el campo es opcional y aditivo; una versión anterior ignora `lyrics` sin romper la importación.
- **Letra con HTML o contenido malicioso** → se renderiza como texto.

## Migration Plan

1. Añadir `lyrics?` al modelo y al validador; las canciones existentes cargan sin cambios.
2. Añadir `'lyrics'` al enum y al validador de preferencias; no se sube `schemaVersion`.
3. Desplegar la vista y el editor.
4. Rollback: una versión anterior ignora el campo `lyrics` y conserva el resto de la canción; no se borran datos.
