const STORAGE_KEY = 'chordifree-landing-lang';

const spanish = {
  'a11y.skip': 'Saltar al contenido',
  'nav.features': 'Funciones',
  'nav.primaryAria': 'Principal',
  'nav.languageAria': 'Idioma',
  'nav.mobileAria': 'Móvil',
  'nav.timeline': 'Línea de tiempo',
  'nav.compare': 'Comparativa',
  'nav.run': 'Ejecutar',
  'nav.faq': 'Preguntas',
  'nav.github': 'GitHub',
  'nav.openMenu': 'Abrir menú',
  'nav.closeMenu': 'Cerrar menú',
  'nav.menuNote': 'Local first · código abierto',

  'hero.title': 'Acordes que siguen la canción.',
  'hero.lead':
    'Busca en YouTube por nombre o trae tu propio audio y obtén una hoja de acordes sincronizada con pulsos, compases, letra y práctica A–B. Baja el tempo, transpón la canción, canta sobre una mezcla karaoke o separa la canción en pistas en la versión de escritorio. Ejecútala en local o aloja una instancia privada para cuentas aprobadas.',
  'hero.primary': 'Consigue la app',
  'hero.secondary': 'Verla en acción',
  'hero.proofOpen': 'Gratis y de código abierto',
  'hero.proofLanguages': 'Inglés y español',
  'hero.windowTag': 'Vista por compases',
  'hero.caption':
    'La canción de demostración, con una sola barra de reproducción, la vista de compases y el diagrama del acorde activo.',
  'hero.alt':
    'Vista de canción de Chordifree con la barra de reproducción, la barra de herramientas de acordes y la rejilla de compases de la demo, con los acordes Do, Sol, Lam y Fa y el diagrama de guitarra.',

  'sheet.one': 'Toma el',
  'sheet.two': 'siguiente compás,',
  'sheet.three': 'tócalo',
  'sheet.four': 'despacio.',
  'sheet.timeline': 'Línea de tiempo',
  'sheet.bars': '4 compases',
  'sheet.loop': 'Bucle A–B',

  'features.eyebrow': 'Qué hace',
  'features.title': 'Cada acorde sale del audio.',
  'features.lead':
    'Todas las vistas salen del mismo análisis: tonalidad, rejilla de pulsos, compases, acordes y las partes donde alguien canta.',
  'feature.find.title': 'Encuentra',
  'feature.find.body':
    'Busca en YouTube por nombre. Cada resultado muestra la miniatura, el canal y la duración, y un clic analiza la canción.',
  'feature.find.tag': 'Un clic',
  'feature.1.title': 'Detecta',
  'feature.1.body':
    'Essentia lee el audio, estima la tonalidad y encuentra los cambios de acorde. El suavizado de Viterbi evita que la hoja parpadee entre acordes parecidos.',
  'feature.2.title': 'Alinea',
  'feature.2.body':
    'Busca la letra por título y artista, o pega la tuya. Se ajusta a las partes donde alguien canta; cuando una línea se desvía, mueve un ancla y el resto la sigue.',
  'feature.2.tag': 'Regiones vocales',
  'feature.3.title': 'Practica',
  'feature.3.body':
    'Marca A y B en la rejilla, previsualiza un compás al pasar el ratón y reproduce el rango o ponlo en bucle. Baja el tempo, transpón la canción y cuenta antes de empezar. La hoja sigue la reproducción y, en escritorio, puede marcar el acorde con el micrófono.',
  'feature.3.tag': 'Bucle A–B',
  'feature.4.title': 'Ajusta',
  'feature.4.body':
    'Transpone los acordes, añade cejilla, simplifica o redúcelos. Cambia entre diagramas de guitarra, piano y ukelele, con sostenidos, bemoles o solfeo.',
  'feature.4.tag': 'Guitarra · piano · uke',
  'feature.5.title': 'Guarda',
  'feature.5.body':
    'Guarda canciones y repertorios en tu navegador, en tu equipo o en una instancia online privada vinculada a tu cuenta de Google. Exporta ChordPro, MusicXML o un MIDI multipista con el bajo y la batería transcritos, imprime un PDF, haz una copia en JSON o comparte la hoja.',
  'feature.5.tag': 'Local o nube privada',
  'feature.6.title': 'Separa',
  'feature.6.body':
    'En escritorio, un plugin local divide la canción en voz, batería, bajo y otros. Reproduce las cuatro pistas sincronizadas, cada una con su volumen, escucha una pista cada vez o exporta el resultado. Las separaciones se guardan en una caché local que puedes vaciar.',
  'feature.6.tag': 'Escritorio · en tu equipo',

  'features.searchTag': 'Búsqueda en YouTube',
  'features.searchCaption':
    'Busca por nombre, revisa el canal y carga un resultado con un clic.',
  'features.searchAlt':
    'Búsqueda de Radiohead Creep en Chordifree con miniaturas, nombres de canal, duraciones y un botón Analizar junto a cada resultado.',

  'product.eyebrow': 'La línea de tiempo',
  'product.title': 'Mira cada compás antes de tocarlo.',
  'product.lead':
    'La rejilla da una celda a cada pulso y agrupa los compases en filas. El pulso activo sigue la reproducción para que siempre sepas dónde estás.',
  'product.windowTag': 'Rejilla de pulsos',
  'product.caption1': 'Dos compases por fila',
  'product.caption2': 'El pulso activo sigue la reproducción',
  'product.caption3': 'Haz clic en un compás para saltar o repetir',
  'product.caption4': 'Diagrama del acorde actual',
  'product.alt':
    'Parrilla de pulsos de la demo de Chordifree, con dos compases por fila, cuatro pulsos por compás y los acordes Do, Sol, Lam y Fa.',

  'compare.eyebrow': 'Comparativa',
  'compare.title': 'Cómo se compara.',
  'compare.lead':
    'Chordifree cubre el flujo de práctica con tu propio audio y tu propia biblioteca. Símbolos: ✓ sí, ~ limitado o de pago, — no.',
  'compare.caption':
    'Comparativa de funciones entre Chordifree, Chordify, Moises y Ultimate Guitar.',
  'compare.feature': 'Función',
  'compare.sync': 'Acordes sincronizados',
  'compare.edit': 'Hoja de acordes editable',
  'compare.export': 'ChordPro · MusicXML · MIDI',
  'compare.karaoke': 'Karaoke / quitar la voz',
  'compare.stems': 'Mezclador de cuatro pistas',
  'compare.offline': 'Funciona sin conexión',
  'compare.open': 'Código abierto / autoalojado',
  'compare.free': 'Gratis sin cuenta',
  'compare.web': 'Funciona en el navegador',
  'compare.yes': 'Sí',
  'compare.no': 'No',
  'compare.limited': 'Limitado o de pago',
  'compare.desktop': 'Sí, con el plugin de escritorio',
  'compare.note':
    '✓ sí · ~ limitado o de pago · — no. * El mezclador de cuatro pistas necesita el plugin opcional de escritorio. Las funciones dependen del plan y pueden cambiar.',

  'how.eyebrow': 'Del audio a la práctica',
  'how.title': 'Tres pasos, sin cuenta obligatoria.',
  'how.lead':
    'Trae un enlace o un archivo. El analizador se encarga del tiempo y tú tomas las decisiones musicales. El modo local sigue sin cuentas; la instancia online añade inicio de sesión con Google y sincronización.',
  'how.1.title': 'Añade una fuente',
  'how.1.body':
    'Busca en YouTube por nombre, pega un enlace o elige un archivo de audio. Se admiten MP3, WAV, M4A, OGG, FLAC, WebM y MP4.',
  'how.2.title': 'Deja trabajar al analizador',
  'how.2.body':
    'Los pulsos, compases, la tonalidad y los acordes los detecta el analizador. La primera ejecución carga los modelos y tarda un poco más.',
  'how.3.title': 'Corrige, guarda, practica',
  'how.3.body':
    'Corrige cualquier acorde en el editor, añade la letra y guarda en tu biblioteca o repertorios. En una instancia online privada, la biblioteca también se sincroniza con tu cuenta.',

  'run.eyebrow': 'Ejecútalo a tu manera',
  'run.title': 'Una app de escritorio, o tu propio servidor.',
  'run.lead':
    'La versión de escritorio incluye el analizador. El stack de Docker pone la misma app en un portátil, un servidor doméstico o un VPS. Terraform despliega una instancia online privada en Cloud Run.',
  'run.windows.title': 'Vista previa para Windows',
  'run.windows.badge': 'Sin firma',
  'run.windows.body':
    'Un instalador NSIS generado por CI. Incluye el analizador, ffmpeg y los modelos ONNX. No está firmado, así que SmartScreen avisará: elige Más información y luego Ejecutar de todas formas.',
  'run.windows.note': 'Se publica un checksum SHA-256 con cada release.',
  'run.windows.cta': 'Descargar el instalador',
  'run.windows.guide': 'Guía de instalación',
  'run.macos.title': 'Vista previa para macOS',
  'run.macos.badge': 'Sin notarizar',
  'run.macos.body':
    'Builds DMG y ZIP para Apple Silicon e Intel. Están firmadas de forma ad-hoc, no notarizadas, así que Gatekeeper pedirá permitir la app en Privacidad y seguridad.',
  'run.macos.note':
    'macOS 13 o posterior en Intel, macOS 15 o posterior en Apple Silicon. Se publica un checksum SHA-256 con cada release.',
  'run.macos.cta': 'Descargar el DMG',
  'run.macos.guide': 'Guía de macOS',
  'run.linux.title': 'Vista previa para Linux',
  'run.linux.badge': 'x64',
  'run.linux.body':
    'AppImage y .deb para x86_64. Incluye el analizador, ffmpeg y los modelos ONNX. El AppImage es portable; el .deb se instala con apt.',
  'run.linux.note':
    'Compilado en Ubuntu 22.04 para glibc 2.35 o posterior. El AppImage puede necesitar FUSE. Se publica un checksum SHA-256 con cada release.',
  'run.linux.cta': 'Descargar el AppImage',
  'run.linux.guide': 'Guía de Linux',
  'run.docker.title': 'Docker',
  'run.docker.body':
    'Clona el repositorio y arranca el stack. La primera build instala Essentia, ONNX Runtime, ffmpeg y los modelos.',
  'run.docker.note': 'Después abre http://localhost:3000.',
  'run.docker.cta': 'Guía de Docker',
  'run.copy': 'Copiar',
  'run.copied': 'Copiado',
  'run.codeAria': 'Comandos de Docker',
  'run.pwa.title': 'App web autoalojada',
  'run.pwa.body':
    'Pon la app web detrás de HTTPS para instalarla como PWA. La API y el analizador siguen ejecutándose en el mismo host.',
  'run.pwa.cta': 'Notas de despliegue',
  'run.gcp.title': 'Nube privada en GCP',
  'run.gcp.badge': 'Terraform',
  'run.gcp.body':
    'Despliega la app web y un analizador privado en Cloud Run, guarda la lista de acceso y la biblioteca de cada usuario en Firestore y deja entrar solo a cuentas de Google aprobadas. Ambos servicios escalan a cero y caben en el free tier para uso personal.',
  'run.gcp.note':
    'Inicio de sesión con Google, una página de administración para los accesos y un solo servicio de Cloud Run para la app. Sin balanceador ni IAP. YouTube puede necesitar el extractor residencial opcional o subir el audio.',
  'run.gcp.cta': 'Guía de despliegue en GCP',
  'run.gcp.guide': 'Código Terraform',

  'privacy.eyebrow': 'Local first',
  'privacy.title': 'Tus canciones se quedan contigo.',
  'privacy.lead':
    'Las versiones de escritorio y web local no tienen cuentas ni seguimiento: la biblioteca vive en tu equipo. La instancia online opcional usa Google solo para decidir quién puede entrar y guarda la biblioteca de cada usuario en el proyecto de Firestore que despliegues.',
  'privacy.1.title': 'Sin cuentas por defecto',
  'privacy.1.body':
    'Abre la app local y empieza. El inicio de sesión con Google solo aparece en una instancia online privada.',
  'privacy.2.title': 'Local o tu nube',
  'privacy.2.body':
    'Las canciones, los repertorios y el historial de práctica se quedan en el almacenamiento local por defecto. La instancia online los guarda bajo tu usuario en Firestore y los sincroniza entre dispositivos.',
  'privacy.3.title': 'Tu audio',
  'privacy.3.body':
    'Los archivos se analizan y no se guardan en la biblioteca. Los archivos temporales se eliminan. En Cloud Run se quedan en tu propio proyecto de GCP.',
  'privacy.legal':
    'Descargar audio de YouTube puede contravenir sus Términos de Servicio. Usa la subida de archivo cuando no tengas derechos sobre el contenido.',

  'faq.eyebrow': 'Preguntas',
  'faq.title': 'Antes de empezar.',
  'faq.lead':
    'Las respuestas cortas. El README tiene los detalles, las variables de entorno, el despliegue privado en GCP y la arquitectura.',
  'faq.1.q': '¿Necesito una cuenta?',
  'faq.1.a':
    'No para las versiones de escritorio y web local. La instancia online privada opcional usa inicio de sesión con Google y solo pueden entrar las cuentas que apruebe un administrador.',
  'faq.13.q': '¿Puedo ejecutar una instancia online privada?',
  'faq.13.a':
    'Sí. El stack de Terraform en deploy/gcp despliega la app en Cloud Run, mantiene el analizador privado y guarda la lista de acceso y las bibliotecas en Firestore. Está pensado para el free tier de GCP.',
  'faq.14.q': '¿Quién puede acceder a la instancia online?',
  'faq.14.a':
    'Solo las cuentas de Google de la lista de acceso. Los administradores siempre tienen acceso y pueden añadir o quitar cuentas desde la página de Administración.',
  'faq.15.q': '¿Dónde se guarda la biblioteca online?',
  'faq.15.a':
    'En la base de datos Firestore de tu propio proyecto de GCP, bajo el ID de cada usuario. El navegador guarda una copia y fusiona las canciones y repertorios más recientes.',
  'faq.16.q': '¿La instancia online me rastrea?',
  'faq.16.a':
    'No hay analítica ni anuncios. El inicio de sesión de Google aporta el correo que se usa para la lista de acceso; no se guarda ningún otro dato del perfil.',
  'faq.2.q': '¿Sube mi audio a un tercero?',
  'faq.2.a':
    'No. La app web solo envía el audio a la API y al analizador que tú ejecutas. En el despliegue privado de Cloud Run, ese es tu propio proyecto de GCP, no un servicio de terceros.',
  'faq.3.q': '¿Las versiones de escritorio necesitan Docker?',
  'faq.3.a':
    'No. Los instaladores de Windows, macOS y Linux incluyen el analizador, ffmpeg y los modelos ONNX. Docker es la alternativa para la app web y los servidores.',
  'faq.4.q': '¿La versión de Windows está firmada?',
  'faq.4.a':
    'Todavía no. Es una vista previa generada por CI, así que SmartScreen avisará: elige Más información y luego Ejecutar de todas formas. Verifica el SHA-256 de SHA256SUMS.txt antes de ejecutarlo.',
  'faq.10.q': '¿Por qué macOS bloquea la app?',
  'faq.10.a':
    'La versión de macOS está firmada de forma ad-hoc y no notarizada. Permítela en Ajustes del Sistema → Privacidad y seguridad y vuelve a abrirla. La guía de macOS tiene los pasos.',
  'faq.11.q': '¿Hay una versión para Linux ARM?',
  'faq.11.a':
    'Todavía no. Essentia no publica un wheel de Linux arm64, así que la versión de escritorio para Linux es solo x86_64. Una build ARM requeriría compilar Essentia desde el código fuente.',
  'faq.5.q': '¿Funciona con YouTube?',
  'faq.5.a':
    'Sí, mediante yt-dlp. En una instancia online privada, YouTube puede bloquear la IP del servidor; sube el archivo de audio o configura el extractor residencial opcional. Descargar audio de YouTube puede contravenir sus Términos de Servicio, así que usa tus propios archivos cuando no tengas derechos.',
  'faq.12.q': '¿Puedo buscar en YouTube por nombre?',
  'faq.12.a':
    'Sí. Escribe una canción o un artista en el buscador, revisa la miniatura y el canal, y pulsa Chordifree para analizar ese video. Pegar un enlace sigue funcionando.',
  'faq.6.q': '¿Dónde se guardan mis canciones?',
  'faq.6.a':
    'En el almacenamiento local para las versiones locales, o en tu propia base de datos Firestore en la instancia online privada. Exporta JSON para copias o ChordPro para otras herramientas.',
  'faq.7.q': '¿Puedo usarla sin conexión?',
  'faq.7.a':
    'La app de escritorio instalada funciona sin conexión. La app web necesita la API y el analizador en marcha, pero la interfaz se puede instalar como PWA.',
  'faq.17.q': '¿Puedo quitar la voz o exportar MIDI?',
  'faq.17.a':
    'En la versión de escritorio, un plugin local opcional (Demucs) separa la canción en voz, batería, bajo y otros. Puedes mezclar las cuatro pistas con volumen independiente, escuchar una sola y exportar un MIDI multipista con el bajo y la batería transcritos. Se ejecuta en tu equipo y guarda una caché que puedes vaciar; la instancia alojada no separa audio.',
  'faq.8.q': '¿Qué instrumentos e idiomas admite?',
  'faq.8.a':
    'Guitarra, piano y ukelele; inglés y español; sostenidos, bemoles, solfeo, cejilla, transposición y acordes simplificados o reducidos.',
  'faq.9.q': '¿Es gratis?',
  'faq.9.a':
    'Sí. Chordifree es código abierto bajo AGPL-3.0. El autoalojamiento en GCP cabe en el free tier para uso personal, pero Google puede cobrar si lo superas.',

  'finale.eyebrow': 'Cuando quieras',
  'finale.title': 'Convierte la próxima canción en una hoja de acordes.',
  'finale.lead':
    'Descarga la vista previa de escritorio, arranca el stack de Docker o despliega tu propia instancia privada en GCP. La biblioteca es tuya.',
  'finale.primary': 'Consigue la app',
  'finale.secondary': 'Ver en GitHub',
  'finale.slogan': 'De un músico para músicos y músicas.',
  'finale.author': 'Hecho por Moisés Lodeiro.',

  'footer.tagline': 'Musica laetitiae comes, medicina dolorum.',
  'footer.taglineTitle': 'La música acompaña la alegría y alivia el dolor.',
  'footer.linksAria': 'Pie de página',
  'footer.github': 'GitHub',
  'footer.readme': 'README',
  'footer.privacy': 'Privacidad',
  'footer.terms': 'Términos',
  'footer.license': 'AGPL-3.0',
  'footer.legal':
    'Descargar audio de YouTube puede contravenir sus Términos de Servicio. Chordifree no evita restricciones técnicas.',
};

