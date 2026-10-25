# Simulador de Empréstimo Consignado — MVP Octafin

Aplicação para simulação, validação de convênio empregador e consolidação resiliente de propostas de empréstimo consignado em múltiplas instituições financeiras.

---

## 1. Instruções de Execução

### Pré-requisitos
- **Node.js** (v18+ ou superior).

### Como rodar localmente
1. Instale as dependências do projeto:
   `npm install`
2. Inicie o servidor de desenvolvimento:
   `npm run dev`
3. Abra o navegador em:
   `http://localhost:3000`

### Fluxo em duas etapas
1. **Seleção de Perfil:** o usuário escolhe entre 🏢 **Trabalhador CLT**, 👵 **Aposentado/Pensionista INSS** ou 🏛️ **Servidor Público**.
2. **Formulário adaptado ao perfil:** os campos mudam conforme o vínculo (ver tabela abaixo) e o botão **"Alterar perfil"** permite voltar à etapa 1 a qualquer momento.

| Perfil | Identificação do vínculo | Fonte pagadora |
|---|---|---|
| CLT | CNPJ do Empregador | Consulta ao vivo na BrasilAPI (com fallback) |
| INSS | Número do Benefício (NB, 10 dígitos) | INSS definido automaticamente (sem chamada externa) |
| Servidor Público | CNPJ do Órgão + Matrícula funcional | Consulta ao vivo na BrasilAPI (com fallback) |

> A API continua aceitando payloads **sem** o campo `profile`, que são tratados como `CLT` (compatibilidade retroativa).

### Como testar os diferentes cenários na interface
Cada perfil já carrega valores padrão válidos e exibe seus próprios gatilhos de teste. Os principais:
- **Consulta Real de CNPJ (BrasilAPI):** CLT com `33000167000101` (Petrobras) ou Servidor com `00394460000141` (Ministério da Fazenda).
- **Contraproposta Inteligente (Cálculo Reverso de Margem):** Altere o valor solicitado para `45000`. Os bancos reprovarão o valor original por exceder a margem consignável, mas apresentarão automaticamente o **teto máximo pré-aprovado** para o salário informado.
- **Contingência de CNPJ Inativo (Fallback):** Informe um CNPJ fictício terminado em `00` (ex: `12345678000100`).
- **Isolamento de Timeout (> 2s):** Informe um CNPJ terminado em `99` (ex: `12345678000199`) ou, no perfil INSS, um NB terminado em `99` (ex: `1234567899`). O *Gama Digital Bank* sofrerá timeout de 2000ms sem afetar a resposta dos demais bancos.
- **Isolamento de Erro HTTP 503:** Informe um CPF terminado em `0` (ex: `12345678910`). O *Gama Digital Bank* simulará falha crítica de servidor e será listado como `UNAVAILABLE` de forma segura.
- **Convênio por perfil:** no perfil INSS a *Beta Financeira* reprova por não operar o convênio; no perfil Servidor com `84` parcelas ela reprova por exceder seu prazo máximo (72x).

---

## 2. Decisões Técnicas e Arquitetura

- **Padrão Adapter / Strategy (`BankProvider`):** Cada instituição financeira possui regras próprias de margem (30% vs 35%), renda mínima, limites de prazo e contratos de retorno. A interface `BankProvider` desacopla o orquestrador (`SimulationService`) das regras individuais de cada banco, respeitando o Princípio Aberto/Fechado (SOLID).
- **Regras por Perfil (`ProfilePolicies`):** Cada banco declara um mapa `Record<ApplicantProfile, ProfilePolicy | null>` com taxa, margem, prazo máximo e renda mínima por perfil (`null` = convênio não operado). Adicionar um novo perfil ou banco exige apenas declarar sua política.
- **Validação Discriminada (`z.discriminatedUnion`):** O schema Zod escolhe os campos obrigatórios a partir do `profile` (CNPJ, NB ou CNPJ + matrícula), e o tipo `SimulationRequest` é uma *discriminated union* no TypeScript, garantindo em tempo de compilação que cada perfil só acesse seus próprios identificadores.
- **Consumo de API Externa Real com Fallback (`EmployerService`):** Antes de acionar os bancos, o serviço resolve a fonte pagadora (`resolvePayingSource`). Para CLT e Servidores, consulta o CNPJ na **BrasilAPI** (`GET /api/cnpj/v1/{cnpj}`); caso a API pública esteja indisponível ou o avaliador utilize um CNPJ fictício, o sistema aciona um modo de contingência transparente. Para INSS, a fonte pagadora é predefinida, evitando chamadas externas desnecessárias.
- **Execução Paralela e Tolerância a Falhas (`Promise.all` + `Promise.race`):** Todas as instituições são consultadas simultaneamente com um SLA máximo de **2 segundos** por banco. Falhas ou lentidão em um parceiro são isoladas e convertidas no status `UNAVAILABLE`.
- **Matemática Financeira Realista (Tabela Price Direta e Reversa):** Cálculo exato de prestações compostas e aplicação da fórmula inversa da Tabela Price para sugerir contrapropostas viáveis ao cliente.
- **Ordenação Focada em Negócio:** Os resultados são ordenados priorizando: 1º `APPROVED` (da menor taxa de juros para a maior), 2º `REJECTED` (priorizando bancos que oferecem contraproposta de valor) e 3º `UNAVAILABLE`.

