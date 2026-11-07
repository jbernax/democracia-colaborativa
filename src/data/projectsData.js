/**
 * Catalogo de Planes y Proyectos de Politica Publica (Piloto Espana)
 * Cada plan se estructura como una monografia legible con secciones, propuestas de cambio y opiniones.
 */

import { computeClauseDiff } from '../engine/collaborationEngine.js';

export function createInitialProjectsCatalog() {
  const projects = [
    {
      id: 'reincorporacion-laboral-maternidad',
      code: 'EXP-2026-MTES-042',
      title: 'Plan de Reincorporacion Laboral Progresiva Post-Maternidad/Paternidad',
      category: 'Empleo y Familias',
      stage: 'Debate abierto',
      summary:
        'Reforma del Art. 37.6 del Estatuto de los Trabajadores y de la Ley General de la Seguridad Social para permitir una vuelta gradual al empleo tras las 16 semanas mediante media jornada bonificada o rampa progresiva, preservando cotizaciones y protegiendo a micropymes y autonomas.',
      createdAt: '2026-10-15',
      updatedAt: '2026-10-31',
      popularity: 142,
      monograph: [
        {
          id: 'diagnostico',
          title: '1. Diagnostico y Justificacion Social',
          content: `En Espana, al concluir las 16 semanas iniciales del permiso por nacimiento y cuidado de menor (Art. 48.4 del Estatuto de los Trabajadores), el retorno abrupto a la jornada completa de 40 horas semanales coincide con la etapa de lactancia exclusiva recomendada por la OMS (hasta los 6 meses de vida).

Esta rigidez provoca que un 18,4% de las madres trabajadoras recurran a excedencias sin retribucion o abandonen temporalmente su puesto. Asimismo, la actual reduccion por guarda legal (Art. 37.6 ET) acarrea una merma salarial proporcional integra que recae en un 89% sobre las mujeres, agravando la penalizacion salarial por maternidad ("child penalty") evaluada en un 11,2% a cinco anos vista.

El objetivo central de este plan es sustituir el retorno de choque por una reincorporacion laboral progresiva protegida, donde el tiempo dedicado al cuidado durante el primer ano cuente con compensacion economica de la Seguridad Social y mantenga la cotizacion al 100% para evitar futuras brechas de pension.`
        },
        {
          id: 'articulado',
          title: '2. Medidas y Articulado Propuesto',
          content: `Articulo 37.6 bis (Nuevo). Derecho a la Reincorporacion Progresiva Post-Natal:
1. Una vez agotadas las dieciseis semanas del permiso por nacimiento, las personas trabajadoras tendran derecho a una reduccion del 50 por ciento de su jornada de trabajo durante un periodo de ocho meses continuados.
2. Durante este periodo, la persona trabajadora percibira el 50 por ciento de su salario ordinario a cargo de la empresa, complementado con un subsidio de la Seguridad Social equivalente al 80 por ciento de la reduccion salarial, garantizando una retribucion final efectiva del 90 por ciento de su base previa.
3. Las bases de cotizacion de la persona trabajadora durante la reduccion se mantendran computadas al 100 por ciento a efectos de prestaciones de jubilacion, incapacidad permanente y desempleo.
4. Las empresas que formalicen contratos de sustitucion a tiempo parcial para cubrir las horas no trabajadas disfrutaran de una bonificacion del 75 por ciento en las cotizaciones empresariales a la Seguridad Social (95 por ciento en microempresas de menos de diez trabajadores).

Disposicion Adicional RETA:
Las trabajadoras incluidas en el Regimen Especial de Trabajadores Autonomos (RETA) tendran derecho durante dicho tramo a una ayuda mensual de conciliacion y relevo de 750 euros para sostener la contratacion de apoyo o la continuidad del negocio.`
        },
        {
          id: 'impacto',
          title: '3. Evaluacion de Impacto Economico y Laboral',
          content: `De acuerdo con las estimaciones de gasto sobre una cohorte anual de 265.000 progenitores ocupados:
- Coste bruto para el sistema de Seguridad Social: aproximadamente 1.580 millones de euros anuales.
- Retorno fiscal y contributivo inducido: retorno directo estimado de 367 millones de euros anuales derivados de la mayor tasa de retencion en el empleo femenino, recaudacion por IRPF/IVA y cotizaciones de los contratos de relevo creados.
- Coste neto final para la Administracion: 1.213 millones de euros anuales (4.577 euros netos por beneficiario).
- Impacto en empleo de sustitucion: se proyecta la creacion de mas de 22.000 puestos equivalentes a tiempo completo mediante contratos de relevo incentivados.
- Impacto de genero: reduccion prevista del 42% en las excedencias no retribuidas y disminucion de la penalizacion salarial a cinco anos del 11,2% al 6,1%.`
        },
        {
          id: 'puntos-criticos',
          title: '4. Aspectos a Debate y Puntos Criticos',
          content: `El diseno actual mantiene abiertos tres aspectos esenciales que requieren consenso entre las partes:
1. Dificultades operativas en micropymes industriales y sanitarias: cubrir fracciones de solo cuatro horas diarias en puestos a turnos rotatorios resulta complejo. Se debate permitir la compactacion de la reduccion en dias completos alternos (semana de 2,5 dias).
2. Cobertura de familias monoparentales: conforme a la doctrina constitucional (STC 140/2024), se plantea si la madre o progenitor unico debe poder acumular el tramo que habria correspondido a un segundo progenitor con un multiplicador de 1,8x.
3. Garantia de corresponsabilidad: incentivar que ambos progenitores compartan el tramo progresivo para evitar que la reduccion se concentre exclusivamente en las madres.`
        }
      ],
      proposals: [
        {
          id: 'prop-1',
          sectionId: 'articulado',
          title: 'Permitir compactar la reduccion en jornadas completas alternas en micropymes',
          author: 'Marcos Ibanez (Asociacion de Pequenas Empresas)',
          originalText:
            '1. Una vez agotadas las dieciseis semanas del permiso por nacimiento, las personas trabajadoras tendran derecho a una reduccion del 50 por ciento de su jornada de trabajo durante un periodo de ocho meses continuados.',
          proposedText:
            '1. Una vez agotadas las dieciseis semanas del permiso por nacimiento, las personas trabajadoras tendran derecho a una reduccion del 50 por ciento de su jornada de trabajo durante un periodo de ocho meses continuados. En microempresas de menos de veinticinco trabajadores o en centros con trabajo a turnos, previo acuerdo entre las partes, la reduccion podra acumularse en jornadas completas alternas.',
          reason:
            'En talleres, comercio y clinicas pequenas de 3 a 5 trabajadores, contratar a un relevista para solo 4 horas al dia genera vacantes desiertas. Agrupar las horas en dias completos facilita contratar a una persona por jornadas completas y resolver el relevo sin friccion.',
          status: 'Abierta para debate',
          createdAt: '2026-10-22'
        },
        {
          id: 'prop-2',
          sectionId: 'articulado',
          title: 'Equiparacion expresa del multiplicador en familias monoparentales (1,8x)',
          author: 'Dra. Elena Gomez (Jurista Laboralista)',
          originalText:
            '2. Durante este periodo, la persona trabajadora percibira el 50 por ciento de su salario ordinario a cargo de la empresa, complementado con un subsidio de la Seguridad Social equivalente al 80 por ciento de la reduccion salarial, garantizando una retribucion final efectiva del 90 por ciento de su base previa.',
          proposedText:
            '2. Durante este periodo, la persona trabajadora percibira el 50 por ciento de su salario ordinario a cargo de la empresa, complementado con un subsidio de la Seguridad Social equivalente al 80 por ciento de la reduccion salarial, garantizando una retribucion final efectiva del 90 por ciento de su base previa. En el caso de familias monoparentales, la persona progenitora unica podra disfrutar de un tramo ampliado mediante la aplicacion de un coeficiente de 1,8 sobre la duracion maxima prevista.',
          reason:
            'Alinea la ley con la sentencia del Tribunal Constitucional STC 140/2024 para no discriminar al menor en hogares monoparentales, que en un 81% estan sustentados unicamente por una madre trabajadora.',
          status: 'Abierta para debate',
          createdAt: '2026-10-25'
        }
      ],
      opinions: [
        {
          id: 'op-1',
          author: 'Lucia M. (Madre y dependienta de comercio)',
          type: 'Aportacion ciudadana',
          text: 'Si la empresa me obliga a hacer la media jornada en turnos partidos (2 horas por la manana y 2 por la tarde), no me sirve de nada porque la guarderia cierra a las 16:00. La ley debe garantizar que la reduccion se ejerza dentro de un turno continuado.',
          createdAt: '2026-10-28'
        },
        {
          id: 'op-2',
          author: 'Javier S. (Economista fiscal)',
          type: 'Propuesta tecnica',
          text: 'El calculo de retorno presupuestario es muy realista. Al evitar que la madre salga del mercado laboral formal, se mantiene la recaudacion por IRPF y cuotas contributivas durante toda su vida laboral restante.',
          createdAt: '2026-10-29'
        },
        {
          id: 'op-3',
          author: 'Carmen T. (Federacion de Autonomas RETA)',
          type: 'Alerta de debilidad',
          text: 'El bono de 750 euros mensuales para autonomas es un gran avance, pero debe tramitarse como pago directo del INSS en los primeros 5 dias del mes. Si la trabajadora tiene que adelantar el dinero, muchas no podran acogerse por falta de liquidez.',
          createdAt: '2026-10-30'
        }
      ]
    },
    {
      id: 'teletrabajo-municipios-rurales',
      code: 'EXP-2026-TRD-018',
      title: 'Estrategia de Conectividad y Teletrabajo en Municipios del Reto Demografico',
      category: 'Desarrollo Rural y Reto Demografico',
      stage: 'Pendiente de aportaciones',
      summary:
        'Plan integral para habilitar espacios de trabajo compartido (coworking rural comarcal), bonificaciones fiscales para empresas que permitan el teletrabajo desde poblaciones de menos de 5.000 habitantes y cobertura gigabit garantizada.',
      createdAt: '2026-10-18',
      updatedAt: '2026-10-29',
      popularity: 98,
      monograph: [
        {
          id: 'diagnostico',
          title: '1. Diagnostico del Despoblamiento y Brecha Territorial',
          content: `Mas del 60 por ciento de los municipios espanoles cuentan con menos de 1.000 habitantes y experimentan un envejecimiento demografico continuo. Sin embargo, el despliegue del teletrabajo tras 2020 demostro que un porcentaje relevante de profesionales puede desarrollar su actividad fuera de las grandes urbes si dispone de conexion de alta velocidad fiable y servicios basicos.

La principal barrera actual reside en la falta de infraestructura de conexion redundante en pequenos nucleos, la ausencia de incentivos claros para que las empresas autoricen el teletrabajo permanente en zonas rurales y el aislamiento social de profesionales que trabajan desde domicilios sin espacios de colaboracion comarcal.`
        },
        {
          id: 'articulado',
          title: '2. Medidas y Normativa Propuesta',
          content: `1. Red Nacional de Espacios de Teletrabajo Comarcal: Financiacion conjunta Estado-Comunidades Autonomas para habilitar un centro publico de coworking con conexion de fibra gigabit por satelite/fibra y sala polivalente en cada comarca rural de menos de 15.000 habitantes.
2. Deduccion en el Impuesto sobre Sociedades por Puesto Rural: Deduccion de 2.000 euros anuales por cada empleado que traslade su residencia efectiva y fije su domicilio fiscal en un municipio de menos de 5.000 habitantes en modalidad de trabajo a distancia al menos el 80% de su jornada.
3. Tarifa Plana de Conectividad Rural: Subvencion directa del 50 por ciento en el coste de abono a internet de banda ancha de alta capacidad para profesionales autonomos y trabajadores desplazados en municipios rurales prioritarios.`
        },
        {
          id: 'impacto',
          title: '3. Proyeccion de Efectos Economicos y Demograficos',
          content: `El coste previsto de inversion inicial en infraestructura comarcal asciende a 140 millones de euros en tres anos, con un gasto fiscal anual recurrente por deducciones de 65 millones de euros.

Se estima que la medida facilitaria la radicacion de 28.000 familias en municipios rurales en el primer trienio, dinamizando el comercio local, el mantenimiento de escuelas rurales de educacion infantil y primaria y reduciendo la huella de carbono derivada de los desplazamientos diarios interurbanos en mas de 45 kilotoneladas de CO2 anuales.`
        },
        {
          id: 'puntos-criticos',
          title: '4. Aspectos a Debate',
          content: `Aspectos en discusion ciudadana y tecnica:
- Criterios de empadronamiento real: mecanismos para evitar fraudes en deducciones sin arraigo efectivo en el municipio.
- Sostenibilidad de los centros comarcales: gestion mediante cooperativas locales frente a gestion municipal directa.
- Dotacion de servicios complementarios (medico rural y transporte a demanda) para evitar que la iniciativa fracase por falta de servicios basicos.`
        }
      ],
      proposals: [
        {
          id: 'prop-rural-1',
          sectionId: 'articulado',
          title: 'Ampliar la deduccion a micropymes radicadas originalmente en el pueblo',
          author: 'Asociacion de Jovenes Agricultores y Autonomos Rurales',
          originalText:
            '2. Deduccion en el Impuesto sobre Sociedades por Puesto Rural: Deduccion de 2.000 euros anuales por cada empleado que traslade su residencia efectiva y fije su domicilio fiscal en un municipio de menos de 5.000 habitantes en modalidad de trabajo a distancia al menos el 80% de su jornada.',
          proposedText:
            '2. Deduccion en el Impuesto sobre Sociedades por Puesto Rural: Deduccion de 2.000 euros anuales por cada empleado que traslade o mantenga su residencia efectiva y domicilio fiscal en un municipio de menos de 5.000 habitantes, extendiendo esta deduccion a las microempresas autoctonas que contraten personal residente local.',
          reason:
            'No solo hay que atraer a nuevos teletrabajadores de grandes ciudades; tambien se debe apoyar a las pequenas empresas y personas que ya viven y resisten en los municipios rurales para que no se sientan discriminadas respecto a los recien llegados.',
          status: 'Abierta para debate',
          createdAt: '2026-10-27'
        }
      ],
      opinions: [
        {
          id: 'op-r-1',
          author: 'Manuel B. (Alcalde de municipio en Teruel)',
          type: 'Aportacion ciudadana',
          text: 'El coworking comarcal debe tener servicio de guarderia o espacio infantil por horas. De lo contrario, las parejas jovenes con bebes no pueden teletrabajar concentradas.',
          createdAt: '2026-10-26'
        }
      ]
    },
    {
      id: 'simplificacion-pymes-autonomos',
      code: 'EXP-2026-ECO-031',
      title: 'Plan de Simplificacion de Cargas Administrativas para Micropymes y Autonomos',
      category: 'Economia y PYMEs',
      stage: 'Debate abierto',
      summary:
        'Proyecto de ley de Ventanilla Unica Cero Burocracia: declaracion responsable unica anual, eliminacion de duplicidades entre Seguridad Social y Agencia Tributaria, y reduccion de plazos maximos de resolucion administrativa a 15 dias.',
      createdAt: '2026-10-10',
      updatedAt: '2026-10-28',
      popularity: 115,
      monograph: [
        {
          id: 'diagnostico',
          title: '1. Diagnostico del Exceso Burocratico en Espana',
          content: `Una microempresa espanola de 1 a 5 trabajadores dedica una media de 180 horas al ano al cumplimiento de obligaciones burocraticas y remision repetida de los mismos datos a distintas administraciones publicas (Hacienda, Seguridad Social, Comunidades Autonomas y Ayuntamientos).

La falta de interoperabilidad entre bases de datos estatales y autonomicas vulnera en la practica el derecho reconocido en el Art. 53 de la Ley 39/2015 a no presentar documentos que ya obren en poder de la Administracion.`
        },
        {
          id: 'articulado',
          title: '2. Medidas y Articulado de Simplificacion',
          content: `1. Principio de "Una Sola Vez" (Once Only): Prohibicion expresa de solicitar certificados de estar al corriente con la Seguridad Social o con la Agencia Tributaria en cualquier procedimiento administrativo de licitacion o ayuda publica, comprobando el dato de oficio en tiempo real.
2. Declaracion Informativa Unificada para Microempresas: Unificacion de los modelos trimestrales de IVA, retenciones y resumenes en una unica liquidacion digital simplificada asistida.
3. Silencio Administrativo Positivo para Licencias de Actividad Inocuas: En actividades comerciales sin impacto ambiental relevante, la comunicacion previa surtira efectos inmediatos para la apertura sin necesidad de esperar licencia municipal previa.`
        },
        {
          id: 'impacto',
          title: '3. Evaluacion de Costes y Eficiencia Productiva',
          content: `El coste de integracion informatica entre plataformas estatales es de 18 millones de euros.

A cambio, el ahorro anual estimado en costes indirectos de gestion para el tejido productivo asciende a 720 millones de euros anuales, liberando tiempo util de gestion que redundara en mayor productividad y supervivencia empresarial durante los dos primeros anos de actividad.`
        },
        {
          id: 'puntos-criticos',
          title: '4. Aspectos a Debate',
          content: `Puntos en debate:
- Garantias frente a morosidad o infracciones en caso de silencio positivo sin verificacion posterior.
- Coordinacion con ayuntamientos de menor tamano que carecen de medios informaticos para conectarse en tiempo real a las plataformas estatales.`
        }
      ],
      proposals: [],
      opinions: [
        {
          id: 'op-pyme-1',
          author: 'Sofia N. (Gestora administrativa)',
          type: 'Propuesta tecnica',
          text: 'Es fundamental que el sistema RED y la sede de la Agencia Tributaria compartan un calendario comun de liquidacion, evitando que coincidan vencimientos de cotizaciones e IVA en el mismo dia habil del trimestre.',
          createdAt: '2026-10-24'
        }
      ]
    }
  ];

  // Calcular diff de las propuestas pre-cargadas
  for (const project of projects) {
    for (const prop of project.proposals) {
      if (!prop.diff) {
        prop.diff = computeClauseDiff(prop.originalText, prop.proposedText);
      }
    }
  }

  const seeds = [
    {
      id: 'idea-01',
      title: 'Bancos de tiempo municipales respaldados por ley para cuidados comunitarios',
      category: 'Servicios Sociales y Cuidados',
      author: 'Maria Jose G. (Asociacion Vecinal)',
      description:
        'Establecer una base legal que permita a los ayuntamientos certificar horas de apoyo y cuidado entre vecinos (cuidado de mayores o acompanamiento escolar) con incentivos en tasas locales.',
      votes: 38,
      createdAt: '2026-10-29'
    },
    {
      id: 'idea-02',
      title: 'Marco unificado para la reutilizacion de locales comerciales vacios como talleres o viveros juveniles',
      category: 'Urbanismo y Juventud',
      author: 'David L. (Arquitecto y Urbanista)',
      description:
        'En muchas ciudades hay cientos de bajos cerrados con carteles de alquiler durante anos. Una ley que bonifique el IBI al propietario si lo cede a proyectos cooperativos juveniles reactivaria los barrios.',
      votes: 29,
      createdAt: '2026-10-31'
    }
  ];

  return { projects, seeds };
}
