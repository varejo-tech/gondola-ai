# Processo: Promoção

modo: híbrido
descricao: Ciclo completo de promoção — análise de oportunidades, criação de materiais, publicação e verificação de execução em loja.
dependencias: nenhuma

## Configuração de fontes de dados

Este processo utiliza `config.json` para declarar as fontes de dados consumidas pelas skills. Cada usuário deve configurar seu próprio `config.json` com as credenciais e endpoints corretos. O arquivo não é versionado.

Cada dataset suporta múltiplos tipos de fonte: `arquivo` (Excel, CSV), `api` (endpoint + credenciais) ou `banco` (host + porta + credenciais). O tipo é escolha do usuário na configuração — as skills referenciam apenas o nome do dataset, não o tipo.

### Datasets utilizados

| Dataset | Consumido por | Descrição |
|---|---|---|
| `estoque` | skill-oportunidade-promocional | Dados de estoque atual |
| `vendas` | skill-oportunidade-promocional | Histórico de vendas |
| `vendas_cupom` | skill-cross-selling | Vendas por cupom fiscal (últimos 6 meses) |
| `instagram` | skill-pesquisa-concorrente, skill-publicacao | Meta API — Instagram Graph |
| `whatsapp` | skill-checklist-loja, skill-distribuicao | Meta API — WhatsApp Business |
| `imagen` | skill-geracao-imagem | Google API — Imagen |

### Template do config.json

Ver `config.json` na raiz do processo para o formato esperado.

## Agentes

- agente-analista: Analisa dados internos e externos para identificar oportunidades de promoção. Entrega lista curada de produtos recomendados.
- agente-criativo: Produz materiais de comunicação (briefing, peças visuais) e publica nos canais da loja.
- agente-execucao: Garante execução no chão de loja e distribui relatórios via WhatsApp.

## Fluxo de execução

1. **Fase 1 — Entender** — agente-analista executa análise de oportunidades, cross-selling e pesquisa de concorrentes. Grava relatório consolidado em `outputs/`.
   - Checkpoint (modo híbrido): Apresenta lista de produtos recomendados para validação do usuário antes de prosseguir.
2. **Fase 2 — Multiplicar** — agente-criativo recebe o output do analista, gera briefing, produz peça visual e publica no Instagram. Grava registro em `outputs/`.
   - Checkpoint (modo híbrido): Apresenta briefing e peça gerada para aprovação antes de publicar.
3. **Fase 3 — Coordenar** — agente-execucao dispara checklist de execução em loja e distribui relatórios. Grava status em `outputs/`.
