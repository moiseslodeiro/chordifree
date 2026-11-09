# lyrics-chord-sheet Specification

## Purpose

Permite guardar la letra de una canción y leerla con los acordes colocados automáticamente sobre las líneas, siguiendo la reproducción de forma aproximada y coherente con la tonalidad y el capo actuales.

## Requirements

### Requirement: Letra asociada a la canción

Cada canción SHALL poder guardar una letra opcional como texto plano, conservando saltos de línea y espacios. La letra SHALL persistir con la canción en la biblioteca local, incluirse en las copias de seguridad e ignorarse sin errores cuando no exista.

#### Scenario: Guardar y recuperar la letra

- **WHEN** el usuario guarda una letra para una canción
- **THEN** la letra se conserva al cerrar y volver a abrir la canción
- **AND** también se conserva al recargar la página

#### Scenario: Canción sin letra

- **WHEN** se abre una canción creada antes de este cambio o sin letra guardada
- **THEN** la canción carga con normalidad
- **AND** la vista Letra muestra un estado vacío con la opción de añadirla

#### Scenario: Copia de seguridad

- **WHEN** se exporta la biblioteca a JSON y se vuelve a importar
- **THEN** las letras guardadas se incluyen en la copia
- **AND** se restauran junto con sus canciones

#### Scenario: Eliminar la letra

- **WHEN** el usuario borra el contenido de la letra y guarda
- **THEN** la canción queda sin letra
- **AND** la vista Letra vuelve a su estado vacío

### Requirement: Edición manual de la letra

La vista Letra SHALL ofrecer un editor para pegar o modificar el texto y guardarlo de forma explícita. El editor SHALL distinguir entre cambios sin guardar y letra persistida, y SHALL descartar el borrador al cancelar.

#### Scenario: Pegar una letra

- **WHEN** el usuario pega varias líneas en el editor y pulsa guardar
- **THEN** la letra queda asociada a la canción
- **AND** la vista muestra las líneas con sus acordes

#### Scenario: Cancelar la edición

- **WHEN** el usuario modifica el texto y pulsa cancelar
- **THEN** se conserva la letra guardada anteriormente
- **AND** el borrador se descarta

#### Scenario: Texto vacío o solo espacios

- **WHEN** el usuario guarda un texto compuesto solo por espacios o saltos de línea
- **THEN** la canción se considera sin letra

### Requirement: Alineación automática por tiempo

El sistema SHALL repartir las líneas no vacías sobre el tramo comprendido entre el primer y el último acorde, excluyendo los tramos instrumentales detectados, y SHALL asignar cada cambio de acorde a la línea cuyo intervalo contiene su tiempo de inicio. Dentro de cada línea, los acordes SHALL ordenarse por tiempo y colocarse con una posición horizontal proporcional, sin solaparse.

#### Scenario: Reparto uniforme de líneas

- **WHEN** hay cuatro líneas no vacías y el tramo musical dura cuarenta segundos
- **THEN** cada línea cubre diez segundos
- **AND** un acorde que empieza en el segundo quince se muestra sobre la segunda línea

#### Scenario: Líneas vacías como separadores

- **WHEN** la letra contiene líneas vacías entre estrofas
- **THEN** las líneas vacías se conservan visualmente
- **AND** no reciben acordes ni alteran el reparto de las líneas no vacías

#### Scenario: Acordes en un tramo instrumental

- **WHEN** un cambio de acorde cae dentro de un tramo instrumental detectado
- **THEN** no se muestra sobre ninguna línea de letra
- **AND** el tramo instrumental queda sin capa de acordes

#### Scenario: Varios acordes en una línea

- **WHEN** dos o más acordes empiezan dentro de la misma línea
- **THEN** se muestran en orden temporal
- **AND** se separan lo suficiente para que sus etiquetas no se solapen

#### Scenario: Canción sin acordes

- **WHEN** la canción tiene letra pero no tiene acordes
- **THEN** la letra se muestra sin capa de acordes
- **AND** el editor sigue disponible

#### Scenario: Cambios en la letra o en los acordes

- **WHEN** el usuario guarda una letra distinta o la línea de acordes cambia
- **THEN** la alineación se recalcula automáticamente
- **AND** no se guardan posiciones manuales

### Requirement: Intros, interludios y anclas de tiempo

El sistema SHALL detectar de forma conservadora tramos instrumentales mediante la repetición de frases de acordes y SHALL excluirlos del reparto de líneas. La intro solo SHALL descartarse si la primera aparición de la frase principal llega dentro de los primeros 16 compases; si aparece más tarde, el sistema SHALL usar el reparto uniforme en lugar de inventar una intro gigante. También SHALL aceptar un ancla `[mm:ss]` al inicio de una línea para fijar su tiempo y SHALL ofrecer acciones para insertar el tiempo actual en la línea seleccionada o en la primera línea con texto.

#### Scenario: Intro instrumental

- **WHEN** la canción empieza con compases que no forman parte de la frase principal y esa frase aparece en los primeros 16 compases
- **THEN** la primera línea de letra empieza después de esos compases
- **AND** los acordes de la intro no se muestran sobre una línea de letra

#### Scenario: Frase principal tardía

