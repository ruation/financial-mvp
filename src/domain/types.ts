export type ApplicantProfile = 'CLT' | 'INSS' | 'PUBLIC_SERVANT';

interface BaseSimulationRequest {
  name: string;
  email: string;
  cpf: string;
  monthlyIncome: number;
  requestedAmount: number;
  installments: number;
}

export interface CltSimulationRequest extends BaseSimulationRequest {
  profile: 'CLT';
  employerCnpj: string;
}

export interface InssSimulationRequest extends BaseSimulationRequest {
  profile: 'INSS';
  benefitNumber: string;
}

export interface PublicServantSimulationRequest extends BaseSimulationRequest {
  profile: 'PUBLIC_SERVANT';
  employerCnpj: string;
  registrationNumber: string;
}

export type SimulationRequest =
  | CltSimulationRequest
  | InssSimulationRequest
  | PublicServantSimulationRequest;

export type PayingSourceKind = 'PRIVATE_COMPANY' | 'SOCIAL_SECURITY' | 'PUBLIC_AGENCY';

export interface EmployerInfo {
  cnpj: string;
  companyName: string;
  isActive: boolean;
  statusDescription: string;
  source: 'BRASIL_API' | 'FALLBACK' | 'INSS_REGISTRY';
  kind: PayingSourceKind;
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
    profile: ApplicantProfile;
    maskedCpf: string;
    monthlyIncome: number;
    maxConsignableMargin: number;
  };
  employer: EmployerInfo;
  evaluations: BankEvaluationResult[];
}
