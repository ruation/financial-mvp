import {
  ApplicantProfile,
  EvaluationContext,
  BankEvaluationResult,
  SimulationRequest,
} from '../domain/types';

export interface BankProvider {
  readonly bankId: string;
  readonly bankName: string;
  evaluate(context: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>>;
}

/** Commercial rules a bank applies to a given applicant profile. */
export interface ProfilePolicy {
  interestRateMonthly: number;
  /** Share of monthly income the installment may consume (e.g. 0.35 = 35%). */
  marginRate: number;
  maxInstallments: number;
  minMonthlyIncome?: number;
}

/** `null` means the bank does not operate that payroll agreement (convênio). */
export type ProfilePolicies = Record<ApplicantProfile, ProfilePolicy | null>;

/**
 * Simulated monthly interest cap for INSS payroll loans in this MVP.
 * Adjust here if the regulatory ceiling changes.
 */
export const INSS_MONTHLY_RATE_CAP = 1.66;

export const PROFILE_LABELS: Record<ApplicantProfile, string> = {
  CLT: 'Trabalhador CLT',
  INSS: 'Aposentado/Pensionista INSS',
  PUBLIC_SERVANT: 'Servidor Público',
};

/** Identifier of the employment/benefit link (CNPJ or NB), used by simulated test triggers. */
export function getLinkIdentifier(request: SimulationRequest): string {
  return request.profile === 'INSS' ? request.benefitNumber : request.employerCnpj;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function calculatePriceInstallment(
  principal: number,
  monthlyRatePercent: number,
  months: number
): number {
  const i = monthlyRatePercent / 100;
  const factor = Math.pow(1 + i, months);
  const pmt = principal * ((i * factor) / (factor - 1));
  return Number(pmt.toFixed(2));
}

export function calculateMaxLoanAmount(
  maxMonthlyInstallment: number,
  monthlyRatePercent: number,
  months: number
): number {
  const i = monthlyRatePercent / 100;
  const factor = Math.pow(1 + i, months);
  const pv = maxMonthlyInstallment * ((factor - 1) / (i * factor));
  return Math.floor(pv);
}
