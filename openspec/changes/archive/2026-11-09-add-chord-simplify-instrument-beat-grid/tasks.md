# Tasks

## 1. Pulsos en el analizador

- [x] 1.1 Extraer la detección de pulsos a una función que se ejecute una sola vez y pasar la lista a `_detect_with_beats`; verificar con `pytest` que el fallback a `_detect_fixed_frame` conserva los pulsos.
- [x] 1.2 Devolver `beats` y `beatsPerBar` en `analyze_file` con valores finitos, crecientes y recortados a la duración; verificar con tests el caso normal, el vacío y el de menos de dos pulsos.
- [x] 1.3 Subir `ANALYZER_VERSION` por defecto a `essentia-1.2` y actualizar fixtures y aserciones; verificar con `PYTHONPATH=/tmp/opencode/pydeps:. .venv/bin/python -m pytest services/analyzer -q`.
- [x] 1.4 Documentar `beats` y `beatsPerBar` en `services/analyzer/README.md`; verificar que el ejemplo de respuesta coincide con el contrato y que `curl` local devuelve esos campos.

## 2. Propagación en el servidor

- [x] 2.1 Añadir `beats?: number[]` y `beatsPerBar?: number` a `RawAnalysis` y `AnalysisResult`; verificar con `pnpm --filter @chordifree/server typecheck`.
- [x] 2.2 Sanear los pulsos del analizador (finitos, estrictamente crecientes, dentro de `[0, duration]`, sin duplicados) y normalizar `beatsPerBar` a 4; verificar con tests de valores inválidos y de lista vacía.
- [x] 2.3 Propagar los pulsos en `analyzeYoutube` y `analyzeUpload`; verificar con los tests de integración de `apps/server/tests/api.test.ts`.
- [x] 2.4 Verificar que un resultado cacheado con `essentia-1.0` no se reutiliza tras el cambio de versión; añadir el test correspondiente.
- [x] 2.5 Documentar los campos nuevos en `apps/server/README.md`; verificar que el ejemplo de `GET /api/analyses/:id` incluye `beats` y `beatsPerBar`.

## 3. Simplificación compartida

- [x] 3.1 Implementar `simplifyChord` en `packages/chords` con la tabla de familias del diseño; verificar con tests cada fila de la tabla.
- [x] 3.2 Cubrir los casos `Cmaj7 → C`, `Am7 → Am`, `Bdim7 → Bdim`, `C/G → C` y `C5 → C5`; verificar con `pnpm --filter @chordifree/chords test`.
- [x] 3.3 Conservar `G7 → G7` en la simplificación y añadir digitación/voicing de séptima de dominante para guitarra, ukelele y piano; verificar con tests de simplificación, formas y voicings.

## 4. Preferencias de presentación

- [x] 4.1 Extender `Preferences` con `simplifyChords`, `instrument` y `gridView`, y sus valores por defecto; verificar con `pnpm --filter @chordifree/web typecheck`.
- [x] 4.2 Hacer tolerante el validador de preferencias y mezclar los valores ausentes con los defaults; verificar con tests de preferencias antiguas, parciales y corruptas.
- [x] 4.3 Persistir y restaurar las tres preferencias; verificar con un test que recarga desde el mismo almacén y conserva notación, alteraciones y trasposición.

## 5. Diagramas de instrumento

- [x] 5.1 Implementar las formas móviles de guitarra y ukelele para `major`, `minor`, `dim`, `aug` y `power`, con cálculo de traste según la fundamental; verificar con tests de resolución y de acorde sin forma.
- [x] 5.2 Implementar el voicing de piano a partir de los tonos del acorde simplificado; verificar con tests de notas para mayor, menor, disminuido y aumentado.
- [x] 5.3 Crear los componentes SVG accesibles de mástil y teclado con `role="img"` y `aria-label`; verificar con tests de etiqueta accesible y del aviso "sin digitación".

## 6. Simplificación en la interfaz

