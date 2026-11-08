const EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4']);

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : '';
}

export function isAllowedAudioExtension(filename: string): boolean {
  return EXTENSIONS.has(extensionOf(filename));
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Comprueba la firma real del archivo para no confiar en la extensión.
 * Devuelve true si el contenido se parece a alguno de los formatos admitidos.
 */
export function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // WAV: "RIFF....WAVE"
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x41, 0x56, 0x45], 8)) {
    return true;
  }
  // OGG: "OggS"
  if (startsWith(buffer, [0x4f, 0x67, 0x67, 0x53])) return true;
  // FLAC: "fLaC"
  if (startsWith(buffer, [0x66, 0x4c, 0x61, 0x43])) return true;
  // MP4/M4A: "ftyp" en el byte 4
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return true;
  // MP3 con etiqueta ID3
  if (startsWith(buffer, [0x49, 0x44, 0x33])) return true;
  // MP3 sin ID3: frame sync 0xFFEx/0xFFFx
  if (buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0) return true;

  return false;
}
