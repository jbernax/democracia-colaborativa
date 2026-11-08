# Ágora Normativa: Marco de Democracia Colaborativa

Plataforma abierta para la **revisión y mejora colaborativa de planes y políticas públicas**, diseñada para elevar la calidad técnica y social de las decisiones administrativas, facilitar propuestas de cambio y recoger la voz ciudadana.

---

## Características Principales

1. **Portada y Catálogo de Planes (Sin pestañas complejas)**:
   - Punto de entrada limpio donde explorar diferentes planes y proyectos normativos (por fecha reciente, popularidad o pendientes de aportaciones).
   - Acceso inmediato a planes reales de política pública:
     - **Plan de Reincorporación Laboral Progresiva Post-Maternidad/Paternidad** (`EXP-2026-MTES-042`).
     - **Estrategia de Conectividad y Teletrabajo en Municipios del Reto Demográfico** (`EXP-2026-TRD-018`).
     - **Plan de Simplificación de Cargas Administrativas para Micropymes y Autónomos** (`EXP-2026-ECO-031`).
2. **Ideas Ciudadanas para Nuevos Planes**:
   - Espacio en la portada para proponer nuevas ideas o necesidades prioritarias en lenguaje natural, permitiendo originar nuevos planes desde la experiencia ciudadana.
3. **Lectura Monográfica de Planes**:
   - Cada plan se presenta como un documento continuo y legible (diagnóstico, articulado normativo propuesto, evaluación de impacto económico y puntos críticos).
4. **Propuestas de Cambio Directas (Enmiendas con Diff)**:
   - Cualquier participante puede proponer cambios de texto sobre una sección específica. La plataforma calcula y muestra el diferencial (*diff* con adiciones en verde y eliminaciones tachadas en rojo) y la justificación técnica.
5. **Debate y Alerta de Puntos Críticos**:
   - Espacio para exponer advertencias operativas, casos límite o aportaciones ciudadanas asociadas a cada plan.

---

## Estructura del Repositorio

- [docs/MARCO_DEMOCRACIA_COLABORATIVA.md](file:///home/antigravity/Projects/Democracia_Colaborativa/docs/MARCO_DEMOCRACIA_COLABORATIVA.md): Especificación formal del marco metodológico e institucional.
- [src/data/projectsData.js](file:///home/antigravity/Projects/Democracia_Colaborativa/src/data/projectsData.js): Catálogo inicial de planes monográficos, propuestas e ideas.
- [src/store/repositoryStore.js](file:///home/antigravity/Projects/Democracia_Colaborativa/src/store/repositoryStore.js): Persistencia en disco (`data/projects_state.json`).
- [src/server.js](file:///home/antigravity/Projects/Democracia_Colaborativa/src/server.js): Servidor HTTP y API REST simplificada.
- [public/index.html](file:///home/antigravity/Projects/Democracia_Colaborativa/public/index.html), [public/styles.css](file:///home/antigravity/Projects/Democracia_Colaborativa/public/styles.css), [public/app.js](file:///home/antigravity/Projects/Democracia_Colaborativa/public/app.js): Interfaz web sobria y editorial.
- [tests/engine.test.js](file:///home/antigravity/Projects/Democracia_Colaborativa/tests/engine.test.js): Pruebas automatizadas.
