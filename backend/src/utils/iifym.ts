// backend/src/utils/iifym.ts
// Calculadora IIFYM — If It Fits Your Macros
// Métodos: Mifflin-St Jeor e Katch-McArdle

export type ActivityLevel =
  | 'SEDENTARY'
  | 'LIGHT'
  | 'MODERATE'
  | 'ACTIVE'
  | 'VERY_ACTIVE';

export type Goal = 'DEFICIT' | 'MAINTENANCE' | 'SURPLUS';
export type Gender = 'MALE' | 'FEMALE';

interface IIFYMInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
  bodyFatPercent?: number | null;
}

interface IIFYMResult {
  bmr: number;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  method: string;
  leanMassKg: number | null;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  DEFICIT: -500,
  MAINTENANCE: 0,
  SURPLUS: 300,
};

export function calculateIIFYM(input: IIFYMInput): IIFYMResult {
  const { weightKg, heightCm, ageYears, gender, activityLevel, goal, bodyFatPercent } = input;

  let bmr: number;
  let method: string;
  let leanMassKg: number | null = null;

  if (bodyFatPercent != null && bodyFatPercent > 0 && bodyFatPercent < 60) {
    // ─── Katch-McArdle (mais preciso com % gordura) ────────────────────────
    leanMassKg = weightKg * (1 - bodyFatPercent / 100);
    bmr = 370 + 21.6 * leanMassKg;
    method = `Katch-McArdle (BF=${bodyFatPercent}%, LMM=${leanMassKg.toFixed(1)}kg)`;
  } else {
    // ─── Mifflin-St Jeor ──────────────────────────────────────────────────
    if (gender === 'MALE') {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
    }
    method = `Mifflin-St Jeor (${gender === 'MALE' ? 'Masculino' : 'Feminino'})`;
  }

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const targetKcal = Math.max(1200, tdee + GOAL_ADJUSTMENTS[goal]);

  // Distribuição de macros baseada em IIFYM:
  // Proteína: 2g por kg de massa magra (ou 1.8g/kg de peso total)
  const effectiveLeanMass = leanMassKg ?? weightKg * 0.82;
  const proteinG = Math.round(effectiveLeanMass * 2.0);

  // Lipídios: 0.9g por kg de peso total
  const fatG = Math.round(weightKg * 0.9);

  // Carboidratos: calorias restantes
  const remainingKcal = targetKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingKcal / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal: Math.round(targetKcal),
    proteinG,
    carbsG,
    fatG,
    method,
    leanMassKg: leanMassKg ? Math.round(leanMassKg * 10) / 10 : null,
  };
}
