import { EmployerInfo, PayingSourceKind, SimulationRequest } from '../domain/types';

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral: string;
}

type CnpjSourceKind = Exclude<PayingSourceKind, 'SOCIAL_SECURITY'>;

/** Real CNPJ of INSS (Instituto Nacional do Seguro Social), the paying source for retirees/pensioners. */
const INSS_CNPJ = '29979036000140';

export class EmployerService {
  private readonly API_URL = 'https://brasilapi.com.br/api/cnpj/v1';
  private readonly TIMEOUT_MS = 3000;

  /**
   * Resolves who pays the applicant (and therefore who must authorize the payroll deduction):
   * - INSS: predefined social security entity, no network call needed.
   * - CLT / Public servant: employer/agency CNPJ checked on BrasilAPI (with fallback).
   */
  async resolvePayingSource(request: SimulationRequest): Promise<EmployerInfo> {
    switch (request.profile) {
      case 'INSS':
        return this.buildInssPayingSource();
      case 'PUBLIC_SERVANT':
        return this.getEmployerInfo(request.employerCnpj, 'PUBLIC_AGENCY');
      case 'CLT':
      default:
        return this.getEmployerInfo(request.employerCnpj, 'PRIVATE_COMPANY');
    }
  }

  async getEmployerInfo(cnpj: string, kind: CnpjSourceKind = 'PRIVATE_COMPANY'): Promise<EmployerInfo> {
    try {
      const response = await fetch(`${this.API_URL}/${cnpj}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`BrasilAPI returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as BrasilApiCnpjResponse;
      const status = (data.descricao_situacao_cadastral || 'DESCONHECIDA').toUpperCase();

      return {
        cnpj,
        companyName: data.nome_fantasia || data.razao_social || 'Empresa Identificada',
        isActive: status === 'ATIVA',
        statusDescription: status,
        source: 'BRASIL_API',
        kind,
      };
    } catch (error) {
      console.warn(
        `[EmployerService] Fallback ativado para CNPJ ${cnpj}. Motivo: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`
      );
      return this.buildFallbackEmployer(cnpj, kind);
    }
  }

  private buildInssPayingSource(): EmployerInfo {
    return {
      cnpj: INSS_CNPJ,
      companyName: 'INSS – Instituto Nacional do Seguro Social',
      isActive: true,
      statusDescription: 'CONVÊNIO ATIVO (Previdência Social)',
      source: 'INSS_REGISTRY',
      kind: 'SOCIAL_SECURITY',
    };
  }

  private buildFallbackEmployer(cnpj: string, kind: CnpjSourceKind): EmployerInfo {
    const isSimulatedInactive = cnpj.endsWith('00');
    const isPublicAgency = kind === 'PUBLIC_AGENCY';

    const activeName = isPublicAgency
      ? 'Órgão Público Simulado (Contingência)'
      : 'Empresa Parceira Simulada S.A. (Contingência)';
    const inactiveName = isPublicAgency
      ? 'Órgão Público Simulado Extinto (Contingência)'
      : 'Empresa Simulada Baixada LTDA (Contingência)';

    return {
      cnpj,
      companyName: isSimulatedInactive ? inactiveName : activeName,
      isActive: !isSimulatedInactive,
      statusDescription: isSimulatedInactive ? 'BAIXADA (Simulado)' : 'ATIVA (Contingência)',
      source: 'FALLBACK',
      kind,
    };
  }
}
