import {
  BankProvider,
  calculatePriceInstallment,
  calculateMaxLoanAmount,
} from './bank-provider.interface';
import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export class BancoAlfaProvider implements BankProvider {
  readonly bankId = 'banco-alfa';
  readonly bankName = 'Banco Alfa Consig';

  async evaluate({ request, employer }: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>> {
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    if (!employer.isActive) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Convênio negado: CNPJ do empregador (${employer.companyName}) consta como ${employer.statusDescription}.`,
      };
    }

    const interestRateMonthly = 1.80;
    const installmentValue = calculatePriceInstallment(
      request.requestedAmount,
      interestRateMonthly,
      request.installments
    );
    const maxMargin = Number((request.monthlyIncome * 0.35).toFixed(2));

    if (installmentValue > maxMargin) {
      const suggestedMaxAmount = calculateMaxLoanAmount(maxMargin, interestRateMonthly, request.installments);
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        interestRateMonthly,
        installmentValue,
        suggestedMaxAmount,
        reason: `A parcela de R$ ${installmentValue.toFixed(2)} excede sua margem de 35% (R$ ${maxMargin.toFixed(2)}). Contraproposta disponível: até R$ ${suggestedMaxAmount.toLocaleString('pt-BR')} em ${request.installments}x.`,
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