const meta = {
  en: {
    title: 'Chordifree — synchronized chords from YouTube or your audio',
    description:
      'Search YouTube by name or upload your own audio. A synchronized chord sheet with beats, bars, lyrics, karaoke, A–B practice, MIDI export and desktop stem separation. Local-first, or your own private cloud.',
  },
  es: {
    title: 'Chordifree — acordes sincronizados desde YouTube o tu audio',
    description:
      'Busca en YouTube por nombre o sube tu propio audio. Una hoja de acordes sincronizada con pulsos, compases, letra, karaoke, práctica A–B, MIDI y separación de pistas en escritorio. Local first, o tu propia nube privada.',
  },
};

const textNodes = [...document.querySelectorAll('[data-i18n]')];
const ariaNodes = [...document.querySelectorAll('[data-i18n-aria]')];
const altNodes = [...document.querySelectorAll('[data-i18n-alt]')];
const titleNodes = [...document.querySelectorAll('[data-i18n-title]')];
const imageNodes = [...document.querySelectorAll('[data-src-en][data-src-es]')];
const englishText = new Map(textNodes.map((node) => [node.dataset.i18n, node.textContent.trim()]));
const englishAria = new Map(ariaNodes.map((node) => [node.dataset.i18nAria, node.getAttribute('aria-label')]));
const englishAlt = new Map(altNodes.map((node) => [node.dataset.i18nAlt, node.getAttribute('alt')]));
const englishTitle = new Map(titleNodes.map((node) => [node.dataset.i18nTitle, node.getAttribute('title')]));

