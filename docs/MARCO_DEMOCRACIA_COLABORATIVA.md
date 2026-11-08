# Marco de Democracia Colaborativa e Ingeniería Normativa Abierta (Piloto España)

## 1. Propósito y Diagnóstico Institucional

Los sistemas democráticos contemporáneos operan con un desfase estructural entre la complejidad técnica de las políticas públicas y los mecanismos disponibles para deliberar sobre ellas. En la práctica parlamentaria y administrativa actual:

1. **Fragmentación por bloques y conflicto binario**: Los planes gubernamentales y proyectos de ley suelen presentarse como paquetes cerrados donde la oposición y los agentes sociales se ven forzados a aceptar o rechazar el bloque completo, desperdiciando áreas de consenso técnico transversal.
2. **Opacidad de los efectos de segundo y tercer orden**: Una medida bienintencionada en un ámbito (por ejemplo, ampliar una reducción de jornada) puede generar efectos adversos no previstos en otros ejes (como la contratación en micropymes de menos de diez trabajadores, la desprotección de trabajadoras autónomas sin relevo disponible o la brecha futura en pensiones contributivas) si no se modela el sistema completo.
3. **Barreras de entrada asimétricas en la participación pública**: El actual trámite de *Audiencia e Información Pública* (Art. 133 de la Ley 39/2015) recoge alegaciones en documentos aislados (PDF o texto libre) que no dialogan entre sí, no se versionan, no permiten que un especialista jurídico complemente la idea de un ciudadano afectado, ni obligan a cuantificar cómo altera cada propuesta la Memoria del Análisis de Impacto Normativo (MAIN).

El **Marco de Democracia Colaborativa (Ágora Normativa)** resuelve estas tres deficiencias trasladando los principios del control de versiones distribuido (Git), la revisión por pares multidisciplinar y las pruebas de estrés (*red-teaming*) al diseño de planes públicos en España, priorizando un objetivo único: **la máxima calidad técnica, económica, jurídica y social de las soluciones adoptadas**.

---

## 2. Anclaje Jurídico y Administrativo en España

Para ser inmediatamente operativo sin requerir una reforma constitucional previa, el marco se despliega como una infraestructura técnica de elaboración normativa acoplada a cuatro instrumentos vigentes del ordenamiento jurídico español:

### 2.1. Ley 39/2015 (LPACAP, Art. 133) y Ley 50/1997 del Gobierno (Art. 26)
Sustituye el buzón pasivo de alegaciones en las fases de *Consulta Pública Previa* y *Audiencia e Información Pública* por un **Expediente Normativo Versionado**. Cada aportación ciudadana o técnica queda vinculada a un artículo, parámetro presupuestario o supuesto de hecho específico, manteniendo trazabilidad pública de qué enmiendas se han incorporado, cuáles están pendientes de co-autoría y por qué razón técnica se ha descartado o modificado una alternativa.

### 2.2. Real Decreto 931/2017: Memoria del Análisis de Impacto Normativo (MAIN) Viva
En lugar de redactar la MAIN como un documento burocrático *ex post* para justificar una decisión ya tomada, la MAIN se convierte en el **modelo computacional activo del plan**. Cualquier rama o modificación propuesta recalcula y expone de forma transparente cinco ejes obligatorios:
- **Eje 1 — Impacto Económico y Presupuestario**: Coste bruto para la Seguridad Social o Presupuestos Generales del Estado, retornos fiscales inducidos (IRPF, IVA, mantenimiento de empleo), coste neto anual y coste por beneficiario.
- **Eje 2 — Impacto Laboral, Empresarial y en PYMEs (*Test PYME*)**: Retención en el mercado de trabajo, fricción organizativa en microempresas (<10 empleados), cobertura efectiva del Régimen Especial de Trabajadores Autónomos (RETA) y costes de sustitución.
- **Eje 3 — Impacto Social, Demográfico y por Razón de Género**: Reducción de la penalización salarial por maternidad (*child penalty*), índice de corresponsabilidad entre progenitores, equidad en familias monoparentales y horas de cuidado presencial en la primera infancia.
- **Eje 4 — Impacto Medioambiental y Territorial (*Reto Demográfico*)**: Reducción de desplazamientos pendulares diarios, ahorro anual en emisiones equivalentes ($\text{ktCO}_2\text{e}/\text{año}$) y viabilidad de aplicación en municipios rurales (<5.000 habitantes).
- **Eje 5 — Viabilidad Jurídica y Operativa**: Artículos modificados (*Estatuto de los Trabajadores*, *Ley General de la Seguridad Social*, *Estatuto del Trabajo Autónomo*), adecuación a Directivas de la Unión Europea y jurisprudencia constitucional, y tiempo requerido de adaptación informática por el INSS y la TGSS.