- [x] 6.1 Aplicar `simplifyChord` después de la trasposición en `SongView` sin modificar `song.segments` ni `detectedSegments`; verificar que al desactivar se recuperan los acordes originales.
- [x] 6.2 Añadir los controles de simplificación e instrumento con etiquetas y operación por teclado; verificar con tests de componente que cambian el estado y se anuncian.
- [x] 6.3 Conectar el diagrama del acorde activo al reloj de reproducción; verificar con el adaptador falso que el diagrama cambia al avanzar de segmento.

## 7. Modelo y reloj de pulsos

- [x] 7.1 Implementar `buildBeatGrid` con compases de cuatro tiempos, celdas de relleno, acorde vigente y marca de cambio; verificar con tests de compás completo, incompleto, cambio de acorde y silencio.
- [x] 7.2 Extender `PlaybackClock` con `setBeats` y `getBeatIndex`, notificando solo cuando cambia el índice de segmento o el de pulso; verificar con tests de ambos índices y de búsqueda en bordes.
- [x] 7.3 Añadir el hook `useIsBeatActive`; verificar con un test de contador de renders que solo se actualizan las celdas afectadas.

## 8. Primera parrilla por tiempos

- [x] 8.1 Renderizar filas de cuatro celdas con marca de tiempo al inicio, celdas vacías no focusables y etiqueta de acorde agrupada; verificar con tests de render para una lista de pulsos fija.
- [x] 8.2 Resaltar la celda del pulso activo y autodesplazar el compás activo sin saltos al hacer scroll manual; verificar con el adaptador falso y un test de componente.
- [x] 8.3 Implementar el salto con clic o Intro y la navegación con flechas, Home y End; verificar que `seekTo` recibe el tiempo del pulso correcto.
- [x] 8.4 Ampliar la región `aria-live` para anunciar compás, tiempo y acorde; verificar con tests de accesibilidad y revisión con lector de pantalla.
- [x] 8.5 Añadir el selector lista/parrilla con persistencia y el fallback a lista con aviso cuando no haya pulsos; verificar con tests de cambio de vista, recarga y canción antigua sin pulsos.

## 9. Reducción de acordes

- [x] 9.1 Implementar `reduceChordSegments` en `packages/chords` con simplificación, agrupación de duplicados, umbral de una pulsación (1,5 s de reserva sin pulsos), absorción del vecino más estable, protección del último acorde y conservación de silencios y de progresiones con cambios en cada pulsación; verificar con tests de cada paso, del caso sin pulsos, de la conservación de acordes estables y de idempotencia.
- [x] 9.2 Añadir `reduceChords: boolean` a `Preferences` con default `false` y validación tolerante; verificar con tests de preferencias antiguas sin el campo y de persistencia tras recargar.
- [x] 9.3 Aplicar la reducción en el pipeline de `SongView` después de la simplificación y antes de `ChordGrid`/`ActiveChordDiagram`, con `useMemo` y sin tocar el editor ni `song.segments`; verificar con tests de activación, desactivación y apertura del editor.
- [x] 9.4 Añadir el control "Reducir acordes" en `DisplayControls` con `aria-pressed`, etiqueta y anuncio accesible, manteniendo el control de simplificación; verificar con tests de cambio de estado y de combinación con instrumento.

## 10. Parrilla de ocho pulsos

- [x] 10.1 Añadir `buildBeatRows` en `apps/web/src/grid/beats.ts` para agrupar dos compases de cuatro tiempos por fila, rellenar hasta ocho celdas y exponer los inicios de compás; verificar con tests de fila completa, última fila incompleta y frontera entre filas.
- [x] 10.2 Renderizar filas de ocho casillas al estilo Chordify: canal lateral con tiempo y número de compás, separador vertical marcado cada cuatro casillas, etiqueta solo en el cambio de acorde, columnas fluidas sin scroll horizontal en escritorio y scroll mínimo solo por debajo de `sm`; verificar con tests de render de ocho botones, de la última fila rellena, del canal lateral y del ancho sin desbordamiento.
- [x] 10.3 Actualizar el resaltado y el autoscroll para usar la fila de ocho pulsos, manteniendo la pausa del desplazamiento manual; verificar con el adaptador falso que la fila activa queda visible al cruzar un límite de fila.
- [x] 10.4 Actualizar la navegación por teclado para recorrer las ocho celdas de la fila, subir y bajar entre filas y resolver Home/End en la primera y última celda con pulso; verificar con tests de foco y de `seekTo` en los bordes.
- [x] 10.5 Ampliar el anuncio accesible y el contador de la cabecera para distinguir fila, compás y tiempo; verificar con tests de la región `aria-live` y del texto visible.

