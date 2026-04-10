# Skill: Distribuição

## Propósito

Distribuir relatórios e comunicações da promoção para uma lista de contatos via WhatsApp. O envio é delegado a um workflow no n8n via webhook (recebe payload JSON com texto e/ou anexo PDF em base64). Suporta dois caminhos:

- **Caminho com anexo PDF** — payload inclui o PDF em base64; n8n converte e anexa como documento na mensagem WhatsApp.
- **Caminho só-texto** — payload sem anexo; n8n envia mensagem de texto.

Quando o webhook do n8n não estiver configurado, ativa **fallback local**: abre o PDF no visualizador padrão do sistema, ou imprime o texto no stdout. O fallback é sucesso, não erro — permite o lojista validar o processo end-to-end antes de configurar o n8n.

## Inputs

- **conteudo**: object — Conteúdo a distribuir:
  - `tipo`: string — Tipo do relatório (`"relatorio-concorrentes"` | `"resumo-promocao"` | `"confirmacao-publicacao"`)
  - `titulo`: string — Título da comunicação
  - `corpo`: string — Texto que acompanha (caption do anexo, ou mensagem só-texto)
- **destinatarios**: array — Lista de contatos: `{ nome, whatsapp, loja }` (lido de `config.json` → `contatos.equipe_comercial` ou `contatos.gerentes`)
- **arquivo_pdf**: string (opcional) — Path para PDF a anexar. Quando presente, ativa o caminho com anexo. Quando ausente, ativa o caminho só-texto.
- **webhook_url**: string — URL do webhook n8n (lido de `config.json` → `whatsapp.url_distribuicao`). Pode estar vazio, ausente ou `"PREENCHER"` — nesse caso a skill ativa o fallback local.

## Outputs

- **registro_envio**: object — Resultado da distribuição:
  - `data_envio`: string — Timestamp ISO
  - `conteudo_titulo`: string
  - `modo`: string — `"webhook"` | `"local"`
  - `webhook_status`: number ou null — HTTP status code (null se modo local)
  - `webhook_response`: object ou null — resposta do n8n (null se modo local)
  - `arquivo_aberto`: string ou null — path do arquivo aberto localmente (apenas no fallback com PDF)

## Implementação

### Detecção de modo

Antes de qualquer ação, a skill avalia o `webhook_url`:

```bash
if [ -z "${webhook_url:-}" ] || [ "$webhook_url" = "PREENCHER" ]; then
  modo="local"
else
  modo="webhook"
fi
```

### Modo webhook

1. Se `arquivo_pdf` está presente: ler o arquivo, codificar em base64.
2. Montar payload JSON:

```json
{
  "relatorio": {
    "tipo": "{conteudo.tipo}",
    "data": "{YYYY-MM-DD}",
    "conteudo": "{conteudo.corpo}"
  },
  "destinatarios": [
    { "nome": "...", "whatsapp": "+55...", "loja": "..." }
  ],
  "arquivo": {
    "nome": "{basename do arquivo_pdf}",
    "mime": "application/pdf",
    "base64": "{conteúdo base64 do PDF}"
  }
}
```

Quando `arquivo_pdf` está ausente, o bloco `"arquivo"` é omitido do payload.

3. POST para `webhook_url` com `Content-Type: application/json`.
4. Capturar status code e response body.
5. Retornar `registro_envio` com `modo: "webhook"`.

### Modo local (fallback)

1. Reportar ao operador (via mensagem ao agente que invocou): "n8n não configurado — abrindo o relatório localmente. Configure `whatsapp.url_distribuicao` para distribuição automática via WhatsApp."

2. Detectar SO:

```bash
case "$(uname -s)" in
  Darwin*)  open_cmd="open" ;;
  Linux*)   open_cmd="xdg-open" ;;
  CYGWIN*|MINGW*|MSYS*) open_cmd="start" ;;
  *) open_cmd="open" ;;
esac
```

3. Se `arquivo_pdf` está presente: abrir o arquivo no visualizador padrão:

```bash
$open_cmd "$arquivo_pdf"
```

(Em Windows: `start "" "$arquivo_pdf"` — string vazia entre `start` e o path.)

4. Se `arquivo_pdf` está ausente (modo só-texto): imprimir o conteúdo no stdout com cabeçalho:

```
=== DISTRIBUIÇÃO LOCAL (n8n não configurado) ===
Tipo: {conteudo.tipo}
Para: {lista de destinatarios}
Título: {conteudo.titulo}

{conteudo.corpo}
=================================================
```

5. Retornar `registro_envio` com `modo: "local"`, `webhook_status: null`, e `arquivo_aberto: {path}` (ou null se só-texto).

### Importante: fallback é sucesso

O fallback local termina com **status de sucesso**, não erro. A intenção é exatamente permitir validação sem dependência externa. O agente que invocou a skill deve tratar `modo: "local"` como conclusão normal e prosseguir com o fluxo.

### Fallback técnico (erros reais)

- **Webhook indisponível** (timeout, erro de conexão): retornar `registro_envio` com `webhook_status: null`, `erro: "webhook_indisponivel"`. O agente reporta erro ao Orquestrador.
- **Webhook retorna ≥ 400**: registrar status e response. Retornar `registro_envio` com erro. O agente reporta.
- **Falha ao abrir PDF localmente** (comando `open`/`xdg-open` retorna erro): tratar como erro real, retornar `registro_envio` com `erro: "abertura_local_falhou"`.

### Exemplo de invocação (modo webhook + PDF)

```bash
# Após gerar o PDF e ter o webhook_url configurado
PDF_BASE64=$(base64 -i "$pdf_path")
PAYLOAD=$(jq -n \
  --arg tipo "relatorio-concorrentes" \
  --arg data "2026-04-10" \
  --arg corpo "Segue o relatório semanal de concorrentes." \
  --arg nome_arquivo "$(basename "$pdf_path")" \
  --arg b64 "$PDF_BASE64" \
  --argjson destinatarios "$destinatarios_json" \
  '{relatorio:{tipo:$tipo,data:$data,conteudo:$corpo},destinatarios:$destinatarios,arquivo:{nome:$nome_arquivo,mime:"application/pdf",base64:$b64}}')

curl -s -X POST "$webhook_url" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

### Mudanças no workflow n8n (dependência externa)

O workflow n8n precisa ser atualizado para:
1. Detectar a presença de `body.arquivo`.
2. Usar nó "Move Binary Data" para converter `body.arquivo.base64` em binário.
3. Enviar mensagem WhatsApp com o documento anexado e o `body.relatorio.conteudo` como caption.

Esta mudança é responsabilidade do administrador do framework, não desta implementação.

## Notas

- **Compatibilidade com versão anterior preservada**: chamadas sem `arquivo_pdf` continuam funcionando exatamente como antes.
- **Skill não chama `report-progress`**: quem reporta é o agente.
- **Não conhece outros agentes nem outras skills**: recebe inputs semânticos (`conteudo`, `destinatarios`, `arquivo_pdf`, `webhook_url`) e pronto.
