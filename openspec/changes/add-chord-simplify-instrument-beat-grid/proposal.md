# Proposal

## Why

La parrilla actual agrupa los pulsos en filas de cuatro casillas, muestra todos los acordes detectados —incluidos los de paso— y apila la rejilla, el reproductor y las herramientas en una sola columna. El resultado se aleja de una parrilla de acompañamiento: hay que desplazarse demasiado, los acordes importantes de la canción se pierden entre cambios breves y el video ocupa espacio que debería aprovechar la rejilla.

Este cambio completa la parrilla para que cada fila muestre ocho pulsos (dos compases de 4/4) al estilo de Chordify, añade un modo de reducción que simplifica la calidad y descarta los acordes de paso de una pulsación o menos, reorganiza la vista de canción en dos columnas con el video ajustado al ancho, incorpora tema claro y oscuro (claro por defecto) y unifica la marca como Chordifree.

## What Changes

- Cambiar la parrilla de filas de **cuatro** a filas de **ocho pulsos** al estilo Chordify: dos compases de 4/4 por fila, canal lateral con tiempo y número de compás, separador visual marcado cada cuatro celdas, etiqueta solo en el cambio de acorde y relleno de las casillas que falten en la última fila.
- Añadir un **modo de reducción de acordes**, independiente de la simplificación: además de reducir la calidad (`Cmaj7` → `C`, `C/G` → `C`), agrupa acordes repetidos y absorbe solo los acordes de paso que duran menos de medio pulso. Los acordes de medio pulso o más se conservan. Es reversible y solo afecta a la presentación.
- Mantener la **simplificación de calidad** existente como control separado; conserva la séptima de dominante (`G7` → `G7`), usa los símbolos `♭`/`♯` y activar la reducción también simplifica la calidad, pero desactivarla recupera la línea de tiempo completa.
- Reorganizar `SongView` en **dos columnas**: a la izquierda la rejilla de acordes (o el editor), a la derecha el video compacto, el transporte y las herramientas de presentación (instrumento, simplificación, reducción y acorde activo). En escritorio la parrilla ocupa todo el ancho libre sin scroll horizontal y el video se limita a 18rem; en pantallas estrechas las columnas se apilan con el video y las herramientas primero.
- Añadir **tema claro y oscuro**, con el claro como valor inicial, persistencia de la elección y un control en la cabecera.
- Renombrar toda la aplicación de **freechords** a **chordifree**: marca visible, paquetes `@chordifree/*`, imports, Docker, analizador, documentación y prefijo de almacenamiento, con migración de las claves antiguas.
- Conservar la vista de lista, la navegación por teclado, el salto por clic, el anuncio accesible y la degradación cuando no hay pulsos.
- Persistir en `chordifree:v1:preferences` el nuevo modo de reducción con valor por defecto desactivado, el tema con default claro y migración tolerante desde preferencias y claves antiguas.

## Capabilities

### New Capabilities

- `chord-display`: simplificación de calidad, reducción de acordes a los importantes para la canción, selección de instrumento con diagramas/voicings y organización en dos columnas de la rejilla y las herramientas.
- `beat-grid`: contrato de pulsos del análisis y presentación de la línea de tiempo como filas de ocho pulsos agrupadas en compases de cuatro tiempos.

### Modified Capabilities

<!-- Ninguna: el proyecto todavía no tiene specs principales archivadas; los cambios de contrato se declaran en las capacidades nuevas. -->

## Impact

- **Paquete compartido**: nueva función pura de reducción de segmentos (agrupación y descarte de acordes de paso) y tests unitarios de sus umbrales y casos límite.
- **Web**: `SongView` pasa a un layout de dos columnas, `ChordGrid`/`BeatGrid` renderizan filas de ocho pulsos con canal lateral, `DisplayControls` añade el control de reducción, `storage/preferences.ts` migra las nuevas preferencias y la cabecera añade el control de tema.
- **Tema y marca**: tokens de color claro/oscuro en `index.css` y Tailwind, y renombrado completo a `chordifree` en código, configuración y documentación.
- **Almacenamiento**: prefijo `chordifree:v1` con migración automática desde `freechords:v1:*`.
- **Analizador y servidor**: sin cambios de contrato; se reutilizan `beats` y `beatsPerBar` ya propagados por el cambio en curso.
- **Datos**: no se guarda audio ni se envía la biblioteca; la reducción es una transformación de presentación y `song.segments`/`detectedSegments` no se modifican.
- **Pruebas**: se actualizan los tests de la parrilla, preferencias, controles y vista de canción, y el fixture E2E gana pulsos para cubrir la parrilla de ocho casillas.
- **Dependencias**: ninguna nueva; los diagramas y la reducción se implementan con datos propios.