### Regras simuladas por banco e perfil

| Banco | CLT | INSS | Servidor Público |
|---|---|---|---|
| **Banco Alfa Consig** | 1,80% a.m. · margem 35% · até 84x | 1,66% a.m. (teto) · margem 35% · até 84x | 1,55% a.m. · margem 35% · até 84x |
| **Beta Financeira S.A.** | 1,45% a.m. · margem 30% · renda ≥ R$ 2.500 · até 60x | Não opera convênio INSS | 1,35% a.m. · margem 30% · até 72x |
| **Gama Digital Bank** | 1,60% a.m. · margem 35% · até 84x | 1,62% a.m. · margem 35% · até 84x | 1,50% a.m. · margem 35% · até 84x |

> Taxas e prazos são valores fictícios para fins de demonstração. O teto INSS do MVP está centralizado na constante `INSS_MONTHLY_RATE_CAP`.

---

## 3. Limitações do MVP

- **Persistência em Memória:** Não há banco de dados acoplado para facilitar a execução imediata pelos avaliadores sem necessidade de containers externos.
- **Comunicação Request-Response Síncrona:** O cliente aguarda até 2 segundos na requisição HTTP. Bancos que respondem apenas via Webhook assíncrono exigiriam arquitetura orientada a eventos.

---

## 4. Espaço para Propor (Melhorias Implementadas e Planejadas)

### ✅ Melhorias IMPLEMENTADAS no MVP

#### 1. Contraproposta Inteligente via Cálculo Reverso da Tabela Price
1. **Problema:** No fluxo tradicional de crédito consignado, quando o cliente solicita um valor cuja parcela ultrapassa 30% ou 35% do seu salário, ele recebe apenas um "Reprovado" e abandona a plataforma sem saber quanto poderia contratar.
2. **Proposta:** Quando um banco reprova a simulação exclusivamente por limite de margem consignável, o sistema aplica a fórmula inversa da Tabela Price com a taxa daquele banco e retorna o campo `suggestedMaxAmount` (teto máximo liberado para o salário do cliente).
3. **Por quê:** Para o **cliente**, transforma uma frustração em uma oferta clara e acionável. Para a **operação**, recupera leads que seriam perdidos por erro de estimativa do usuário no preenchimento inicial.

#### 2. Isolamento de Falhas e Timeout Individual por Instituição (Degradação Graciosa)
1. **Problema:** A operação depende de APIs bancárias de terceiros sujeitas a quedas (HTTP 5xx) e alta latência. Uma falha não tratada em um único banco parceiro derrubaria toda a simulação.
2. **Proposta:** Encapsulamento individual de cada provedor com `Promise.race` (timeout estrito de 2 segundos) e conversão de exceções no estado `UNAVAILABLE`, mantendo a exibição normal dos bancos saudáveis.
3. **Por quê:** Garante alta disponibilidade para o **cliente** e impede que a instabilidade técnica de um banco parceiro prejudique as vendas dos demais bancos na plataforma.

#### 3. Verificação Real do CNPJ Empregador (BrasilAPI) com Fallback Resiliente
1. **Problema:** No empréstimo consignado, a averbação depende de o empregador estar ativo na Receita Federal. Digitações incorretas ou empresas baixadas geram reprovações silenciosas nas esteiras bancárias.
2. **Proposta:** Integração com a API pública **BrasilAPI** para validar a situação cadastral e exibir a Razão Social do empregador na interface, acompanhada de um mecanismo de *Fallback* automático caso a API externa sofra timeout ou receba CNPJs de teste.
3. **Por quê:** Aumenta a transparência para o **cliente**, enriquece o contexto enviado aos bancos e garante que a aplicação nunca pare de funcionar mesmo se o serviço governamental sair do ar.