const langButtons = [...document.querySelectorAll('.lang-btn')];
const descriptionTag = document.querySelector('meta[name="description"]');
const copyButton = document.querySelector('[data-copy]');
let currentLanguage = 'en';
let copyTimer = null;
let menuOpen = false;

function translate(key, language = currentLanguage) {
  if (language === 'es') return spanish[key] ?? englishText.get(key) ?? key;
  return englishText.get(key) ?? key;
}

function applyLanguage(language) {
  currentLanguage = language === 'es' ? 'es' : 'en';
  const isSpanish = currentLanguage === 'es';

  for (const node of textNodes) {
    const key = node.dataset.i18n;
    node.textContent = isSpanish ? (spanish[key] ?? englishText.get(key)) : englishText.get(key);
  }

  for (const node of ariaNodes) {
    const key = node.dataset.i18nAria;
    node.setAttribute('aria-label', isSpanish ? (spanish[key] ?? englishAria.get(key)) : englishAria.get(key));
  }

  for (const node of altNodes) {
    const key = node.dataset.i18nAlt;
    node.setAttribute('alt', isSpanish ? (spanish[key] ?? englishAlt.get(key)) : englishAlt.get(key));
  }

  for (const node of titleNodes) {
    const key = node.dataset.i18nTitle;
    node.setAttribute('title', isSpanish ? (spanish[key] ?? englishTitle.get(key)) : englishTitle.get(key));
  }

  for (const node of imageNodes) {
    const source = isSpanish ? node.dataset.srcEs : node.dataset.srcEn;
    if (source && node.getAttribute('src') !== source) node.setAttribute('src', source);
  }

  const labels = meta[currentLanguage];
  document.title = labels.title;
  descriptionTag?.setAttribute('content', labels.description);
  document.documentElement.lang = currentLanguage;

  for (const button of langButtons) {
    const active = button.dataset.lang === currentLanguage;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  if (copyButton && !copyTimer) {
    copyButton.textContent = translate('run.copy');
  }

  if (menuOpen) {
    document.getElementById('menu-btn')?.setAttribute('aria-label', translate('nav.closeMenu'));
  }

  try {
    localStorage.setItem(STORAGE_KEY, currentLanguage);
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

function savedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Ignore.
  }
  return 'en';
}

/* Language */

for (const button of langButtons) {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang));
}

