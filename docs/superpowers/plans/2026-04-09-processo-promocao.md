# Processo Promoção — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o primeiro processo do framework — `promocao/` — com 3 agentes, 8 skills, config de fontes de dados, fixtures mock e integração com o Orquestrador.

**Architecture:** Processo em 3 fases sequenciais (Entender → Multiplicar → Coordenar). Skills são criadas primeiro (bottom-up), depois agentes que as referenciam, depois integração com o framework. O `config.json` introduz um padrão novo de configuração de fontes de dados por processo.

**Tech Stack:** Markdown (agentes/skills), JSON (config, fixtures, outputs), Bash (report-progress.sh), APIs externas (Meta API, Google Imagen).

---

## Task 1: Scaffold — Estrutura de pastas e CLAUDE.md do processo

**Files:**
- Create: `promocao/CLAUDE.md`
- Create: `promocao/config.json`
- Create: `promocao/agents/` (diretório)
- Create: `promocao/skills/` (diretório)
- Create: `promocao/outputs/` (diretório)
- Modify: `.gitignore`

- [ ] **Step 1: Criar estrutura de pastas**

```bash
mkdir -p promocao/agents promocao/skills promocao/outputs
```

- [ ] **Step 2: Criar `promocao/CLAUDE.md`**

Criar o arquivo com o conteúdo:

```markdown
# Processo: Promoção

modo: híbrido
descricao: Ciclo completo de promoção — análise de oportunidades, criação de materiais, publicação e verificação de execução em loja.
dependencias: nenhuma

## Configuração de fontes de dados

Este processo utiliza `config.json` para declarar as fontes de dados consumidas pelas skills. Cada usuário deve configurar seu próprio `config.json` com as credenciais e endpoints corretos. O arquivo não é versionado.

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
```

- [ ] **Step 3: Criar `promocao/config.json` (template)**

```json
{
  "fontes": {
    "estoque": {
      "tipo": "api",
      "endpoint": "https://api.avanco.com/estoque",
      "credenciais": "caminho/para/credenciais.json"
    },
    "vendas": {
      "tipo": "arquivo",
      "caminho": "/dados/vendas-mensal.xlsx"
    },
    "vendas_cupom": {
      "tipo": "banco",
      "host": "db.exemplo.com",
      "porta": 5432,
      "usuario": "PREENCHER",
      "senha": "PREENCHER",
      "database": "vendas"
    },
    "instagram": {
      "tipo": "api",
      "endpoint": "https://graph.facebook.com/v19.0",
      "access_token": "PREENCHER",
      "perfis_concorrentes": ["perfil1", "perfil2"],
      "perfil_publicacao": "PREENCHER"
    },
    "whatsapp": {
      "tipo": "api",
      "endpoint": "https://graph.facebook.com/v19.0",
      "access_token": "PREENCHER",
      "phone_number_id": "PREENCHER"
    },
    "imagen": {
      "tipo": "api",
      "endpoint": "https://generativelanguage.googleapis.com/v1beta",
      "api_key": "PREENCHER"
    }
  },
  "brand_book": {
    "paleta": ["#PREENCHER"],
    "fontes": ["PREENCHER"],
    "tom_de_voz": "PREENCHER",
    "logo": "caminho/para/logo.png"
  },
  "contatos": {
    "gerentes": [
      {"nome": "PREENCHER", "whatsapp": "+55PREENCHER", "loja": "PREENCHER"}
    ],
    "equipe_comercial": [
      {"nome": "PREENCHER", "whatsapp": "+55PREENCHER"}
    ]
  }
}
```

- [ ] **Step 4: Adicionar `config.json` ao `.gitignore`**

Adicionar ao `.gitignore`:

```
# Config de fontes de dados por processo (credenciais locais)
**/config.json
```

- [ ] **Step 5: Commit**

```bash
git add promocao/CLAUDE.md promocao/agents/.gitkeep promocao/skills/.gitkeep promocao/outputs/.gitkeep .gitignore
git commit -m "feat(promocao): scaffold do processo com CLAUDE.md e config template"
```

Nota: criar `.gitkeep` em pastas vazias para que o git as versione.

---

## Task 2: Skills da Fase 1 — Análise (agente-analista)

### Task 2a: skill-oportunidade-promocional

**Files:**
- Create: `promocao/skills/skill-oportunidade-promocional.md`

- [ ] **Step 1: Criar `promocao/skills/skill-oportunidade-promocional.md`**

```markdown
# Skill: Oportunidade Promocional

## Propósito

Identificar produtos com potencial promocional cruzando análise externa (sazonalidade, tendências) com análise interna (estoque excessivo, vendas baixas). Opcionalmente, incorporar negociações com fornecedores informadas pelo usuário.

## Inputs

- data_atual: string (ISO 8601) — Data de referência para análise sazonal
- dados_estoque: array — Lista de produtos com quantidade em estoque e giro médio. Dataset: `estoque`
- dados_vendas: array — Histórico de vendas por produto (últimos 3 meses). Dataset: `vendas`
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
   - Relação estoque/giro: `estoque_atual / giro_medio_diario` = dias de cobertura
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
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-oportunidade-promocional.md
git commit -m "feat(promocao): add skill-oportunidade-promocional"
```

### Task 2b: skill-cross-selling

**Files:**
- Create: `promocao/skills/skill-cross-selling.md`

- [ ] **Step 1: Criar `promocao/skills/skill-cross-selling.md`**

```markdown
# Skill: Cross-Selling

## Propósito

Identificar oportunidades de venda cruzada para os produtos selecionados, combinando análise de cesta de compras (dados internos) com pesquisa de complementaridades externas.

## Inputs

- produtos_alvo: array — Lista de produtos selecionados para promoção (output da skill-oportunidade-promocional)
- dados_vendas_cupom: object — Acesso a vendas por cupom fiscal dos últimos 6 meses. Dataset: `vendas_cupom`

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
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-cross-selling.md
git commit -m "feat(promocao): add skill-cross-selling"
```

### Task 2c: skill-pesquisa-concorrente

**Files:**
- Create: `promocao/skills/skill-pesquisa-concorrente.md`

- [ ] **Step 1: Criar `promocao/skills/skill-pesquisa-concorrente.md`**

