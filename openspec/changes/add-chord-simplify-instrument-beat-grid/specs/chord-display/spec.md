# Spec Delta

## Purpose

Define cómo se presentan los acordes al usuario: simplificación de calidad, reducción a los acordes importantes de la canción, diagramas según el instrumento elegido y una disposición en dos columnas que prioriza la rejilla de acompañamiento.

## ADDED Requirements

### Requirement: Simplificación visual de acordes

El sistema SHALL ofrecer un modo reversible que reduzca las tensiones, extensiones y suspensiones de cada acorde a su tríada básica —conservando la séptima de dominante— y elimine el bajo invertido, sin modificar los segmentos guardados ni los detectados.

#### Scenario: Acorde con extensión

- **WHEN** el modo de simplificación está activo y aparece `Cmaj7`
- **THEN** la interfaz muestra `C`
- **AND** el segmento guardado conserva `Cmaj7`

#### Scenario: Séptima de dominante

- **WHEN** el modo de simplificación está activo y aparece `G7`
- **THEN** la interfaz muestra `G7`
- **AND** el diagrama de instrumento incluye la séptima

#### Scenario: Acorde con inversión

- **WHEN** el modo de simplificación está activo y aparece `C/G`
- **THEN** la interfaz muestra `C`

#### Scenario: Alteraciones

- **WHEN** la tonalidad o la preferencia usan bemoles
- **THEN** los acordes se muestran con el símbolo `♭` (`Si♭m`, `Re♭`, `Fa7`)
- **AND** los sostenidos usan el símbolo `♯` en el selector de alteraciones

#### Scenario: Desactivar la simplificación

- **WHEN** el usuario desactiva el modo de simplificación
- **THEN** la interfaz vuelve a mostrar la calidad y el bajo originales

### Requirement: Reducción a los acordes importantes

El sistema SHALL ofrecer un modo reversible de reducción que aplique la simplificación de calidad, agrupe segmentos consecutivos con el mismo acorde y absorba los acordes de paso que duren una pulsación o menos cuando estén rodeados por acordes más largos, sin alterar la línea de tiempo guardada ni el editor.

#### Scenario: Acordes repetidos

- **WHEN** el modo de reducción está activo y dos segmentos consecutivos comparten el mismo acorde
- **THEN** la rejilla muestra una sola aparición de ese acorde
- **AND** el tiempo cubierto se extiende hasta el inicio del siguiente acorde distinto

#### Scenario: Acorde de paso

- **WHEN** un acorde dura una pulsación o menos y está rodeado por acordes más largos (o por el mismo acorde a ambos lados)
- **THEN** la rejilla lo absorbe en el acorde vecino más estable
- **AND** el acorde de paso no aparece como una casilla propia

#### Scenario: Acorde estable

- **WHEN** un acorde dura más de una pulsación
- **THEN** la rejilla lo conserva como una casilla propia

#### Scenario: Progresión con cambios en cada pulsación

- **WHEN** todos los acordes de un tramo duran una pulsación y no hay vecinos más largos
- **THEN** la reducción conserva todos los acordes del tramo
- **AND** no colapsa la armonía real de la canción

#### Scenario: Canción con un único acorde breve

- **WHEN** la reducción dejaría la canción sin ningún acorde
- **THEN** se conserva al menos el acorde de mayor duración
- **AND** la rejilla sigue mostrando contenido

#### Scenario: Reversibilidad y edición

- **WHEN** el usuario desactiva la reducción o abre el editor
- **THEN** se muestran todos los segmentos originales
- **AND** ninguna operación de edición ve la línea de tiempo reducida

### Requirement: Selector de instrumento y diagrama del acorde

El sistema SHALL permitir elegir entre guitarra, piano y ukelele y SHALL mostrar el diagrama o voicing del acorde activo y de cada acorde de la rejilla con la fundamental y la calidad ya transpuestas y, si corresponde, reducidas.

#### Scenario: Cambio de instrumento

- **WHEN** el usuario cambia el instrumento en el selector
- **THEN** el diagrama del acorde activo usa el nuevo instrumento
- **AND** la elección se conserva al recargar la página

#### Scenario: Acorde sin digitación

- **WHEN** el acorde no tiene una forma disponible para el instrumento elegido
- **THEN** la interfaz muestra su nombre y un aviso de "sin digitación"
- **AND** el resto de la vista sigue siendo operable

### Requirement: Disposición en dos columnas

La vista de canción SHALL organizar la rejilla de acordes en la columna izquierda y el video compacto con las herramientas en la columna derecha en pantallas anchas, y SHALL apilar ambos bloques en pantallas estrechas manteniendo todas las funciones accesibles.

#### Scenario: Pantalla ancha

- **WHEN** la vista de canción se muestra en una pantalla ancha
- **THEN** la rejilla de acordes ocupa la columna izquierda con todo el ancho libre
- **AND** el video y las herramientas ocupan una columna derecha compacta
- **AND** el video se ajusta al ancho de su columna sin recortarse ni deformarse
- **AND** la parrilla reparte sus ocho columnas sin scroll horizontal

#### Scenario: Pantalla estrecha

- **WHEN** la vista de canción se muestra en una pantalla estrecha
- **THEN** la rejilla y el bloque de video y herramientas se apilan en una sola columna
- **AND** el video y el transporte quedan visibles antes de desplazarse por una rejilla larga

#### Scenario: Modo de edición

- **WHEN** el usuario entra en el modo de edición
- **THEN** el editor sustituye a la rejilla en la columna izquierda
- **AND** el video y las herramientas de la derecha siguen disponibles

### Requirement: Tema claro y oscuro

El sistema SHALL ofrecer un tema claro y un tema oscuro, SHALL usar el tema claro como valor inicial y SHALL conservar la elección del usuario entre recargas.

#### Scenario: Tema inicial

- **WHEN** el usuario abre la aplicación por primera vez
- **THEN** la interfaz usa el tema claro
- **AND** todos los textos, paneles y controles mantienen contraste suficiente

#### Scenario: Cambio de tema

- **WHEN** el usuario alterna el tema desde la cabecera
- **THEN** toda la interfaz cambia de forma inmediata sin recargar
- **AND** la elección se restaura en la siguiente visita

#### Scenario: Preferencia antigua

- **WHEN** un usuario con preferencias guardadas anteriores no tiene tema almacenado
- **THEN** la aplicación carga el tema claro sin descartar el resto de preferencias
