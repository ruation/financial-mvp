import {
  BankProvider,
  ProfilePolicies,
  PROFILE_LABELS,
  calculatePriceInstallment,
  calculateMaxLoanAmount,
  formatPercent,
} from './bank-provider.interface';
import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export class BancoBetaProvider implements BankProvider {
  readonly bankId = 'banco-beta';
  readonly bankName = 'Beta Financeira S.A.';

  private readonly policies: ProfilePolicies = {
    CLT: { interestRateMonthly: 1.45, marginRate: 0.30, maxInstallments: 60, minMonthlyIncome: 2500 },
    INSS: null,
    PUBLIC_SERVANT: { interestRateMonthly: 1.35, marginRate: 0.30, maxInstallments: 72 },
  };

  async evaluate({ request, employer }: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>> {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 400));

    const policy = this.policies[request.profile];
    if (!policy) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: 'Política interna: Beta Financeira não opera convênio INSS (aposentados e pensionistas).',
      };
    }

    if (!employer.isActive) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Empregador inativo na Receita Federal (${employer.statusDescription}).`,
      };
    }

    if (policy.minMonthlyIncome && request.monthlyIncome < policy.minMonthlyIncome) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Política interna: Beta Financeira exige renda mensal mínima de R$ ${policy.minMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${PROFILE_LABELS[request.profile]}.`,
      };
    }

    if (request.installments > policy.maxInstallments) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Política interna: prazo máximo permitido por esta instituição é de ${policy.maxInstallments} parcelas para ${PROFILE_LABELS[request.profile]}.`,
      };
    }

    const { interestRateMonthly } = policy;
    const installmentValue = calculatePriceInstallment(
      request.requestedAmount,
      interestRateMonthly,
      request.installments
    );
    const maxMargin = Number((request.monthlyIncome * policy.marginRate).toFixed(2));

    if (installmentValue > maxMargin) {
      const suggestedMaxAmount = calculateMaxLoanAmount(maxMargin, interestRateMonthly, request.installments);
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        interestRateMonthly,
        installmentValue,
        suggestedMaxAmount,
        reason: `A parcela de R$ ${installmentValue.toFixed(2)} excede o limite interno de ${formatPercent(policy.marginRate)} da renda (R$ ${maxMargin.toFixed(2)}). Contraproposta disponível: até R$ ${suggestedMaxAmount.toLocaleString('pt-BR')} em ${request.installments}x.`,
      };
    }

    return {
      bankId: this.bankId,
      bankName: this.bankName,
      status: 'APPROVED',
      interestRateMonthly,
      installmentValue,
      totalAmount: Number((installmentValue * request.installments).toFixed(2)),
    };
  }
}
