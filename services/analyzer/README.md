# Chordifree Analyzer

FastAPI microservice that detects chords, beats and sung sections from an audio file.

## Engine

- `NNLSChroma` with tuning correction for mid-range and bass chroma.
- Global key estimation with `KeyExtractor`.
- Bass chroma weighting for the chord root.
- Key prior plus Viterbi decoding for a stable chord sequence.
- Energy-based silence detection.
- `YAMNet` embeddings + Essentia `voice/instrumental` classifier (ONNX) for `vocalRegions`.

The dependency is pinned to `essentia==2.1b6.dev1389`. Essentia 2.0.1 is the last non-beta
release, but it is from 2014, is not published on PyPI, and does not include `NNLSChroma` or
`LogSpectrum`. The 2.1 line only exists as betas; the exact tested beta is pinned.

## Run

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

The ONNX models are downloaded automatically on the first analysis. To prefetch them, see
[`models/README.md`](models/README.md). Set `ANALYZER_DOWNLOAD_MODELS=0` when the models are
baked into the image.

## API

### `GET /health`

```bash
curl -fsS http://localhost:8001/health
# {"status":"ok","analyzerVersion":"essentia-1.6"}
```

### `POST /analyze`

Accepts `multipart/form-data` with a `file` field (MP3, WAV, M4A, OGG, FLAC, WebM or MP4).

```bash
curl -fsS -X POST http://localhost:8001/analyze \
  -F "file=@song.wav"
```

Response:

```json
{
  "segments": [
    { "start": 0.0, "end": 2.3, "label": "C", "confidence": 0.81 }
  ],
  "duration": 12.4,
  "beats": [0.42, 0.91, 1.38, 1.87],
  "beatsPerBar": 4,
  "vocalRegions": [{ "start": 4.2, "end": 11.8 }],
  "analyzerVersion": "essentia-1.6"
}
```

`beats` contains detected beats in seconds, sorted and inside `[0, duration]`; it can be empty
when the rhythm is unclear. `beatsPerBar` is estimated from the beat accents (3/4 or 4/4) and
defaults to 4 when the rhythm is ambiguous; the web app lets the user correct it.
`vocalRegions` contains sung sections; if the ONNX models are not
available, it is `[]` and the web app falls back to the harmonic heuristic. Labels are returned
un-normalized; the Express server converts them to the canonical chord model and repairs the
timeline.

## Tests

```bash
pytest
```
