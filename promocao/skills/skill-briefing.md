# Skill: Briefing

## Propósito

Transformar a lista de produtos selecionados para promoção em briefings estruturados e acionáveis para geração de conteúdo. Classifica produtos, agrupa em núcleos de encarte, gera copy, define hierarquia visual e monta calendário de publicação.

## Inputs

- promocoes_ativas: array — Lista de promoções (output da etapa anterior), cada item com: produto, preco_original, preco_promocional, validade, justificativa
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
