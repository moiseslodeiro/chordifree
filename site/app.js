const STORAGE_KEY = 'chordifree-landing-lang';

const spanish = {
  'a11y.skip': 'Saltar al contenido',
  'nav.features': 'Funciones',
  'nav.timeline': 'Línea de tiempo',
  'nav.run': 'Ejecutar',
  'nav.faq': 'Preguntas',
  'nav.github': 'GitHub',
  'nav.openMenu': 'Abrir menú',
  'nav.closeMenu': 'Cerrar menú',
  'nav.menuNote': 'Local first · código abierto',

  'hero.title': 'Acordes que siguen la canción.',
  'hero.lead':
    'Busca en YouTube por nombre o trae tu propio audio y obtén una hoja de acordes sincronizada con pulsos, compases, letra y práctica A–B. El análisis se ejecuta en tu equipo.',
  'hero.primary': 'Consigue la app',
  'hero.secondary': 'Verla en acción',
  'hero.proofOpen': 'Gratis y de código abierto',
  'hero.proofLanguages': 'Inglés y español',
  'hero.windowTag': 'Vista por compases',
  'hero.caption':
    'La canción de demostración, analizada en compases, acordes y una línea de tiempo reproducible.',

  'sheet.one': 'Toma el',
  'sheet.two': 'siguiente compás,',
  'sheet.three': 'tócalo',
  'sheet.four': 'despacio.',
  'sheet.timeline': 'Línea de tiempo',
  'sheet.bars': '4 compases',
  'sheet.loop': 'Bucle A–B',

  'features.eyebrow': 'Qué hace',
  'features.title': 'Una hoja de acordes, no una adivinanza.',
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
    'Marca A y B en la rejilla, previsualiza un compás al pasar el ratón y reproduce el rango o ponlo en bucle. Baja el tempo y cuenta antes de empezar.',
  'feature.3.tag': 'Bucle A–B',
  'feature.4.title': 'Ajusta',
  'feature.4.body':
    'Transpone, añade cejilla, simplifica o reduce acordes. Cambia entre diagramas de guitarra, piano y ukelele, con sostenidos, bemoles o solfeo.',
  'feature.4.tag': 'Guitarra · piano · uke',
  'feature.5.title': 'Guarda',
  'feature.5.body':
    'Guarda canciones y repertorios en una biblioteca local con carpetas e historial de práctica. Exporta ChordPro o MusicXML, imprime un PDF, haz una copia en JSON o envía la hoja por WhatsApp, Telegram o correo.',
  'feature.5.tag': 'Biblioteca local',

  'features.searchTag': 'Búsqueda en YouTube',
  'features.searchCaption':
    'Busca por nombre, revisa el canal y carga un resultado con un clic.',

  'product.eyebrow': 'La línea de tiempo',
  'product.title': 'Mira cada compás antes de tocarlo.',
  'product.lead':
    'La rejilla da una celda a cada pulso y una fila a cada compás. El pulso activo sigue la reproducción para que siempre sepas dónde estás.',
  'product.windowTag': 'Rejilla de pulsos',
  'product.caption1': 'Una fila por compás',
  'product.caption2': 'El pulso activo sigue la reproducción',
  'product.caption3': 'Haz clic en un compás para saltar o repetir',
  'product.caption4': 'Diagrama del acorde actual',

  'how.eyebrow': 'Del audio a la práctica',
  'how.title': 'Tres pasos, sin cuenta.',
  'how.lead':
    'Trae un enlace o un archivo. El analizador se encarga del tiempo y tú tomas las decisiones musicales.',
  'how.1.title': 'Añade una fuente',
  'how.1.body':
    'Busca en YouTube por nombre, pega un enlace o elige un archivo de audio. Se admiten MP3, WAV, M4A, OGG, FLAC, WebM y MP4.',
  'how.2.title': 'Deja trabajar al analizador',
  'how.2.body':
    'Los pulsos, compases, la tonalidad y los acordes se detectan en local. La primera ejecución carga los modelos y tarda un poco más.',
  'how.3.title': 'Corrige, guarda, practica',
  'how.3.body':
    'Corrige cualquier acorde en el editor, añade la letra y guarda en tu biblioteca o repertorios. Nada sale de tu equipo.',

  'run.eyebrow': 'Ejecútalo a tu manera',
  'run.title': 'Una app de escritorio, o tu propio servidor.',
  'run.lead':
    'La versión de escritorio incluye el analizador. El stack de Docker pone la misma app en un portátil, un servidor doméstico o un VPS.',
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

  'privacy.eyebrow': 'Local por diseño',
  'privacy.title': 'Tus canciones se quedan contigo.',
  'privacy.lead':
    'Chordifree no tiene cuentas ni seguimiento. La biblioteca vive en tu navegador y la versión de escritorio mantiene el analizador en tu equipo.',
  'privacy.1.title': 'Sin cuentas',
  'privacy.1.body': 'Abre la app y empieza. No hay registro.',
  'privacy.2.title': 'Biblioteca local',
  'privacy.2.body':
    'Las canciones, los repertorios y el historial de práctica se quedan en el almacenamiento local. Exporta cuando quieras.',
  'privacy.3.title': 'Tu audio',
  'privacy.3.body':
    'Los archivos se analizan y no se guardan en la biblioteca. Los archivos temporales se eliminan.',
  'privacy.legal':
    'Descargar audio de YouTube puede contravenir sus Términos de Servicio. Usa la subida de archivo cuando no tengas derechos sobre el contenido.',

  'faq.eyebrow': 'Preguntas',
  'faq.title': 'Antes de empezar.',
  'faq.lead':
    'Las respuestas cortas. El README tiene los detalles, las variables de entorno y la arquitectura.',
  'faq.1.q': '¿Necesito una cuenta?',
  'faq.1.a': 'No. No hay registro, ni inicio de sesión, ni seguimiento.',
  'faq.2.q': '¿Sube mi audio a un tercero?',
  'faq.2.a':
    'No. La app web solo envía el audio a la API y al analizador que tú ejecutas. La versión de escritorio lo mantiene todo en tu equipo.',
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
    'Sí, mediante yt-dlp. Descargar audio de YouTube puede contravenir sus Términos de Servicio, así que usa tus propios archivos cuando no tengas derechos.',
  'faq.12.q': '¿Puedo buscar en YouTube por nombre?',
  'faq.12.a':
    'Sí. Escribe una canción o un artista en el buscador, revisa la miniatura y el canal, y pulsa Chordifree para analizar ese video. Pegar un enlace sigue funcionando.',
  'faq.6.q': '¿Dónde se guardan mis canciones?',
  'faq.6.a':
    'En el almacenamiento local de tu navegador para la app web, y en tu equipo para la versión de escritorio. Exporta JSON para copias o ChordPro para otras herramientas.',
  'faq.7.q': '¿Puedo usarla sin conexión?',
  'faq.7.a':
    'La app de escritorio instalada funciona sin conexión. La app web necesita la API y el analizador en marcha, pero la interfaz se puede instalar como PWA.',
  'faq.8.q': '¿Qué instrumentos e idiomas admite?',
  'faq.8.a':
    'Guitarra, piano y ukelele; inglés y español; sostenidos, bemoles, solfeo, cejilla, transposición y acordes simplificados o reducidos.',
  'faq.9.q': '¿Es gratis?',
  'faq.9.a': 'Sí. Chordifree es código abierto bajo AGPL-3.0.',

  'finale.eyebrow': 'Cuando quieras',
  'finale.title': 'Convierte la próxima canción en una hoja de acordes.',
  'finale.lead':
    'Descarga la vista previa para Windows o arranca el stack de Docker. La biblioteca es tuya.',
  'finale.primary': 'Consigue la app',
  'finale.secondary': 'Ver en GitHub',
  'finale.slogan': 'De un músico para músicos y músicas.',
  'finale.author': 'Hecho por Moisés Lodeiro.',

  'footer.tagline': 'De un músico para músicos y músicas. Hecho por Moisés Lodeiro.',
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
      'Search YouTube by name or upload your own audio. A synchronized chord sheet with beats, bars, lyrics and A–B practice. Free, open source and local first.',
  },
  es: {
    title: 'Chordifree — acordes sincronizados desde YouTube o tu audio',
    description:
      'Busca en YouTube por nombre o sube tu propio audio. Una hoja de acordes sincronizada con pulsos, compases, letra y práctica A–B. Gratis, código abierto y local first.',
  },
};

const textNodes = [...document.querySelectorAll('[data-i18n]')];
const ariaNodes = [...document.querySelectorAll('[data-i18n-aria]')];
const englishText = new Map(textNodes.map((node) => [node.dataset.i18n, node.textContent.trim()]));
const englishAria = new Map(ariaNodes.map((node) => [node.dataset.i18nAria, node.getAttribute('aria-label')]));

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