```markdown
# Skill: Pesquisa Concorrente

## Propósito

Monitorar preços de concorrentes publicados em encartes no Instagram. Acessa perfis de concorrentes, analisa imagens de encarte e extrai produtos, marcas e preços anunciados.

## Inputs

- perfis_concorrentes: array — Lista de perfis Instagram a monitorar (lida de `config.json` → `instagram.perfis_concorrentes`)
- periodo_analise: object — `{ inicio: string, fim: string }` — Período de análise (datas ISO 8601)
- regras_padronizacao: object (opcional) — Mapeamento de aliases para nomes padronizados de produtos

## Outputs

- relatorio_concorrentes: object — Relatório estruturado com:
  - data_analise: string — Data de geração do relatório
  - periodo: object — Período analisado
  - concorrentes: array — Para cada concorrente:
    - perfil: string — Handle do Instagram
    - nome: string — Nome comercial
    - produtos: array — Lista de produtos identificados:
      - data_post: string — Data da publicação
      - produto: string — Nome padronizado
      - marca: string — Marca identificada
      - variacao: string — Tamanho/peso/volume
      - preco: number — Preço anunciado
      - tipo_post: string — "feed" | "story" | "reel" | "carrossel"
      - link: string — URL do post
  - comparativo: array — Tabela consolidada: data, concorrente, produto, marca, variação, preço

## Implementação

### Passos

1. Ler lista de `perfis_concorrentes` e `access_token` do config do processo (dataset `instagram`)
2. Para cada perfil de concorrente:
   a. Consultar posts do período via Instagram Graph API:
      - Endpoint: `GET /{user_id}/media`
      - Parâmetros: `fields=id,caption,media_type,media_url,timestamp,permalink`
      - Filtrar por período de análise
   b. Para cada post encontrado:
      - Baixar imagem/carrossel
      - Analisar imagem com visão computacional (modelo multimodal):
        - Identificar se é encarte/promoção
        - Extrair: produtos, marcas, tamanhos, preços
      - Analisar caption para informações complementares
   c. Normalizar descrições usando `regras_padronizacao` (se fornecido)
3. Consolidar dados em tabela comparativa
4. Gerar `relatorio_concorrentes`

### API/MCP

**Endpoint:** Instagram Graph API — `https://graph.facebook.com/v19.0`

**Autenticação:** Bearer token (lido de `config.json` → `instagram.access_token`)

**Chamadas:**

1. Listar mídias do perfil:
   - `GET /{user_id}/media?fields=id,caption,media_type,media_url,timestamp,permalink&access_token={token}`

2. Obter detalhes da mídia:
   - `GET /{media_id}?fields=id,media_type,media_url,children{media_url}&access_token={token}`

**Resposta esperada (listar mídias):**
```json
{
  "data": [
    {
      "id": "17895695668004550",
      "caption": "OFERTAS DA SEMANA! Arroz 5kg...",
      "media_type": "IMAGE",
      "media_url": "https://...",
      "timestamp": "2026-04-07T10:00:00+0000",
      "permalink": "https://www.instagram.com/p/..."
    }
  ],
  "paging": { "next": "..." }
}
```

### Fallback

- Se Meta API indisponível ou token expirado: informar ao operador "Não foi possível acessar os perfis de concorrentes no Instagram. Verifique o token de acesso no config.json." Retornar relatório vazio com flag `api_indisponivel: true`.
- Se análise de imagem não identificar preços: registrar post como "não classificável" e seguir para o próximo.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-pesquisa-concorrente.md
git commit -m "feat(promocao): add skill-pesquisa-concorrente"
```

---

## Task 3: Skills da Fase 2 — Criação (agente-criativo)

### Task 3a: skill-briefing

**Files:**
- Create: `promocao/skills/skill-briefing.md`

- [ ] **Step 1: Criar `promocao/skills/skill-briefing.md`**

```markdown
# Skill: Briefing

## Propósito

Transformar a lista de produtos selecionados para promoção em briefings estruturados e acionáveis para geração de conteúdo. Classifica produtos, agrupa em núcleos de encarte, gera copy, define hierarquia visual e monta calendário de publicação.

## Inputs

- promocoes_ativas: array — Lista de promoções (output do agente-analista), cada item com: produto, preco_original, preco_promocional, validade, justificativa
- brand_book: object — Kit de marca da loja (lido de `config.json` → `brand_book`): paleta, fontes, tom_de_voz, logo
- canais_ativos: array — Lista de canais habilitados (ex: ["instagram_feed"]). MVP: apenas "instagram_feed"

## Outputs

- briefings: object — Documento estruturado (JSON) com:
  - nucleos: array — Agrupamentos de encarte, cada um com:
    - nome: string — Nome do núcleo (ex: "Proteínas", "Bebidas")
    - produtos: array — Produtos do núcleo com hierarquia (âncora vs. coadjuvante)
    - headline: string — Copy curta com gatilho de urgência ou economia
    - tom_de_voz: string — Alinhamento com brand book
  - pecas: array — Briefing por peça a ser gerada:
    - canal: string — Canal de destino (ex: "instagram_feed")
    - formato: string — Especificação técnica (ex: "1080x1080")
    - nucleo: string — Referência ao núcleo
    - produtos_destaque: array — Produtos a exibir (máx 3-5 por post feed)
    - prompt_imagem: string — Prompt descritivo para geração de imagem
    - hashtags: array — Hashtags sugeridas
    - cta: string — Call-to-action
    - legenda: string — Legenda do post
  - cronograma: array — Calendário de publicação:
    - peca_ref: string — Referência à peça
    - canal: string — Canal
    - data_publicacao: string — Data e hora planejada
    - validade_promocao: string — Data limite da promoção

## Implementação

### Passos

1. Classificar cada produto por apelo visual e tipo de comunicação:
   - Perecíveis (hortifruti, carnes, frios) → foco em foto real, frescor
   - Bebidas → lifestyle, refrescância
   - Limpeza/higiene → foco em preço, economia
   - Mercearia seca → destaque ao desconto percentual
2. Agrupar itens em núcleos de encarte equilibrados:
   - Máximo 1 núcleo por departamento principal
   - Cada núcleo deve ter 1 produto-âncora (maior desconto) e 2-4 coadjuvantes
3. Para cada núcleo, gerar:
   - Headline: copy curta (máx 60 caracteres), gatilho de urgência ("Só hoje!", "Última chance!") ou economia ("Economize até X%")
   - Hierarquia visual: produto-âncora em destaque (maior, centralizado), coadjuvantes em apoio
   - Tom de voz calibrado pelo `brand_book.tom_de_voz`
4. Para cada peça (MVP = 1 post feed):
   - Formato: 1080×1080 pixels
   - Máximo 3-5 produtos por post feed
   - Gerar `prompt_imagem` descritivo: composição, cores, elementos, texto overlay
   - Gerar hashtags relevantes (5-10 por post)
   - Gerar CTA ("Corra para a [nome da loja]!", "Aproveite!")
   - Gerar legenda completa para o post
5. Montar cronograma de publicação

### Regras de negócio

