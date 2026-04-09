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
- Se imagem gerada não atender qualidade: o agente responsável pode solicitar nova geração com prompt ajustado (máximo 3 tentativas).
