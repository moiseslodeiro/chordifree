# Modelos de detección de voz

El analizador usa dos modelos ONNX para localizar las secciones cantadas y alinear la letra:

- `yamnet.onnx` — extractor de embeddings de AudioSet (YAMNet, 1024 dimensiones).
- `voice_instrumental.onnx` — clasificador voice/instrumental de Essentia sobre esos embeddings.

Los archivos no se versionan. Se descargan automáticamente en la primera análisis, o manualmente:

```bash
cd services/analyzer
mkdir -p models
curl -fsSL \
  'https://huggingface.co/jafet21/yamnetonnx/resolve/337f563004630f00673d4a773a0d657d0233ce56/yamnet.onnx' \
  -o models/yamnet.onnx
curl -fsSL \
  'https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-audioset-yamnet-1.onnx' \
  -o models/voice_instrumental.onnx
```

Variables de entorno:

- `ANALYZER_MODEL_DIR`: carpeta donde buscar los modelos (por defecto `services/analyzer/models`).
- `ANALYZER_DOWNLOAD_MODELS=0`: desactiva la descarga automática; sin modelos, el analizador sigue funcionando pero devuelve `vocalRegions: []` y la letra usa la heurística anterior.

Licencias: YAMNet es Apache 2.0; el clasificador de Essentia es CC BY-NC-SA 4.0. Revisa las licencias antes de un uso comercial.