- Nunca publicar promoção com validade expirada — validar `validade` >= data de publicação planejada
- Incluir disclaimer quando houver limite por cliente (ex: "Limitado a 3 unidades por cliente")
- Produto-âncora (maior desconto) sempre em destaque visual
- Densidade máxima por formato: 3-5 produtos por post feed, 1-2 por story
- Não repetir mesmo produto no mesmo horário em dois canais sem variação de abordagem
- Calcular "% off" automaticamente: `round((1 - preco_promocional / preco_original) * 100)`

### Fallback

- Se `brand_book` não configurado no config: usar valores genéricos (paleta neutra, tom direto) e alertar operador para configurar brand book.
- Se lista de promoções vazia: informar ao operador "Nenhuma promoção ativa recebida do analista."
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-briefing.md
git commit -m "feat(promocao): add skill-briefing"
```

### Task 3b: skill-geracao-imagem

**Files:**
- Create: `promocao/skills/skill-geracao-imagem.md`

- [ ] **Step 1: Criar `promocao/skills/skill-geracao-imagem.md`**

```markdown
# Skill: Geração de Imagem

## Propósito

Produzir peças visuais a partir dos briefings estruturados. No MVP, gera 1 peça de post para feed do Instagram (1080×1080).

## Inputs

- briefing_peca: object — Briefing de uma peça (output da skill-briefing → `pecas[n]`), contendo: prompt_imagem, produtos_destaque, formato, headline
- kit_marca: object — Logo, paleta, fontes, selos (lido de `config.json` → `brand_book`)
- fotos_produtos: array (opcional) — Caminhos para fotos dos produtos

## Outputs

- imagem: object — Peça visual gerada:
  - arquivo: string — Caminho do arquivo de imagem gerado
  - formato: string — "1080x1080"
  - canal: string — "instagram_feed"
  - preview_url: string (opcional) — URL de preview se disponível

## Implementação

### Passos

1. Receber `briefing_peca` com prompt descritivo da composição
2. Montar prompt final para API de geração de imagem:
   - Base: `briefing_peca.prompt_imagem`
   - Adicionar especificações de marca: cores da paleta, estilo do logo
   - Adicionar regras de composição (ver abaixo)
   - Formato de saída: 1080×1080 pixels
3. Enviar prompt para API de geração de imagem (Google Imagen)
4. Receber imagem gerada
5. Salvar imagem em `outputs/` com nome: `{YYYY-MM-DD}_peca-{canal}-{indice}.png`
6. Retornar referência ao arquivo gerado

### Regras de composição

- Densidade máxima: 3-5 produtos por post feed
- Preço antigo riscado ao lado do novo quando houver comparativo
- Selos "% off" calculados automaticamente e posicionados no canto do produto
- Perecíveis: fundo ambientado (madeira, folhas, cores quentes)
- Industrializados: fundo limpo (branco, cinza claro)
- Cores alternadas por departamento para diferenciação visual
- Logo da loja sempre presente (canto inferior ou superior)
- Texto deve ser legível em tamanho mobile

### Formatos futuros (pós-MVP)

- Stories: 1080×1920
- Encarte Express: 1 página, 6-8 itens
- Encarte Padrão: 2-4 páginas, 15-30 itens
- Capa WhatsApp / Link preview: 1200×628

### API/MCP

**Endpoint:** Google Imagen API — `https://generativelanguage.googleapis.com/v1beta`

**Autenticação:** API Key (lida de `config.json` → `imagen.api_key`)

**Chamada:**
- `POST /models/imagen-3.0-generate-002:predict`
- Body:
```json
{
  "instances": [{"prompt": "..."}],
  "parameters": {
    "sampleCount": 1,
    "aspectRatio": "1:1",
    "safetyFilterLevel": "block_few"
  }
}
```

**Resposta esperada:**
```json
{
  "predictions": [
    {
      "bytesBase64Encoded": "...",
      "mimeType": "image/png"
    }
  ]
}
```

### Fallback

- Se API de geração indisponível ou quota excedida: informar ao operador "Geração de imagem indisponível. Verifique a API key e quota no config.json." Retornar objeto com `arquivo: null` e `erro: "api_indisponivel"`.
- Se imagem gerada não atender qualidade: o agente-criativo pode solicitar nova geração com prompt ajustado (máximo 3 tentativas).
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-geracao-imagem.md
git commit -m "feat(promocao): add skill-geracao-imagem"
```

### Task 3c: skill-publicacao

**Files:**
- Create: `promocao/skills/skill-publicacao.md`

- [ ] **Step 1: Criar `promocao/skills/skill-publicacao.md`**

```markdown
# Skill: Publicação

## Propósito

Publicar peças visuais nos canais da loja. No MVP, publica 1 post no feed do Instagram.

## Inputs

- imagem: object — Peça visual finalizada (output da skill-geracao-imagem): arquivo, formato, canal
- briefing_peca: object — Briefing correspondente (output da skill-briefing): legenda, hashtags, cta
- perfil_publicacao: string — ID do perfil Instagram para publicação (lido de `config.json` → `instagram.perfil_publicacao`)
- access_token: string — Token de acesso Meta API (lido de `config.json` → `instagram.access_token`)

## Outputs

- publicacao: object — Registro da publicação:
  - status: string — "publicado" | "erro"
  - post_id: string — ID do post no Instagram
  - permalink: string — URL do post publicado
  - canal: string — "instagram_feed"
  - data_publicacao: string — Timestamp da publicação
  - mensagem_erro: string (opcional) — Mensagem de erro se falhou

## Implementação

### Passos

1. Montar legenda completa:
   - Texto da legenda (do briefing)
   - Hashtags concatenadas
   - CTA no final
2. Fazer upload da imagem para o container do Instagram:
   - Endpoint: `POST /{ig_user_id}/media`
   - Parâmetros: `image_url` ou `image_data`, `caption`, `access_token`
3. Publicar o container:
   - Endpoint: `POST /{ig_user_id}/media_publish`
   - Parâmetros: `creation_id` (do passo anterior), `access_token`
4. Verificar publicação:
   - Endpoint: `GET /{media_id}?fields=id,permalink,timestamp`
5. Retornar `publicacao` com dados do post

### Funcionalidades futuras (pós-MVP)

- Agendamento de stories com intervalos
- Publicação de reels em horário de pico
- Carrossel de encarte (múltiplas imagens)
- Geração de alt-text para acessibilidade
- Localização geográfica no post

### API/MCP

**Endpoint:** Instagram Graph API — `https://graph.facebook.com/v19.0`

**Autenticação:** Bearer token (lido de `config.json` → `instagram.access_token`)

**Chamadas:**

1. Criar container de mídia:
   - `POST /{ig_user_id}/media`
   - Body: `{ "image_url": "...", "caption": "...", "access_token": "..." }`
   - Resposta: `{ "id": "17889455560051444" }`

2. Publicar container:
   - `POST /{ig_user_id}/media_publish`
   - Body: `{ "creation_id": "17889455560051444", "access_token": "..." }`
   - Resposta: `{ "id": "17920238422030506" }`

