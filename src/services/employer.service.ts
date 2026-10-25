import { EmployerInfo } from '../domain/types';

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral: string;
}

export class EmployerService {
  private readonly API_URL = 'https://brasilapi.com.br/api/cnpj/v1';
  private readonly TIMEOUT_MS = 3000;

  async getEmployerInfo(cnpj: string): Promise<EmployerInfo> {
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
      };
    } catch (error) {
      console.warn(
        `[EmployerService] Fallback ativado para CNPJ ${cnpj}. Motivo: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`
      );
      return this.buildFallbackEmployer(cnpj);
    }
  }

  private buildFallbackEmployer(cnpj: string): EmployerInfo {
    const isSimulatedInactive = cnpj.endsWith('00');

    return {
      cnpj,
      companyName: isSimulatedInactive
        ? 'Empresa Simulada Baixada LTDA (Contingência)'
        : 'Empresa Parceira Simulada S.A. (Contingência)',
      isActive: !isSimulatedInactive,
      statusDescription: isSimulatedInactive ? 'BAIXADA (Simulado)' : 'ATIVA (Contingência)',
      source: 'FALLBACK',
    };
  }
}
