import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export interface BankProvider {
  readonly bankId: string;
  readonly bankName: string;
  evaluate(context: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>>;
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
