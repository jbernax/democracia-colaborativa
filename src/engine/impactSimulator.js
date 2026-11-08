/**
 * Motor de Simulación Paramétrica para la Memoria del Análisis de Impacto Normativo (MAIN - RD 931/2017)
 * Calibrado con parámetros demográficos, laborales y fiscales de España (INE, Seguridad Social, AIReF, DIRCE).
 */

export const SPAIN_BASELINE_CONSTANTS = Object.freeze({
  annualBirthsTotal: 322000,
  eligibleWorkingParentsCohort: 265000,
  selfEmployedMothersCohort: 30500,
  averageMonthlyGrossWageEur: 2200,
  averageMonthlyEmployerSsQuotaEur: 673,
  workHoursPerMonthFullTime: 160,
  baselineUnpaidLeaveOrDropoutRatePercent: 18.4,
  baselineMaternityWagePenalty5YrPercent: 11.2,
  baselineCoResponsibilityRatePercent: 24.0,
  averageCommuteRoundTripKgCo2: 3.18,
  workingDaysPerMonth: 20
});

const DEFAULT_PLAN_PARAMETERS = Object.freeze({
  reductionPercent: 50,
  durationMonths: 8,
  salarySubsidyPercent: 80,
  smeReliefPercent: 75,
  selfEmployedFlatGrantEur: 650,
  teleworkSharePercent: 30,
  coResponsibilityBonusMonths: 2,
  monoparentalMultiplier: 1.8,
  ruralSmeExtraReliefPercent: 95
});

export function normalizePlanParameters(rawParams = {}) {
  const merged = { ...DEFAULT_PLAN_PARAMETERS, ...rawParams };
  return {
    reductionPercent: clampNumber(merged.reductionPercent, 10, 75),
    durationMonths: clampNumber(merged.durationMonths, 1, 24),
    salarySubsidyPercent: clampNumber(merged.salarySubsidyPercent, 0, 100),
    smeReliefPercent: clampNumber(merged.smeReliefPercent, 0, 100),
    selfEmployedFlatGrantEur: clampNumber(merged.selfEmployedFlatGrantEur, 0, 1800),
    teleworkSharePercent: clampNumber(merged.teleworkSharePercent, 0, 80),
    coResponsibilityBonusMonths: clampNumber(merged.coResponsibilityBonusMonths, 0, 6),
    monoparentalMultiplier: clampNumber(merged.monoparentalMultiplier, 1.0, 2.0),
    ruralSmeExtraReliefPercent: clampNumber(merged.ruralSmeExtraReliefPercent, 0, 100)
  };
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return min;
  }
  return Math.min(max, Math.max(min, num));
}

