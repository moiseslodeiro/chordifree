# Spec Delta

## Purpose

Definir cómo se representan, escriben y trasponen los acordes para que una misma línea de tiempo pueda mostrarse en notación inglesa o española y en cualquier tonalidad.

## ADDED Requirements

### Requirement: Representación canónica del acorde

El sistema SHALL representar cada acorde de forma independiente de su notación de pantalla, con una fundamental, una cualidad y una bajo opcional.

#### Scenario: Acorde con bajo invertido

- **WHEN** el sistema recibe el acorde `C/G`
- **THEN** lo interpreta como fundamental `C`, cualidad mayor y bajo `G`
- **AND** conserva el bajo al cambiar de notación o trasponer

#### Scenario: Etiqueta de acorde no reconocida

- **WHEN** la detección devuelve una etiqueta que no puede interpretarse
- **THEN** el sistema la descarta y registra el segmento como acorde desconocido
- **AND** no impide mostrar el resto de la línea de tiempo

### Requirement: Notación inglesa

El sistema SHALL mostrar los acordes en notación inglesa usando las letras `A` a `G`, con `#` para sostenidos y `b` para bemoles.

#### Scenario: Acorde menor en inglés

- **WHEN** la notación activa es inglesa y el acorde es un menor de La
- **THEN** la rejilla muestra `Am`

#### Scenario: Acorde con séptima mayor en inglés

- **WHEN** la notación activa es inglesa y el acorde es un Do con séptima mayor
- **THEN** la rejilla muestra `Cmaj7`

### Requirement: Notación española o latina

El sistema SHALL mostrar los acordes en notación española usando `Do`, `Re`, `Mi`, `Fa`, `Sol`, `La` y `Si`, manteniendo los símbolos de alteración y de cualidad.

#### Scenario: Acorde menor en español

- **WHEN** la notación activa es española y el acorde es un menor de La
- **THEN** la rejilla muestra `Lam`

#### Scenario: Acorde sostenido en español

- **WHEN** la notación activa es española y el acorde es un Fa sostenido mayor
- **THEN** la rejilla muestra `Fa#`

#### Scenario: Cualidad sin traducción

- **WHEN** la notación activa es española y el acorde es un Do con séptima mayor
- **THEN** la rejilla muestra `Domaj7`
- **AND** el sufijo de cualidad no se traduce

### Requirement: Cambio de notación

El sistema SHALL permitir alternar entre notación inglesa y española sin volver a analizar el audio ni perder la posición de reproducción.

#### Scenario: Alternancia en reproducción

- **WHEN** el usuario cambia la notación mientras el video se reproduce en `01:10`
- **THEN** toda la rejilla se vuelve a escribir en la nueva notación
- **AND** la reproducción continúa desde `01:10`

### Requirement: Trasposición cromática

El sistema SHALL permitir trasponer la línea de tiempo entre -11 y +11 semitonos, aplicando el desplazamiento a la fundamental y al bajo de cada acorde.

#### Scenario: Trasposición ascendente

- **WHEN** el usuario traspone +2 semitonos una línea con `C`, `Am` y `F`
- **THEN** la rejilla muestra `D`, `Bm` y `G`

#### Scenario: Desplazamiento envolvente

- **WHEN** el usuario traspone +1 semitono un acorde de `B`
- **THEN** el acorde resultante es `C`
- **AND** no se muestran notas fuera de las doce clases de altura

#### Scenario: Trasposición de un acorde invertido

- **WHEN** el usuario traspone +2 semitonos el acorde `C/G`
- **THEN** la rejilla muestra `D/A`

### Requirement: Ortografía enarmónica

El sistema SHALL elegir sostenidos o bemoles de forma coherente con la tonalidad resultante y SHALL permitir al usuario forzar una preferencia.

#### Scenario: Tonalidad con bemoles

- **WHEN** la línea se traspone a Fa mayor y el usuario no ha forzado preferencia
- **THEN** las notas alteradas se escriben con bemoles, como `Bb`

#### Scenario: Preferencia forzada

- **WHEN** el usuario selecciona escritura con sostenidos
- **THEN** las notas alteradas se escriben con `#` aunque la tonalidad sugiera bemoles

### Requirement: Persistencia de las preferencias de notación

El sistema SHALL recordar la notación y la preferencia enarmónica del usuario entre sesiones en el mismo navegador.

#### Scenario: Reapertura de la aplicación

- **WHEN** el usuario había elegido notación española y vuelve a abrir la aplicación
- **THEN** la notación activa sigue siendo española
