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
