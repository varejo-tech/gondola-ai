# Skill: Oportunidade Promocional

## Propósito

Identificar produtos com potencial promocional cruzando análise externa (sazonalidade, tendências) com análise interna (estoque excessivo, vendas baixas). Opcionalmente, incorporar negociações com fornecedores informadas pelo usuário.

## Inputs

- data_atual: string (ISO 8601) — Data de referência para análise sazonal
- dados_estoque: dataset `estoque` — Dados de estoque atual. Precisa conter, para cada produto: identificador do produto, nome/descrição, quantidade em estoque, giro médio (diário ou mensal), e se o produto é perecível. Estrutura e nomes de campos variam por fonte — o agente deve identificar a correspondência.
- dados_vendas: dataset `vendas` — Histórico de vendas por produto (últimos 3 meses). Precisa conter: identificador do produto, nome/descrição, data da venda, quantidade vendida, valor vendido. Estrutura e nomes de campos variam por fonte — o agente deve identificar a correspondência.
- negociacoes_fornecedor: array (opcional) — Produtos em negociação informados pelo usuário

## Outputs

- produtos_recomendados: array — Lista ranqueada de produtos candidatos à promoção, cada item com:
  - produto: string — Nome/código do produto
  - justificativa: string — Motivo da recomendação (sazonal, estoque alto, negociação fornecedor)
  - fonte: string — "sazonal" | "estoque_alto" | "negociacao_fornecedor"
  - score: number — Pontuação de prioridade (0-100)
  - dados_suporte: object — Métricas que sustentam a recomendação

## Implementação

### Frente 1 — Exploração externa (pesquisa web)

1. Identificar o período sazonal atual com base na `data_atual`:
   - Meses e eventos próximos (Páscoa, Dia das Mães, São João, Natal, volta às aulas, etc.)
   - Estações do ano e seus impactos em consumo
2. Pesquisar tendências de consumo para o período:
   - Produtos em evidência no mercado
   - Lançamentos recentes relevantes para supermercados
   - Categorias com crescimento de demanda
3. Gerar lista de produtos sazonais recomendados com justificativa

### Frente 2 — Análise interna (dados do processo)

1. Carregar `dados_estoque` e `dados_vendas` via config do processo
2. Calcular para cada produto:
   - Relação estoque/giro: quantidade em estoque ÷ giro médio diário = dias de cobertura
   - Produtos com cobertura > 45 dias e venda declinante = candidatos
3. Classificar produtos por urgência de saída:
   - Perecíveis com cobertura alta → prioridade máxima
   - Não-perecíveis com cobertura > 60 dias → prioridade alta
   - Demais com cobertura > 45 dias → prioridade normal
4. Gerar lista de produtos internos recomendados com métricas

### Consolidação (modo híbrido)

1. Unir listas das duas frentes, removendo duplicatas
2. Apresentar ao usuário a lista consolidada
3. Perguntar: "Há negociações com fornecedores em andamento? Se sim, informe os produtos e condições."
4. Se houver negociações:
   - Avaliar potencial dos produtos informados usando os mesmos critérios internos
   - Incorporar à lista com fonte "negociacao_fornecedor"
5. Ranquear lista final por score (peso: perecíveis com estoque alto > sazonais > estoque alto > negociação)
6. Retornar `produtos_recomendados`

### Fallback

- Se dados de `estoque` ou `vendas` indisponíveis: executar apenas a Frente 1 (externa) e informar ao operador que a análise interna foi omitida por falta de dados.
- Se pesquisa web falhar: executar apenas a Frente 2 (interna) e informar ao operador.
