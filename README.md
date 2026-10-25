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

### Como testar os diferentes cenários na interface
O formulário já inicia preenchido com um caso válido (incluindo o CNPJ real da Petrobras para consulta ao vivo na **BrasilAPI**). Você pode testar cenários específicos usando os gatilhos abaixo:
- **Consulta Real de CNPJ (BrasilAPI):** Utilize qualquer CNPJ real ativo (ex: `33000167000101`).
- **Contraproposta Inteligente (Cálculo Reverso de Margem):** Altere o valor solicitado para `45000`. Os bancos reprovarão o valor original por exceder a margem consignável, mas apresentarão automaticamente o **teto máximo pré-aprovado** para o salário informado.
- **Contingência de CNPJ Inativo (Fallback):** Informe um CNPJ fictício terminado em `00` (ex: `12345678000100`).
- **Isolamento de Timeout (> 2s):** Informe um CNPJ terminado em `99` (ex: `12345678000199`). O *Gama Digital Bank* sofrerá timeout de 2000ms sem afetar a resposta dos demais bancos.
- **Isolamento de Erro HTTP 503:** Informe um CPF terminado em `0` (ex: `12345678910`). O *Gama Digital Bank* simulará falha crítica de servidor e será listado como `UNAVAILABLE` de forma segura.

---

## 2. Decisões Técnicas e Arquitetura

- **Padrão Adapter / Strategy (`BankProvider`):** Cada instituição financeira possui regras próprias de margem (30% vs 35%), renda mínima, limites de prazo e contratos de retorno. A interface `BankProvider` desacopla o orquestrador (`SimulationService`) das regras individuais de cada banco, respeitando o Princípio Aberto/Fechado (SOLID).
- **Consumo de API Externa Real com Fallback (`EmployerService`):** Antes de acionar os bancos, o serviço consulta o CNPJ do empregador na **BrasilAPI** (`GET /api/cnpj/v1/{cnpj}`). Caso a API pública esteja indisponível ou o avaliador utilize um CNPJ fictício, o sistema aciona um modo de contingência transparente e repassa o contexto (`EvaluationContext`) aos bancos.
- **Execução Paralela e Tolerância a Falhas (`Promise.all` + `Promise.race`):** Todas as instituições são consultadas simultaneamente com um SLA máximo de **2 segundos** por banco. Falhas ou lentidão em um parceiro são isoladas e convertidas no status `UNAVAILABLE`.
- **Matemática Financeira Realista (Tabela Price Direta e Reversa):** Cálculo exato de prestações compostas e aplicação da fórmula inversa da Tabela Price para sugerir contrapropostas viáveis ao cliente.
- **Ordenação Focada em Negócio:** Os resultados são ordenados priorizando: 1º `APPROVED` (da menor taxa de juros para a maior), 2º `REJECTED` (priorizando bancos que oferecem contraproposta de valor) e 3º `UNAVAILABLE`.

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