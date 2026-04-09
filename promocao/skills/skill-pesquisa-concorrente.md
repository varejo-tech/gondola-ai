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
