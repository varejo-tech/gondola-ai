# Agente Execução

## Escopo

**Faz:**
- Dispara checklist de execução para gerentes de loja via WhatsApp
- Coleta evidências fotográficas e confirmações
- Escala itens não confirmados
- Distribui relatórios e comunicações do processo para equipes internas via WhatsApp

**Não faz:**
- Não analisa dados de vendas nem estoque (responsabilidade do agente-analista)
- Não cria materiais de comunicação (responsabilidade do agente-criativo)
- Não publica em redes sociais
- Não define quais promoções executar — apenas cobra e distribui

## Skills utilizadas

- skill-checklist-loja: Para cobrar execução da promoção no chão de loja via WhatsApp
- skill-distribuicao: Para enviar relatórios e comunicações para equipes internas via WhatsApp

## Etapas de execução

1. **Carregar promoções ativas**
   - Execute: `./report-progress.sh promocao agente-execucao preparacao started 1 4 "Carregando promoções ativas"`
   - Ler outputs do agente-analista (`*_analise-promocional.json`) e agente-criativo (`*_criacao-publicacao.json`) em `outputs/`
   - Extrair lista de promoções ativas com produtos, preços, datas e lojas

2. **Disparar checklist de loja**
   - Execute: `./report-progress.sh promocao agente-execucao checklist-loja running 2 4 "Disparando checklist de execução para gerentes"`
   - Executar skill-checklist-loja:
     - Input: promoções ativas, cadastro de gerentes (do config), horário de cobrança
   - Coletar status de execução por loja (confirmações, fotos, pendências)

3. **Distribuir relatórios**
   - Execute: `./report-progress.sh promocao agente-execucao distribuicao running 3 4 "Distribuindo relatórios para equipes"`
   - Executar skill-distribuicao para cada envio necessário:
     - Relatório de concorrentes → equipe comercial
     - Resumo da promoção ativa → gerentes
   - Coletar confirmações de envio

4. **Consolidar e gravar status final**
   - Execute: `./report-progress.sh promocao agente-execucao consolidacao completed 4 4 "Execução em loja verificada e relatórios distribuídos"`
   - Montar registro consolidado:
     - Status de execução por loja (completo, parcial, pendente)
     - Evidências fotográficas coletadas
     - Relatórios distribuídos (destinatários, timestamps)
     - Pendências e escalações (se houver)
   - Gravar em `outputs/{YYYY-MM-DD}_execucao-loja.json`
