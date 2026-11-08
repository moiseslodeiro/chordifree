# Proposal

## Why

Hoy la canción solo puede leerse como parrilla o como lista de acordes. Para acompañar una canción cantada falta el texto, y copiar la letra y colocar los acordes a mano en cada línea es lento y se rompe al transportar o cambiar el capo. Un modo de letra con los acordes colocados automáticamente permite practicar y cantar sin salir de Chordifree, reutilizando la línea de tiempo que ya existe.

## What Changes

- Añadir una **vista «Letra»** junto a Parrilla y Lista, con la letra en líneas y los acordes encima.
- Permitir **pegar, editar y eliminar la letra** de cada canción desde la propia vista, sin servicios externos ni descargas automáticas.
- **Alinear los acordes por tiempo**: repartir las líneas no vacías sobre el tramo musical de la canción y colocar cada cambio de acorde sobre la línea y la posición horizontal aproximada que le corresponde.
- Reutilizar la presentación actual: los acordes de la letra reflejan notación, alteraciones, transporte, capo, simplificación y reducción.
- Resaltar la línea y el acorde activos durante la reproducción; pulsar una línea o un acorde salta a su tiempo.
- Guardar la letra como parte de la canción (`Song.lyrics`), de forma opcional y compatible con canciones antiguas, la biblioteca local y las copias JSON.
- Añadir la preferencia de vista «Letra» sin romper las preferencias existentes.

**Fuera de alcance de este cambio:** obtener letras de YouTube, servicios externos o archivos LRC; sincronización exacta palabra a palabra y edición de tiempos por palabra; incluir la letra en la hoja imprimible o en la exportación de imagen. Las anclas de tiempo por línea sí forman parte del cambio.

## Capabilities

### New Capabilities

- `lyrics-chord-sheet`: almacenamiento de la letra por canción, edición manual, vista de letra con acordes alineados automáticamente por tiempo y seguimiento de la reproducción.

### Modified Capabilities

<!-- Ninguna: no hay specs principales archivadas; el cambio introduce una capacidad nueva. -->

## Impact

- **Web / modelo**: `Song.lyrics?: string` y `GridView` gana `'lyrics'`; `songFromResult` y la biblioteca siguen funcionando con canciones sin letra.
- **Almacenamiento**: `isSong` acepta letra opcional; las copias JSON la incluyen sin cambiar el formato; el validador de preferencias acepta la nueva vista.
- **UI**: nueva vista en el selector de la línea de tiempo, editor de letra, componente de letra con acordes y estados vacíos; reutiliza `displaySegments`, la tonalidad y el reloj de reproducción.
- **Lógica pura**: nuevo módulo de alineación letra-acordes con tests de reparto, líneas vacías, acordes fuera del tramo y colisiones.
- **Accesibilidad**: letra renderizada como texto (nunca HTML), etiquetas para el editor, línea activa anunciada y navegación por clic/teclado.
- **Sin cambios** en el analizador, la API, el servidor ni las dependencias externas.
