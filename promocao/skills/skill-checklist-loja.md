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