3. Verificar publicação:
   - `GET /17920238422030506?fields=id,permalink,timestamp&access_token=...`
   - Resposta: `{ "id": "...", "permalink": "https://www.instagram.com/p/...", "timestamp": "..." }`

### Fallback

- Se Meta API indisponível ou token expirado: informar ao operador "Não foi possível publicar no Instagram. Verifique o token de acesso no config.json." Retornar com `status: "erro"` e `mensagem_erro` descritiva.
- Se upload falhar: tentar novamente 1 vez. Se persistir, reportar erro.
- Se publicação falhar mas upload ok: informar ao operador com o `creation_id` para retry manual.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-publicacao.md
git commit -m "feat(promocao): add skill-publicacao"
```

---

## Task 4: Skills da Fase 3 — Execução (agente-execucao)

### Task 4a: skill-checklist-loja

**Files:**
- Create: `promocao/skills/skill-checklist-loja.md`

- [ ] **Step 1: Criar `promocao/skills/skill-checklist-loja.md`**

```markdown
# Skill: Checklist Loja

## Propósito

Cobrar a execução da promoção no chão de loja via WhatsApp. Envia checklist estruturado para gerentes de loja, coleta respostas (fotos e confirmações) e registra status de execução.

## Inputs

- promocoes_ativas: array — Lista de promoções em vigor: produto, preco, datas, loja
- gerentes: array — Cadastro de gerentes com contato WhatsApp (lido de `config.json` → `contatos.gerentes`): nome, whatsapp, loja
- horario_cobranca: string — Horário para disparo do checklist (ex: "07:30"). Default: "07:30" do primeiro dia da promoção
- phone_number_id: string — ID do número WhatsApp Business (lido de `config.json` → `whatsapp.phone_number_id`)
- access_token: string — Token de acesso Meta API (lido de `config.json` → `whatsapp.access_token`)

## Outputs

- status_execucao: object — Status de execução por loja/promoção:
  - data_cobranca: string — Data e hora do disparo
  - lojas: array — Para cada loja:
    - loja: string — Identificação da loja
    - gerente: string — Nome do gerente
    - checklist: array — Itens cobrados:
      - item: string — "gondola_montada" | "etiquetas_atualizadas" | "pdv_atualizado"
      - status: string — "confirmado" | "pendente" | "nao_confirmado"
      - evidencia: string (opcional) — URL da foto enviada
    - status_geral: string — "completo" | "parcial" | "pendente"

## Implementação

### Passos

1. No horário configurado (`horario_cobranca`), para cada gerente em `gerentes`:
   a. Montar mensagem de checklist com os produtos da promoção ativa para aquela loja:
      ```
      Bom dia, {nome}! 🏪

      As promoções de hoje já estão ativas. Preciso confirmar a execução:

      📋 CHECKLIST DE EXECUÇÃO:

      1️⃣ Ponta de gôndola montada com os produtos da promoção?
         → Mande uma FOTO da gôndola

      2️⃣ Etiquetas de preço atualizadas com os preços promocionais?
         → Mande uma FOTO das etiquetas

      3️⃣ Preço atualizado no PDV/caixa?
         → Responda SIM ou NÃO

      Produtos da promoção:
      {lista de produtos com preços}
      ```
   b. Enviar mensagem via WhatsApp Business API
2. Coletar respostas:
   - Fotos → registrar como evidência do item correspondente
   - "SIM" / "NÃO" → registrar como confirmação/negação do PDV
   - Timeout: se sem resposta em 2 horas, enviar lembrete
3. Se item não confirmado após lembrete:
   - Registrar como "nao_confirmado"
   - Escalar: informar ao operador do processo
4. Consolidar `status_execucao`

### API/MCP

**Endpoint:** WhatsApp Business API — `https://graph.facebook.com/v19.0`

**Autenticação:** Bearer token (lido de `config.json` → `whatsapp.access_token`)

**Chamadas:**

1. Enviar mensagem de texto:
   - `POST /{phone_number_id}/messages`
   - Body:
```json
{
  "messaging_product": "whatsapp",
  "to": "{numero_gerente}",
  "type": "text",
  "text": { "body": "{mensagem_checklist}" }
}
```
   - Resposta: `{ "messages": [{ "id": "wamid.xxx" }] }`

2. Receber respostas (webhook):
   - Webhook configurado para receber mensagens de resposta
   - Payload inclui: texto, mídia (fotos), timestamp

### Fallback

- Se WhatsApp API indisponível: informar ao operador "Não foi possível enviar checklist via WhatsApp. Verifique as credenciais no config.json." Retornar com status "erro" e lista de gerentes não contactados.
- Se gerente não responde após 2 lembretes: marcar como "pendente" e incluir na saída para ação manual do operador.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-checklist-loja.md
git commit -m "feat(promocao): add skill-checklist-loja"
```

### Task 4b: skill-distribuicao

**Files:**
- Create: `promocao/skills/skill-distribuicao.md`

- [ ] **Step 1: Criar `promocao/skills/skill-distribuicao.md`**

```markdown
# Skill: Distribuição

## Propósito

Enviar relatórios e comunicações da promoção para lista de contatos via WhatsApp. Utilizada para distribuir outputs do processo (relatório de concorrentes, resumo da promoção, etc.) para equipes internas.

## Inputs

- conteudo: object — Output a distribuir, com:
  - titulo: string — Título do relatório/comunicação
  - corpo: string — Conteúdo formatado para envio
  - anexos: array (opcional) — Caminhos de arquivos para enviar (imagens, PDFs)
- destinatarios: array — Lista de contatos: nome, whatsapp (lido de `config.json` → `contatos.equipe_comercial` ou `contatos.gerentes`)
- formato_envio: string — "resumo" | "completo" | "destaque". Default: "resumo"
- phone_number_id: string — ID do número WhatsApp Business (lido de `config.json` → `whatsapp.phone_number_id`)
- access_token: string — Token de acesso Meta API (lido de `config.json` → `whatsapp.access_token`)

## Outputs

- registro_envio: object — Confirmação de distribuição:
  - data_envio: string — Timestamp do envio
  - conteudo_titulo: string — Título do que foi enviado
  - destinatarios: array — Para cada destinatário:
    - nome: string — Nome do contato
    - whatsapp: string — Número
    - status: string — "enviado" | "erro"
    - message_id: string (opcional) — ID da mensagem no WhatsApp
    - erro: string (opcional) — Descrição do erro se falhou

## Implementação

### Passos

1. Preparar conteúdo conforme `formato_envio`:
   - "resumo": Extrair pontos principais, limitar a 500 caracteres
   - "completo": Enviar corpo integral (quebrar em múltiplas mensagens se > 4096 caracteres)
   - "destaque": Apenas título + top 3 informações mais relevantes
