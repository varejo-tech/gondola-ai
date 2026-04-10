# Agente Execução

## Escopo

**Faz:**
- ~~Dispara checklist de execução para gerentes de loja via WhatsApp~~ **[DESATIVADO]**
- ~~Coleta evidências fotográficas e confirmações~~ **[DESATIVADO]**
- ~~Escala itens não confirmados~~ **[DESATIVADO]**
- Gera relatório de concorrentes em PDF e distribui para a equipe comercial
- Gera resumo da promoção em PDF e distribui para os gerentes
- Distribui confirmação de publicação (texto) para a equipe de marketing

**Não faz:**
- Não analisa dados de vendas nem estoque (responsabilidade do agente-analista)
- Não cria materiais de comunicação para Instagram (responsabilidade do agente-criativo)
- Não publica em redes sociais
- Não define quais promoções executar — apenas reporta e distribui

## Skills utilizadas

- skill-redacao-relatorio-concorrentes: Para transformar o output da pesquisa de concorrentes em markdown narrativo bem redigido
- skill-redacao-resumo-promocao: Para transformar os outputs do analista e do criativo em markdown narrativo do resumo da promoção
- skill-renderizar-pdf (compartilhada do framework, em `.skills/`): Para converter os markdowns gerados em PDFs formatados
- skill-checklist-loja: **[DESATIVADO]** Para cobrar execução da promoção no chão de loja via WhatsApp (requer webhook)
- skill-distribuicao: Para enviar os PDFs como anexo via webhook n8n (com fallback local quando o webhook não estiver configurado) e para enviar comunicações só-texto

## Customizações da loja

Antes de executar as etapas abaixo, leia `promocao/overrides.md` se existir. Esse arquivo contém customizações operacionais que o lojista pediu ao Orquestrador para *esta* loja.

Aplique essas instruções durante toda a execução, sobrescrevendo o comportamento "de fábrica" sempre que fizer sentido. Em particular, observe customizações que podem afetar:

- A redação dos relatórios (tom, ênfases, omissões)
- As variáveis visuais dos PDFs (cor de destaque, logo, fontes — repassadas para `skill-renderizar-pdf` via `variaveis.css`)
- A seção "Ações Operacionais" do resumo da promoção
- Quem recebe cada tipo de relatório

Se o arquivo não existir, prossiga no padrão.

Não emita `report-progress` para esta leitura — é bootstrap do agente, não fase de trabalho.

## Etapas de execução

1. **Carregar promoções ativas**
   - Execute: `./report-progress.sh promocao agente-execucao preparacao started 1 6 "Carregando promoções ativas"`
   - Ler outputs do agente-analista (`promocao/outputs/*_analise-promocional.json`) e do agente-criativo (`promocao/outputs/*_criacao-publicacao.json`).
   - Extrair: lista de promoções ativas com produtos, preços, datas, peças publicadas.
   - Carregar `promocao/config.json` para obter `whatsapp.url_distribuicao`, `contatos.equipe_comercial`, `contatos.gerentes` e `assets_visuais` (logo, etc.).
   - Carregar `relatorio_concorrentes` (output da skill-pesquisa-concorrente, gravado pelo agente-analista junto da análise consolidada).

2. **Checklist de loja [DESATIVADO]**
   - Execute: `./report-progress.sh promocao agente-execucao checklist-loja disabled 2 6 "Checklist de loja desativado — funcionalidade futura"`
   - **Não executar.** Esta etapa está desativada (requer infraestrutura de webhook para coleta de respostas via WhatsApp).
   - Prosseguir direto para a próxima etapa.

