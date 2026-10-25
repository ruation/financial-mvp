import {
  BankProvider,
  calculatePriceInstallment,
  calculateMaxLoanAmount,
} from './bank-provider.interface';
import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export class BancoBetaProvider implements BankProvider {
  readonly bankId = 'banco-beta';
  readonly bankName = 'Beta Financeira S.A.';

  async evaluate({ request, employer }: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>> {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 400));

    if (!employer.isActive) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Empregador inativo na Receita Federal (${employer.statusDescription}).`,
      };
    }

    if (request.monthlyIncome < 2500) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: 'Política interna: Beta Financeira exige renda mensal mínima de R$ 2.500,00.',
      };
    }

    if (request.installments > 60) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: 'Política interna: prazo máximo permitido por esta instituição é de 60 parcelas.',
      };
    }

    const interestRateMonthly = 1.45;
    const installmentValue = calculatePriceInstallment(
      request.requestedAmount,
      interestRateMonthly,
      request.installments
    );
    const maxMargin = Number((request.monthlyIncome * 0.30).toFixed(2));

    if (installmentValue > maxMargin) {
      const suggestedMaxAmount = calculateMaxLoanAmount(maxMargin, interestRateMonthly, request.installments);
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        interestRateMonthly,
        installmentValue,
        suggestedMaxAmount,
        reason: `A parcela de R$ ${installmentValue.toFixed(2)} excede o limite interno de 30% da renda (R$ ${maxMargin.toFixed(2)}). Contraproposta disponível: até R$ ${suggestedMaxAmount.toLocaleString('pt-BR')} em ${request.installments}x.`,
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
