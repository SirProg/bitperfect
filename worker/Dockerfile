# ffmpeg va en la imagen porque yt-dlp lo necesita para las fuentes que sirven
# HLS —TikTok e Instagram, con frecuencia—. No se usa para convertir: eso sigue
# ocurriendo en el navegador del usuario.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Sin privilegios: el worker ejecuta yt-dlp contra entrada de terceros.
RUN useradd --create-home --uid 10001 worker \
 && mkdir -p /tmp/bitperfect && chown worker /tmp/bitperfect
USER worker

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