- **WHEN** la primera aparición exacta de la frase más repetida llega después de los primeros 16 compases
- **THEN** no se marca ese tramo como intro
- **AND** la letra se reparte de forma uniforme para no desplazarla minutos fuera de su sitio

#### Scenario: Interludio instrumental

- **WHEN** hay un tramo largo sin progresión propia entre dos apariciones de la frase principal
- **THEN** el reparto de líneas omite ese tramo
- **AND** sus acordes no se asignan a una línea de letra

#### Scenario: Heurística no concluyente

- **WHEN** no hay una frase de acordes repetida el número suficiente de veces
- **THEN** se usa el reparto uniforme anterior
- **AND** la letra sigue visible y navegable

#### Scenario: Ancla manual

- **WHEN** una línea empieza por `[01:12]`
- **THEN** esa línea se fija al segundo 72
- **AND** el marcador no se muestra como parte del texto de la letra

#### Scenario: Anclar al tiempo actual

- **WHEN** el usuario pulsa «Anclar línea» con el cursor en una línea o «Anclar inicio»
- **THEN** se inserta el tiempo del reproductor al inicio de esa línea o de la primera línea con texto
- **AND** el texto restante de la línea se conserva

### Requirement: Coherencia con la presentación de acordes

Los acordes mostrados sobre la letra SHALL usar la misma notación, alteraciones, transporte, capo y simplificación que la parrilla. La reducción normal SHALL aplicarse a la letra, pero la reducción máxima SHALL limitarse a la parrilla para no mover los tiempos reales de los cambios de acorde.

#### Scenario: Transporte y capo

- **WHEN** el usuario transporta la canción o cambia el capo
- **THEN** los acordes de la letra cambian igual que en la parrilla
- **AND** la letra permanece intacta

#### Scenario: Simplificación y reducción

- **WHEN** el usuario activa la simplificación o la reducción normal
- **THEN** la letra muestra los acordes simplificados o reducidos
- **AND** la alineación se recalcula con los cambios visibles

#### Scenario: Reducción máxima

- **WHEN** el usuario activa la reducción máxima
- **THEN** la parrilla muestra como mucho un acorde por compás
- **AND** la letra conserva los cambios y tiempos reales para no desalinearse

#### Scenario: Notación y alteraciones

- **WHEN** el usuario cambia entre notación inglesa y española o entre sostenidos y bemoles
- **THEN** los acordes de la letra usan la misma representación que la parrilla

### Requirement: Seguimiento de la reproducción y salto

Durante la reproducción, la vista Letra SHALL resaltar la línea y el acorde vigentes. Pulsar una línea o un acorde SHALL buscar el tiempo correspondiente en el reproductor.

#### Scenario: Línea activa

- **WHEN** la reproducción entra en el intervalo de una línea
- **THEN** esa línea se resalta
- **AND** el acorde vigente dentro de la línea también se distingue

#### Scenario: Salto por clic o teclado

- **WHEN** el usuario activa una línea o un acorde con ratón o teclado
- **THEN** la reproducción salta al inicio de esa línea o al tiempo del acorde
- **AND** el reloj y la parrilla quedan sincronizados

#### Scenario: Reproductor no disponible

- **WHEN** no hay reproductor o reloj de reproducción
- **THEN** la letra y los acordes siguen siendo legibles
- **AND** no se muestra ningún resaltado activo

### Requirement: Vista Letra y preferencia de presentación

El selector de vistas de la canción SHALL incluir Letra junto a Parrilla y Lista. La elección SHALL persistir entre recargas y las preferencias antiguas SHALL seguir siendo válidas sin migración destructiva.

#### Scenario: Cambiar a la vista Letra

- **WHEN** el usuario pulsa Letra
- **THEN** la línea de tiempo muestra la letra con los acordes
- **AND** la preferencia de vista se actualiza

#### Scenario: Recargar con la vista Letra

- **WHEN** el usuario recarga una canción con letra estando en la vista Letra
- **THEN** la vista Letra se recupera
- **AND** la letra y sus acordes siguen visibles

#### Scenario: Preferencias antiguas

- **WHEN** una preferencia guardada solo contiene Parrilla o Lista
- **THEN** se sigue aplicando sin errores
- **AND** la vista Letra queda disponible para elegirla

#### Scenario: Vista Letra sin letra

- **WHEN** el usuario entra en Letra sin haber guardado texto
- **THEN** ve un estado vacío con la acción de añadir la letra
- **AND** puede volver a Parrilla o Lista sin perder la canción

### Requirement: Presentación segura y accesible

La letra SHALL renderizarse siempre como texto, nunca como HTML, y cada línea SHALL ser identificable por lectores de pantalla. El editor SHALL tener una etiqueta accesible y la línea activa SHALL comunicarse sin depender solo del color.

#### Scenario: Texto con etiquetas HTML

- **WHEN** la letra contiene texto como `<b>Hola</b>`
- **THEN** se muestra literalmente como texto
- **AND** no se interpreta ni ejecuta como HTML

#### Scenario: Navegación accesible

- **WHEN** un lector de pantalla recorre la vista Letra
- **THEN** reconoce la letra como una lista de líneas
- **AND** la línea activa se anuncia mediante un estado accesible
- **AND** los acordes indican su etiqueta y su tiempo
