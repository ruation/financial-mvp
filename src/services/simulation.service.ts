import crypto from 'crypto';
import { BankProvider } from '../providers/bank-provider.interface';
import { EmployerService } from './employer.service';
import {
  SimulationRequest,
  ConsolidatedSimulationResponse,
  BankEvaluationResult,
  EvaluationContext,
  EvaluationStatus,
} from '../domain/types';

export class SimulationService {
  private readonly BANK_TIMEOUT_MS = 2000;

  constructor(
    private readonly employerService: EmployerService,
    private readonly providers: BankProvider[]
  ) {}

  async executeSimulation(request: SimulationRequest): Promise<ConsolidatedSimulationResponse> {
    const employer = await this.employerService.getEmployerInfo(request.employerCnpj);
    const context: EvaluationContext = { request, employer };

    const evaluations = await Promise.all(
      this.providers.map((provider) => this.evaluateWithResilience(provider, context))
    );

    const statusPriority: Record<EvaluationStatus, number> = {
      APPROVED: 1,
      REJECTED: 2,
      UNAVAILABLE: 3,
    };

    evaluations.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      if (a.status === 'APPROVED' && b.status === 'APPROVED') {
        return (a.interestRateMonthly ?? 99) - (b.interestRateMonthly ?? 99);
      }
      if (a.status === 'REJECTED' && b.status === 'REJECTED') {
        return (b.suggestedMaxAmount ?? 0) - (a.suggestedMaxAmount ?? 0);
      }
      return 0;
    });

    return {
      simulationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      applicant: {
        name: request.name,
        maskedCpf: this.maskCpf(request.cpf),
        monthlyIncome: request.monthlyIncome,
        maxConsignableMargin: Number((request.monthlyIncome * 0.35).toFixed(2)),
      },
      employer,
      evaluations,
    };
  }

  private async evaluateWithResilience(
    provider: BankProvider,
    context: EvaluationContext
  ): Promise<BankEvaluationResult> {
    const startTime = Date.now();

    try {
      const evaluationPromise = provider.evaluate(context);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), this.BANK_TIMEOUT_MS)
      );

      const result = await Promise.race([evaluationPromise, timeoutPromise]);

      return {
        ...result,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message === 'TIMEOUT_EXCEEDED';

      console.warn(
        `[SimulationService] Falha isolada no provedor ${provider.bankName} (${elapsed}ms): ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`
      );

      return {
        bankId: provider.bankId,
        bankName: provider.bankName,
        status: 'UNAVAILABLE',
        reason: isTimeout
          ? `Tempo limite de resposta excedido (${this.BANK_TIMEOUT_MS}ms).`
          : 'Serviço da instituição financeira temporariamente indisponível.',
        responseTimeMs: elapsed,
      };
    }
  }

  private maskCpf(cpf: string): string {
    return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
  }
}
