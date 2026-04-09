# Skill: Distribuição

## Propósito

Enviar relatórios e comunicações da promoção para lista de contatos via WhatsApp. Delega o envio para um workflow no n8n via webhook, que cuida do fluxo de templates e entrega das mensagens.

## Inputs

- conteudo: object — Output a distribuir, com:
  - titulo: string — Título do relatório/comunicação
  - corpo: string — Conteúdo formatado para envio
  - tipo: string — Tipo do relatório ("resumo-promocao" | "relatorio-concorrentes" | "confirmacao-publicacao")
- destinatarios: array — Lista de contatos: nome, whatsapp, loja (lido de `config.json` → `contatos.equipe_comercial` ou `contatos.gerentes`)
- formato_envio: string — "resumo" | "completo" | "destaque". Default: "resumo"
- webhook_url: string — URL do webhook n8n (lido de `config.json` → `whatsapp.url_distribuicao`)

## Outputs

- registro_envio: object — Confirmação de distribuição:
  - data_envio: string — Timestamp do envio
  - conteudo_titulo: string — Título do que foi enviado
  - webhook_status: number — HTTP status code da resposta do n8n
  - webhook_response: object — Resposta do n8n (formato livre, depende do workflow)

## Implementação

### Passos

1. Preparar conteúdo conforme `formato_envio`:
   - "resumo": Extrair pontos principais, limitar a 500 caracteres
   - "completo": Enviar corpo integral
   - "destaque": Apenas título + top 3 informações mais relevantes
2. Montar payload para o webhook:
   ```json
   {
     "relatorio": {
       "tipo": "{conteudo.tipo}",
       "data": "{YYYY-MM-DD}",
       "conteudo": "{conteudo_formatado}"
     },
     "destinatarios": [
       {"nome": "...", "whatsapp": "+55...", "loja": "..."}
     ]
   }
   ```
3. Enviar POST para `webhook_url` com o payload
4. Registrar resposta do webhook

### Schema do payload

O workflow n8n recebe o payload e pode acessar:

| Campo | Acesso no n8n | Descrição |
|---|---|---|
| Tipo do relatório | `$json.body.relatorio.tipo` | Identifica qual template usar |
| Data | `$json.body.relatorio.data` | Data de referência da promoção |
| Texto da mensagem | `$json.body.relatorio.conteudo` | Conteúdo formatado para envio |
| Destinatários | `$json.body.destinatarios` | Array de contatos |
| Nome do contato | `$json.body.destinatarios[n].nome` | Para personalização |
| WhatsApp | `$json.body.destinatarios[n].whatsapp` | Número no formato +55... |
| Loja | `$json.body.destinatarios[n].loja` | Para segmentação |

### Casos de uso

- Enviar relatório de preços dos concorrentes (output da skill-pesquisa-concorrente) para equipe comercial → tipo: `relatorio-concorrentes`
- Enviar resumo da promoção ativa para gerentes → tipo: `resumo-promocao`
- Enviar confirmação de publicação (link do post) para equipe de marketing → tipo: `confirmacao-publicacao`

### Chamada

```bash
curl -s -X POST "{webhook_url}" \
  -H "Content-Type: application/json" \
  -d '{
    "relatorio": {
      "tipo": "resumo-promocao",
      "data": "2026-04-09",
      "conteudo": "Promoção ativa: Picanha Friboi de R$69,90 por R$49,90 (-29%). Válida até 12/04. Publicada no Instagram às 08:00."
    },
    "destinatarios": [
      {"nome": "João", "whatsapp": "+5585999999999", "loja": "Centro"},
      {"nome": "Maria", "whatsapp": "+5585888888888", "loja": "Sul"}
    ]
  }'
```

### Fallback

- Se webhook indisponível (erro de conexão ou timeout): informar ao operador "Não foi possível distribuir o relatório. Verifique se o workflow n8n está ativo e a URL no config.json está correta." Retornar com `webhook_status: null` e `erro: "webhook_indisponivel"`.
- Se webhook retornar erro (status >= 400): registrar o status e a resposta. Informar ao operador o código de erro recebido.
