import {
  BankProvider,
  calculatePriceInstallment,
  calculateMaxLoanAmount,
} from './bank-provider.interface';
import { EvaluationContext, BankEvaluationResult } from '../domain/types';

export class BancoGamaProvider implements BankProvider {
  readonly bankId = 'banco-gama';
  readonly bankName = 'Gama Digital Bank';

  async evaluate({ request, employer }: EvaluationContext): Promise<Omit<BankEvaluationResult, 'responseTimeMs'>> {
    if (request.employerCnpj.endsWith('99')) {
      await new Promise((resolve) => setTimeout(resolve, 3500));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
    }

    if (request.cpf.endsWith('0')) {
      throw new Error('HTTP 503 Service Unavailable - Core bancário em manutenção');
    }

    if (!employer.isActive) {
      return {
        bankId: this.bankId,
        bankName: this.bankName,
        status: 'REJECTED',
        reason: `Empresa empregadora não habilitada (${employer.statusDescription}).`,
      };
    }

    const interestRateMonthly = 1.60;
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
        reason: `Parcela calculada (R$ ${installmentValue.toFixed(2)}) supera a margem de 35% (R$ ${maxMargin.toFixed(2)}). Contraproposta disponível: até R$ ${suggestedMaxAmount.toLocaleString('pt-BR')} em ${request.installments}x.`,
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