2. Para cada destinatário em `destinatarios`:
   a. Enviar mensagem de texto com o conteúdo formatado
   b. Se houver anexos: enviar cada anexo como mensagem de mídia separada
   c. Registrar status do envio
3. Consolidar `registro_envio`

### Casos de uso

- Enviar relatório de preços dos concorrentes (output da skill-pesquisa-concorrente) para equipe comercial
- Enviar resumo da promoção ativa para gerentes
- Enviar confirmação de publicação (link do post) para equipe de marketing

### API/MCP

**Endpoint:** WhatsApp Business API — `https://graph.facebook.com/v19.0`

**Autenticação:** Bearer token (lido de `config.json` → `whatsapp.access_token`)

**Chamadas:**

1. Enviar mensagem de texto:
   - `POST /{phone_number_id}/messages`
   - Body:
```json
{
  "messaging_product": "whatsapp",
  "to": "{numero_destinatario}",
  "type": "text",
  "text": { "body": "{conteudo_formatado}" }
}
```

2. Enviar mídia (imagem/documento):
   - `POST /{phone_number_id}/messages`
   - Body:
```json
{
  "messaging_product": "whatsapp",
  "to": "{numero_destinatario}",
  "type": "image",
  "image": { "link": "{url_da_imagem}", "caption": "{legenda}" }
}
```

### Fallback

- Se WhatsApp API indisponível: informar ao operador "Não foi possível distribuir o relatório via WhatsApp. Verifique as credenciais no config.json." Retornar com lista de destinatários não alcançados.
- Se envio falhar para destinatário específico: registrar erro e continuar com próximo destinatário. Não interromper o lote.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-distribuicao.md
git commit -m "feat(promocao): add skill-distribuicao"
```

---

## Task 5: Agente Analista (Fase 1)

**Files:**
- Create: `promocao/agents/agente-analista.md`

- [ ] **Step 1: Criar `promocao/agents/agente-analista.md`**

```markdown
# Agente Analista

## Escopo

**Faz:**
- Analisa dados internos (estoque, vendas) e externos (sazonalidade, tendências) para identificar produtos com potencial promocional
- Identifica oportunidades de cross-selling por produto-alvo
- Monitora preços de concorrentes publicados em encartes no Instagram
- Consolida tudo em relatório único com recomendação final
- Pergunta ao usuário sobre negociações com fornecedores (modo híbrido)

**Não faz:**
- Não cria materiais de comunicação (responsabilidade do agente-criativo)
- Não publica conteúdo em nenhum canal
- Não contata gerentes de loja
- Não define preços promocionais — apenas recomenda produtos

## Skills utilizadas

- skill-oportunidade-promocional: Para identificar produtos candidatos via análise interna + externa
- skill-cross-selling: Para encontrar produtos correlacionados por produto-alvo
- skill-pesquisa-concorrente: Para monitorar preços de concorrentes no Instagram

## Etapas de execução

1. **Identificar oportunidades promocionais**
   - Execute: `./report-progress.sh promocao agente-analista analise-oportunidades started 1 5 "Iniciando análise de oportunidades promocionais"`
   - Executar skill-oportunidade-promocional:
     - Frente externa: pesquisa de sazonalidade e tendências
     - Frente interna: cruzamento estoque × vendas
   - Coletar lista de produtos candidatos

2. **Checkpoint — Validar com usuário (modo híbrido)**
   - Execute: `./report-progress.sh promocao agente-analista analise-oportunidades waiting 2 5 "Aguardando validação do usuário sobre produtos candidatos"`
   - Apresentar lista de produtos candidatos ao usuário
   - Perguntar: "Há negociações com fornecedores em andamento? Se sim, informe os produtos e condições."
   - Incorporar feedback do usuário à lista (se houver)

3. **Analisar cross-selling**
   - Execute: `./report-progress.sh promocao agente-analista cross-selling running 3 5 "Analisando oportunidades de cross-selling"`
   - Executar skill-cross-selling para cada produto da lista validada
   - Coletar correlações (cesta + pesquisa externa)

4. **Pesquisar concorrentes**
   - Execute: `./report-progress.sh promocao agente-analista pesquisa-concorrente running 4 5 "Monitorando preços de concorrentes"`
   - Executar skill-pesquisa-concorrente
   - Coletar relatório de preços dos concorrentes

5. **Consolidar e gravar relatório**
   - Execute: `./report-progress.sh promocao agente-analista consolidacao completed 5 5 "Relatório de análise consolidado e salvo"`
   - Montar documento consolidado com:
     - Lista de produtos recomendados para promoção (com justificativa e score)
     - Sugestões de cross-selling por produto
     - Panorama de preços dos concorrentes
     - Recomendação final: quais produtos promover, com que enfoque
   - Gravar resultado em `outputs/{YYYY-MM-DD}_analise-promocional.json`
```

- [ ] **Step 2: Validar**

Conferir:
- Todas as 5 etapas têm report-progress como primeira instrução? Sim.
- Escopo claro (faz / não faz)? Sim.
- Skills referenciadas existem (foram criadas nas Tasks 2a-2c)? Sim.
- Última etapa grava em `outputs/`? Sim.
- Há checkpoint de modo híbrido? Sim (etapa 2).

- [ ] **Step 3: Commit**

```bash
git add promocao/agents/agente-analista.md
git commit -m "feat(promocao): add agente-analista (fase 1 — entender)"
```

---

## Task 6: Agente Criativo (Fase 2)

**Files:**
- Create: `promocao/agents/agente-criativo.md`

- [ ] **Step 1: Criar `promocao/agents/agente-criativo.md`**

```markdown
# Agente Criativo

## Escopo

**Faz:**
- Recebe a lista curada de produtos do agente-analista
- Gera briefings estruturados com copy, hierarquia visual e cronograma
- Produz peças visuais (MVP: 1 post feed 1080×1080)
- Publica no Instagram (MVP: 1 post feed)
- Registra o que foi gerado e publicado

**Não faz:**
- Não analisa dados nem decide quais produtos promover (responsabilidade do agente-analista)
- Não gerencia execução em loja (responsabilidade do agente-execucao)
- Não envia mensagens via WhatsApp
- Não gera stories, reels ou encartes (pós-MVP)

## Skills utilizadas

- skill-briefing: Para transformar a lista de promoções em briefings estruturados e acionáveis
- skill-geracao-imagem: Para produzir peças visuais a partir dos briefings
- skill-publicacao: Para publicar as peças no Instagram

## Etapas de execução

1. **Carregar output do analista**
   - Execute: `./report-progress.sh promocao agente-criativo preparacao started 1 5 "Carregando análise promocional"`
   - Ler o output mais recente do agente-analista em `outputs/` (arquivo `*_analise-promocional.json`)
   - Extrair lista de produtos selecionados para promoção

