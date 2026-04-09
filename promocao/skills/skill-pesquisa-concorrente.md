# Skill: Pesquisa Concorrente

## Propósito

Monitorar promoções de concorrentes publicadas no Instagram. Acessa perfis de concorrentes via API oficial da Meta (Business Discovery), analisa imagens, vídeos e legendas dos posts para identificar promoções em vigor — produtos, preços, prazos e condições anunciadas.

## Inputs

- perfis_concorrentes: array — Lista de perfis Instagram a monitorar (lida de `config.json` → `instagram.perfis_concorrentes`). Cada item pode ser um username (`fortatacadista`) ou um link de perfil (`https://www.instagram.com/fortatacadista/`).
- instagram_business_id: string — ID do Instagram Business do usuário, vinculado à Business Manager (lido de `config.json` → `instagram.instagram_business_id`)
- access_token: string — Token do System User com permissões adequadas (lido de `config.json` → `instagram.access_token`)
- regras_padronizacao: object (opcional) — Mapeamento de aliases para nomes padronizados de produtos

## Outputs

- relatorio_concorrentes: object — Relatório estruturado com:
  - data_analise: string — Data de geração do relatório
  - concorrentes: array — Para cada concorrente:
    - perfil: string — Username do Instagram
    - posts_analisados: number — Quantidade de posts retornados pela API
    - promocoes_encontradas: array — Lista de promoções identificadas:
      - data_post: string — Data da publicação
      - produto: string — Nome padronizado do produto
      - marca: string — Marca identificada
      - variacao: string — Tamanho/peso/volume
      - preco: number — Preço anunciado (quando identificado)
      - prazo: string — Validade da promoção (quando identificado)
      - condicoes: string — Condições especiais (ex: "leve 3 pague 2", "no PIX")
      - tipo_midia: string — "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"
      - link: string — Permalink do post
      - confianca: string — "alta" | "media" | "baixa" — grau de confiança na extração
    - posts_sem_promocao: number — Quantidade de posts que não continham promoção
  - comparativo: array — Tabela consolidada: concorrente, produto, marca, variação, preço, prazo

## Implementação

### Extração de username

Antes de consultar a API, cada item de `perfis_concorrentes` deve ser normalizado para extrair apenas o username:

- Se o valor for um link (contém `instagram.com/`): extrair somente o username da URL, removendo barras e parâmetros. Exemplo: `https://www.instagram.com/fortatacadista/` → `fortatacadista`
- Se o valor já for um username simples (sem `http`, sem `/`): usar diretamente.

### Passos

1. Ler `perfis_concorrentes`, `instagram_business_id` e `access_token` do config do processo (dataset `instagram`)
2. Normalizar cada perfil para obter o username (ver regra de extração acima)
3. Para cada username de concorrente, fazer uma chamada à API da Meta via endpoint Business Discovery:
   ```
   GET https://graph.facebook.com/v25.0/{instagram_business_id}?fields=business_discovery.username({username}){media{media_url,caption,timestamp,media_type,permalink}}&access_token={access_token}
   ```
   - Substituir `{instagram_business_id}` pelo valor de `config.json` → `instagram.instagram_business_id`
   - Substituir `{username}` pelo username normalizado do concorrente
   - Substituir `{access_token}` pelo valor de `config.json` → `instagram.access_token`
   - A API retorna os **últimos 25 posts** da conta pesquisada

