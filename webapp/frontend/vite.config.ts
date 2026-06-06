import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// emscripten-wasm-loader macht `import * as nanoid from 'nanoid'; nanoid(45)`.
// Ein ESM-Namespace ist im Browser-Bundle nicht aufrufbar (-> "t is not a
// function"). Wir ersetzen den Import in genau dieser Vendordatei durch eine
// kleine inline-Implementierung (kein nanoid-Versionsproblem mehr).
function fixEmscriptenNanoid(): Plugin {
  return {
    name: 'fix-emscripten-nanoid',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('node_modules')) return null
      let out = code
      // 1) `import * as nanoid` -> inline-Implementierung (nicht aufrufbar als NS)
      if (/import \* as nanoid from ['"]nanoid['"]/.test(out)) {
        out = out.replace(
          /import \* as nanoid from ['"]nanoid['"];?/,
          "const nanoid = (size) => { const a = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'; let id = ''; let i = size || 21; while (i--) id += a[(Math.random() * 64) | 0]; return id; };"
        )
      }
      // 2) Emscripten-Factory wird als `runtimeModule(...)` aufgerufen, aber als
      //    Namespace importiert. Auf Default-Import umstellen (CJS module.exports
      //    = callable factory).
      if (id.includes('hunspell-asm') && /import \* as runtime from/.test(out)) {
        out = out.replace(
          /import \* as runtime from (['"][^'"]+['"])/,
          'import runtime from $1'
        )
      }
      return out === code ? null : { code: out, map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [fixEmscriptenNanoid(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Nicht vorab bündeln, damit das nanoid/runtime-Patch-Plugin auch im
  // Dev-Modus auf diese Pakete angewandt wird.
  optimizeDeps: {
    exclude: ['hunspell-asm', 'emscripten-wasm-loader'],
  },
})