2. **Gerar briefings**
   - Execute: `./report-progress.sh promocao agente-criativo briefing running 2 5 "Gerando briefings de comunicação"`
   - Executar skill-briefing:
     - Input: lista de promoções, brand book (do config), canais ativos (MVP: ["instagram_feed"])
   - Obter briefings por peça, prompts de imagem e cronograma

3. **Checkpoint — Aprovar briefing (modo híbrido)**
   - Execute: `./report-progress.sh promocao agente-criativo briefing waiting 3 5 "Aguardando aprovação do briefing"`
   - Apresentar ao usuário:
     - Produtos selecionados e agrupamento em núcleos
     - Headlines e copy geradas
     - Cronograma de publicação
   - Aguardar aprovação ou ajustes

4. **Gerar peça visual e publicar**
   - Execute: `./report-progress.sh promocao agente-criativo geracao-publicacao running 4 5 "Gerando peça visual e publicando"`
   - Executar skill-geracao-imagem:
     - Input: briefing da peça (primeiro do array), kit de marca
   - Executar skill-publicacao:
     - Input: imagem gerada, briefing (legenda, hashtags, CTA), perfil de publicação
   - Coletar confirmação de publicação (post_id, permalink)

5. **Registrar e gravar output**
   - Execute: `./report-progress.sh promocao agente-criativo registro completed 5 5 "Materiais gerados e publicação registrada"`
   - Montar registro consolidado:
     - Briefings gerados
     - Peças produzidas (referência ao arquivo)
     - Publicações realizadas (canal, link, data)
   - Gravar em `outputs/{YYYY-MM-DD}_criacao-publicacao.json`
```

- [ ] **Step 2: Validar**

Conferir:
- Todas as 5 etapas têm report-progress? Sim.
- Escopo claro? Sim.
- Skills referenciadas existem (Tasks 3a-3c)? Sim.
- Última etapa grava em `outputs/`? Sim.
- Checkpoint de modo híbrido? Sim (etapa 3).

- [ ] **Step 3: Commit**

```bash
git add promocao/agents/agente-criativo.md
git commit -m "feat(promocao): add agente-criativo (fase 2 — multiplicar)"
```

---

## Task 7: Agente Execução (Fase 3)

**Files:**
- Create: `promocao/agents/agente-execucao.md`

- [ ] **Step 1: Criar `promocao/agents/agente-execucao.md`**

```markdown
# Agente Execução

## Escopo

**Faz:**
- Dispara checklist de execução para gerentes de loja via WhatsApp
- Coleta evidências fotográficas e confirmações
- Escala itens não confirmados
- Distribui relatórios e comunicações do processo para equipes internas via WhatsApp

**Não faz:**
- Não analisa dados de vendas nem estoque (responsabilidade do agente-analista)
- Não cria materiais de comunicação (responsabilidade do agente-criativo)
- Não publica em redes sociais
- Não define quais promoções executar — apenas cobra e distribui

## Skills utilizadas

- skill-checklist-loja: Para cobrar execução da promoção no chão de loja via WhatsApp
- skill-distribuicao: Para enviar relatórios e comunicações para equipes internas via WhatsApp

## Etapas de execução

1. **Carregar promoções ativas**
   - Execute: `./report-progress.sh promocao agente-execucao preparacao started 1 4 "Carregando promoções ativas"`
   - Ler outputs do agente-analista (`*_analise-promocional.json`) e agente-criativo (`*_criacao-publicacao.json`) em `outputs/`
   - Extrair lista de promoções ativas com produtos, preços, datas e lojas

2. **Disparar checklist de loja**
   - Execute: `./report-progress.sh promocao agente-execucao checklist-loja running 2 4 "Disparando checklist de execução para gerentes"`
   - Executar skill-checklist-loja:
     - Input: promoções ativas, cadastro de gerentes (do config), horário de cobrança
   - Coletar status de execução por loja (confirmações, fotos, pendências)

3. **Distribuir relatórios**
   - Execute: `./report-progress.sh promocao agente-execucao distribuicao running 3 4 "Distribuindo relatórios para equipes"`
   - Executar skill-distribuicao para cada envio necessário:
     - Relatório de concorrentes → equipe comercial
     - Resumo da promoção ativa → gerentes
   - Coletar confirmações de envio

4. **Consolidar e gravar status final**
   - Execute: `./report-progress.sh promocao agente-execucao consolidacao completed 4 4 "Execução em loja verificada e relatórios distribuídos"`
   - Montar registro consolidado:
     - Status de execução por loja (completo, parcial, pendente)
     - Evidências fotográficas coletadas
     - Relatórios distribuídos (destinatários, timestamps)
     - Pendências e escalações (se houver)
   - Gravar em `outputs/{YYYY-MM-DD}_execucao-loja.json`