### 2.3. Metodología de Evaluación Independiente (Estilo AIReF)
Los modelos paramétricos del plan utilizan supuestos demográficos y macroeconómicos explícitos y auditables (encuestas de población activa del INE, tablas salariales, distribución de empresas por tamaño del DIRCE y series de prestaciones del Ministerio de Inclusión, Seguridad Social y Migraciones). Cualquier partido, sindicato, organización empresarial o ciudadano puede inspeccionar los supuestos y comprobar el impacto bajo escenarios de sensibilidad pesimista, central u optimista.

---

## 3. La Tubería de Elaboración Progresiva (Resolución del Dilema Rigor vs. Accesibilidad)

Un fallo habitual de los sistemas técnicos de participación es exigir que cada proponente entregue una propuesta perfecta y completa en todos los ámbitos. Si a un ciudadano que detecta un problema real en el medio rural, o a un abogado laboralista que identifica una inconstitucionalidad en un inciso del artículo 37.6 del Estatuto de los Trabajadores, se le exige además calcular el impacto en emisiones de $\text{CO}_2$ y el coste actuarial para la Seguridad Social, su conocimiento se pierde.

Por el contrario, si se aceptan propuestas sin rigor ni evaluación de impacto, la calidad del plan se degrada.

El marco resuelve esta tensión mediante una **Tubería de Elaboración Progresiva en 4 Niveles**, donde el rigor es una propiedad exigida al **plan consolidado**, pero las aportaciones individuales pueden entrar con el nivel de especialización que cada participante posea:

### Nivel 1: Idea Ciudadana ("Pendiente de Elaborar")
- **Quién participa**: Cualquier ciudadano, trabajador afectado, pequeña empresa o colectivo social.
- **Qué aporta**: Una intuición constructiva, la descripción de un caso cotidiano no contemplado por la norma, o una propuesta preliminar en lenguaje natural. No requiere redactar texto legal ni rellenar tablas económicas.
- **Cómo actúa el sistema**: Registra la idea vinculándola al ámbito del plan y genera automáticamente **Etiquetas de Especialidad Requerida** (por ejemplo: `[Requiere Desarrollo Jurídico]`, `[Requiere Cuantificación Presupuestaria]`, `[Requiere Diseño Operativo PYME]`).

### Nivel 2: Enmienda de Dominio (Pull Request Parcial Especializado)
- **Quién participa**: Especialistas en una disciplina concreta (juristas del trabajo, economistas fiscales, técnicos de igualdad, ingenieros ambientales, graduados sociales, gestores administrativos).
- **Qué aporta**: Una modificación rigurosa dentro de su propio dominio de competencia —por ejemplo, la redacción técnica exacta de un apartado del artículo 37.6 del Estatuto de los Trabajadores o la estimación del coste de bonificación de contratos de interinidad—, bien por iniciativa propia o adoptando una Idea de Nivel 1.
- **Cómo actúa el sistema**: Valida el dominio cubierto por el especialista y publica la enmienda en el estado `Solicita Co-autoría Multidisciplinar`, listando explícitamente qué dominios de la MAIN faltan por completar antes de que la enmienda pueda fusionarse.

### Nivel 3: Enmienda Integrada Co-autorada (Pull Request Completo)
- **Quién participa**: Equipos multidisciplinares espontáneos o estructurados (cuando un economista, un técnico ambiental o un representante sectorial completa los dominios pendientes de una Enmienda de Nivel 2).
- **Qué aporta**: El diferencial normativo completo (*diff* de artículos), la variación paramétrica si procede y la evaluación en los ejes afectados de la MAIN, junto con la verificación de que no introduce nuevas debilidades críticas sin mitigar.
- **Cómo actúa el sistema**: Calcula automáticamente el diferencial de impacto ($\Delta$) frente a la rama base y habilita la revisión final para su fusión, reconociendo la co-autoría explícita de quien aportó la idea original y de cada especialista que completó un dominio.

### Nivel 4: Disposición Consolidada (Fusión en Rama o Tronco Común)
- **Resultado**: La enmienda se incorpora al historial versionado del plan (*commit normativo*), actualiza el texto articulado y las proyecciones presupuestarias/sociales, y cierra las auditorías de debilidad que haya mitigado.

---

## 4. Auditoría Sistemática de Debilidades (Stress Testing Público)

En la democracia adversarial tradicional, las debilidades de un plan se utilizan como arma retórica para desacreditar la totalidad de la propuesta, o bien son ocultadas por el proponente para evitar costes políticos. En el Marco de Democracia Colaborativa, **exponer una debilidad real con rigor es una contribución de primer orden**.