applyLanguage(savedLanguage());

/* Mobile menu */

const menuButton = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

function setMenu(open) {
  if (!menuButton || !mobileMenu) return;
  menuOpen = open;
  mobileMenu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', translate(open ? 'nav.closeMenu' : 'nav.openMenu'));
  document.body.classList.toggle('menu-open', open);
}

menuButton?.addEventListener('click', () => setMenu(!menuOpen));
mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuOpen) setMenu(false);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 1020 && menuOpen) setMenu(false);
});

/* Scroll reveal */

const revealNodes = [...document.querySelectorAll('[data-reveal]')];

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px' },
  );

  for (const node of revealNodes) observer.observe(node);
} else {
  for (const node of revealNodes) node.classList.add('is-visible');
}

/* Chord band animation */

const chordSlots = [...document.querySelectorAll('.chord-slot')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (chordSlots.length > 1 && !reduceMotion) {
  let active = 0;
  window.setInterval(() => {
    active = (active + 1) % chordSlots.length;
    chordSlots.forEach((slot, index) => slot.classList.toggle('is-active', index === active));
  }, 2400);
}

/* Copy command */

copyButton?.addEventListener('click', async () => {
  const target = document.getElementById(copyButton.dataset.copy);
  if (!target) return;

  const text = target.textContent ?? '';
  let copied = false;

  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    copied = document.execCommand('copy');
    selection?.removeAllRanges();
  }

  if (!copied) return;

  copyButton.textContent = translate('run.copied');
  copyTimer = window.setTimeout(() => {
    copyTimer = null;
    copyButton.textContent = translate('run.copy');
  }, 1800);
});

/* Year */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
