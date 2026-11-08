# Spec Delta

## Purpose

Obtener una línea de tiempo de acordes a partir de un video de YouTube o de un archivo de audio, con marcas de tiempo fiables y errores accionables.

## ADDED Requirements

### Requirement: Ingesta desde un enlace de YouTube

El sistema SHALL aceptar enlaces de YouTube en los formatos `youtube.com/watch?v=`, `youtu.be/` y `youtube.com/shorts/`, extraer el identificador de video y rechazar cualquier otro host o esquema.

#### Scenario: Enlace válido

- **WHEN** el usuario envía `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- **THEN** el sistema inicia un análisis identificado por el ID de video `dQw4w9WgXcQ`

#### Scenario: Enlace de host no permitido

- **WHEN** el usuario envía `https://example.com/watch?v=abc`
- **THEN** el sistema responde con un error de validación que indica que solo se admiten enlaces de YouTube
- **AND** no realiza ninguna petición de red al host indicado

#### Scenario: Enlace de YouTube sin identificador

- **WHEN** el usuario envía `https://www.youtube.com/watch`
- **THEN** el sistema responde con un error de validación indicando que falta el identificador del video

### Requirement: Ingesta desde un archivo de audio

El sistema SHALL aceptar archivos de audio en formatos MP3, WAV, M4A, OGG y FLAC, verificando el tipo real del contenido antes de procesarlo.

#### Scenario: Archivo de audio admitido

- **WHEN** el usuario sube un archivo MP3 de 4 MB
- **THEN** el sistema inicia un análisis sobre ese archivo
- **AND** la respuesta identifica el origen como una subida de audio

#### Scenario: Archivo que no es audio

- **WHEN** el usuario sube un archivo con extensión `.mp3` cuyo contenido no es audio
- **THEN** el sistema responde con un error de validación indicando que el archivo no es un audio válido

### Requirement: Procesamiento asíncrono con estados observables

El sistema SHALL procesar cada análisis como un trabajo asíncrono y exponer su estado como `queued`, `processing`, `done` o `error`.

#### Scenario: Consulta del progreso

- **WHEN** el cliente consulta un análisis recién creado
- **THEN** recibe un estado `queued` o `processing` mientras el trabajo no ha terminado
- **AND** recibe `done` junto con la línea de tiempo cuando el análisis finaliza

#### Scenario: Análisis fallido

- **WHEN** la extracción o la detección de acordes falla
- **THEN** el estado pasa a `error` con un mensaje comprensible y un código de error estable

### Requirement: Línea de tiempo de acordes

El sistema SHALL devolver una lista ordenada de segmentos no solapados con `start`, `end` y un acorde canónico o `null` para ausencia de acorde, cubriendo la duración analizada.

#### Scenario: Segmentos ordenados y contiguos

- **WHEN** un análisis termina correctamente
- **THEN** cada segmento tiene `end` mayor que `start`
- **AND** el `start` de cada segmento es mayor o igual que el `end` del anterior
- **AND** el último segmento termina en la duración del audio, con una tolerancia de un segundo

#### Scenario: Fragmentos demasiado cortos

- **WHEN** la detección produce dos segmentos consecutivos con el mismo acorde
- **THEN** el sistema los fusiona en un único segmento

#### Scenario: Ausencia de acorde

- **WHEN** un tramo del audio no contiene armonía detectable
- **THEN** el segmento correspondiente se devuelve con acorde `null` en lugar de una etiqueta inventada

### Requirement: Límites de uso y protección del servicio

El sistema SHALL imponer una duración máxima de 15 minutos por análisis, un tamaño máximo de 25 MB por archivo y un límite de peticiones por cliente.

#### Scenario: Audio demasiado largo

- **WHEN** el usuario solicita analizar un video de 40 minutos
- **THEN** el sistema rechaza el análisis antes de descargar el audio e indica la duración máxima admitida

#### Scenario: Límite de peticiones excedido

- **WHEN** un cliente supera el número de análisis permitido en la ventana de tiempo configurada
- **THEN** el sistema responde con un error de límite excedido e indica cuándo puede reintentar

### Requirement: Caché y limpieza de resultados

El sistema SHALL conservar los resultados de análisis durante 24 horas para permitir su consulta repetida y SHALL eliminar los archivos temporales de audio al terminar o fallar el trabajo.

#### Scenario: Repetición del mismo video

- **WHEN** se solicita un análisis para un ID de video ya analizado dentro de las últimas 24 horas
- **THEN** el sistema devuelve el resultado almacenado sin volver a descargar ni analizar el audio

#### Scenario: Limpieza tras un fallo

- **WHEN** un trabajo falla durante la detección de acordes
- **THEN** el archivo temporal asociado se elimina en un plazo máximo de una hora