1. **Registro Estructurado de Debilidades**: Cualquier participante puede abrir un expediente de debilidad (*Stress Test*) indicando:
   - Artículo o supuesto donde se produce el fallo.
   - Colectivo, sector o territorio perjudicado (ej. *trabajadoras autónomas sin asalariados*, *familias monoparentales*, *turnos continuos en pymes industriales*).
   - Severidad objetiva:
     - `Crítica (Bloqueante)`: Vulneración constitucional o legal, inviabilidad presupuestaria o exclusión grave de un colectivo vulnerable. Impide que la rama supere el umbral de madurez para aprobación definitiva hasta que exista una cláusula de mitigación verificada.
     - `Alta`: Fricción operativa importante o efecto económico regresivo secundario que reduce sustancialmente el Índice de Madurez.
     - `Moderada (Caso Límite)`: Supuesto específico que requiere aclaración reglamentaria o ajuste técnico.
2. **Trazabilidad de Mitigación**: Una debilidad nunca se borra; pasa del estado `Abierta` a `En Mitigación` cuando una Enmienda (PR) se vincula a ella, y a `Mitigada y Verificada` cuando dicha enmienda se fusiona en el plan.

---

## 5. Arquitectura de Consenso Multipartidista: Tronco Común y Ramas de Exploración

Para superar la lógica de confrontación entre partidos políticos y agentes sociales, cada plan se estructura en dos capas:

1. **Tronco Común Consolidado (`tronco-comun`)**: Contiene el diagnóstico compartido y los artículos sobre los que existe consenso técnico y transversal (por ejemplo, que el ejercicio de la reincorporación progresiva compute al 100% de la base de cotización a efectos de jubilación y protección frente al despido improcedente).
2. **Ramas de Exploración (`ramas`)**: Cuando existen visiones legítimamente distintas sobre cómo distribuir los esfuerzos presupuestarios y organizativos, en lugar de bloquear la reforma se abren ramas paralelas completamente modeladas bajo los mismos datos base:
   - Cada rama mantiene sus propios parámetros, redacción articulada de los preceptos en disputa y métricas MAIN calculadas con idéntica metodología.
   - La **Matriz de Puentes y Compromisos (*Bridging Matrix*)** cruza las ramas con las prioridades de los distintos actores (sindicatos, organizaciones empresariales de PYMEs, grupos parlamentarios de distinto signo, colectivos de familias y hacienda pública), identificando qué combinación de cláusulas maximiza el bienestar agregado y minimiza los vetos cruzados.
   - A partir de esa matriz, se promueven **Enmiendas de Síntesis**: propuestas híbridas que toman, por ejemplo, el mecanismo de control horario flexible de una rama y el escudo protector para micropymes de otra.

---

## 6. Índice de Calidad y Madurez Normativa (ICMN)

Ningún plan o rama se evalúa por votos de popularidad simple ("me gusta / no me gusta"), vulnerables a campañas de movilización coordinada, sino mediante el **Índice de Calidad y Madurez Normativa ($\text{ICMN} \in [0, 100]$)**, compuesto por cuatro factores auditables:

$$\text{ICMN} = 0.30 \cdot C_{\text{MAIN}} + 0.30 \cdot S_{\text{Auditoría}} + 0.20 \cdot P_{\text{Consenso}} + 0.20 \cdot R_{\text{Jurídico}}$$

Donde:
- $C_{\text{MAIN}} \in [0, 100]$ (**Completitud Multidisciplinar MAIN**): Porcentaje de cobertura verificada de los 5 ejes de impacto (Económico, Laboral/PYME, Social/Igualdad, Ambiental/Territorial y Jurídico/Operativo).
- $S_{\text{Auditoría}} \in [0, 100]$ (**Solidez frente a Debilidades**): Parte de 100 y descuenta penalizaciones por cada debilidad abierta según su severidad ($-25$ por cada debilidad `Crítica`, $-12$ por cada `Alta`, $-5$ por cada `Moderada`), recuperando la puntuación a medida que se fusionan enmiendas mitigadoras.
- $P_{\text{Consenso}} \in [0, 100]$ (**Índice de Puente Transversal**): Mide la proporción de sectores y sensibilidades distintas (laboral, empresarial, fiscal, familiar, territorial) cuyas exigencias mínimas de viabilidad quedan satisfechas simultáneamente por la rama.
- $R_{\text{Jurídico}} \in [0, 100]$ (**Precisión Normativa y Operativa**): Evalúa el grado de concreción del texto articulado, su compatibilidad con el marco constitucional/europeo y la viabilidad de los plazos de implantación administrativa.

> **Regla de Calidad**: Una rama solo alcanza el estado `Apta para Tramitación Legislativa` cuando $\text{ICMN} \ge 80$ y el número de debilidades de severidad `Crítica` abiertas es exactamente $0$.
