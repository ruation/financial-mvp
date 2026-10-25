export interface SimulationRequest {
  name: string;
  email: string;
  cpf: string;
  employerCnpj: string;
  monthlyIncome: number;
  requestedAmount: number;
  installments: number;
}

export interface EmployerInfo {
  cnpj: string;
  companyName: string;
  isActive: boolean;
  statusDescription: string;
  source: 'BRASIL_API' | 'FALLBACK';
}

export interface EvaluationContext {
  request: SimulationRequest;
  employer: EmployerInfo;
}

export type EvaluationStatus = 'APPROVED' | 'REJECTED' | 'UNAVAILABLE';

export interface BankEvaluationResult {
  bankId: string;
  bankName: string;
  status: EvaluationStatus;
  interestRateMonthly?: number;
  installmentValue?: number;
  totalAmount?: number;
  suggestedMaxAmount?: number;
  reason?: string;
  responseTimeMs: number;
}

export interface ConsolidatedSimulationResponse {
  simulationId: string;
  timestamp: string;
  applicant: {
    name: string;
    maskedCpf: string;
    monthlyIncome: number;
    maxConsignableMargin: number;
  };
  employer: EmployerInfo;
  evaluations: BankEvaluationResult[];
}
