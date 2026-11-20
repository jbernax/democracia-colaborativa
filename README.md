# Ágora normativa: democracia colaborativa

Plataforma abierta para leer planes públicos, señalar fallos y proponer mejoras en el texto entre ciudadanos y especialistas. Cada cambio queda guardado con su historial, su coste estimado y las áreas analizadas.

## Documentación de referencia

- Cómo funciona el modelo completo (pasos de revisión, análisis de impacto MAIN y nota ICMN): [MARCO_DEMOCRACIA_COLABORATIVA.md](docs/MARCO_DEMOCRACIA_COLABORATIVA.md)
- Reglas visuales y tipográficas de la interfaz: [DESIGN.md](DESIGN.md)

## Cómo funciona en GitHub (sin servidores de pago)

La web funciona entera sobre infraestructura gratuita estándar de GitHub:

| Pieza | Qué hace |
| :--- | :--- |
| GitHub Pages (`dist-pages/`) | Sirve la web estática, el catálogo (`catalog.json`) y la lógica compartida de `public/shared/`. Tus cambios se guardan como borrador en `localStorage` y puedes exportarlos a Markdown o JSON. |
| Catálogo en Git (`data/catalog/`) | Guarda cada plan como un JSON propio dentro de `data/catalog/plans/` y las ideas ciudadanas en `data/catalog/ideas.json`. |
| Puente a Issues y Pull Requests | El botón «Enviar a GitHub» abre un Issue ya rellenado con el bloque `agora-payload`. Si alguien con permiso le pone la etiqueta `aprobada-publicar`, GitHub Actions valida los datos, actualiza `data/catalog/` y abre un Pull Request a `main`. |

## Requisitos y comandos locales

Necesitas **Node.js >= 20.0.0** (no hace falta instalar paquetes externos):

- Arrancar el servidor local: `npm start`
- Ejecutar las pruebas: `npm test`
- Comprobar que el catálogo está bien formado: `npm run validate:catalog`
- Generar la versión estática para GitHub Pages: `npm run build:pages`
- Pasar todas las comprobaciones juntas: `npm run check`
