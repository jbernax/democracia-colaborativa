# Marco de democracia colaborativa en España

## 1. Qué problema intenta resolver

Hoy en día, las leyes y planes públicos suelen llegar cerrados y cuesta mucho participar en ellos con rigor. En la práctica pasan tres cosas:

1. **Todo o nada**: los planes llegan como paquetes cerrados. La oposición y los grupos afectados solo pueden aceptar o rechazar el bloque entero, aunque coincidan en la mitad de las medidas.
2. **Efectos ocultos en otros sectores**: una buena idea en un área (por ejemplo, reducir la jornada tras un nacimiento) puede causar problemas en otra si no se miran las consecuencias. Puede complicar los turnos en pymes de menos de diez personas o dejar atrás a las autónomas.
3. **Alegaciones sueltas**: en las consultas públicas actuales (art. 133 de la Ley 39/2015), la gente envía PDFs que nadie cruza entre sí. Un vecino afectado no puede juntar su experiencia con el análisis de un abogado o un economista.

Este marco aplica a las políticas públicas la forma de trabajar por versiones (como en Git), el análisis entre varias disciplinas y la revisión abierta de fallos. El objetivo es sencillo: sacar adelante normas más claras, mejor pensadas y con más acuerdo.

---

## 2. Cómo encaja en la ley española actual

Este sistema funciona dentro de las leyes españolas vigentes, sin necesidad de cambiar la Constitución. Se apoya en tres herramientas que ya existen:

### 2.1. Ley 39/2015 (art. 133) y Ley 50/1997 del Gobierno (art. 26)
Cambia el buzón de PDFs sueltos de las consultas públicas por un expediente abierto con historial. Cada comentario o propuesta apunta a un apartado o cifra concreta. Así todo el mundo ve qué cambios se han aceptado, cuáles siguen esperando análisis y por qué se descartó una alternativa.

### 2.2. Real Decreto 931/2017: análisis de impacto vivo (MAIN)
En lugar de escribir la Memoria del Análisis de Impacto Normativo (MAIN) al final solo para cumplir el trámite, aquí funciona como una calculadora viva. Cada cambio que propones actualiza cinco áreas clave:

| Área | Qué mide |
| :--- | :--- |
| 1. Cuentas públicas | Coste bruto para Hacienda o la Seguridad Social, retorno en impuestos y coste neto por persona. |
| 2. Empleo y pymes | Cómo afecta a la contratación, a los turnos en empresas de menos de 10 personas y a los autónomos (RETA). |
| 3. Impacto social e igualdad | Brecha salarial, tiempo de cuidado, reparto entre madres y padres y familias monoparentales. |
| 4. Clima y medio rural | Ahorro de desplazamientos, emisiones de $\text{CO}_2$ ($\text{ktCO}_2\text{e}/\text{año}$) y viabilidad en pueblos de menos de 5.000 habitantes. |
| 5. Encaje legal y plazos | Leyes que cambian (*Estatuto de los Trabajadores*, *Ley General de la Seguridad Social*, *Estatuto del Trabajo Autónomo*), respeto a normas europeas y meses que tarda el INSS en ponerlo en marcha. |

### 2.3. Datos abiertos y verificables (estilo AIReF)
Todos los cálculos parten de datos oficiales y públicos (INE, DIRCE y Seguridad Social). Cualquier partido, sindicato, asociación o ciudadano puede revisar las cifras y probar escenarios optimistas o pesimistas.

---

## 3. Cómo participa cada persona (4 niveles)

Muchas plataformas piden a todo el mundo textos legales perfectos y cálculos económicos desde el primer día. Si a un vecino de un pueblo o a un abogado laboralista le exiges calcular emisiones de $\text{CO}_2$ y el gasto para la Seguridad Social, deja de participar.

Por el contrario, aceptar ideas sin revisar sus consecuencias baja la calidad de la ley.

Aquí el rigor se exige al **plan final**, no a cada aportación individual. Cualquier propuesta va sumando piezas paso a paso en cuatro niveles:

### Nivel 1: idea ciudadana
- **Quién participa**: cualquier persona, trabajador, autónomo o asociación.
- **Qué aporta**: cuenta un problema real o una idea con sus palabras, sin redactar artículos legales ni hacer números.
- **Qué hace el sistema**: guarda la idea y marca qué áreas faltan por analizar (por ejemplo, encaje legal, presupuesto o efecto en pymes).

