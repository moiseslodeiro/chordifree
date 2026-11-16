# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements-docker.txt ./
RUN pip install --no-cache-dir -r requirements-docker.txt

COPY app.py ./

RUN useradd --create-home --uid 10001 extractor
USER extractor
ENV HOME=/tmp

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health')" || exit 1

CMD ["gunicorn", "--workers", "1", "--threads", "1", "--bind", "0.0.0.0:8010", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
