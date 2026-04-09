# Skill: Cross-Selling

## Propósito

Identificar oportunidades de venda cruzada para os produtos selecionados, combinando análise de cesta de compras (dados internos) com pesquisa de complementaridades externas.

## Inputs

- produtos_alvo: array — Lista de produtos selecionados para promoção (output da skill-oportunidade-promocional)
- dados_vendas_cupom: dataset `vendas_cupom` — Dados de vendas detalhadas por transação (últimos 6 meses). Precisa conter: identificador da transação/cupom/nota fiscal, identificador do produto, nome/descrição do produto, data da venda. Estrutura e nomes de campos variam por fonte — o agente deve identificar a correspondência.

## Outputs

- correlacoes: array — Para cada produto-alvo, lista dos 10 principais produtos correlacionados, com:
  - produto_alvo: string — Produto de referência
  - correlacionados: array — Top 10, cada um com:
    - produto: string — Nome/código do produto correlacionado
    - coocorrencia: number — Quantidade de vezes que aparecem juntos
    - confianca: number — P(B|A) — probabilidade de comprar B dado que comprou A
    - lift: number — Lift da associação
    - nivel_confianca: string — "alta" (100+) | "utilizavel" (50-99) | "exploratoria" (30-49)
    - origem: string — "cesta" | "pesquisa_externa"
    - observacao_comercial: string — Contexto de uso ou sugestão de exposição

## Implementação

### Frente 1 — Análise de cesta (dados internos)

1. Carregar `dados_vendas_cupom` via config do processo
2. Para cada produto em `produtos_alvo`:
   a. Filtrar cupons dos últimos 6 meses que contenham o produto
   b. Contar coocorrências com todos os outros produtos
   c. Calcular métricas:
      - Coocorrência: contagem de cupons com ambos os produtos
      - Confiança: coocorrência / total de cupons com produto A
      - Lift: confiança / (total de cupons com produto B / total de cupons)
   d. Filtrar:
      - Mínimo 30 coocorrências
      - Lift > 1.1 (descartar lift ≈ 1)
      - Ignorar produtos genéricos/onipresentes (ex: sacola plástica, sal, açúcar)
   e. Classificar por nível de confiança:
      - 100+ coocorrências → "alta"
      - 50-99 coocorrências → "utilizavel"
      - 30-49 coocorrências → "exploratoria"
   f. Ranquear por lift * coocorrência (balancear relevância e volume)
   g. Selecionar top 10

### Frente 2 — Pesquisa externa

1. Para cada produto em `produtos_alvo`:
   a. Pesquisar na web:
      - Ocasiões de consumo típicas
      - Combinações culinárias e receitas populares
      - Complementaridades de uso (ex: macarrão → molho, queijo ralado)
      - Práticas de cross-merchandising no varejo
   b. Identificar produtos complementares não evidentes nos dados internos
   c. Gerar sugestões com `origem: "pesquisa_externa"` e `observacao_comercial` descritiva

### Consolidação

1. Para cada produto-alvo, unir resultados das duas frentes
2. Separar em duas seções:
   - "Comprovados pela cesta" — produtos com `origem: "cesta"`
   - "Sugeridos por pesquisa externa" — produtos com `origem: "pesquisa_externa"`
3. Limitar a 10 produtos no total por produto-alvo (priorizar cesta sobre pesquisa)
4. Retornar `correlacoes`

### Fallback

- Se `vendas_cupom` indisponível: executar apenas Frente 2 (pesquisa externa) e informar ao operador. Todos os resultados terão `origem: "pesquisa_externa"`.
- Se pesquisa web falhar: executar apenas Frente 1 (cesta). Resultados limitados a dados internos.
