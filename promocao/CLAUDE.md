# Processo: Promoção

modo: híbrido
descricao: Ciclo completo de promoção — análise de oportunidades, criação de materiais, publicação e verificação de execução em loja.
dependencias: nenhuma

## Configuração de fontes de dados

Este processo utiliza `config.json` para declarar as fontes de dados consumidas pelas skills. Cada usuário deve configurar seu próprio `config.json` com as credenciais e endpoints corretos. O arquivo não é versionado.

Cada dataset suporta múltiplos tipos de fonte: `arquivo` (Excel, CSV), `api` (endpoint + credenciais) ou `banco` (host + porta + credenciais). O tipo é escolha do usuário na configuração — as skills referenciam apenas o nome do dataset, não o tipo.

### Datasets utilizados

| Dataset | Consumido por | Descrição |
|---|---|---|
| `estoque` | skill-oportunidade-promocional | Dados de estoque atual |
| `vendas` | skill-oportunidade-promocional | Histórico de vendas |
| `vendas_cupom` | skill-cross-selling | Vendas por cupom fiscal (últimos 6 meses) |
| `instagram` | skill-pesquisa-concorrente, skill-publicacao | Meta API — Instagram Graph (Business Discovery) |
| `whatsapp` | skill-checklist-loja, skill-distribuicao | Webhook n8n — envio de mensagens WhatsApp |
| `gemini` | skill-geracao-imagem | Gemini API — Nano Banana 2 (geração de imagem) |

### Configurações obrigatórias do Instagram

O dataset `instagram` requer configurações que o usuário deve preencher antes de executar o processo:

| Parâmetro | Descrição | Exemplo |
|---|---|---|
| `instagram_business_id` | ID do Instagram Business do usuário, vinculado à Business Manager | `17841400123456789` |
| `access_token` | Token do System User com permissões adequadas (`instagram_basic`, `business_management`, `pages_read_engagement`) | Token da Meta |
| `perfis_concorrentes` | Lista de perfis de concorrentes a monitorar. Aceita username ou link do perfil. | `["fortatacadista", "https://www.instagram.com/atacadao/"]` |
| `perfil_publicacao` | Username do perfil onde serão publicadas as peças | Username do Instagram da loja |

**Estas configurações são solicitadas pelo Orquestrador ao configurar o processo de promoção.** O processo não deve ser executado sem que estejam preenchidas.

#### Texto guia para o Orquestrador apresentar ao lojista

- **`instagram_business_id`** — "Preciso do ID do seu Instagram Business — é o número que identifica sua conta profissional do Instagram dentro da Meta. Sua conta precisa ser do tipo Business e estar vinculada a uma Business Manager. Você encontra esse ID nas configurações da sua conta Business no Meta Business Suite."
- **`access_token`** — "Preciso do token de acesso do System User da sua Business Manager. É o código que autoriza o acesso à API da Meta. Você pode gerá-lo no painel de desenvolvedores da Meta (Business Settings → System Users). O token precisa ter as permissões: instagram_basic, business_management e pages_read_engagement."
- **`perfis_concorrentes`** — "Quais são os perfis de Instagram dos seus concorrentes que você quer monitorar? Pode me passar o nome de usuário (ex.: fortatacadista) ou o link do perfil. Pode listar quantos quiser." Importante: se ficar vazio ou com `["PREENCHER"]`, a pesquisa de concorrentes não roda — avise o lojista antes de prosseguir.
- **`perfil_publicacao`** — "Qual é o perfil do Instagram da sua loja onde serão publicadas as peças promocionais?"

### Assets visuais (opcionais, recomendados)

A seção `assets_visuais` do config.json permite ao usuário fornecer materiais visuais que melhoram significativamente a qualidade das peças geradas. São opcionais — sem eles a geração funciona apenas com prompt de texto.

