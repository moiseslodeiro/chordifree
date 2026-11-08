# Spec Delta

## Purpose

Reproducir el video o audio y mantener una rejilla de acordes alineada con el tiempo real de reproducción, para que el usuario vea el acorde que suena en cada momento.

## ADDED Requirements

### Requirement: Reproductor integrado

El sistema SHALL reproducir videos de YouTube mediante el reproductor embebido oficial y archivos de audio subidos mediante un reproductor de audio del navegador.

#### Scenario: Reproducción de un video de YouTube

- **WHEN** el usuario abre una canción con origen YouTube
- **THEN** el sistema muestra el reproductor de YouTube para ese video
- **AND** los controles de reproducción del reproductor permanecen disponibles

#### Scenario: Reproducción de un audio subido

- **WHEN** el usuario abre una canción con origen de audio subido
- **THEN** el sistema muestra un reproductor de audio con controles de reproducción, pausa y búsqueda

### Requirement: Rejilla de acordes con marcas de tiempo

El sistema SHALL mostrar la línea de tiempo como una rejilla ordenada donde cada fila presenta la marca de tiempo de inicio y el acorde correspondiente.

#### Scenario: Visualización de la rejilla

- **WHEN** una canción tiene una línea de tiempo cargada
- **THEN** la rejilla muestra una fila por segmento con el tiempo en formato `mm:ss` y su acorde
- **AND** los segmentos sin acorde se muestran con una indicación explícita de silencio o ausencia de acorde

#### Scenario: Línea de tiempo vacía

- **WHEN** una canción no tiene segmentos de acordes
- **THEN** el sistema muestra un mensaje indicando que no se detectaron acordes en lugar de una rejilla vacía

### Requirement: Sincronización con la reproducción

El sistema SHALL resaltar el acorde activo según el tiempo actual del reproductor con una latencia perceptible menor a 250 ms y SHALL desplazar la rejilla para mantener visible el acorde activo.

#### Scenario: Cambio de acorde durante la reproducción

- **WHEN** el tiempo de reproducción entra en el intervalo de un segmento
- **THEN** la fila de ese segmento se marca como activa
- **AND** la fila anterior deja de estar activa

#### Scenario: Pausa y reanudación

- **WHEN** el usuario pausa el reproductor
- **THEN** el acorde activo se mantiene en el último tiempo reproducido
- **AND** al reanudar la sincronización continúa desde el nuevo tiempo

#### Scenario: Búsqueda manual en el reproductor

- **WHEN** el usuario arrastra la barra de progreso a otro punto
- **THEN** la rejilla actualiza el acorde activo al segmento correspondiente a ese tiempo

### Requirement: Navegación por acordes

El sistema SHALL permitir al usuario seleccionar una fila de la rejilla para saltar la reproducción al inicio de ese segmento.

#### Scenario: Salto a un acorde

- **WHEN** el usuario hace clic en la fila del acorde que comienza en `01:24`
- **THEN** el reproductor salta a `01:24`
- **AND** esa fila pasa a mostrarse como activa

#### Scenario: Salto con el reproductor pausado

- **WHEN** el usuario selecciona una fila mientras la reproducción está pausada
- **THEN** el reproductor se posiciona en ese tiempo sin iniciar la reproducción automáticamente

### Requirement: Accesibilidad de la rejilla

El sistema SHALL hacer la rejilla navegable por teclado y SHALL anunciar el acorde activo a las tecnologías de asistencia sin interrumpir la reproducción.

#### Scenario: Navegación por teclado

- **WHEN** el usuario recorre la rejilla con las flechas arriba y abajo
- **THEN** el foco se mueve entre filas
- **AND** la fila enfocada puede activarse con Intro para saltar a su tiempo

#### Scenario: Anuncio del acorde activo

- **WHEN** el acorde activo cambia durante la reproducción
- **THEN** el nuevo acorde se publica en una región accesible de tipo estado sin robar el foco
