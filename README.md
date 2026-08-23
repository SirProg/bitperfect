<div align="center">

# 🎧 BitPerfect

**Conversor de audio que funciona íntegramente en tu navegador. Sube un archivo, elige el formato de salida y descárgalo — sin servidores, sin cuentas y sin que tu música salga de tu equipo.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-React_TS-646CFF.svg)](https://vitejs.dev/)
[![ffmpeg.wasm](https://img.shields.io/badge/powered_by-ffmpeg.wasm-007808.svg)](https://ffmpegwasm.netlify.app/)
[![Deploy: Vercel](https://img.shields.io/badge/deploy-Vercel-000000.svg)](https://vercel.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

---

## 📖 ¿Qué es BitPerfect?

**BitPerfect** es una aplicación web de código abierto para **convertir archivos de audio entre formatos** (por ejemplo `.mp3 → .flac` o `.flac → .mp3`). Toda la conversión ocurre **dentro del navegador** gracias a [ffmpeg.wasm](https://ffmpegwasm.netlify.app/): el archivo **nunca se sube a ningún servidor**, lo que hace la herramienta rápida, privada y gratuita de alojar.

Nace como acompañante del proyecto [**musikver**](https://github.com/SirProg/musikver) (servidor de música FLAC): con BitPerfect puedes convertir tus pistas al formato que necesites antes de llevarlas a tu biblioteca o a cualquier otro dispositivo. Aun así, **es una app totalmente independiente**: no comparte código, cuentas ni conexión con musikver.

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

> Los ocho formatos están **verificados** contra el build de `@ffmpeg/core` que usa el proyecto: `npm run audit:encoders` pregunta al propio binario qué encoders trae. Formatos poco comunes o propietarios requerirían un build personalizado del core.
>
> Dos límites reales de este build, que la interfaz ya respeta y por eso nunca llegan a fallar:
> - **Ogg Vorbis** no admite frecuencias por encima de **48 kHz**.
> - **Opus** solo admite 8, 12, 16, 24 y 48 kHz, y se codifica con complejidad 4 (ver [Notas de implementación](#-notas-de-implementación)).

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
| UI | [React](https://react.dev/) 19 + **TypeScript** |
| Estilos | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Tipografías | [Fontsource](https://fontsource.org/) (autohospedadas: Archivo, Inter, JetBrains Mono) |
| Motor de conversión | [`ffmpeg.wasm`](https://ffmpegwasm.netlify.app/) (FFmpeg compilado a WebAssembly) |
| Lectura de metadatos | [`music-metadata`](https://github.com/Borewit/music-metadata) |
| Idiomas | [i18next](https://www.i18next.com/) + react-i18next (es / en) |
| Tests | [Vitest](https://vitest.dev/) |
| Lint | [oxlint](https://oxc.rs/) |
| Ejecución | 100% cliente — sin backend |
| Despliegue | [Vercel](https://vercel.com/) (estático) |
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
git clone https://github.com/SirProg/bitperfect.git
cd bitperfect

# 2. Instalar dependencias
#    El postinstall copia los binarios de ffmpeg.wasm a public/ffmpeg/
npm install

# 3. Arrancar en modo desarrollo
npm run dev

# 4. Abrir el navegador en la URL que indique Vite (por defecto http://localhost:5173)
```

> `public/ffmpeg/` es un artefacto derivado y no se versiona. Si el motor no carga, ejecuta `npm run sync:ffmpeg`.

### Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo, ya con las cabeceras COOP/COEP puestas. |
| `npm run build` | Build de producción en `/dist`. |
| `npm run preview` | Sirve el build localmente, también con COOP/COEP. |
| `npm run lint` | oxlint. |
| `npm run typecheck` | `tsc` sin emitir. |
| `npm test` | Tests de la lógica pura con Vitest. |
| `npm run sync:ffmpeg` | Recopia los binarios del core a `public/ffmpeg/`. |
| `npm run audit:encoders` | Pregunta al core de ffmpeg.wasm qué encoders y parámetros admite. |

## 🌐 Despliegue

BitPerfect se publica en **Vercel** como sitio estático. No hay backend que desplegar: el build produce `/dist` y se sirve tal cual.

### Requisito clave: aislamiento de origen (COOP/COEP)

`ffmpeg.wasm` en su versión multihilo usa `SharedArrayBuffer`, que solo está disponible en páginas servidas con **cross-origin isolation**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Están declaradas en [`vercel.json`](./vercel.json) para producción y en `vite.config.ts` para desarrollo, de modo que ambos entornos se comportan igual.

**Consecuencia práctica:** con `require-corp` el navegador **bloquea cualquier recurso de terceros** que no envíe cabecera CORP. Por eso el proyecto no carga nada desde un CDN:

- Los binarios del core se copian a `public/ffmpeg/` en el `postinstall` (`scripts/sync-ffmpeg-core.mjs`) y se sirven desde el propio origen.
- Las tipografías van autohospedadas vía Fontsource. Google Fonts no funcionaría.

### Publicar

1. Importa el repositorio en Vercel. Detecta Vite automáticamente (build `npm run build`, salida `dist`).
2. No hay variables de entorno que configurar.
3. Cada pull request recibe su propio *preview deployment*.

Para comprobar que el aislamiento quedó activo, abre la consola en el dominio desplegado y ejecuta `crossOriginIsolated`: debe devolver `true`. La cabecera del sitio también lo indica, con **Multihilo** o **Monohilo** junto al nombre.

### Si el navegador no ofrece `SharedArrayBuffer`

La aplicación lo detecta en runtime y carga el core **monohilo**, que no lo necesita. La conversión es más lenta pero el resultado es idéntico, y la interfaz lo indica en lugar de fallar.

## 🚦 Rendimiento y límites

- **Un archivo a la vez** mediante cola, para no saturar la CPU ni la memoria del navegador.
- **Límite de 500 MB por archivo.** Al ejecutarse en WebAssembly, archivos muy grandes pueden acercarse a los límites de memoria del navegador; en equipos modestos conviene usar archivos más pequeños.
- La velocidad depende del equipo del usuario, no de un servidor.

---

## 🗺️ Roadmap

**Implementado**
- [x] Subir un archivo de audio (arrastrar y soltar o selector)
- [x] Los ocho formatos de la tabla, de entrada y de salida
- [x] Conversión en el navegador con progreso real (derivado del log de ffmpeg)
- [x] Previsualización de la onda y del sonido, antes y después
- [x] Descargar el resultado y liberarlo de memoria
- [x] Presets y control avanzado, cada opción con su explicación
- [x] Aviso automático en conversiones con pérdida → sin pérdida (y otros cuatro avisos de calidad)
- [x] Preservación de metadatos y carátula donde el formato lo admite
- [x] Interfaz bilingüe español / inglés
- [x] Fallback monohilo para navegadores sin `SharedArrayBuffer`

**Siguientes pasos**
- [ ] Conversión por lotes de verdad (hoy la cola procesa de uno en uno)
- [ ] Recorte y normalización de volumen
- [ ] Edición de tags antes de convertir
- [ ] Onda del resultado también en formatos que el navegador no sabe decodificar

## 🔬 Notas de implementación

Tres rarezas del build de `ffmpeg.wasm` que costaron encontrar y que el código ya sortea. Se dejan escritas porque no son evidentes leyendo el código y volverían a morder al subir la versión del core.

### Opus se codifica con complejidad 4, no con la de por defecto

`libopus` con la complejidad por defecto de ffmpeg (10) **desborda el heap de wasm a 48 kHz estéreo**. En Node el core aborta con `memory access out of bounds`; en el navegador es peor, porque el worker se queda colgado y la promesa de `exec()` no se resuelve nunca. La frontera es exacta: 0–4 funcionan, 5–10 no.

Afecta a *cualquier* salida Opus estéreo, incluso partiendo de 44.1 kHz, porque Opus siempre trabaja internamente a 48 kHz. Por eso `catalog.ts` fija `-compression_level 4`; la diferencia de calidad frente a 10 es marginal.

### El core se recicla después de cada conversión

ffmpeg.wasm acumula memoria entre llamadas a `exec()`. Tras unas ocho conversiones seguidas sobre la misma instancia empieza a abortar con `memory access out of bounds`, y las que siguen fallan todas. `convert.ts` destruye la instancia al terminar cada archivo para que la siguiente arranque con un heap limpio.

Como red de seguridad hay además un plazo máximo por conversión: sin él, un core que revienta dejaría la interfaz esperando indefinidamente.

### Todo se sirve desde el propio origen

`Cross-Origin-Embedder-Policy: require-corp` bloquea cualquier recurso de terceros sin cabecera CORP. Eso descarta cargar el core desde unpkg y descarta Google Fonts. El core se copia en `postinstall` y las tipografías van empaquetadas.

Un detalle fácil de pasar por alto: `@ffmpeg/ffmpeg` crea su worker con `type: "module"`, y ese `worker.js` importa `const.js` y `errors.js` por ruta relativa. Si no se copian junto a él, el worker se queda colgado sin ningún error visible en consola.

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