4. Para cada post retornado, analisar o conteúdo buscando promoções:

   **a. Análise da legenda (caption):**
   - Identificar menções a produtos, preços, prazos de validade da promoção
   - Identificar condições especiais (ex: "leve 3 pague 2", "desconto no PIX", "válido até domingo")
   - Extrair marcas e variações de produto quando mencionadas

   **b. Análise da imagem (quando `media_type` = `IMAGE` ou `CAROUSEL_ALBUM`):**
   - Usar modelo multimodal para analisar a imagem via `media_url`
   - Identificar se é um encarte/flyer/tabloide promocional
   - Extrair: produtos, marcas, tamanhos, preços visíveis na imagem
   - Cruzar informações da imagem com a legenda para complementar dados

   **c. Análise de vídeo (quando `media_type` = `VIDEO`):**
   - Usar modelo multimodal para analisar o vídeo via `media_url`
   - Identificar se o conteúdo é promocional (vídeo de ofertas, encarte animado, locutor anunciando preços)
   - Extrair: produtos, marcas, preços e condições visíveis ou falados no vídeo
   - Cruzar informações do vídeo com a legenda para complementar dados

5. Normalizar descrições de produtos usando `regras_padronizacao` (se fornecido)
6. Classificar grau de confiança de cada extração:
   - **alta**: preço e produto claramente legíveis/identificáveis
   - **media**: produto identificado mas preço incerto ou parcialmente legível
   - **baixa**: conteúdo parece promocional mas dados são ambíguos
7. Consolidar dados em tabela comparativa
8. Gerar `relatorio_concorrentes`

### API/MCP

**Endpoint:** Instagram Graph API — Business Discovery
**URL base:** `https://graph.facebook.com/v25.0`

**Autenticação:** Token do System User da Business Manager do usuário (lido de `config.json` → `instagram.access_token`). O token precisa das permissões: `instagram_basic`, `business_management`, `pages_read_engagement`.

**Chamada principal — Business Discovery (uma por perfil concorrente):**
```
GET https://graph.facebook.com/v25.0/{instagram_business_id}?fields=business_discovery.username({username}){media{media_url,caption,timestamp,media_type,permalink}}&access_token={access_token}
```

**Parâmetros:**
- `{instagram_business_id}`: ID do Instagram Business do usuário (config → `instagram.instagram_business_id`)
- `{username}`: username do perfil concorrente (extraído de `perfis_concorrentes`)
- `{access_token}`: token do System User (config → `instagram.access_token`)

**Resposta esperada:**
```json
{
  "business_discovery": {
    "media": {
      "data": [
        {
          "media_url": "https://...",
          "caption": "OFERTAS DA SEMANA! Arroz Tio João 5kg por R$ 24,90...",
          "timestamp": "2026-04-07T10:00:00+0000",
          "media_type": "IMAGE",
          "permalink": "https://www.instagram.com/p/..."
        },
        {
          "media_url": "https://...",
          "caption": "Confira nossas promoções em vídeo! 🎬",
          "timestamp": "2026-04-06T14:30:00+0000",
          "media_type": "VIDEO",
          "permalink": "https://www.instagram.com/p/..."
        }
      ]
    }
  },
  "id": "17841400123456789"
}
```

**Observações:**
- A API retorna os últimos 25 posts da conta pesquisada
- O `media_type` pode ser `IMAGE`, `VIDEO` ou `CAROUSEL_ALBUM`
- Para todos os tipos de mídia, a `media_url` contém o link direto para o conteúdo

### Fallback

- Se Meta API indisponível ou token expirado: informar ao operador "Não foi possível acessar os perfis de concorrentes no Instagram. Verifique o token de acesso e o instagram_business_id no config.json." Retornar relatório vazio com flag `api_indisponivel: true`.
- Se `instagram_business_id` não estiver preenchido: informar ao operador "O ID do Instagram Business não foi configurado. Configure em config.json → instagram.instagram_business_id."
- Se `perfis_concorrentes` estiver vazio ou com valores padrão: informar ao operador "Nenhum perfil de concorrente foi configurado. Configure em config.json → instagram.perfis_concorrentes."
- Se análise de imagem/vídeo não identificar promoção: registrar post como não-promocional e seguir para o próximo.
- Se análise identificar conteúdo promocional mas não conseguir extrair dados: registrar com confiança "baixa" e incluir no relatório.
