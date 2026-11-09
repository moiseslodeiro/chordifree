# Spec Delta

## Purpose

Define los pulsos que acompañan al análisis y presenta la línea de tiempo como filas de ocho pulsos —dos compases de cuatro tiempos— alineadas con la reproducción y navegables.

## ADDED Requirements

### Requirement: Pulsos en el resultado del análisis

El resultado del análisis SHALL incluir los pulsos detectados en segundos, estrictamente crecientes y dentro de la duración, y el número de tiempos por compás; el analizador y el servidor SHALL propagarlos sin recortarlos.

#### Scenario: Análisis con pulsos detectados

- **WHEN** se analiza un audio con ritmo detectable
- **THEN** el resultado incluye `beats` con al menos dos valores crecientes dentro de `[0, duration]`
- **AND** incluye `beatsPerBar` con valor `4`

#### Scenario: Análisis sin pulsos

- **WHEN** el analizador no puede detectar pulsos
- **THEN** el resultado devuelve `beats` vacío y un `beatsPerBar` válido
- **AND** el análisis no se marca como fallido por ello

#### Scenario: Pulsos inválidos del analizador

- **WHEN** el analizador devuelve pulsos no finitos, desordenados o fuera de la duración
- **THEN** el servidor los descarta y devuelve una lista vacía
- **AND** no expone datos que rompan la parrilla

#### Scenario: Invalidación de la caché anterior

- **WHEN** el usuario abre una canción cacheada con una versión de analizador anterior sin pulsos
- **THEN** la caché se considera obsoleta y se realiza un análisis nuevo

#### Scenario: Pulsos incompletos en una canción guardada

- **WHEN** los pulsos guardados terminan antes que la duración del audio
- **THEN** la parrilla prolonga la rejilla con el intervalo mediano de los pulsos
- **AND** la línea de tiempo cubre la canción hasta el final en lugar de cortarse

### Requirement: Filas de ocho pulsos en compases de cuatro tiempos

El sistema SHALL agrupar los pulsos en filas de ocho casillas —dos compases de cuatro tiempos— empezando por el primer pulso detectado, separar visualmente cada compás, mostrar en un canal lateral el tiempo de inicio y el número del primer compás de la fila, dejar vacías las casillas que falten en la última fila y mantener visibles las ocho columnas.

#### Scenario: Filas completas

- **WHEN** el análisis devuelve veinticuatro pulsos
- **THEN** la parrilla muestra tres filas de ocho celdas
- **AND** cada fila se divide visualmente en dos compases de cuatro celdas

#### Scenario: Última fila incompleta

- **WHEN** el análisis devuelve dieciocho pulsos
- **THEN** la tercera fila muestra dos celdas con pulso y seis celdas vacías
- **AND** las celdas vacías no se pueden activar ni simulan acordes

#### Scenario: Canal lateral de tiempo y compás

- **WHEN** una fila contiene varios compases
- **THEN** el canal lateral muestra el tiempo de inicio de la fila y el número del primer compás
- **AND** las marcas no se solapan con las etiquetas de acorde ni con las celdas
- **AND** cada compás se distingue con un separador vertical más marcado

#### Scenario: Pantalla estrecha

- **WHEN** la parrilla no cabe en el ancho disponible
- **THEN** la fila conserva sus ocho casillas y se desplaza horizontalmente solo por debajo del punto de ruptura móvil
- **AND** en pantallas de escritorio las ocho columnas se reparten el ancho disponible sin scroll horizontal

### Requirement: Acorde vigente en cada celda

Cada celda de pulso SHALL mostrar el acorde vigente al inicio de ese pulso; las celdas consecutivas con el mismo acorde SHALL agruparse visualmente y los silencios SHALL mostrarse de forma explícita.

#### Scenario: Acorde sostenido

- **WHEN** el mismo acorde cubre cuatro pulsos consecutivos
- **THEN** la fila muestra una sola etiqueta de acorde que abarca esas celdas

#### Scenario: Cambio de acorde

- **WHEN** el acorde cambia entre el segundo y el tercer pulso de un compás
- **THEN** la etiqueta del nuevo acorde aparece en la celda del tercer pulso

#### Scenario: Silencio

- **WHEN** no hay acorde detectable en un pulso
- **THEN** la celda muestra una indicación explícita de silencio o ausencia de acorde

### Requirement: Resaltado del pulso activo

El sistema SHALL resaltar la celda del pulso activo según el tiempo de reproducción con una latencia perceptible menor a 250 ms y SHALL desplazar la parrilla para mantener visible la fila activa.

#### Scenario: Reproducción continua

- **WHEN** el tiempo de reproducción alcanza el inicio de un pulso
- **THEN** su celda se marca como activa
- **AND** la celda anterior deja de estarlo

#### Scenario: Cambio de fila

- **WHEN** el pulso activo entra en una fila que no está visible
- **THEN** la parrilla se desplaza para mostrar esa fila
- **AND** no interrumpe un desplazamiento manual reciente del usuario

#### Scenario: Pausa y reanudación

- **WHEN** el usuario pausa la reproducción
- **THEN** la celda activa se mantiene en el último pulso reproducido
- **AND** al reanudar el resaltado continúa desde el nuevo tiempo

#### Scenario: Búsqueda manual

- **WHEN** el usuario mueve la barra de progreso a otro punto
- **THEN** la parrilla resalta el pulso correspondiente a ese tiempo

### Requirement: Navegación y accesibilidad de la parrilla

La parrilla SHALL ser navegable por teclado, SHALL permitir saltar al inicio de un pulso con clic o Intro y SHALL anunciar el acorde activo a las tecnologías de asistencia sin robar el foco.

#### Scenario: Salto a un pulso

- **WHEN** el usuario hace clic en la celda de un pulso o la activa con Intro
- **THEN** la reproducción salta al tiempo de ese pulso
- **AND** la celda pasa a mostrarse como activa

#### Scenario: Navegación con flechas

- **WHEN** el usuario recorre la parrilla con las flechas
- **THEN** el foco se mueve entre las ocho celdas de la fila y entre filas
- **AND** cada celda anuncia su tiempo, compás y acorde

#### Scenario: Inicio y final

- **WHEN** el usuario pulsa Home o End dentro de la parrilla
- **THEN** el foco va a la primera o a la última celda con pulso
- **AND** la parrilla desplaza esa fila a la vista

#### Scenario: Anuncio del acorde activo

- **WHEN** el acorde o el pulso activo cambia durante la reproducción
- **THEN** el nuevo acorde se publica en una región accesible de tipo estado sin mover el foco

### Requirement: Vista de lista y degradación sin pulsos

El sistema SHALL permitir alternar entre la parrilla por tiempos y la lista de segmentos, SHALL conservar el tiempo de reproducción al cambiar de vista y SHALL usar la lista con un aviso cuando no haya pulsos.

#### Scenario: Cambio de vista

- **WHEN** el usuario alterna entre parrilla y lista durante la reproducción
- **THEN** el tiempo de reproducción no cambia
- **AND** la vista elegida se aplica a la canción actual

#### Scenario: Canción sin pulsos

- **WHEN** la canción no tiene pulsos, por ejemplo una canción guardada antes de este cambio
- **THEN** la aplicación muestra la vista de lista con un aviso de que no se detectaron pulsos
- **AND** la reproducción y la edición siguen disponibles

#### Scenario: Persistencia de la vista

- **WHEN** el usuario elige la parrilla o la lista y recarga la página
- **THEN** se restaura la vista elegida
- **AND** si la canción no tiene pulsos se mantiene la lista
