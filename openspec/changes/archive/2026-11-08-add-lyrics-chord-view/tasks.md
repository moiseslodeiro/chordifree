# Tasks

## 1. Modelo y persistencia

- [x] 1.1 Añadir `lyrics?: string` a `Song` y `'lyrics'` a `GridView`, y verificar con `pnpm --filter @chordifree/web typecheck`.
- [x] 1.2 Aceptar letra opcional en `isSong` y la nueva vista en el validador de preferencias; verificar con tests de `storage.test.ts` que una canción antigua y una preferencia sin `lyrics` siguen cargando.
- [x] 1.3 Comprobar que la copia JSON conserva y restaura la letra; añadir el caso a `backup.test.ts` y verificar que pasa.
- [x] 1.4 Comprobar que borrar una canción o eliminar su letra no deja datos huérfanos; verificar con tests de biblioteca.

## 2. Alineación letra-acordes

- [x] 2.1 Crear `apps/web/src/lyrics/align.ts` con lectura de líneas, construcción de eventos de acorde y reparto uniforme sobre el tramo musical; verificar con tests unitarios de líneas vacías y de una sola línea.
- [x] 2.2 Asignar cada evento a su línea por tiempo, recortar los que quedan fuera del tramo y calcular el desplazamiento horizontal acotado; verificar con tests de acordes antes, dentro y después del tramo.
- [x] 2.3 Resolver varios acordes en la misma línea en orden temporal y con separación mínima; verificar con tests de colisiones y de etiquetas largas.
- [x] 2.4 Cubrir canciones sin acordes y sin letra; verificar que la alineación devuelve líneas navegables sin capa de acordes o una lista vacía, respectivamente.

## 3. Vista Letra

- [x] 3.1 Añadir el botón «Letra» al selector de vistas y el estado vacío con acción para añadir letra; verificar con tests de `ChordGrid` que la vista se activa y que Parrilla sigue deshabilitada sin pulsos.
- [x] 3.2 Crear `LyricsChordView` con líneas de texto y botones de acorde encima, reutilizando `displaySegments` y la alineación; verificar con tests de renderizado, orden y etiquetas.
- [x] 3.3 Implementar el resaltado de línea y acorde activos a partir del índice de segmento del reloj y el salto por clic o teclado; verificar con tests de interacción y de ausencia de reproductor.
- [x] 3.4 Persistir la vista Letra en preferencias y recuperarla al recargar; verificar con tests de preferencias y con la app que una preferencia antigua sigue siendo válida.
- [x] 3.5 Añadir estilos responsive para que los acordes se envuelvan sin solaparse ni generar scroll horizontal; verificar a 390 px y 1440 px.

## 4. Editor de letra

- [x] 4.1 Crear el editor con textarea etiquetada, contador de líneas y acciones Guardar, Cancelar y Eliminar; verificar con tests de componente.
- [x] 4.2 Integrar el editor en `SongView` con un borrador que sobreviva a cambios de vista; verificar que cancelar conserva la letra anterior y que guardar actualiza la canción.
- [x] 4.3 Persistir la letra en la biblioteca al guardar y recuperarla al reabrir y recargar; verificar con un test de integración de la app.
- [x] 4.4 Normalizar texto vacío o solo espacios a «sin letra» y cubrir el caso con test.

## 5. Integración y accesibilidad

- [x] 5.1 Verificar que transporte, capo, notación, simplificación y reducción actualizan los acordes de la letra sin tocar el texto; añadir tests de integración.
- [x] 5.2 Revisar que la letra se renderiza como texto y que HTML literal no se interpreta; añadir un test con `<b>`.
- [x] 5.3 Comprobar la accesibilidad de la vista y del editor (lista, `aria-current`, etiquetas y tiempos); ejecutar la suite de accesibilidad existente.
- [x] 5.4 Añadir el flujo E2E de pegar letra, ver acordes, cambiar capo, recargar y recuperar la vista; ejecutar Chromium y Firefox.
- [x] 5.5 Actualizar el README con la vista Letra y su límite de alineación aproximada; verificar que el texto coincide con el comportamiento real.

## 6. Verificación final

- [x] 6.1 Ejecutar `pnpm typecheck`, `pnpm lint`, la suite de tests y el build; verificar que todo pasa.
- [x] 6.2 Ejecutar los E2E de Chromium y Firefox y revisar visualmente claro/oscuro a 1440 px y 390 px.
- [x] 6.3 Ejecutar `openspec validate add-lyrics-chord-view --strict` y corregir cualquier aviso.

## 7. Intros, interludios y anclas

- [x] 7.1 Implementar la detección conservadora de intro, outro e interludio por frases de compases; verificar con tests de frase repetida, intro, outro, vamp y ausencia de estructura fiable.
- [x] 7.2 Añadir anclas `[mm:ss]`, repartir las líneas entre anclas excluyendo tramos instrumentales y ocultar el marcador del texto; verificar con tests de anclas y de combinación con la heurística.
- [x] 7.3 Integrar los tramos detectados en la alineación de la vista y comprobar que los acordes instrumentales no se asignan a líneas; verificar con tests de componente.
- [x] 7.4 Añadir «Anclar línea al tiempo actual» al editor e insertar el tiempo del reproductor en la línea del cursor; verificar con tests del editor y de la app.
- [x] 7.5 Actualizar la ayuda del editor y el README con la heurística, las anclas y sus límites; verificar que el texto coincide con el comportamiento.

## 8. Verificación de la mejora

- [x] 8.1 Ejecutar `pnpm typecheck`, `pnpm lint`, la suite de tests y el build.
- [x] 8.2 Ejecutar los E2E de Chromium y Firefox y revisar visualmente la letra con intro e interludio a 1440 px y 390 px.
- [x] 8.3 Ejecutar `openspec validate add-lyrics-chord-view --strict` y corregir cualquier aviso.

## 9. Correcciones de tiempos y reducción

- [x] 9.1 Hacer que la reducción máxima use el compás real (`beatsPerBar`) y añadir un test de 3/4.
- [x] 9.2 Separar los segmentos de la letra de la reducción máxima para que los acordes no se muevan de tiempo; añadir un test de integración con «Máxima».
- [x] 9.3 Avanzar la línea activa por tiempo de reproducción, no por índice de segmento; verificar con tests de la vista.
- [x] 9.4 Añadir «Anclar inicio» al editor y cubrirlo con test.
- [x] 9.5 Actualizar spec, diseño y README con el comportamiento de la reducción máxima y el anclaje de inicio.

## 10. Verificación de las correcciones

- [x] 10.1 Ejecutar typecheck, lint, suite de tests, build y `openspec validate --strict`.
- [x] 10.2 Ejecutar los E2E de Chromium y Firefox y revisar la letra con reducción máxima.

## Workflow follow-up

- Archivar el cambio cuando la implementación y sus verificaciones estén completas.
- Revisar que la letra aparece en las copias de seguridad existentes sin subir la versión del formato.