```

- [ ] **Step 2: Validar**

Conferir:
- Todas as 4 etapas têm report-progress? Sim.
- Escopo claro? Sim.
- Skills referenciadas existem (Tasks 4a-4b)? Sim.
- Última etapa grava em `outputs/`? Sim.

- [ ] **Step 3: Commit**

```bash
git add promocao/agents/agente-execucao.md
git commit -m "feat(promocao): add agente-execucao (fase 3 — coordenar)"
```

---

## Task 8: Fixtures Mock para Teste em Sandbox

**Files:**
- Create: `.dev/fixtures/fixture-promocao-estoque.json`
- Create: `.dev/fixtures/fixture-promocao-vendas.json`
- Create: `.dev/fixtures/fixture-promocao-vendas-cupom.json`
- Create: `.dev/fixtures/fixture-promocao-instagram-concorrente.json`
- Create: `.dev/fixtures/fixture-promocao-meta-whatsapp.json`

- [ ] **Step 1: Criar `fixture-promocao-estoque.json`**

```json
{
  "descricao": "Fixture de estoque para teste do processo de promoção",
  "data_referencia": "2026-04-09",
  "produtos": [
    { "codigo": "001", "nome": "Arroz Tipo 1 5kg", "categoria": "mercearia", "estoque_atual": 450, "giro_medio_diario": 8, "perecivel": false },
    { "codigo": "002", "nome": "Feijão Carioca 1kg", "categoria": "mercearia", "estoque_atual": 300, "giro_medio_diario": 12, "perecivel": false },
    { "codigo": "003", "nome": "Óleo de Soja 900ml", "categoria": "mercearia", "estoque_atual": 600, "giro_medio_diario": 5, "perecivel": false },
    { "codigo": "004", "nome": "Cerveja Lata 350ml", "categoria": "bebidas", "estoque_atual": 800, "giro_medio_diario": 25, "perecivel": false },
    { "codigo": "005", "nome": "Picanha Bovina kg", "categoria": "carnes", "estoque_atual": 120, "giro_medio_diario": 3, "perecivel": true },
    { "codigo": "006", "nome": "Frango Inteiro Resfriado kg", "categoria": "carnes", "estoque_atual": 200, "giro_medio_diario": 4, "perecivel": true },
    { "codigo": "007", "nome": "Leite Integral 1L", "categoria": "laticinios", "estoque_atual": 500, "giro_medio_diario": 30, "perecivel": true },
    { "codigo": "008", "nome": "Detergente Líquido 500ml", "categoria": "limpeza", "estoque_atual": 350, "giro_medio_diario": 3, "perecivel": false },
    { "codigo": "009", "nome": "Banana Prata kg", "categoria": "hortifruti", "estoque_atual": 180, "giro_medio_diario": 15, "perecivel": true },
    { "codigo": "010", "nome": "Refrigerante Cola 2L", "categoria": "bebidas", "estoque_atual": 400, "giro_medio_diario": 10, "perecivel": false }
  ]
}
```

- [ ] **Step 2: Criar `fixture-promocao-vendas.json`**

```json
{
  "descricao": "Fixture de vendas mensais para teste do processo de promoção",
  "periodo": { "inicio": "2026-01-01", "fim": "2026-03-31" },
  "vendas_por_produto": [
    { "codigo": "001", "nome": "Arroz Tipo 1 5kg", "jan": 240, "fev": 220, "mar": 200, "tendencia": "queda" },
    { "codigo": "002", "nome": "Feijão Carioca 1kg", "jan": 360, "fev": 350, "mar": 340, "tendencia": "estavel" },
    { "codigo": "003", "nome": "Óleo de Soja 900ml", "jan": 180, "fev": 150, "mar": 130, "tendencia": "queda" },
    { "codigo": "004", "nome": "Cerveja Lata 350ml", "jan": 700, "fev": 750, "mar": 800, "tendencia": "alta" },
    { "codigo": "005", "nome": "Picanha Bovina kg", "jan": 90, "fev": 85, "mar": 80, "tendencia": "queda" },
    { "codigo": "006", "nome": "Frango Inteiro Resfriado kg", "jan": 120, "fev": 115, "mar": 110, "tendencia": "queda" },
    { "codigo": "007", "nome": "Leite Integral 1L", "jan": 900, "fev": 880, "mar": 870, "tendencia": "estavel" },
    { "codigo": "008", "nome": "Detergente Líquido 500ml", "jan": 90, "fev": 88, "mar": 85, "tendencia": "estavel" },
    { "codigo": "009", "nome": "Banana Prata kg", "jan": 450, "fev": 430, "mar": 420, "tendencia": "queda" },
    { "codigo": "010", "nome": "Refrigerante Cola 2L", "jan": 300, "fev": 310, "mar": 320, "tendencia": "alta" }
  ]
}
```

- [ ] **Step 3: Criar `fixture-promocao-vendas-cupom.json`**

```json
{
  "descricao": "Fixture de vendas por cupom fiscal para análise de cross-selling",
  "periodo": "ultimos_6_meses",
  "total_cupons": 15000,
  "coocorrencias": [
    { "produto_a": "Picanha Bovina kg", "produto_b": "Cerveja Lata 350ml", "contagem": 280, "confianca": 0.72, "lift": 2.8 },
    { "produto_a": "Picanha Bovina kg", "produto_b": "Carvão 4kg", "contagem": 210, "confianca": 0.54, "lift": 4.1 },
    { "produto_a": "Picanha Bovina kg", "produto_b": "Sal Grosso 1kg", "contagem": 195, "confianca": 0.50, "lift": 3.5 },
    { "produto_a": "Arroz Tipo 1 5kg", "produto_b": "Feijão Carioca 1kg", "contagem": 520, "confianca": 0.68, "lift": 2.1 },
    { "produto_a": "Arroz Tipo 1 5kg", "produto_b": "Óleo de Soja 900ml", "contagem": 310, "confianca": 0.41, "lift": 1.8 },
    { "produto_a": "Frango Inteiro Resfriado kg", "produto_b": "Batata Lavada kg", "contagem": 155, "confianca": 0.45, "lift": 2.3 },
    { "produto_a": "Frango Inteiro Resfriado kg", "produto_b": "Tempero Pronto", "contagem": 130, "confianca": 0.38, "lift": 1.9 },
    { "produto_a": "Cerveja Lata 350ml", "produto_b": "Refrigerante Cola 2L", "contagem": 180, "confianca": 0.22, "lift": 1.1 },
    { "produto_a": "Banana Prata kg", "produto_b": "Leite Integral 1L", "contagem": 95, "confianca": 0.21, "lift": 1.3 },
    { "produto_a": "Detergente Líquido 500ml", "produto_b": "Esponja de Aço", "contagem": 72, "confianca": 0.35, "lift": 2.5 }
  ]
}
```

- [ ] **Step 4: Criar `fixture-promocao-instagram-concorrente.json`**

```json
{
  "descricao": "Fixture de posts de concorrentes no Instagram para teste de pesquisa",
  "data_consulta": "2026-04-09",
  "concorrentes": [
    {
      "perfil": "supermercado_rival_1",
      "nome": "Supermercado Rival 1",
      "posts": [
        {
          "id": "17895695668004550",
          "caption": "OFERTAS DA SEMANA! Arroz 5kg por R$ 21,90. Feijão 1kg por R$ 7,49. Corra!",
          "media_type": "IMAGE",
          "media_url": "https://mock-image-url.com/encarte1.jpg",
          "timestamp": "2026-04-07T10:00:00+0000",
          "permalink": "https://www.instagram.com/p/mock1",
          "produtos_identificados": [
            { "produto": "Arroz Tipo 1 5kg", "marca": "Tio João", "variacao": "5kg", "preco": 21.90 },
            { "produto": "Feijão Carioca 1kg", "marca": "Kicaldo", "variacao": "1kg", "preco": 7.49 }
          ]
        },
        {
          "id": "17895695668004551",
          "caption": "Churrasco de Páscoa! Picanha bovina por R$ 49,90/kg",
          "media_type": "CAROUSEL_ALBUM",
          "media_url": "https://mock-image-url.com/encarte2.jpg",
          "timestamp": "2026-04-06T14:00:00+0000",
          "permalink": "https://www.instagram.com/p/mock2",
          "produtos_identificados": [
            { "produto": "Picanha Bovina", "marca": "Friboi", "variacao": "kg", "preco": 49.90 }
          ]
        }
      ]
    },
    {
      "perfil": "supermercado_rival_2",
      "nome": "Supermercado Rival 2",
      "posts": [
        {
          "id": "17895695668004560",
          "caption": "Só hoje! Cerveja lata 350ml R$ 2,99. Refrigerante 2L R$ 6,49",
          "media_type": "IMAGE",
          "media_url": "https://mock-image-url.com/encarte3.jpg",
          "timestamp": "2026-04-08T09:00:00+0000",
          "permalink": "https://www.instagram.com/p/mock3",
          "produtos_identificados": [
            { "produto": "Cerveja Lata 350ml", "marca": "Brahma", "variacao": "350ml", "preco": 2.99 },
            { "produto": "Refrigerante Cola 2L", "marca": "Coca-Cola", "variacao": "2L", "preco": 6.49 }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Criar `fixture-promocao-meta-whatsapp.json`**

```json
{
  "descricao": "Fixture de respostas da WhatsApp Business API para teste",
  "envio_mensagem": {
    "resposta_sucesso": {
      "messaging_product": "whatsapp",
      "contacts": [{ "input": "+5511999999999", "wa_id": "5511999999999" }],
      "messages": [{ "id": "wamid.HBgNNTUxMTk5OTk5OTk5FQIAERgSMUYyMDhGNDVGMUEyOThBQTEA" }]
    },
    "resposta_erro": {
      "error": {
        "message": "Invalid OAuth 2.0 Access Token",
        "type": "OAuthException",
        "code": 190
      }
    }
  },
  "webhook_respostas": [
    {
      "gerente": "João Silva",
      "loja": "Loja Centro",
      "respostas": [
        { "item": "gondola_montada", "tipo": "foto", "url_foto": "https://mock-foto.com/gondola.jpg", "timestamp": "2026-04-09T08:15:00Z" },
        { "item": "etiquetas_atualizadas", "tipo": "foto", "url_foto": "https://mock-foto.com/etiquetas.jpg", "timestamp": "2026-04-09T08:18:00Z" },
        { "item": "pdv_atualizado", "tipo": "texto", "valor": "SIM", "timestamp": "2026-04-09T08:20:00Z" }
      ]
    }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add .dev/fixtures/fixture-promocao-estoque.json .dev/fixtures/fixture-promocao-vendas.json .dev/fixtures/fixture-promocao-vendas-cupom.json .dev/fixtures/fixture-promocao-instagram-concorrente.json .dev/fixtures/fixture-promocao-meta-whatsapp.json
git commit -m "feat(promocao): add fixtures mock para teste em sandbox"
```

---

## Task 9: Atualizar Orquestrador

**Files:**
- Modify: `CLAUDE.orquestrador.md:11-13` (seção "Processos disponíveis")

- [ ] **Step 1: Pedir confirmação do Leonardo**

Antes de modificar, informar Leonardo:
> O processo `promocao/` está pronto. Preciso atualizar o `CLAUDE.orquestrador.md` para registrar o novo processo. A alteração será na seção "Processos disponíveis", substituindo "Nenhum processo instalado ainda" pelo registro do processo de promoção.

- [ ] **Step 2: Atualizar `CLAUDE.orquestrador.md`**

Substituir a linha 13:

**De:**
```markdown
Nenhum processo instalado ainda. Use `/processos` para verificar.
```

**Para:**
```markdown
| Comando | Processo | Modo | Descrição |
|---|---|---|---|
| `/promocao` | Promoção | híbrido | Ciclo completo de promoção — análise de oportunidades, criação de materiais, publicação e verificação de execução em loja. |

Use `/processos` para ver detalhes atualizados.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.orquestrador.md
git commit -m "feat(orquestrador): registrar processo promocao como disponível"
```

---

## Task 10: Teste em Sandbox

- [ ] **Step 1: Verificar integridade da estrutura**

Confirmar que todos os arquivos existem:

```bash
ls -la promocao/
ls -la promocao/agents/
ls -la promocao/skills/
ls -la promocao/outputs/
ls -la .dev/fixtures/fixture-promocao-*
```

Esperado: 1 CLAUDE.md, 1 config.json, 3 agentes, 8 skills, 5 fixtures.

- [ ] **Step 2: Validar CLAUDE.md do processo**

Ler `promocao/CLAUDE.md` e confirmar:
- Modo: híbrido
- Dependências: nenhuma
- 3 agentes listados
- Fluxo de execução com 3 fases sequenciais

- [ ] **Step 3: Validar agentes**

Para cada agente, conferir:
- Todas as etapas têm report-progress como primeira instrução
- Skills referenciadas existem em `promocao/skills/`
- Escopo (faz / não faz) está definido
- Última etapa grava em `outputs/`

- [ ] **Step 4: Validar skills**

Para cada skill, conferir:
- Inputs e outputs documentados com tipos
- Se consome API: endpoint documentado, fallback previsto
- Não faz referência a agentes
- Não chama report-progress

- [ ] **Step 5: Executar teste sandbox do processo (se solicitado)**

Seguir regras de sandbox do `.dev/CLAUDE.dev.md`:
- Substituir APIs/MCPs por fixtures de `.dev/fixtures/`
- Não executar report-progress — registrar em log local
- Gravar outputs em `.dev/test-outputs/promocao/`
- Reportar resultado do teste

---

## Resumo de Entregáveis

| # | Task | Arquivos | Commits |
|---|---|---|---|
| 1 | Scaffold | `promocao/CLAUDE.md`, `config.json`, pastas, `.gitignore` | 1 |
| 2a | skill-oportunidade-promocional | `promocao/skills/skill-oportunidade-promocional.md` | 1 |
| 2b | skill-cross-selling | `promocao/skills/skill-cross-selling.md` | 1 |
| 2c | skill-pesquisa-concorrente | `promocao/skills/skill-pesquisa-concorrente.md` | 1 |
| 3a | skill-briefing | `promocao/skills/skill-briefing.md` | 1 |
| 3b | skill-geracao-imagem | `promocao/skills/skill-geracao-imagem.md` | 1 |
| 3c | skill-publicacao | `promocao/skills/skill-publicacao.md` | 1 |
| 4a | skill-checklist-loja | `promocao/skills/skill-checklist-loja.md` | 1 |
| 4b | skill-distribuicao | `promocao/skills/skill-distribuicao.md` | 1 |
| 5 | agente-analista | `promocao/agents/agente-analista.md` | 1 |
| 6 | agente-criativo | `promocao/agents/agente-criativo.md` | 1 |
| 7 | agente-execucao | `promocao/agents/agente-execucao.md` | 1 |
| 8 | Fixtures | 5 arquivos em `.dev/fixtures/` | 1 |
| 9 | Orquestrador | `CLAUDE.orquestrador.md` (modificação) | 1 |
| 10 | Teste sandbox | Validação + teste opcional | 0 |

**Total: 19 arquivos novos, 2 modificados, 14 commits.**