#### 4. Mascaramento de Dados Sensíveis (LGPD)
1. **Problema:** Exposição de dados pessoais (CPF completo) em logs de erro de integração e payloads de retorno.
2. **Proposta:** Higienização na entrada com Zod, omissão de PII nos logs de falha dos provedores e mascaramento do CPF (`***.456.789-**`) na resposta consolidada.
3. **Por quê:** Reduz riscos de segurança e adequa a arquitetura aos princípios de minimização de dados da LGPD.

#### 5. Etapa de Perfil do Solicitante (CLT / INSS / Servidor Público)
1. **Problema:** Cada tipo de vínculo tem um convênio consignado diferente. Aposentados do INSS não têm "CNPJ do empregador", servidores públicos se identificam por órgão e matrícula, e taxas e prazos variam por convênio. Um formulário único confunde o cliente e gera simulações inválidas.
2. **Proposta:** Uma etapa inicial de seleção de perfil adapta o formulário (CNPJ, NB ou CNPJ do órgão + matrícula), a validação (`z.discriminatedUnion`), a resolução da fonte pagadora (INSS sem chamada externa) e as regras de cada banco (`ProfilePolicies`, incluindo bancos que não operam determinado convênio).
3. **Por quê:** O **cliente** só preenche o que faz sentido para ele e vê ofertas realistas para o seu convênio. Para a **operação**, a arquitetura permite plugar novos convênios (ex.: FGTS, militares) declarando apenas novas políticas por banco.

---

### 🗓️ Melhorias PLANEJADAS (Ordem de Prioridade para a "Próxima Semana")

#### Prioridade 1: Processamento Assíncrono com Filas e Server-Sent Events (SSE)
1. **Problema:** Esteiras reais de crédito consignado frequentemente levam de 10 a 40 segundos para consultar sistemas de folha de pagamento e bureaus de crédito, tornando inviável segurar uma conexão HTTP síncrona aberta.
2. **Proposta:** Desacoplar a rota `POST /api/simulations` para retornar `HTTP 202 Accepted` com um `simulationId`, processar cada banco em background via fila (BullMQ + Redis) e transmitir o resultado individual de cada instituição para o front-end em tempo real via **Server-Sent Events (SSE)** assim que ficar pronto.
3. **Por quê:** O **cliente** visualiza imediatamente os bancos mais rápidos na tela enquanto os bancos legados continuam processando sem risco de *Gateway Timeout*, aumentando o número de propostas entregues.

#### Prioridade 2: Padrão Circuit Breaker por Provedor Bancário
1. **Problema:** Se a API de um banco parceiro cair por 2 horas, continuar enviando requisições que aguardarão 2 segundos de timeout em todas as simulações desperdiça threads/conexões da nossa infraestrutura e atrasa a resposta para o usuário.
2. **Proposta:** Implementar um **Circuit Breaker** (ex: biblioteca `opossum`) em torno de cada `BankProvider`. Após 5 falhas consecutivas, o circuito abre por 60 segundos e retorna `UNAVAILABLE` em `0ms` sem realizar chamada de rede, testando a recuperação gradualmente no estado *Half-Open*.
3. **Por quê:** Protege a **infraestrutura** da empresa contra efeito cascata, reduz drasticamente o tempo de resposta durante incidentes em terceiros e evita bloqueios por *rate-limiting* nos bancos parceiros.

#### Prioridade 3: Idempotência e Cache de Simulações Recentes (Redis TTL)
1. **Problema:** Clientes costumam clicar repetidas vezes no botão de simulação ou recarregar a página, gerando chamadas duplicadas e custos desnecessários de consumo de APIs externas.
2. **Proposta:** Criar uma chave de idempotência baseada no hash dos parâmetros da simulação (`SHA-256(cpf + cnpj + salario + valor + parcelas)`) e armazenar o resultado consolidado em cache com TTL de 10 minutos.
3. **Por quê:** Reduz custos operacionais de infraestrutura, evita sobrecarga nos bancos parceiros e entrega respostas instantâneas (`< 10ms`) em consultas repetidas pelo mesmo cliente.