### Nivel 2: propuesta de un área
- **Quién participa**: especialistas en derecho, economía, igualdad, medio ambiente o gestión laboral.
- **Qué aporta**: redacta el cambio concreto en su campo o desarrolla una idea de nivel 1.
- **Qué hace el sistema**: valida esa parte y deja la propuesta en estado `Solicita co-autoría`, indicando qué áreas quedan pendientes.

### Nivel 3: propuesta completa
- **Quién participa**: equipos formados de manera abierta cuando otros especialistas cubren las áreas que faltaban.
- **Qué aporta**: el cambio exacto de texto, las nuevas cifras de impacto y la comprobación de que no crea fallos graves nuevos.
- **Qué hace el sistema**: calcula la diferencia ($\Delta$) frente a la opción actual, muestra a todas las personas autoras y deja la propuesta lista para incorporar.

### Nivel 4: texto incorporado al plan
- **Qué pasa**: el cambio entra en el texto oficial del plan, queda registrado en el historial y cierra los fallos que haya resuelto.

---

## 4. Detectar puntos débiles desde el principio

En el debate político clásico, señalar un fallo sirve para tumbar el plan entero, y quien lo propone suele esconder los problemas para evitar críticas. Aquí ocurre al revés: **encontrar un fallo real a tiempo ayuda a mejorar el plan**.

Cualquiera puede abrir un aviso de punto débil indicando qué apartado falla, a quién perjudica (por ejemplo, autónomas sin empleados o familias monoparentales) y su gravedad:

- `Crítica`: choca con una ley superior, es imposible de pagar o deja fuera a un grupo vulnerable. Bloquea la aprobación del plan hasta que exista una solución probada.
- `Alta`: causa problemas serios de organización o efectos injustos, y baja mucho la nota del plan.
- `Moderada`: afecta a un caso concreto que necesita un ajuste o aclaración.

Los avisos nunca se borran. Pasan de `Abierta` a `En mitigación` cuando una propuesta intenta resolverlos, y a `Mitigada` cuando esa solución entra en el texto del plan.

---

## 5. Puntos en común y opciones alternativas

Para evitar bloqueos de todo o nada, cada plan separa lo que ya genera acuerdo de lo que sigue abierto:

1. **Puntos ya acordados (`tronco-comun`)**: incluye el diagnóstico compartido y las reglas en las que casi todo el mundo coincide. Por ejemplo, que la cotización para la pensión siga al 100% durante la reducción de jornada.
2. **Opciones paralelas (`ramas`)**: cuando hay formas distintas de repartir el presupuesto o los plazos, se comparan varias opciones bajo los mismos datos oficiales.

El simulador cruza cada opción con las prioridades de sindicatos, pymes, cuentas públicas, familias y mundo rural. Así se ve dónde hay acuerdo y se pueden combinar las mejores ideas de dos opciones en una propuesta nueva.

---

## 6. Nota de calidad del plan (ICMN)

Los planes no se aprueban por votos simples de «me gusta» o «no me gusta», que son fáciles de manipular. Se miden con el **Índice de Calidad y Madurez Normativa ($\text{ICMN} \in [0, 100]$)**, formado por cuatro notas visibles:

$$\text{ICMN} = 0.30 \cdot C_{\text{MAIN}} + 0.30 \cdot S_{\text{Auditoría}} + 0.20 \cdot P_{\text{Consenso}} + 0.20 \cdot R_{\text{Jurídico}}$$

- $C_{\text{MAIN}} \in [0, 100]$ (**Áreas de impacto cubiertas**): cuántas de las cinco áreas MAIN están analizadas y cubiertas.
- $S_{\text{Auditoría}} \in [0, 100]$ (**Resistencia a fallos**): empieza en 100 y resta puntos por cada fallo abierto ($-25$ por fallo `Crítico`, $-12$ por `Alto` y $-5$ por `Moderado`). Recupera puntos al resolverse.
- $P_{\text{Consenso}} \in [0, 100]$ (**Acuerdo entre sectores**): mide cuántos sectores distintos (trabajadores, pymes, cuentas públicas, familias y medio rural) cumplen sus requisitos mínimos.
- $R_{\text{Jurídico}} \in [0, 100]$ (**Claridad del texto**): valora si los artículos son concretos, respetan la ley y tienen plazos realistas.

> **Regla de calidad**: un plan solo queda listo para tramitar cuando logra $\text{ICMN} \ge 80$ y tiene exactamente $0$ fallos `Críticos` abiertos.
