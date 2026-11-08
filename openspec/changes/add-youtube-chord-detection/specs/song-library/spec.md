# Spec Delta

## Purpose

Guardar en el navegador las canciones analizadas, sus correcciones y la caché de análisis para que el usuario pueda volver a ellas sin repetir el procesamiento.

## ADDED Requirements

### Requirement: Guardado de una canción en la biblioteca

El sistema SHALL guardar en el almacenamiento local del navegador una canción con su origen, título, duración, línea de tiempo y preferencias aplicadas.

#### Scenario: Guardado de un video analizado

- **WHEN** el usuario guarda una canción analizada desde YouTube
- **THEN** la biblioteca contiene una entrada con el identificador del video, el título y la línea de tiempo
- **AND** la entrada aparece en la lista de canciones sin recargar la página

#### Scenario: Guardado de un audio subido

- **WHEN** el usuario guarda una canción originada por un archivo de audio
- **THEN** la entrada conserva el nombre del archivo y la línea de tiempo
- **AND** no se almacena el archivo de audio completo en la biblioteca

### Requirement: Listado y apertura de canciones

El sistema SHALL mostrar las canciones guardadas ordenadas por última modificación y SHALL permitir abrir cualquiera de ellas.

#### Scenario: Orden de la biblioteca

- **WHEN** el usuario modifica una canción antigua y vuelve a la biblioteca
- **THEN** esa canción aparece en primer lugar

#### Scenario: Apertura de una canción guardada

- **WHEN** el usuario abre una canción de la biblioteca
- **THEN** se cargan su línea de tiempo y sus preferencias de notación y trasposición
- **AND** el reproductor queda listo en el origen correspondiente

### Requirement: Eliminación de canciones

El sistema SHALL permitir eliminar una canción de la biblioteca solicitando confirmación previa.

#### Scenario: Eliminación confirmada

- **WHEN** el usuario confirma la eliminación de una canción
- **THEN** la entrada desaparece de la biblioteca
- **AND** sus datos se eliminan del almacenamiento local

#### Scenario: Eliminación cancelada

- **WHEN** el usuario cancela la confirmación de eliminación
- **THEN** la canción permanece en la biblioteca sin cambios

### Requirement: Caché de resultados de análisis

El sistema SHALL almacenar localmente el resultado del análisis indexado por origen y versión del analizador, y SHALL reutilizarlo cuando coincida.

#### Scenario: Reutilización de la caché

- **WHEN** el usuario vuelve a analizar el mismo video con la misma versión del analizador
- **THEN** la aplicación usa el resultado guardado y no solicita un nuevo análisis

#### Scenario: Versión del analizador distinta

- **WHEN** la versión del analizador cambia
- **THEN** la caché anterior se considera obsoleta y se realiza un nuevo análisis

### Requirement: Límites y recuperación del almacenamiento local

El sistema SHALL detectar cuando el almacenamiento local está lleno o corrupto y SHALL informar al usuario sin bloquear la reproducción de la canción actual.

#### Scenario: Cuota excedida al guardar

- **WHEN** el usuario intenta guardar una canción y el almacenamiento local está lleno
- **THEN** el sistema muestra un aviso indicando que debe eliminar canciones o caché
- **AND** la canción abierta sigue siendo usable en memoria

#### Scenario: Datos corruptos

- **WHEN** los datos de la biblioteca no pueden interpretarse al iniciar la aplicación
- **THEN** el sistema conserva una copia del contenido ilegible y arranca con una biblioteca vacía
- **AND** muestra un aviso de recuperación

### Requirement: Compatibilidad del formato almacenado

El sistema SHALL versionar el formato de los datos guardados y SHALL migrar o descartar de forma segura los datos de versiones anteriores.

#### Scenario: Migración de una versión anterior

- **WHEN** la aplicación encuentra datos de una versión anterior compatible
- **THEN** los migra al formato actual y los muestra en la biblioteca

#### Scenario: Versión no compatible

- **WHEN** la aplicación encuentra datos de una versión que no puede migrar
- **THEN** los ignora, informa al usuario y no impide el uso de la aplicación

### Requirement: Privacidad de la biblioteca

El sistema SHALL mantener la biblioteca exclusivamente en el navegador del usuario y no SHALL enviarla al servidor.

#### Scenario: Biblioteca sin sincronización remota

- **WHEN** el usuario guarda o abre una canción
- **THEN** no se realiza ninguna petición que incluya el contenido de la biblioteca