function roundTo(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function simulateFiscalImpact(params) {
  const c = SPAIN_BASELINE_CONSTANTS;
  const reductionFraction = params.reductionPercent / 100;
  const subsidyFraction = params.salarySubsidyPercent / 100;
  const smeReliefFraction = params.smeReliefPercent / 100;

  // Tasa de adopcion depende de cuanto salario se cubre durante la reduccion
  const uptakeRate = Math.min(0.92, 0.35 + 0.57 * subsidyFraction);
  const activeSalariedBeneficiaries = Math.round(c.eligibleWorkingParentsCohort * uptakeRate);

  const effectiveMonths =
    params.durationMonths + params.coResponsibilityBonusMonths * 0.35;

  const monthlyWageSubsidyPerWorker =
    c.averageMonthlyGrossWageEur * reductionFraction * subsidyFraction;

  const grossWageSubsidyMillionEur =
    (activeSalariedBeneficiaries * monthlyWageSubsidyPerWorker * effectiveMonths) / 1_000_000;

  // Coste de bonificacion de cuotas empresariales por contratos de relevo en PYMEs (aprox 42% de los casos requieren relevo formal)
  const smeReplacementShare = 0.42;
  const monthlySmeQuotaReliefPerWorker =
    c.averageMonthlyEmployerSsQuotaEur * reductionFraction * smeReliefFraction;
  const smeReliefCostMillionEur =
    (activeSalariedBeneficiaries *
      smeReplacementShare *
      monthlySmeQuotaReliefPerWorker *
      effectiveMonths) /
    1_000_000;

  // Coste del bono de relevo/corresponsabilidad para trabajadoras autonomas (RETA)
  const retaUptakeRate = Math.min(0.85, 0.2 + (params.selfEmployedFlatGrantEur / 1200) * 0.65);
  const activeRetaBeneficiaries = Math.round(c.selfEmployedMothersCohort * retaUptakeRate);
  const retaCostMillionEur =
    (activeRetaBeneficiaries * params.selfEmployedFlatGrantEur * params.durationMonths) /
    1_000_000;

  const grossPublicCostMillionEur =
    grossWageSubsidyMillionEur + smeReliefCostMillionEur + retaCostMillionEur;

  // Retorno fiscal inducido: menor abandono laboral femenino + contratacion de relevo (IRPF + IVA + cotizaciones de relevistas)
  const retentionFactor = Math.min(1, (subsidyFraction * 0.65) + (smeReliefFraction * 0.35));
  const fiscalReturnRate = 0.24 + 0.14 * retentionFactor;
  const inducedFiscalReturnMillionEur = grossPublicCostMillionEur * fiscalReturnRate;

  const netPublicCostMillionEur = grossPublicCostMillionEur - inducedFiscalReturnMillionEur;
  const totalBeneficiaries = activeSalariedBeneficiaries + activeRetaBeneficiaries;
  const netCostPerBeneficiaryEur =
    totalBeneficiaries > 0
      ? Math.round((netPublicCostMillionEur * 1_000_000) / totalBeneficiaries)
      : 0;

  return {
    activeSalariedBeneficiaries,
    activeRetaBeneficiaries,
    totalBeneficiaries,
    grossPublicCostMillionEur: roundTo(grossPublicCostMillionEur, 1),
    smeReliefCostMillionEur: roundTo(smeReliefCostMillionEur, 1),
    retaCostMillionEur: roundTo(retaCostMillionEur, 1),
    inducedFiscalReturnMillionEur: roundTo(inducedFiscalReturnMillionEur, 1),
    netPublicCostMillionEur: roundTo(netPublicCostMillionEur, 1),
    netCostPerBeneficiaryEur
  };
}

export function simulateLaborAndSmeImpact(params) {
  const c = SPAIN_BASELINE_CONSTANTS;
  const subsidyFraction = params.salarySubsidyPercent / 100;
  const smeReliefFraction = params.smeReliefPercent / 100;
  const reductionFraction = params.reductionPercent / 100;

  // Reduccion del abandono o excedencia no retribuida forzosa tras las 16 semanas
  const dropoutReductionRatio = Math.min(
    0.82,
    0.25 + subsidyFraction * 0.42 + (params.teleworkSharePercent / 100) * 0.15
  );
  const projectedDropoutRatePercent = roundTo(
    c.baselineUnpaidLeaveOrDropoutRatePercent * (1 - dropoutReductionRatio),
    1
  );
  const femaleRetentionGainPercent = roundTo(
    c.baselineUnpaidLeaveOrDropoutRatePercent - projectedDropoutRatePercent,
    1
  );

  // Indice de friccion organizativa en micropymes (0 = sin friccion, 100 = friccion maxima)
  // Reducciones cercanas al 50% (4 horas exactas) son mas faciles de cubrir con media jornada estandar que fracciones irregulares
  const halfDayAlignmentBonus = Math.abs(params.reductionPercent - 50) <= 5 ? 12 : 0;
  const rawSmeFriction =
    58 +
    reductionFraction * 28 -
    smeReliefFraction * 44 -
    halfDayAlignmentBonus -
    (params.teleworkSharePercent / 100) * 14;
  const smeOrganizationalFrictionIndex = Math.round(clampNumber(rawSmeFriction, 8, 95));

  // Cobertura efectiva de trabajadoras autonomas (RETA)
  const retaEffectiveCoveragePercent = roundTo(
    clampNumber((params.selfEmployedFlatGrantEur / 900) * 78, 5, 92),
    1
  );

  // Empleos equivalentes a tiempo completo (ETC) creados en contratos de relevo
  const replacementJobsCreatedFte = Math.round(
    c.eligibleWorkingParentsCohort *
      0.38 *
      reductionFraction *
      (0.4 + 0.6 * smeReliefFraction) *
      (params.durationMonths / 12)
  );

  return {
    projectedDropoutRatePercent,
    femaleRetentionGainPercent,
    smeOrganizationalFrictionIndex,
    retaEffectiveCoveragePercent,
    replacementJobsCreatedFte
  };
}

export function simulateSocialAndEqualityImpact(params) {
  const c = SPAIN_BASELINE_CONSTANTS;
  const subsidyFraction = params.salarySubsidyPercent / 100;
  const reductionFraction = params.reductionPercent / 100;

  // Corresponsabilidad paterna: aumenta mucho cuando el subsidio salarial es alto (>=80%) y existe bono de corresponsabilidad
  const coResponsibilityIndex = roundTo(
    clampNumber(
      c.baselineCoResponsibilityRatePercent +
        subsidyFraction * 36 +
        params.coResponsibilityBonusMonths * 7.5,
      15,
      88
    ),
    1
  );

  // Penalizacion salarial a 5 anos (Child Penalty): disminuye si se evita la excedencia y si el uso es corresponsable
  const penaltyMitigation =
    (subsidyFraction * 0.45 + (coResponsibilityIndex / 100) * 0.4) *
    Math.min(1.15, params.durationMonths / 8);
  const projectedWagePenalty5YrPercent = roundTo(
    Math.max(2.1, c.baselineMaternityWagePenalty5YrPercent * (1 - penaltyMitigation * 0.68)),
    1
  );

  // Horas adicionales de cuidado presencial directo para el lactante durante el primer ano
  const additionalCareHoursPerInfant = Math.round(
    c.workHoursPerMonthFullTime *
      reductionFraction *
      (params.durationMonths + params.coResponsibilityBonusMonths * 0.5)
  );

  // Indice de equidad para familias monoparentales (0-100)
  const monoparentalEquityScore = Math.round(
    clampNumber(40 + (params.monoparentalMultiplier - 1.0) * 60, 40, 100)
  );

  // Renta familiar disponible preservada durante el periodo de reduccion (%)
  const householdIncomePreservationPercent = roundTo(
    100 - params.reductionPercent * (1 - subsidyFraction),
    1
  );

  return {
    coResponsibilityIndex,
    projectedWagePenalty5YrPercent,
    additionalCareHoursPerInfant,
    monoparentalEquityScore,
    householdIncomePreservationPercent
  };
}

export function simulateEnvironmentalAndTerritorialImpact(params, fiscalMetrics) {
  const c = SPAIN_BASELINE_CONSTANTS;
  const reductionFraction = params.reductionPercent / 100;
  const teleworkFraction = params.teleworkSharePercent / 100;

  // Dias completos de desplazamiento evitados por compactacion horaria o teletrabajo parcial
  const avoidedTripRatio = reductionFraction * 0.35 + teleworkFraction * 0.55;
  const avoidedCommuteRoundTripsPerWorker =
    c.workingDaysPerMonth * params.durationMonths * avoidedTripRatio;

  const totalAvoidedTripsMillions = roundTo(
    (fiscalMetrics.totalBeneficiaries * avoidedCommuteRoundTripsPerWorker) / 1_000_000,
    2
  );

  const avoidedCo2KilotonnesPerYear = roundTo(
    (totalAvoidedTripsMillions * 1_000_000 * c.averageCommuteRoundTripKgCo2) / 1_000_000,
    1
  );

  // Viabilidad en municipios rurales (<5.000 hab.): depende del apoyo a RETA y alivio extra a micropymes rurales
  const ruralViabilityIndex = Math.round(
    clampNumber(
      28 +
        (params.ruralSmeExtraReliefPercent / 100) * 35 +
        (params.selfEmployedFlatGrantEur / 1000) * 25 +
        teleworkFraction * 15,
      20,
      96
    )
  );

  return {
    totalAvoidedTripsMillions,
    avoidedCo2KilotonnesPerYear,
    ruralViabilityIndex
  };
}

export function simulateLegalAndOperationalImpact(params) {
  const affectedStatutes = [
    'Art. 37.6 Real Decreto Legislativo 2/2015 (Estatuto de los Trabajadores)',
    'Art. 48.4 Real Decreto Legislativo 2/2015 (Transicion tras suspension de 16 semanas)',
    'Arts. 183-185 Real Decreto Legislativo 8/2015 (Ley General de la Seguridad Social)'
  ];

  if (params.selfEmployedFlatGrantEur > 0) {
    affectedStatutes.push(
      'Art. 38 bis Ley 20/2007 (Estatuto del Trabajo Autónomo - Bono de Relevo y Conciliación)'
    );
  }
  if (params.teleworkSharePercent > 0) {
    affectedStatutes.push(
      'Art. 34.8 Estatuto de los Trabajadores y Ley 10/2021 de Trabajo a Distancia'
    );
  }

  let implementationMonthsInss = 4;
  if (params.selfEmployedFlatGrantEur > 0) {
    implementationMonthsInss += 1;
  }
  if (params.coResponsibilityBonusMonths > 0) {
    implementationMonthsInss += 1;
  }

  return {
    affectedStatutes,
    euDirectiveAlignment: 'Directiva (UE) 2019/1158 relativa a la conciliación de la vida familiar y profesional',
    constitutionalSafeguard:
      params.monoparentalMultiplier >= 1.6
        ? 'Cumple doctrina TC sobre no discriminación de menores en familias monoparentales (STC 140/2024)'
        : 'Riesgo de recurso de inconstitucionalidad por desprotección de familias monoparentales',
    implementationMonthsInss
  };
}

export function simulatePlanImpact(rawParams = {}) {
  const parameters = normalizePlanParameters(rawParams);
  const fiscal = simulateFiscalImpact(parameters);
  const laborSme = simulateLaborAndSmeImpact(parameters);
  const socialEquality = simulateSocialAndEqualityImpact(parameters);
  const environmentalTerritorial = simulateEnvironmentalAndTerritorialImpact(parameters, fiscal);
  const legalOperational = simulateLegalAndOperationalImpact(parameters);

  return {
    parameters,
    fiscal,
    laborSme,
    socialEquality,
    environmentalTerritorial,
    legalOperational
  };
}

export function computeImpactDelta(baseParams, candidateParams) {
  const base = simulatePlanImpact(baseParams);
  const candidate = simulatePlanImpact(candidateParams);

  return {
    base,
    candidate,
    deltas: {
      netPublicCostMillionEur: roundTo(
        candidate.fiscal.netPublicCostMillionEur - base.fiscal.netPublicCostMillionEur,
        1
      ),
      femaleRetentionGainPercent: roundTo(
        candidate.laborSme.femaleRetentionGainPercent - base.laborSme.femaleRetentionGainPercent,
        1
      ),
      smeOrganizationalFrictionIndex:
        candidate.laborSme.smeOrganizationalFrictionIndex -
        base.laborSme.smeOrganizationalFrictionIndex,
      retaEffectiveCoveragePercent: roundTo(
        candidate.laborSme.retaEffectiveCoveragePercent -
          base.laborSme.retaEffectiveCoveragePercent,
        1
      ),
      coResponsibilityIndex: roundTo(
        candidate.socialEquality.coResponsibilityIndex -
          base.socialEquality.coResponsibilityIndex,
        1
      ),
      additionalCareHoursPerInfant:
        candidate.socialEquality.additionalCareHoursPerInfant -
        base.socialEquality.additionalCareHoursPerInfant,
      avoidedCo2KilotonnesPerYear: roundTo(
        candidate.environmentalTerritorial.avoidedCo2KilotonnesPerYear -
          base.environmentalTerritorial.avoidedCo2KilotonnesPerYear,
        1
      ),
      ruralViabilityIndex:
        candidate.environmentalTerritorial.ruralViabilityIndex -
        base.environmentalTerritorial.ruralViabilityIndex
    }
  };
}
