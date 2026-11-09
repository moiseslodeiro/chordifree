# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/models \
    && curl -fsSL 'https://huggingface.co/jafet21/yamnetonnx/resolve/337f563004630f00673d4a773a0d657d0233ce56/yamnet.onnx' \
        -o /app/models/yamnet.onnx \
    && curl -fsSL 'https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-audioset-yamnet-1.onnx' \
        -o /app/models/voice_instrumental.onnx \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

ENV ANALYZER_VERSION=essentia-1.6
ENV ANALYZER_MODEL_DIR=/app/models
USER appuser
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
