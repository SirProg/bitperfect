<div align="center">

# 🎧 BitPerfect

**Conversor de audio que funciona íntegramente en tu navegador. Sube un archivo, elige el formato de salida y descárgalo — sin servidores, sin cuentas y sin que tu música salga de tu equipo.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-React_TS-646CFF.svg)](https://vitejs.dev/)
[![ffmpeg.wasm](https://img.shields.io/badge/powered_by-ffmpeg.wasm-007808.svg)](https://ffmpegwasm.netlify.app/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

---

## 📖 ¿Qué es BitPerfect?

**BitPerfect** es una aplicación web de código abierto para **convertir archivos de audio entre formatos** (por ejemplo `.mp3 → .flac` o `.flac → .mp3`). Toda la conversión ocurre **dentro del navegador** gracias a [ffmpeg.wasm](https://ffmpegwasm.netlify.app/): el archivo **nunca se sube a ningún servidor**, lo que hace la herramienta rápida, privada y gratuita de alojar.

Nace como acompañante del proyecto [**musikver**](https://github.com/TU_USUARIO/musikver) (servidor de música FLAC): con BitPerfect puedes convertir tus pistas al formato que necesites antes de llevarlas a tu biblioteca o a cualquier otro dispositivo. Aun así, **es una app totalmente independiente**: no comparte código, cuentas ni conexión con musikver.

### Características principales

- 🌐 **100% en el navegador:** la conversión se ejecuta en tu equipo con WebAssembly. Ningún archivo se envía a un servidor.
- 🔓 **Sin cuentas ni login:** herramienta pública y abierta. Entras y conviertes.
- 🔁 **Bidireccional:** convierte entre los formatos de audio más usados en cualquier dirección.
- 🏷️ **Preserva metadatos y carátula:** título, artista, álbum, año, número de pista y la imagen embebida se mantienen en la conversión (según lo soporte el formato de destino).
- 🎚️ **Presets + control avanzado:** desde un preset de "máxima calidad" hasta ajuste fino de bitrate, sample rate, bit depth y canales — **cada opción explica qué hace**.
- 📊 **Cola asíncrona con barra de progreso:** ves el avance real de la conversión sin que se congele la interfaz.
- 🎛️ **Nivel de compresión FLAC configurable (0–8)**, con una descripción clara de qué implica cada nivel.
- 🖱️ **Arrastrar y soltar** + **previsualización de audio antes y después** de convertir.
- 🗑️ **Sin rastro:** el archivo convertido se libera de memoria tras la descarga. Cada conversión es de usar y tirar.

---

## ⚠️ Aviso importante: calidad en conversiones "con pérdida → sin pérdida"

Convertir un archivo **con pérdida** (MP3, AAC, OGG…) a uno **sin pérdida** (FLAC, WAV, ALAC…) **no recupera la calidad perdida**. El resultado será una copia fiel del original comprimido, pero ocupando mucho más espacio, sin ganar detalle real.

BitPerfect **permite estas conversiones**, pero **avisa al usuario** en la interfaz cuando detecta este caso, para que sepa que el archivo será más grande sin mejorar el sonido.

---

## 🎼 Formatos soportados

BitPerfect apunta a cubrir los formatos de audio **más conocidos y usados**, tanto de entrada como de salida:

| Formato | Extensión | Tipo | Entrada | Salida |
|---------|-----------|------|:-------:|:------:|
| MP3     | `.mp3`    | Con pérdida  | ✅ | ✅ |
| AAC     | `.m4a` / `.aac` | Con pérdida | ✅ | ✅ |
| Ogg Vorbis | `.ogg` | Con pérdida | ✅ | ✅ |
| Opus    | `.opus`   | Con pérdida  | ✅ | ✅ |
| FLAC    | `.flac`   | Sin pérdida  | ✅ | ✅ |
| WAV     | `.wav`    | Sin pérdida (PCM) | ✅ | ✅ |
| ALAC    | `.m4a`    | Sin pérdida  | ✅ | ✅ |
| AIFF    | `.aiff`   | Sin pérdida (PCM) | ✅ | ✅ |

> La lista exacta depende de los códecs incluidos en el build de `ffmpeg.wasm` empleado. Formatos poco comunes o propietarios pueden requerir un build personalizado del core.

---

## 🎚️ Parámetros de conversión

Cada control muestra en la interfaz **una breve explicación de qué hace y cómo afecta al resultado**, para que no haga falta ser experto en audio.

### Presets rápidos
- **Máxima calidad** — prioriza fidelidad sobre tamaño.
- **Equilibrado** — buen sonido con un tamaño razonable.
- **Para móvil / ahorro de espacio** — archivos ligeros para dispositivos con poco almacenamiento.

### Control avanzado *(opcional)*
| Parámetro | Qué controla | Nota que ve el usuario |
|-----------|--------------|------------------------|
| **Bitrate** | Datos por segundo de audio | Más alto = mejor calidad y archivo más grande (solo formatos con pérdida). |
| **Sample rate** | Muestras por segundo (Hz) | 44.1 kHz es calidad CD; subirlo no mejora un original de menor tasa. |
| **Bit depth** | Bits por muestra | Mayor profundidad = más rango dinámico (solo formatos sin pérdida/PCM). |
| **Canales** | Mono / estéreo | Mono reduce tamaño; estéreo conserva la separación L/R. |
| **Compresión FLAC (0–8)** | Esfuerzo de compresión FLAC | **No afecta la calidad** (FLAC es sin pérdida). Más alto = archivo un poco más pequeño, pero convierte más lento. `0` = rápido/grande, `8` = lento/pequeño. |

### Metadatos
Se conservan los **tags** (título, artista, álbum, año, número de pista…) y la **carátula embebida** siempre que el formato de destino lo admita.

---

## 🖥️ Flujo de uso

1. **Arrastra** un archivo de audio (o haz clic para seleccionarlo). Máximo **500 MB** por archivo.
2. **Escucha la previsualización** del original.
3. **Elige el formato de salida** y, si quieres, ajusta un preset o el control avanzado. Si aplica, verás el aviso de calidad.
4. Pulsa **Convertir**. La conversión entra en una **cola** y una **barra de progreso** muestra el avance real.
5. Al terminar, **escucha el resultado** (previsualización "después") y **descárgalo**.
6. Tras la descarga, el archivo se **libera de memoria**. Sin historial, sin rastro.

> Se procesa **un archivo a la vez** para no saturar la CPU del navegador. Mientras hay una conversión en curso, la cola se encarga de mantener el orden.

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Build / dev | [Vite](https://vitejs.dev/) |
| UI | [React](https://react.dev/) + **TypeScript** |
| Motor de conversión | [`ffmpeg.wasm`](https://ffmpegwasm.netlify.app/) (FFmpeg compilado a WebAssembly) |
| Ejecución | 100% cliente — sin backend |
| Despliegue | GitHub Pages (o Vercel como alternativa) |
| Licencia | MIT |

---

## 🏗️ Arquitectura

```
        Navegador del usuario
┌──────────────────────────────────────┐
│  React + TypeScript (UI)              │
│    │                                  │
│    │  archivo (drag & drop)           │
│    ▼                                  │
│  ffmpeg.wasm  ← convierte en memoria  │
│    │                                  │
│    ▼                                  │
│  Blob de salida → descarga            │
└──────────────────────────────────────┘
        (nada sale del navegador)
```

No hay servidor, base de datos ni almacenamiento remoto. El sitio se sirve como **estático**; toda la lógica vive en el cliente.

---

## 🚀 Puesta en marcha (desarrollo)

### Requisitos
- Node.js 20+

### Pasos

```bash
# 1. Clonar
git clone https://github.com/TU_USUARIO/bitperfect.git
cd bitperfect

# 2. Instalar dependencias
npm install

# 3. Arrancar en modo desarrollo
npm run dev

# 4. Abrir el navegador en la URL que indique Vite (por defecto http://localhost:5173)
```

Para generar el build de producción:

```bash
npm run build      # genera /dist
npm run preview    # sirve el build localmente para probarlo
```

---

## 🌐 Despliegue

BitPerfect es un sitio estático, así que puede publicarse en cualquier hosting de estáticos. Los dos objetivos son **GitHub Pages** (preferido) y **Vercel** (alternativa).

### ⚠️ Requisito clave: aislamiento de origen (COOP/COEP)

`ffmpeg.wasm` en su versión multihilo usa `SharedArrayBuffer`, que requiere que la página se sirva con cabeceras de **cross-origin isolation**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **En Vercel** se configuran fácilmente con un `vercel.json` (sección `headers`).
- **En GitHub Pages no se pueden definir cabeceras personalizadas.** La solución habitual es incluir un pequeño *service worker* (por ejemplo [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker)) que inyecta esas cabeceras desde el cliente. Alternativamente, puede usarse el build **monohilo** de `ffmpeg.wasm`, que no necesita `SharedArrayBuffer` a costa de ser más lento.

### GitHub Pages

```bash
# Ajusta la opción `base` en vite.config.ts al nombre del repo, p. ej. base: '/bitperfect/'
npm run build
# Publica el contenido de /dist en la rama gh-pages (o vía GitHub Actions)
```

### Vercel
Importa el repositorio en Vercel; detecta Vite automáticamente. Añade las cabeceras COOP/COEP en `vercel.json`.

---

## 🚦 Rendimiento y límites

- **Un archivo a la vez** mediante cola, para no saturar la CPU ni la memoria del navegador.
- **Límite de 500 MB por archivo.** Al ejecutarse en WebAssembly, archivos muy grandes pueden acercarse a los límites de memoria del navegador; en equipos modestos conviene usar archivos más pequeños.
- La velocidad depende del equipo del usuario, no de un servidor.

---

## 🗺️ Roadmap

**MVP (primera versión)**
- [x] Subir un archivo de audio (drag & drop)
- [x] Elegir formato de salida
- [x] Convertir en el navegador con barra de progreso
- [x] Previsualización antes/después
- [x] Descargar el resultado

**Siguientes pasos**
- [ ] Interfaz **bilingüe** (español → español/inglés)
- [ ] Presets y control avanzado completos con descripciones
- [ ] Aviso automático en conversiones con pérdida → sin pérdida
- [ ] Preservación robusta de carátula entre formatos
- [ ] Modo monohilo de respaldo para hostings sin COOP/COEP
- [ ] Conversión por lotes (futuro, fuera del alcance inicial)

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Antes de empezar, revisa la [guía de contribución](./CONTRIBUTING.md) y el [código de conducta](./CODE_OF_CONDUCT.md), y usa las plantillas de issues y pull requests del repositorio.

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta [`LICENSE`](./LICENSE) para más detalles.

---

<div align="center">

Hecho como complemento independiente de **musikver** 🎵

</div>
