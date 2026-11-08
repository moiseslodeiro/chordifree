# Spec Delta

## Purpose

Permitir al usuario corregir los acordes y tiempos detectados automáticamente para que el cifrado final refleje lo que realmente suena.

## ADDED Requirements

### Requirement: Entrada y salida del modo de edición

El sistema SHALL ofrecer un modo de edición explícito sobre una línea de tiempo cargada, con acciones para guardar o descartar los cambios.

#### Scenario: Activación de la edición

- **WHEN** el usuario activa el modo de edición
- **THEN** la rejilla habilita la modificación de acordes y tiempos
- **AND** aparecen las acciones de guardar y descartar

#### Scenario: Descarte de cambios

- **WHEN** el usuario descarta los cambios después de modificar dos segmentos
- **THEN** la línea de tiempo vuelve al estado anterior a la edición

### Requirement: Corrección del acorde de un segmento

El sistema SHALL permitir sustituir el acorde de un segmento por otro escrito en notación inglesa o española, o marcarlo como ausencia de acorde.

#### Scenario: Corrección válida

- **WHEN** el usuario cambia el acorde de un segmento de `Am` a `A7`
- **THEN** la rejilla muestra `A7` en ese segmento
- **AND** el resto de segmentos no cambia

#### Scenario: Entrada inválida

- **WHEN** el usuario introduce `H7` como acorde
- **THEN** el sistema muestra un error de validación y conserva el acorde anterior

#### Scenario: Marcado como silencio

- **WHEN** el usuario marca un segmento como ausencia de acorde
- **THEN** ese segmento se muestra como silencio y no como acorde

### Requirement: Ajuste de las marcas de tiempo

El sistema SHALL permitir modificar el inicio y el fin de un segmento sin crear solapamientos ni huecos negativos.

#### Scenario: Ajuste dentro de los límites

- **WHEN** el usuario adelanta el inicio de un segmento a un tiempo posterior al fin del segmento anterior
- **THEN** el nuevo tiempo se guarda y el segmento anterior se recorta o mantiene según corresponda
- **AND** la línea de tiempo sigue ordenada y sin solapamientos

#### Scenario: Ajuste fuera de límites

- **WHEN** el usuario intenta fijar el fin de un segmento antes de su inicio
- **THEN** el sistema rechaza el cambio y muestra un mensaje explicativo

### Requirement: División y fusión de segmentos

El sistema SHALL permitir dividir un segmento en dos en un tiempo intermedio y fusionar dos segmentos adyacentes en uno solo.

#### Scenario: División de un segmento

- **WHEN** el usuario divide el segmento `00:30–00:50` en `00:40`
- **THEN** resultan dos segmentos `00:30–00:40` y `00:40–00:50` con el mismo acorde

#### Scenario: Fusión de segmentos adyacentes

- **WHEN** el usuario fusiona dos segmentos contiguos con acordes distintos
- **THEN** se crea un único segmento que abarca ambos tiempos
- **AND** el acorde resultante es el del primer segmento, salvo que el usuario lo cambie

#### Scenario: Fusión no adyacente

- **WHEN** el usuario intenta fusionar dos segmentos separados por otro segmento
- **THEN** el sistema no ofrece la acción de fusión para esa pareja

### Requirement: Deshacer y rehacer

El sistema SHALL permitir deshacer y rehacer las modificaciones de la sesión de edición en orden inverso.

#### Scenario: Deshacer una corrección

- **WHEN** el usuario deshace después de cambiar un acorde
- **THEN** el acorde vuelve al valor anterior

#### Scenario: Rehacer tras deshacer

- **WHEN** el usuario rehace inmediatamente después de deshacer
- **THEN** la modificación deshecha se aplica de nuevo

### Requirement: Guardado de la línea de tiempo editada

El sistema SHALL guardar la línea de tiempo corregida asociada a la canción y SHALL conservar la versión detectada original para poder restaurarla.

#### Scenario: Guardado de correcciones

- **WHEN** el usuario guarda tras corregir tres acordes
- **THEN** al volver a abrir la canción se muestran los acordes corregidos

#### Scenario: Restauración de la detección original

- **WHEN** el usuario solicita restaurar la versión detectada
- **THEN** la línea de tiempo vuelve a los valores producidos por el análisis
- **AND** se pide confirmación antes de descartar las correcciones
