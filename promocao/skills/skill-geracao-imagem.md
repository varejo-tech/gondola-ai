# Skill: Geração de Imagem

## Propósito

Produzir peças visuais a partir dos briefings estruturados usando o modelo Gemini Nano Banana 2 com input multimodal. No MVP, gera 1 peça de post para feed do Instagram (1080×1080).

## Inputs

- briefing_peca: object — Briefing de uma peça (output da skill-briefing → `pecas[n]`), contendo: prompt_imagem, produtos_destaque, formato, headline, legenda
- kit_marca: object — Logo, paleta, fontes, selos (lido de `config.json` → `brand_book`)
- assets_visuais: object (opcional) — Assets visuais configurados pelo usuário (lido de `config.json` → `assets_visuais`):
  - logo: string — Caminho para o logo da loja
  - templates: array — Caminhos para templates de referência visual (ex: encartes anteriores, posts de referência)
  - fotos_produtos: string — Diretório com fotos de produtos

## Outputs

- imagem: object — Peça visual gerada:
  - arquivo: string — Caminho do arquivo de imagem gerado
  - formato: string — "1080x1080"
  - canal: string — "instagram_feed"
  - preview_url: string (opcional) — URL de preview se disponível

## Implementação

### Passos

1. Receber `briefing_peca` com prompt descritivo da composição
2. Coletar assets visuais disponíveis:
   - Se `assets_visuais.logo` configurado e arquivo existe → incluir como imagem de referência
   - Se `assets_visuais.templates` configurado → incluir templates como referência de estilo
   - Se `assets_visuais.fotos_produtos` configurado → buscar fotos dos produtos listados em `briefing_peca.produtos_destaque`
3. Montar request multimodal para a API:
   - Parte texto: prompt combinando `briefing_peca.prompt_imagem` + especificações de marca (paleta, estilo) + regras de composição (ver abaixo)
   - Partes imagem (quando disponíveis): logo, templates de referência, fotos de produtos
   - Instruções de estilo: "Mantenha o estilo visual dos templates de referência", "Incorpore o logo na composição", "Use as fotos reais dos produtos"
   - Formato de saída: 1080×1080 pixels
4. Enviar request para Gemini API (`generateContent`)
5. Extrair imagem da resposta (iterar `parts`, buscar `inline_data` com mimeType de imagem)
6. Decodificar base64 e salvar em `outputs/` com nome: `{YYYY-MM-DD}_peca-{canal}-{indice}.png`
7. Retornar referência ao arquivo gerado

### Montagem do prompt

O prompt de texto combina 3 blocos:

**Bloco 1 — Instrução de geração:**
```
Gere uma imagem promocional de supermercado no formato 1080x1080 pixels para post de Instagram.
```

**Bloco 2 — Briefing criativo (do skill-briefing):**
```
{briefing_peca.prompt_imagem}
```

**Bloco 3 — Regras de marca e composição:**
```
Estilo de marca:
- Paleta de cores: {brand_book.paleta}
- Tom: {brand_book.tom_de_voz}
[Se logo anexado]: Incorpore o logo da loja na composição (canto inferior ou superior).
[Se templates anexados]: Use os templates anexados como referência de estilo visual. Mantenha a mesma linguagem gráfica.
[Se fotos de produtos anexadas]: Use as fotos reais dos produtos na composição.
```

### Montagem do request multimodal

```
parts: [
  { text: <prompt combinado> },
  { inline_data: <logo> },           // se disponível
  { inline_data: <template_1> },     // se disponível
  { inline_data: <template_N> },     // se disponível
  { inline_data: <foto_produto_1> }, // se disponível
  { inline_data: <foto_produto_N> }  // se disponível
]
```

Cada `inline_data` contém `mime_type` (ex: `image/png`) e `data` (base64 do arquivo).

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

**Modelo:** Gemini Nano Banana 2 — `gemini-3.1-flash-image-preview`

**Endpoint:** Gemini API — `https://generativelanguage.googleapis.com/v1beta`

**Autenticação:** API Key (lida de `config.json` → `gemini.api_key`)

**Chamada:**
- `POST /models/gemini-3.1-flash-image-preview:generateContent?key={api_key}`
- Body:
```json
{
  "contents": [
    {
      "parts": [
        {"text": "...prompt combinado..."},
        {"inline_data": {"mime_type": "image/png", "data": "...base64 do logo..."}},
        {"inline_data": {"mime_type": "image/png", "data": "...base64 do template..."}}
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"]
  }
}
```

**Resposta esperada:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {"text": "Aqui está a peça promocional..."},
          {"inline_data": {"mime_type": "image/png", "data": "...base64..."}}
        ]
      }
    }
  ]
}
```

**Extração da imagem:** Iterar `candidates[0].content.parts`, buscar a part que contém `inline_data` com `mime_type` começando em `image/`. Decodificar `data` de base64 para bytes e salvar como arquivo.

### Fallback

- Se API indisponível ou quota excedida: informar ao operador "Geração de imagem indisponível. Verifique a API key e quota no config.json." Retornar objeto com `arquivo: null` e `erro: "api_indisponivel"`.
- Se imagem gerada não atender qualidade: o agente responsável pode solicitar nova geração com prompt ajustado (máximo 3 tentativas).
- Se assets visuais não configurados: gerar normalmente apenas com prompt de texto. A qualidade será inferior mas funcional. Informar ao operador que configurar assets visuais melhora significativamente o resultado.
