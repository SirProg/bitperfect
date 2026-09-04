# Worker de BitPerfect

Servicio pequeño que **extrae el audio de una URL** para que BitPerfect lo convierta en el navegador.

No convierte nada. Devuelve la pista de audio tal y como la sirve el origen, y la conversión sigue ocurriendo en tu equipo con `ffmpeg.wasm`. Eso es lo que mantiene en pie la propuesta del proyecto: **tu audio nunca se procesa en un servidor ajeno**.

## Por qué hace falta

El navegador no puede hacer esto por sí solo:

- Los sitios de origen no sirven CORS en sus endpoints de media.
- La extracción exige descifrar el JavaScript de sus reproductores, que cambia cada pocas semanas. Ese es el trabajo de [`yt-dlp`](https://github.com/yt-dlp/yt-dlp).

## Este worker es tuyo

No hay una instancia pública. Cada quien levanta la suya, y eso tiene una consecuencia buena: **la URL que pegas no llega a ningún servidor de terceros**, solo al tuyo.

## Desplegar en Fly.io

```bash
cd worker
fly launch --copy-config --no-deploy      # ajusta el nombre de la app
fly secrets set WORKER_TOKEN="$(openssl rand -hex 32)"
fly deploy
fly secrets list                          # apunta el token: lo pide BitPerfect
```

Después, en BitPerfect: **Desde URL → Ajustes**, y pega la URL de tu worker (`https://tu-app.fly.dev`) junto al token.

La máquina se **duerme sin uso** (`auto_stop_machines = "suspend"`) y despierta con la primera petición. Un worker personal está parado casi todo el tiempo.

## Ejecutar en local

```bash
docker build -t bitperfect-worker .
docker run -p 8080:8080 -e WORKER_TOKEN=dev bitperfect-worker
```

O sin Docker, para desarrollar:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
WORKER_TOKEN=dev .venv/bin/uvicorn app.main:app --reload --port 8080
```

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `WORKER_TOKEN` | — | Token que exige en `Authorization: Bearer`. **Sin él el worker no arranca** |
| `ALLOW_ANONYMOUS` | `false` | Permite arrancar sin token. Solo si de verdad quieres un worker abierto |
| `ALLOWED_ORIGINS` | dominio público de BitPerfect y `localhost` | Lista CORS separada por comas |
| `MAX_DURATION_SEC` | `1800` | Tope de duración (30 min) |
| `MAX_BYTES` | `524288000` | Tope de tamaño (500 MB) |
| `MAX_CONCURRENT` | `1` | Descargas simultáneas |
| `PROBE_TIMEOUT_SEC` | `45` | Plazo para consultar metadatos |
| `DOWNLOAD_TIMEOUT_SEC` | `600` | Plazo para descargar |
| `YTDLP_COOKIES_FILE` | — | Archivo de cookies para contenido que requiera sesión |
| `HTTP_PROXY` / `HTTPS_PROXY` | — | Salida por otra ruta de red |
| `ALLOW_PRIVATE_HOSTS` | `false` | **Solo para pruebas.** Desactiva la guardia SSRF |

**Se niega a arrancar sin `WORKER_TOKEN`** a propósito: un endpoint `yt-dlp` accesible y anónimo se descubre y se abusa, y el ancho de banda lo paga quien lo levantó.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Estado, versión de `yt-dlp`, si hay ffmpeg y si se exige token |
| `POST` | `/probe` | `{ url }` → título, autor, duración, extractor y miniatura, **sin descargar el medio** |
| `POST` | `/download` | `{ url }` → los bytes del mejor audio, con `Content-Length` y `X-BitPerfect-Filename` |
| `GET` | `/thumb?u=…` | La miniatura, normalizada a JPEG y servida desde este origen |

`/probe` existe para que veas qué vas a bajar antes de bajarlo, y para rechazar por duración sin gastar ancho de banda.

`/thumb` no es un capricho: BitPerfect se sirve con `Cross-Origin-Embedder-Policy: require-corp`, que **bloquea las imágenes de otros orígenes**. Pasarlas por aquí lo resuelve, y de paso convierte a JPEG las miniaturas WebP de YouTube, que MP3 no admite como carátula.

## Seguridad

El worker recibe una URL arbitraria de un cliente, así que la trata como entrada hostil:

- Solo esquemas `http` y `https`.
- **Guardia SSRF**: se resuelve el host y se rechaza si *cualquiera* de sus IPs es privada, de loopback, de enlace local o reservada. Esto impide usar tu worker para sondear tu red interna o el endpoint de metadatos de tu proveedor de nube (`169.254.169.254`).
- Topes de duración y tamaño aplicados **en el servidor**, no solo en el cliente.
- Plazos máximos y una sola descarga concurrente por defecto.
- El contenedor corre **sin privilegios**, con un usuario propio.

> **Limitación conocida:** `yt-dlp` vuelve a resolver el DNS por su cuenta, así que un ataque de *DNS rebinding* con TTL muy corto podría burlar la comprobación. Detiene los casos directos, que son los que importan en un servicio que además va detrás de un token.

## Mantenimiento

Los extractores se rompen cuando las fuentes cambian. **Actualizar `yt-dlp` es lo que mantiene esto vivo:**

```bash
fly deploy --no-cache     # reconstruye y trae la última versión
```

`GET /health` muestra la versión en uso para que sepas si te has quedado atrás.

## Limitaciones de esta versión

- **Una pista por URL.** Las listas de reproducción se recortan al primer elemento.
- **Sin progreso durante la fase de servidor.** El navegador ve un porcentaje real solo mientras transfiere; mientras el worker descarga, el estado es indeterminado.
- **No se admiten emisiones en directo.**
- La imagen pesa unos 900 MB, casi todo `ffmpeg` de Debian. Se prefiere el paquete firmado de la distribución a descargar un binario de terceros durante la construcción.

## Nota legal

Descargar contenido de estas plataformas suele ir contra sus términos de servicio, y lo que sea legítimo depende de tu jurisdicción y de qué descargues: contenido propio, con licencia libre o de dominio público no plantea el mismo problema que material con derechos. Esta herramienta no toma esa decisión por ti.
