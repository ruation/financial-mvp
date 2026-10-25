import {
  BankProvider,
  ProfilePolicies,
  INSS_MONTHLY_RATE_CAP,
  PROFILE_LABELS,
  calculatePriceInstallment,
  calculateMaxLoanAmount,
  formatPercent,
} from './bank-provider.interface';
import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export class BancoAlfaProvider implements BankProvider {
  readonly bankId = 'banco-alfa';
  readonly bankName = 'Banco Alfa Consig';

  private readonly policies: ProfilePolicies = {
    CLT: { interestRateMonthly: 1.80, marginRate: 0.35, maxInstallments: 84 },
    INSS: { interestRateMonthly: INSS_MONTHLY_RATE_CAP, marginRate: 0.35, maxInstallments: 84 },
    PUBLIC_SERVANT: { interestRateMonthly: 1.55, marginRate: 0.35, maxInstallments: 84 },
  };

  async evaluate({ request, employer }: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>> {
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    const policy = this.policies[request.profile];
    if (!policy) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Convênio indisponível para o perfil ${PROFILE_LABELS[request.profile]}.`,
      };
    }

    if (!employer.isActive) {
      const sourceLabel = employer.kind === 'PUBLIC_AGENCY' ? 'CNPJ do órgão público' : 'CNPJ do empregador';
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Convênio negado: ${sourceLabel} (${employer.companyName}) consta como ${employer.statusDescription}.`,
      };
    }

    if (request.installments > policy.maxInstallments) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Prazo máximo para ${PROFILE_LABELS[request.profile]} neste banco é de ${policy.maxInstallments} parcelas.`,
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
        reason: `A parcela de R$ ${installmentValue.toFixed(2)} excede sua margem de ${formatPercent(policy.marginRate)} (R$ ${maxMargin.toFixed(2)}). Contraproposta disponível: até R$ ${suggestedMaxAmount.toLocaleString('pt-BR')} em ${request.installments}x.`,
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