## 11. Layout de dos columnas

- [x] 11.1 Añadir una variante compacta a `PlayerHost` que haga que el video ocupe el ancho de una columna derecha de 18rem sin deformar su relación de aspecto; verificar con un test de render de la variante y del reproductor de audio.
- [x] 11.2 Reestructurar `SongView` en dos columnas amplias (`ChordGrid` a la izquierda con todo el ancho libre; video, transporte y herramientas a la derecha en 18rem) con sidebar sticky en pantallas anchas y apilado responsive; verificar con tests de estructura y de orden visual.
- [x] 11.3 Mover `DisplayControls`, `ActiveChordDiagram` y `Transport` a la columna derecha, manteniendo el editor en la izquierda durante la edición; verificar con tests de que las herramientas siguen operativas en ambos modos.
- [x] 11.4 Revisar accesibilidad y foco del nuevo layout con `axe`: encabezados, etiquetas de sección y orden de tabulación; verificar que no hay violaciones críticas en la vista de canción.

## 12. Integración, E2E y documentación

- [x] 12.1 Actualizar el fixture de Playwright con `beats` y `beatsPerBar`, e instalar el navegador si falta; verificar que `pnpm --filter @chordifree/web exec playwright test` arranca la suite.
- [x] 12.2 Ampliar el E2E para cubrir la parrilla de ocho casillas, el modo de reducción, el cambio de instrumento, la alternancia parrilla/lista, la navegación por pulsos y el layout de dos columnas; verificar que el flujo completo pasa de principio a fin.
- [x] 12.3 Actualizar el `README.md` raíz con la parrilla de ocho pulsos, el modo de reducción, los instrumentos, el layout de dos columnas y la limitación de compás 4/4; verificar que los comandos documentados siguen funcionando.
- [x] 12.4 Ejecutar `pnpm typecheck`, `pnpm test` y `pnpm --filter @chordifree/web exec playwright test`; verificar que todo pasa y que `pnpm lint` no añade errores nuevos respecto a la línea base.

## 13. Tema claro y oscuro

- [x] 13.1 Añadir `theme: 'light' | 'dark'` a `Preferences` con default `light`, validación tolerante y persistencia; verificar con tests de preferencias antiguas, parciales y corruptas.
- [x] 13.2 Aplicar el tema con `document.documentElement.dataset.theme` y un efecto de arranque, sin parpadeo y con `color-scheme` correcto; verificar que el tema claro es el inicial.
- [x] 13.3 Parametrizar los colores de Tailwind con variables CSS y definir paletas clara y oscura para fondo, paneles, líneas, texto y acento; revisar que los componentes existentes mantienen contraste.
- [x] 13.4 Añadir el botón de alternancia en la cabecera con etiqueta accesible y `aria-pressed`; verificar con un test de cambio claro → oscuro → claro.

## 14. Renombrado a Chordifree

- [x] 14.1 Renombrar la marca visible, títulos, README, Docker, analizador y metadatos de `freechords` a `chordifree`; verificar que no quedan referencias salvo las históricas.
- [x] 14.2 Cambiar el scope de los paquetes a `@chordifree/*`, imports, `tsconfig`, `package.json` y lockfile; verificar con `pnpm install` y `pnpm typecheck`.
- [x] 14.3 Cambiar el prefijo de almacenamiento a `chordifree:v1` y migrar de forma transparente las claves `freechords:v1:*` sin pisar datos nuevos; verificar con un test de migración.
- [x] 14.4 Actualizar el título de la página y la documentación de comandos; verificar que los comandos documentados funcionan con los nombres nuevos.

## Workflow follow-up

- Revisar el solapamiento con el cambio `add-youtube-chord-detection` antes de archivar, porque ambos tocan el contrato de análisis y la rejilla.
- Archivar este cambio cuando la implementación y sus verificaciones estén completas.
