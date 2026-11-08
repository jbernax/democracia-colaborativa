/**
 * Datos iniciales del Caso Piloto España:
 * "Plan Nacional de Reincorporación Laboral Progresiva Post-Maternidad/Paternidad y Corresponsabilidad"
 * Reforma del Art. 37.6 del Estatuto de los Trabajadores (RD Legislativo 2/2015) y LGSS (RD Legislativo 8/2015).
 */

import {
  MATURITY_LEVELS,
  computeClauseDiff,
  recomputeAllBranchMetrics
} from '../engine/collaborationEngine.js';
import { computeImpactDelta } from '../engine/impactSimulator.js';

export function createInitialPilotState() {
  const state = {
    metadata: {
      expedienteCode: 'EXP-MAIN-2026-MTES-042',
      title:
        'Plan Nacional de Reincorporación Laboral Progresiva Post-Maternidad/Paternidad y Corresponsabilidad',
      subtitle:
        'Reforma del Art. 37.6 del Estatuto de los Trabajadores y Capítulo VII de la Ley General de la Seguridad Social',
      jurisdiction: 'España (Ámbito Estatal - Legislación Laboral y de Seguridad Social)',
      legalInstruments: [
        'Art. 133 Ley 39/2015 (Procedimiento Administrativo Común - Participación Pública)',
        'Art. 26 Ley 50/1997 del Gobierno (Procedimiento de Elaboración de Normas con Rango de Ley)',
        'Real Decreto 931/2017 (Memoria del Análisis de Impacto Normativo - MAIN)',
        'Directiva (UE) 2019/1158 relativa a la conciliación de la vida familiar y profesional'
      ],
      problemStatement:
        'En España, tras concluir las 16 semanas del permiso por nacimiento y cuidado de menor (Art. 48.4 ET), el paso abrupto a la jornada completa de 40 horas semanales cuando el lactante tiene apenas 4 meses provoca un 18,4% de excedencias no retribuidas, reducciones de jornada con pérdida salarial íntegra (Art. 37.6 ET vigente) o abandonos del mercado laboral, recayendo en un 89% sobre las madres trabajadoras.',
      statutoryBaseline: [
        {
          id: 'vigente-art-37-6-et',
          articleNumber: 'Art. 37.6 ET (Texto Vigente)',
          title: 'Reducción de jornada por guarda legal sin compensacion salarial pública',
          text: 'Quien por razones de guarda legal tenga a su cuidado directo algún menor de doce años tendrá derecho a una reducción de la jornada de trabajo diaria, con la disminucion proporcional del salario entre, al menos, un octavo y un máximo de la mitad de la duración de aquella.'
        },
        {
          id: 'vigente-art-48-4-et',
          articleNumber: 'Art. 48.4 ET (Texto Vigente)',
          title: 'Suspensión del contrato por nacimiento de 16 semanas',
          text: 'El nacimiento, que comprende el parto y el cuidado de menor de doce meses, suspenderá el contrato de trabajo de la madre biológica y el del progenitor distinto de la madre biológica durante dieciséis semanas, de las cuales serán obligatorias las seis semanas ininterrumpidas inmediatamente posteriores al parto a jornada completa.'
        }
      ]
    },

    commonTrunk: {
      id: 'tronco-común',
      name: 'Tronco Común Consolidado (Consenso Transversal)',
      description:
        'Disposiciones básicas ya consensuadas entre grupos parlamentarios, sindicatos, organizaciones empresariales y colectivos de familias. Se aplican como base común a todas las ramas de exploración.',
      clauses: [
        {
          id: 'tronco-art-1',
          articleNumber: 'Disposición Base 1 (Art. 37.6 bis.1 ET)',
          title: 'Derecho subjetivo a la reincorporación laboral progresiva post-natal',
          text: 'Finalizado el período de suspensión del contrato por nacimiento o adopción previsto en el artículo 48.4, las personas trabajadoras tendrán derecho a un período de reincorporación laboral progresiva con compensacion económica de la Seguridad Social, en los términos establecidos en la presente ley, sin que su ejercicio pueda suponer merma en los derechos de promocion profesional ni en el devengo de antigüedad.'
        },
        {
          id: 'tronco-art-2',
          articleNumber: 'Disposición Base 2 (Art. 237.4 LGSS)',
          title: 'Cotización efectiva al 100% durante la reincorporación progresiva',
          text: 'Durante todo el período de disfrute de la modalidad de reincorporación laboral progresiva, las bases de cotización de la persona trabajadora se computarán incrementadas hasta el 100 por 100 de la cuantía que hubiera correspondido de mantenerse sin reducción la jornada de trabajo, a efectos de las prestaciones de jubilación, incapacidad permanente, muerte y supervivencia, nacimiento y desempleo.'
        },
        {
          id: 'tronco-art-3',
          articleNumber: 'Disposición Base 3 (Art. 55.5.c ET)',
          title: 'Garantía de indemnidad y nulidad objetiva del despido',
          text: 'Será asimismo nulo el despido de las personas trabajadoras durante el ejercicio del derecho de reincorporación laboral progresiva post-natal y hasta transcurridos doce meses desde la reincorporación a la jornada ordinaria completa, salvo que se declare la procedencia del despido por motivos no relacionados con el ejercicio de este derecho.'
        },
        {
          id: 'tronco-art-4',
          articleNumber: 'Disposición Base 4 (Disposición Adicional Monoparental)',
          title: 'Garantía de equidad para menores en familias monoparentales (Doctrina STC 140/2024)',
          text: 'En las familias monoparentales, con el fin de garantizar la igualdad material del menor en el tiempo de cuidado directo recibido, la persona progenitora única podrá acumular el tramo adicional de reincorporación progresiva que habría correspondido al segundo progenitor conforme al coeficiente corrector establecido en cada modalidad.'
        }
      ]
    },

    branches: [
      {
        id: 'rama-media-jornada-bonificada',
        name: 'Rama A: Media Jornada Garantizada (50%) con Prestación del 80% SS',
        shortLabel: 'Rama A: Media Jornada 50% Bonificada',
        proponentSummary:
          'Impulsada inicialmente por ponencia social y sindical con aportaciones de juristas laborales. Prioriza un derecho claro y uniforme a trabajar media jornada (4 horas) entre el mes 5 y el mes 12 del bebé, recibiendo el 90% del salario total (50% salario empresa + 40% prestación Seguridad Social).',
        parameters: {
          reductionPercent: 50,
          durationMonths: 8,
          salarySubsidyPercent: 80,
          smeReliefPercent: 75,
          selfEmployedFlatGrantEur: 350,
          teleworkSharePercent: 25,
          coResponsibilityBonusMonths: 2,
          monoparentalMultiplier: 1.8,
          ruralSmeExtraReliefPercent: 60
        },
        mainCoverage: {
          juridico: true,
          economico: true,
          laboral_pyme: true,
          social_igualdad: true,
          ambiental_territorial: true
        },
        clauses: [
          {
            id: 'art-37-6-et',
            articleNumber: 'Art. 37.6 ET (Propuesta Rama A)',
            title: 'Reducción del 50% de jornada por reincorporación progresiva entre los meses 5 y 12',
            text: '1. Tras la finalizacion del permiso del artículo 48.4, cada progenitor tendrá derecho a reducir su jornada ordinaria en un 50 por 100 durante un período de ocho meses.\n2. Durante dicho período, la Seguridad Social abonara un subsidio equivalente al 80 por 100 de la reducción salarial correspondiente, percibiendo la persona trabajadora el 90 por 100 de su retribucion previa.\n3. Cuando ambos progenitores ejerzan este derecho de forma equitativa o sucesiva durante al menos cuatro meses cada uno, el período conjunto se ampliara en dos meses adicionales.'
          },
          {
            id: 'art-184-lgss',
            articleNumber: 'Art. 184 bis LGSS (Propuesta Rama A)',
            title: 'Bonificación del 75% en cotizaciones por contratos de relevo a tiempo parcial',
            text: '1. Las empresas que concierten contratos de duración determinada a tiempo parcial para sustituir las horas reducidas durante la reincorporación progresiva tendrán derecho a una bonificación del 75 por 100 en las cuotas empresariales a la Seguridad Social.\n2. En el supuesto de trabajadoras encuadradas en el Régimen Especial de Trabajadores Autónomos (RETA), se aplicara una bonificación mensual de 350 euros en su cuota durante ocho meses.'
          }
        ]
      },
      {
        id: 'rama-bolsa-flexible-híbrida',
        name: 'Rama B: Bolsa Flexible de Horas, Rampa Escalonada (50% a 75%) y Teletrabajo',
        shortLabel: 'Rama B: Bolsa Flexible + Rampa Híbrida',
        proponentSummary:
          'Impulsada por equipos técnicos de modernizacion empresarial, economía aplicada y colectivos profesionales. Sustituye la media jornada rigida por un credito de 520 horas distribuibles en rampa progresiva (meses 5-6 al 50%, meses 7-12 al 70% de jornada) combinado con teletrabajo parcial preferente.',
        parameters: {
          reductionPercent: 35,
          durationMonths: 10,
          salarySubsidyPercent: 75,
          smeReliefPercent: 70,
          selfEmployedFlatGrantEur: 600,
          teleworkSharePercent: 55,
          coResponsibilityBonusMonths: 3,
          monoparentalMultiplier: 1.3,
          ruralSmeExtraReliefPercent: 75
        },
        mainCoverage: {
          juridico: true,
          economico: true,
          laboral_pyme: true,
          social_igualdad: true,
          ambiental_territorial: true
        },
        clauses: [
          {
            id: 'art-37-6-et',
            articleNumber: 'Art. 37.6 ET (Propuesta Rama B)',
            title: 'Crédito horario flexible y rampa de reincorporación escalonada',
            text: '1. Cada persona progenitora dispondrá de una bolsa individual de 520 horas de reducción retribuida para su disfrute entre el quinto y el decimocuarto mes desde el nacimiento, equivalente a una reducción media del 35 por 100 durante diez meses.\n2. Por defecto, la reincorporación se articulara mediante una rampa progresiva del 50 por 100 de jornada efectiva durante los dos primeros meses y del 70 por 100 durante los ocho meses siguientes.\n3. En las familias monoparentales se aplicara un coeficiente multiplicador de 1,3 sobre la bolsa horaria individual.'
          },
          {
            id: 'art-34-8-et',
            articleNumber: 'Art. 34.8 bis ET (Propuesta Rama B)',
            title: 'Derecho preferente a modalidad híbrida y ahorro de desplazamientos',
            text: '1. En aquellos puestos cuyas funciones sean tecnicamente susceptibles de ejecucion a distancia, la persona trabajadora en reincorporación progresiva podrá acogerse a teletrabajo hasta en un 55 por 100 de su jornada efectiva, evitando tiempos de desplazamiento pendular.\n2. Las empresas de menos de 50 trabajadores recibiran una compensacion del 70 por 100 en cuotas de Seguridad Social por reorganizacion de turnos o contratacion de apoyo.'
          }
        ]
      },
      {
        id: 'rama-escudo-pymes-rural',
        name: 'Rama C: Escudo Integral Micropymes (<10), Relevo RETA y Cobertura Rural',
        shortLabel: 'Rama C: Escudo PYME + Autonomas Rural',
        proponentSummary:
          'Impulsada por asociaciones de autónomos, cooperativas agrarias/rurales y especialistas en estructura productiva espanola. Mantiene una reducción del 45% durante 9 meses con subsidio del 85%, bonificación del 95% a microempresas de menos de 10 trabajadores y Bono de Relevo de 850 EUR/mes para trabajadoras autónomas.',
        parameters: {
          reductionPercent: 45,
          durationMonths: 9,
          salarySubsidyPercent: 85,
          smeReliefPercent: 92,
          selfEmployedFlatGrantEur: 850,
          teleworkSharePercent: 35,
          coResponsibilityBonusMonths: 2,
          monoparentalMultiplier: 1.8,
          ruralSmeExtraReliefPercent: 98
        },
        mainCoverage: {
          juridico: true,
          economico: true,
          laboral_pyme: true,
          social_igualdad: true,
          ambiental_territorial: true
        },
        clauses: [
          {
            id: 'art-37-6-et',
            articleNumber: 'Art. 37.6 ET (Propuesta Rama C)',
            title: 'Reincorporación al 45% de reducción con opcion de compactacion semanal en PYMEs',
            text: '1. La persona trabajadora tendrá derecho a una reducción del 45 por 100 de su jornada durante nueve meses tras la suspensión por nacimiento, percibiendo un subsidio publico del 85 por 100 sobre la fraccion reducida.\n2. En empresas de menos de diez personas trabajadoras o centros con regimenes de turnos continuos, previo acuerdo, la reducción podrá acumularse en jornadas completas alternas para facilitar la contratacion de un unico relevista compartido.'
          },
          {
            id: 'art-38-reta',
            articleNumber: 'Art. 38 ter Ley 20/2007 RETA (Propuesta Rama C)',
            title: 'Bono de Relevo para Trabajadoras Autonomas y Bolsas Mancomunadas Rurales',
            text: '1. Las personas trabajadoras encuadradas en el RETA tendrán derecho durante nueve meses a un Bono de Relevo y Conciliacion de 850 euros mensuales destinado a sufragar la contratacion a tiempo parcial de una persona empleada o sustituta profesional que garantice la continuidad del negocio.\n2. En municipios de menos de 5.000 habitantes, las microempresas y profesionales autónomos gozaran de una bonificación del 98 por 100 en las cotizaciones de los contratos de sustitucion.'
          }
        ]
      }
    ],

    weaknesses: [
      {
        id: 'deb-01',
        title:
          'Desproteccion de trabajadoras autónomas (RETA) sin asalariados ante una reducción de media jornada sin relevo',
        description:
          'En la Rama A, la ayuda al RETA se limita a 350 EUR/mes de bonificación de cuota. Para una autonoma titular de un pequeno comercio, clinica o despacho sin empleados, reducir el horario un 50% sin fondos suficientes para contratar a un sustituto de media jornada supone perder la mitad de la facturacion manteniendo el 100% del alquiler y costes fijos.',
        severity: 'crítica',
        domain: 'laboral_pyme',
        targetBranchId: 'rama-media-jornada-bonificada',
        targetClauseId: 'art-184-lgss',
        affectedGroup: '30.500 madres trabajadoras autónomas anuales (RETA) y pequeno comercio',
        reportedBy: 'Federacion de Asociaciones de Trabajadores Autónomos y Economia Social',
        status: 'en_mitigacion',
        linkedAmendmentId: 'enmienda-pr-103',
        mitigatedByAmendmentId: null,
        createdAt: '2026-10-21'
      },
      {
        id: 'deb-02',
        title:
          'Vulneracion de equidad constitucional en familias monoparentales por coeficiente 1,3 insuficiente (STC 140/2024)',
        description:
          'La Rama B fija un coeficiente multiplicador de solo 1,3 para hogares monoparentales. El Tribunal Constitucional (STC 140/2024) ha establecido que los menores nacidos en familias monoparentales no pueden recibir un tiempo de cuidado protegido sustancialmente inferior al de las familias biparentales.',
        severity: 'crítica',
        domain: 'juridico',
        targetBranchId: 'rama-bolsa-flexible-híbrida',
        targetClauseId: 'art-37-6-et',
        affectedGroup: 'Familias monoparentales (81% encabezadas por madres)',
        reportedBy: 'Catedra de Derecho del Trabajo y Seguridad Social / Asociacion Madres Solteras',
        status: 'en_mitigacion',
        linkedAmendmentId: 'enmienda-pr-101',
        mitigatedByAmendmentId: null,
        createdAt: '2026-10-23'
      },
      {
        id: 'deb-03',
        title:
          'Alta friccion para cubrir fracciones aisladas de 4 horas diarias en micropymes industriales y sanitarias a turnos',
        description:
          'En sectores con turnos rotatorios o plantas pequenas (<10 empleados), encontrar personal cualificado dispuesto a desplazarse diariamente por un contrato parcial de solo 4 horas genera hasta un 38% de vacantes desiertas si no se permite compactar las horas en dias completos alternos.',
        severity: 'alta',
        domain: 'laboral_pyme',
        targetBranchId: 'rama-media-jornada-bonificada',
        targetClauseId: 'art-37-6-et',
        affectedGroup: 'Micropymes industriales, talleres, clinicas y comercio de proximidad',
        reportedBy: 'Comision Tecnica de Organizacion Industrial y PYMEs',
        status: 'en_mitigacion',
        linkedAmendmentId: 'enmienda-pr-102',
        mitigatedByAmendmentId: null,
        createdAt: '2026-10-25'
      },
      {
        id: 'deb-04',
        title:
          'Riesgo de adelanto de tesoreria en microempresas si el pago del subsidio se gestiona por pago delegado',
        description:
          'Si se obliga a la microempresa a adelantar en nomina el subsidio del 80-85% y esperar a la compensacion de la TGSS mes y medio despues, se genera tension de liquidez en empresas de menos de 10 trabajadores. El abono debe ser pago directo mensual del INSS o compensacion instantanea en sistema RED.',
        severity: 'moderada',
        domain: 'económico',
        targetBranchId: 'rama-escudo-pymes-rural',
        targetClauseId: 'art-37-6-et',
        affectedGroup: 'Microempresas de 1 a 9 trabajadores (con baja liquidez operativa)',
        reportedBy: 'Colegio Oficial de Graduados Sociales y Gestores Administrativos',
        status: 'abierta',
        linkedAmendmentId: null,
        mitigatedByAmendmentId: null,
        createdAt: '2026-10-27'
      }
    ],

    seeds: [
      {
        id: 'semilla-01',
        title:
          'Sincronizacion de los tramos de jornada reducida con los horarios de salida de escuelas infantiles municipales (0-3 años)',
        description:
          'Soy madre trabajadora en turno partido. De poco sirve reducir la jornada un 50% si la empresa me obliga a hacer 2 horas por la manana y 2 horas a ultima hora de la tarde cuando la escuela infantil municipal cierra a las 16:00. La reducción debe garantizar concrecion horaria continuada dentro de la franja lectiva 0-3.',
        authorName: 'Lucia M. (Trabajadora de Comercio)',
        authorProfile: 'Ciudadania / Madre Afectada Directa',
        targetBranchId: 'rama-media-jornada-bonificada',
        affectedCollective: 'Trabajadores a turno partido en comercio y hosteleria con hijos de 0 a 3 años',
        neededDomains: ['juridico', 'laboral_pyme', 'social_igualdad'],
        maturityLevel: MATURITY_LEVELS.LEVEL_1_SEED,
        status: 'pendiente_de_elaborar',
        promotedAmendmentId: null,
        endorsements: 42,
        createdAt: '2026-10-28'
      },
      {
        id: 'semilla-02',
        title:
          'Ampliacion automatica del tramo progresivo al 50% en nacimientos prematuros o con hospitalizacion neonatal prolongada',
        description:
          'Como neonatologo observo que los bebes grandes prematuros requieren cuidados respiratorios y seguimiento intensivo en domicilio muchos meses despues del alta. El computo de los 8 o 10 meses de reincorporación progresiva deberia iniciarse a partir del alta hospitalaria efectiva y contar con 2 meses adicionales.',
        authorName: 'Dr. Carlos V. (Servicio de Neonatologia)',
        authorProfile: 'Profesional Sanitario / Pediatria',
        targetBranchId: 'rama-escudo-pymes-rural',
        affectedCollective: 'Familias con partos prematuros (<32 semanas) u hospitalizacion neonatal',
        neededDomains: ['juridico', 'económico', 'social_igualdad'],
        maturityLevel: MATURITY_LEVELS.LEVEL_1_SEED,
        status: 'pendiente_de_elaborar',
        promotedAmendmentId: null,
        endorsements: 67,
        createdAt: '2026-10-29'
      },
      {
        id: 'semilla-03',
        title:
          'Bolsa comarcal compartida de relevistas para pequenos comercios y autónomas en municipios de menos de 5.000 habitantes',
        description:
          'En los pueblos pequenos es imposible encontrar a alguien para trabajar solo 3 o 4 horas al dia en una panaderia o farmacia rural. Si dos autónomas de la misma comarca pudieran compartir un unico contrato de relevo a jornada completa financiado con sus dos bonos, el relevista tendria un sueldo digno de 8 horas y los dos negocios seguirian abiertos.',
        authorName: 'Elena R. (Titular de Comercio Rural en Soria)',
        authorProfile: 'Trabajadora Autonoma Rural',
        targetBranchId: 'rama-escudo-pymes-rural',
        affectedCollective: 'Autonomas y microempresas en municipios del Reto Demográfico (<5.000 hab.)',
        neededDomains: ['juridico', 'laboral_pyme', 'ambiental_territorial'],
        maturityLevel: MATURITY_LEVELS.LEVEL_1_SEED,
        status: 'pendiente_de_elaborar',
        promotedAmendmentId: null,
        endorsements: 54,
        createdAt: '2026-10-30'
      }
    ],

    amendments: [],

    commitHistory: [
      {
        commitId: 'rev-base03',
        date: '2026-10-20',
        targetBranchId: 'tronco-común',
        amendmentId: 'enmienda-fundacional-tc',
        title:
          'Incorporacion al Tronco Común de la cotización al 100% (Art. 237.4 LGSS) y garantia monoparental (STC 140/2024)',
        coAuthors: [
          'Ponencia Juridica Multipartidista',
          'Representacion Sindical',
          'Asociaciones Empresariales PYME'
        ],
        mitigatedWeaknesses: []
      },
      {
        commitId: 'rev-base02',
        date: '2026-10-15',
        targetBranchId: 'rama-escudo-pymes-rural',
        amendmentId: 'enmienda-fundacional-c',
        title: 'Apertura de Rama C con Bono de Relevo RETA y bonificación del 92% para micropymes',
        coAuthors: ['Mesa de Trabajo Autonomo y Reto Demográfico'],
        mitigatedWeaknesses: []
      },
      {
        commitId: 'rev-base01',
        date: '2026-10-10',
        targetBranchId: 'rama-media-jornada-bonificada',
        amendmentId: 'enmienda-fundacional-a',
        title:
          'Apertura del Expediente Normativo EXP-MAIN-2026-MTES-042 con modelo base de Media Jornada al 50%',
        coAuthors: ['Equipo Redactor Inicial MTES / Seguridad Social'],
        mitigatedWeaknesses: []
      }
    ]
  };

  // Pre-cargar las 3 Enmiendas (PRs) de ejemplo en distintos niveles de la tuberia progresiva
  seedInitialAmendments(state);
  recomputeAllBranchMetrics(state);
  return state;
}