| Parâmetro | Descrição | Exemplo |
|---|---|---|
| `logo` | Caminho para o arquivo de logo da loja (PNG/JPG) | `/caminho/para/logo.png` |
| `templates` | Lista de caminhos para templates de referência visual — encartes anteriores, posts de referência, materiais da marca | `["/caminho/template1.png", "/caminho/template2.jpg"]` |
| `fotos_produtos` | Diretório contendo fotos dos produtos (nomeadas pelo código ou descrição) | `/caminho/para/fotos/` |

**Estas configurações são oferecidas pelo Orquestrador durante a configuração do processo.** O usuário pode pular e configurar depois.

#### Texto guia para o Orquestrador apresentar ao lojista

Apresente como melhoria da qualidade do resultado, não como obrigação. Se o lojista não tiver agora, diga que pode configurar depois a qualquer momento.

- **`assets_visuais.logo`** — "Você tem o logo da sua loja em arquivo digital (PNG ou JPG)? Se me passar o caminho do arquivo, vou incluir automaticamente nas peças promocionais."
- **`assets_visuais.templates`** — "Você tem encartes ou posts anteriores da loja que gostaria de usar como referência de estilo? Pode ser um encarte impresso escaneado, um post antigo do Instagram ou qualquer material visual da loja. Será usado como base para manter a identidade visual."
- **`assets_visuais.fotos_produtos`** — "Você tem uma pasta com fotos dos seus produtos? Se tiver, posso usar as fotos reais em vez de gerar imagens genéricas. Fica muito mais profissional."

### Configuração do WhatsApp

O envio de mensagens WhatsApp é feito via webhook do n8n. Apenas a URL do webhook é necessária.

| Parâmetro | Descrição |
|---|---|
| `whatsapp.url_distribuicao` | URL do webhook do n8n configurado para distribuição de relatórios da promoção. |

Sem essa URL, a Fase 3 (distribuição de relatórios via WhatsApp) não funciona. O processo continua até a publicação, mas a distribuição é afetada.

#### Texto guia para o Orquestrador apresentar ao lojista

- **`whatsapp.url_distribuicao`** — "Preciso da URL do webhook do n8n que você criou para enviar as mensagens de WhatsApp. É o endereço que aparece no nó de Webhook do seu workflow (algo como https://seu-n8n.com/webhook/distribuicao-promocao)."

### Template do config.json

Ver `config.json` na raiz do processo para o formato esperado.

## Agentes

- agente-analista: Analisa dados internos e externos para identificar oportunidades de promoção. Entrega lista curada de produtos recomendados.
- agente-criativo: Produz materiais de comunicação (briefing, peças visuais) e publica nos canais da loja.
- agente-execucao: Garante a comunicação dos resultados — gera relatório de concorrentes e resumo da promoção em PDF, distribui via WhatsApp aos públicos certos (com fallback local), e envia confirmação de publicação para marketing.

## Fluxo de execução

1. **Fase 1 — Entender** — agente-analista executa análise de oportunidades, cross-selling e pesquisa de concorrentes. Grava relatório consolidado em `outputs/`.
   - Checkpoint (modo híbrido): Apresenta lista de produtos recomendados para validação do usuário antes de prosseguir.
2. **Fase 2 — Multiplicar** — agente-criativo recebe o output do analista, gera briefing, produz peça visual e publica no Instagram. Grava registro em `outputs/`.
   - Checkpoint (modo híbrido): Apresenta briefing e peça gerada para aprovação antes de publicar.
3. **Fase 3 — Coordenar** — agente-execucao consolida resultados, gera dois relatórios em PDF (relatório de concorrentes para a equipe comercial; resumo da promoção para os gerentes) e distribui via WhatsApp através de webhook n8n. Quando o webhook não estiver configurado, abre os PDFs localmente como fallback (a etapa segue como sucesso, não erro). Distribui também a confirmação de publicação (texto) para a equipe de marketing. Grava status consolidado em `outputs/`.
   - Checkpoint (modo híbrido): nenhum — a Fase 3 é integralmente automática.
