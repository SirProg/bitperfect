# Guía de contribución

¡Gracias por querer aportar a BitPerfect! Este documento resume lo mínimo para que tu contribución entre sin fricción.

## Antes de empezar

- Para **bugs** y **propuestas de mejora**, abre primero un issue usando las plantillas del repositorio. Así evitamos trabajo duplicado.
- Para cambios pequeños y obvios (typos, enlaces rotos) puedes ir directo al pull request.

## Entorno de desarrollo

Requiere **Node.js 20+**.

```bash
git clone https://github.com/SirProg/bitperfect.git
cd bitperfect
npm install     # el postinstall copia los binarios de ffmpeg.wasm a public/ffmpeg/
npm run dev
```

> `public/ffmpeg/` es un artefacto derivado y está en `.gitignore`. Si algo falla al cargar el motor, ejecuta `npm run sync:ffmpeg`.

### Sobre COOP/COEP

La app se sirve con `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` para habilitar `SharedArrayBuffer`, que el core multihilo de ffmpeg.wasm necesita. Esas cabeceras están en `vite.config.ts` (desarrollo) y en `vercel.json` (producción).

Consecuencia práctica: **no puedes cargar recursos de terceros** (fuentes, imágenes, scripts de un CDN) sin que el navegador los bloquee. Todo debe servirse desde el propio origen.

Para comprobar que el aislamiento está activo, abre la consola del navegador y ejecuta `crossOriginIsolated`. Debe devolver `true`.

## Antes de abrir el pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Los cuatro deben pasar; el CI ejecuta exactamente eso.

## Convenciones

- **TypeScript estricto.** Evita `any`; si no queda otra, comenta por qué.
- **La lógica pura va separada de React.** Todo lo que construya argumentos de ffmpeg, valide entradas o decida capacidades vive en `src/core/` sin importar React, y lleva tests con Vitest.
- **Nuevos formatos** se añaden en `src/core/formats/catalog.ts`. La UI lee de ahí qué controles habilitar, así que no hace falta tocar componentes.
- **Textos de interfaz siempre vía i18n.** Añade la clave en `src/i18n/locales/es.json` y en `en.json`. Nada de cadenas hardcodeadas.
- **Mensajes de commit** en imperativo y en español o inglés, de forma consistente dentro del PR.

## Código de conducta

Al participar aceptas el [código de conducta](./CODE_OF_CONDUCT.md).