function seedInitialAmendments(state) {
  const branchA = state.branches.find((b) => b.id === 'rama-media-jornada-bonificada');
  const branchB = state.branches.find((b) => b.id === 'rama-bolsa-flexible-híbrida');

  // 1. Enmienda Nivel 2 (PR de Dominio Juridico): Experta constitucionalista corrige el coeficiente monoparental en Rama B, dejando pendiente la evaluacion económica
  const origClauseB = branchB.clauses[0].text;
  const propClauseB = [
    '1. Cada persona progenitora dispondrá de una bolsa individual de 520 horas de reducción retribuida para su disfrute entre el quinto y el decimocuarto mes desde el nacimiento, equivalente a una reducción media del 35 por 100 durante diez meses.',
    '2. Por defecto, la reincorporación se articulara mediante una rampa progresiva del 50 por 100 de jornada efectiva durante los dos primeros meses y del 70 por 100 durante los ocho meses siguientes.',
    '3. En las familias monoparentales, en cumplimiento de la doctrina constitucional (STC 140/2024), se aplicara un coeficiente multiplicador de 1,8 sobre la bolsa horaria individual para garantizar identico tiempo de cuidado directo al menor.'
  ].join('\n');

  const paramChanges101 = { monoparentalMultiplier: 1.8 };
  const delta101 = computeImpactDelta(branchB.parameters, {
    ...branchB.parameters,
    ...paramChanges101
  }).deltas;

  state.amendments.push({
    id: 'enmienda-pr-101',
    title:
      'Adecuacion del coeficiente monoparental a 1,8x en Rama B conforme a la STC 140/2024',
    summary:
      'Enmienda especializada de dominio juridico: corrige el apartado 3 del Art. 37.6 ET en la Rama B para elevar el multiplicador de familias monoparentales de 1,3 a 1,8, evitando un recurso de inconstitucionalidad. Solicita co-autoria de un economista para completar la memoria presupuestaria.',
    targetBranchId: 'rama-bolsa-flexible-híbrida',
    targetClauseId: 'art-37-6-et',
    originalClauseText: origClauseB,
    proposedClauseText: propClauseB,
    clauseDiff: computeClauseDiff(origClauseB, propClauseB),
    parameterChanges: paramChanges101,
    impactDelta: delta101,
    requiredDomains: ['juridico', 'social_igualdad', 'económico'],
    coveredDomains: ['juridico', 'social_igualdad'],
    pendingDomains: ['económico'],
    domainAnalyses: {
      juridico:
        'La STC 140/2024 declara discriminatorio por razon de nacimiento (Art. 14 y 39 CE) privar al menor en familia monoparental del tiempo de cuidado que habría correspondido al segundo progenitor. Excluir las primeras 6 semanas solapadas arroja un coeficiente técnico de 1,8x.',
      social_igualdad:
        'Eleva el Indice de Equidad Monoparental de la Rama B de 58/100 a 88/100, protegiendo al 81% de hogares monoparentales encabezados por mujeres trabajadoras.'
    },
    maturityLevel: MATURITY_LEVELS.LEVEL_2_SCOPED_PR,
    status: 'solicita_coautoria',
    coAuthors: [
      {
        name: 'Dra. Elena Gomez-Valor',
        role: 'Jurista del Trabajo y Constitucionalista',
        contributedDomains: ['juridico', 'social_igualdad'],
        date: '2026-10-24'
      }
    ],
    sourceSeedId: null,
    mitigatesWeaknessIds: ['deb-02'],
    reviewComments: [
      {
        author: 'Dra. Elena Gomez-Valor',
        role: 'Jurista del Trabajo',
        domain: 'juridico',
        text: 'He redactado el encaje constitucional exacto del apartado 3. Dejo abierto el dominio económico para que un especialista cuantifique el impacto en el presupuesto del INSS.',
        date: '2026-10-24'
      }
    ],
    createdAt: '2026-10-24'
  });

  // 2. Enmienda Nivel 2 (PR de Dominio Laboral/PYME y Economico): Permite compactacion semanal en turnos e incrementa bonificación PYME, pendiente de redaccion juridica fina
  const origClauseA1 = branchA.clauses[0].text;
  const propClauseA1 = [
    origClauseA1,
    '4. En empresas de menos de 25 trabajadores o centros con regimenes de trabajo a turnos, la reducción del 50 por 100 podrá compactarse en jornadas completas alternas para permitir la contratacion de un unico relevista compartido.'
  ].join('\n');

  const paramChanges102 = { smeReliefPercent: 85 };
  const delta102 = computeImpactDelta(branchA.parameters, {
    ...branchA.parameters,
    ...paramChanges102
  }).deltas;

  state.amendments.push({
    id: 'enmienda-pr-102',
    title:
      'Compactacion en dias alternos para micropymes a turnos y aumento de bonificación SS al 85%',
    summary:
      'Enmienda de dominio laboral y económico para resolver la dificultad de cubrir fracciones aisladas de 4 horas en pymes industriales y sanitarias (Debilidad deb-03). Solicita co-autoria juridica para validar la articulacion con la negociacion colectiva del Art. 37.7 ET.',
    targetBranchId: 'rama-media-jornada-bonificada',
    targetClauseId: 'art-37-6-et',
    originalClauseText: origClauseA1,
    proposedClauseText: propClauseA1,
    clauseDiff: computeClauseDiff(origClauseA1, propClauseA1),
    parameterChanges: paramChanges102,
    impactDelta: delta102,
    requiredDomains: ['laboral_pyme', 'económico', 'juridico'],
    coveredDomains: ['laboral_pyme', 'económico'],
    pendingDomains: ['juridico'],
    domainAnalyses: {
      laboral_pyme:
        'Permitir agrupar dos medias jornadas en dias completos alternos permite a dos trabajadoras o dos pymes compartir un contrato de relevo de 8 horas, reduciendo el Indice de Friccion PYME en 5 puntos.',
      economico:
        'Incrementar la bonificación de cuotas de relevo del 75% al 85% supone un coste neto adicional moderado (+15,2 M EUR/año) ampliamente compensado por la creacion de 3.600 empleos equivalentes de relevo.'
    },
    maturityLevel: MATURITY_LEVELS.LEVEL_2_SCOPED_PR,
    status: 'solicita_coautoria',
    coAuthors: [
      {
        name: 'Marcos Ibanez (Tecnico de Organizacion PYME)',
        role: 'Analista de Operaciones y Costes Laborales',
        contributedDomains: ['laboral_pyme', 'económico'],
        date: '2026-10-26'
      }
    ],
    sourceSeedId: null,
    mitigatesWeaknessIds: ['deb-03'],
    reviewComments: [
      {
        author: 'Marcos Ibanez',
        role: 'Analista de Operaciones PYME',
        domain: 'laboral_pyme',
        text: 'Aportado el modelo de turnos y el calculo de bonificación. Se necesita un jurista laboral para asegurar que la compactacion no pueda ser impuesta unilateralmente sin acuerdo.',
        date: '2026-10-26'
      }
    ],
    createdAt: '2026-10-26'
  });

  // 3. Enmienda Nivel 3 (PR Integrado Completo Co-autorado): Incorpora Bono de Relevo RETA de 750 EUR/mes y cobertura rural a la Rama A, mitigando la debilidad crítica deb-01
  const origClauseA2 = branchA.clauses[1].text;
  const propClauseA2 = [
    '1. Las empresas que concierten contratos de duración determinada a tiempo parcial para sustituir las horas reducidas durante la reincorporación progresiva tendrán derecho a una bonificación del 75 por 100 en las cuotas empresariales a la Seguridad Social.',
    '2. En el supuesto de trabajadoras encuadradas en el Régimen Especial de Trabajadores Autónomos (RETA), se reconocera un Bono de Relevo y Continuidad de Actividad de 750 euros mensuales durante ocho meses para sufragar la contratacion a tiempo parcial o sustitucion profesional, elevandose la bonificación de cuotas al 90 por 100 en municipios de menos de 5.000 habitantes.'
  ].join('\n');

  const paramChanges103 = {
    selfEmployedFlatGrantEur: 750,
    ruralSmeExtraReliefPercent: 90
  };
  const delta103 = computeImpactDelta(branchA.parameters, {
    ...branchA.parameters,
    ...paramChanges103
  }).deltas;

  state.amendments.push({
    id: 'enmienda-pr-103',
    title:
      'Incorporacion de Bono de Relevo RETA (750 EUR/mes) y Escudo Rural a la Rama A (Enmienda de Sintesis A+C)',
    summary:
      'Enmienda multidisciplinar completada por tres co-autores (Asociacion de Autonomas, Economista Fiscal y Jurista de Seguridad Social) que incorpora el mecanismo de proteccion del trabajo autonomo de la Rama C dentro de la Rama A, resolviendo la debilidad crítica deb-01.',
    targetBranchId: 'rama-media-jornada-bonificada',
    targetClauseId: 'art-184-lgss',
    originalClauseText: origClauseA2,
    proposedClauseText: propClauseA2,
    clauseDiff: computeClauseDiff(origClauseA2, propClauseA2),
    parameterChanges: paramChanges103,
    impactDelta: delta103,
    requiredDomains: ['laboral_pyme', 'económico', 'juridico', 'ambiental_territorial'],
    coveredDomains: ['laboral_pyme', 'económico', 'juridico', 'ambiental_territorial'],
    pendingDomains: [],
    domainAnalyses: {
      laboral_pyme:
        'Eleva la cobertura efectiva de trabajadoras autónomas (RETA) en la Rama A del 30,3% al 65,0%, impidiendo el cierre de pequenos negocios liderados por mujeres tras la maternidad.',
      economico:
        'Incrementa el coste neto presupuestario en +47,8 M EUR/año (menos de un 4,5% del presupuesto del programa) con alto retorno en mantenimiento de actividades economicas en el IRPF.',
      juridico:
        'Articulado mediante modificacion coordinada del Art. 184 bis LGSS y disposicion concordante con el Art. 38 bis de la Ley 20/2007 del Estatuto del Trabajo Autonomo.',
      ambiental_territorial:
        'Eleva el Indice de Viabilidad Rural de la Rama A de 62/100 a 82/100 al bonificar al 90% los contratos de relevo en municipios de menos de 5.000 habitantes.'
    },
    maturityLevel: MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR,
    status: 'lista_para_fusion',
    coAuthors: [
      {
        name: 'Asociacion Nacional de Mujeres Autonomas y Rurales',
        role: 'Representacion Sectorial RETA (Semilla Inicial)',
        contributedDomains: ['laboral_pyme', 'ambiental_territorial'],
        date: '2026-10-22'
      },
      {
        name: 'Javier Soriano (Economista Presupuestario)',
        role: 'Analista Fiscal Independiente',
        contributedDomains: ['económico'],
        date: '2026-10-24'
      },
      {
        name: 'Marta Alcazar (Letrada de la Seguridad Social)',
        role: 'Especialista Juridica LGSS',
        contributedDomains: ['juridico'],
        date: '2026-10-25'
      }
    ],
    sourceSeedId: null,
    mitigatesWeaknessIds: ['deb-01'],
    reviewComments: [
      {
        author: 'Javier Soriano',
        role: 'Analista Fiscal Independiente',
        domain: 'económico',
        text: 'Completada la cuantificacion MAIN: el coste neto adicional es de 47,8 M EUR anuales para cubrir a mas de 20.000 autónomas activas.',
        date: '2026-10-24'
      },
      {
        author: 'Marta Alcazar',
        role: 'Especialista Juridica LGSS',
        domain: 'juridico',
        text: 'Validada la redaccion del Art. 184 bis.2 LGSS. Todos los dominios requeridos estan cubiertos; la enmienda esta lista para fusion.',
        date: '2026-10-25'
      }
    ],
    createdAt: '2026-10-22'
  });
}
