# Chordifree Analyzer

Microservicio FastAPI que detecta acordes con Essentia sobre un archivo de audio.

El motor usa `NNLSChroma` (croma de rango medio y de bajos con corrección de afinación),
estima la tonalidad global con `KeyExtractor`, pondera la fundamental con el croma grave y
decodifica la secuencia de acordes por pulso con un prior tonal y Viterbi. Los silencios se
marcan por energía. La versión actual es `essentia-1.5`; al cambiarla se invalida la caché de
las canciones guardadas.

## Ejecutar en local

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API

### `GET /health`

```bash
curl -fsS http://localhost:8000/health
# {"status":"ok","analyzerVersion":"essentia-1.5"}
```

### `POST /analyze`

Acepta `multipart/form-data` con el campo `file` (MP3, WAV, M4A, OGG, FLAC, WebM o MP4).

```bash
curl -fsS -X POST http://localhost:8000/analyze \
  -F "file=@cancion.wav"
```

Respuesta:

```json
{
  "segments": [
    { "start": 0.0, "end": 2.3, "label": "C", "confidence": 0.81 }
  ],
  "duration": 12.4,
  "beats": [0.42, 0.91, 1.38, 1.87],
  "beatsPerBar": 4,
  "analyzerVersion": "essentia-1.5"
}
```

`beats` contiene los pulsos detectados en segundos, ordenados, sin duplicados y dentro de
`[0, duration]`; puede ser una lista vacía si el ritmo no es claro. `beatsPerBar` es `4` en
esta versión. Las etiquetas se devuelven sin normalizar; el servidor Express las convierte al
modelo canónico y repara la línea de tiempo.

## Tests

```bash
pytest
```