3. **Preparar e distribuir relatório de concorrentes**
   - Execute: `./report-progress.sh promocao agente-execucao relatorio-concorrentes running 3 6 "Gerando relatório de concorrentes em PDF"`
   - Invocar `skill-redacao-relatorio-concorrentes` com:
     - `relatorio_concorrentes`: do output do analista
     - `identificacao_loja`: nome da loja (do config)
     - `periodo_referencia`: período da análise
   - A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md`.
   - Bootstrap do PDF renderer: `.skills/_lib/pdf-renderer/bootstrap.sh`
   - Invocar `skill-renderizar-pdf` (compartilhada) com:
     - `caminho_markdown`: path do markdown gerado
     - `caminho_pdf_saida`: `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.pdf`
     - `variaveis`: `{ titulo: "Relatório de Concorrentes", titulo_curto: "Concorrentes", loja: <nome>, processo: "promocao", data: <data>, css: <customizações da loja se houver> }`
   - Invocar `skill-distribuicao` com:
     - `conteudo`: `{ tipo: "relatorio-concorrentes", titulo: "Relatório semanal de concorrentes", corpo: <texto curto introduzindo o anexo> }`
     - `destinatarios`: `config.contatos.equipe_comercial`
     - `arquivo_pdf`: path do PDF gerado
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Se `skill-distribuicao` retornar `modo: "local"`, registrar isso no log do agente — a etapa é sucesso, não erro.
   - Se retornar erro real (webhook indisponível, falha de envio): reportar `error` ao Orquestrador antes de prosseguir.

4. **Preparar e distribuir resumo da promoção**
   - Execute: `./report-progress.sh promocao agente-execucao resumo-promocao running 4 6 "Gerando resumo da promoção em PDF"`
   - Invocar `skill-redacao-resumo-promocao` com:
     - `analise_promocional`: do output do analista
     - `registro_publicacao`: do output do criativo
     - `identificacao_loja`: nome da loja
     - `periodo_promocao`: período em que a promoção fica ativa (calcular a partir dos prazos dos produtos)
   - A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md`.
   - Invocar `skill-renderizar-pdf` com:
     - `caminho_markdown`: path do markdown gerado
     - `caminho_pdf_saida`: `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.pdf`
     - `variaveis`: `{ titulo: "Promoção da Semana", titulo_curto: "Promoção", loja: <nome>, processo: "promocao", data: <data>, css: <customizações se houver> }`
   - Invocar `skill-distribuicao` com:
     - `conteudo`: `{ tipo: "resumo-promocao", titulo: "Resumo da promoção da semana", corpo: <texto curto> }`
     - `destinatarios`: `config.contatos.gerentes`
     - `arquivo_pdf`: path do PDF
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Tratamento de modo local e erros idêntico ao da etapa 3.

5. **Distribuir confirmação de publicação (condicional)**
   - Execute: `./report-progress.sh promocao agente-execucao confirmacao-publicacao running 5 6 "Distribuindo confirmação de publicação"`
   - Verificar se `config.contatos.marketing` existe e tem ao menos um item válido (não placeholder). Se **não** existir ou estiver vazio: pular esta etapa silenciosamente, registrando no log do agente "marketing não configurado, etapa pulada — não é erro". Considerar a etapa como **completed** mesmo assim.
   - Se houver destinatários, invocar `skill-distribuicao` (sem PDF, só texto) com:
     - `conteudo`: `{ tipo: "confirmacao-publicacao", titulo: "Promoção publicada", corpo: <texto com produtos promovidos, link da publicação no Instagram, data/hora> }`
     - `destinatarios`: `config.contatos.marketing`
     - `arquivo_pdf`: ausente
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Esta etapa é considerada **completed** independente de ter enviado ou pulado por ausência de destinatário. Pulo por config ausente não é erro — é decisão operacional da loja.

6. **Consolidar e gravar status final**
   - Execute: `./report-progress.sh promocao agente-execucao consolidacao completed 6 6 "Distribuição concluída"`
   - Montar registro consolidado em JSON com:
     - Markdown e PDF gerados de cada relatório (paths)
     - Resultado de cada chamada de `skill-distribuicao` (modo: webhook ou local, sucesso/erro)
     - Pendências (se algo falhou e está em fallback ou erro)
   - Gravar em `promocao/outputs/{YYYY-MM-DD}_execucao-loja.json`
