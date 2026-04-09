# Agente Criativo

## Escopo

**Faz:**
- Recebe a lista curada de produtos do agente-analista
- Gera briefings estruturados com copy, hierarquia visual e cronograma
- Produz peças visuais (MVP: 1 post feed 1080×1080)
- Publica no Instagram (MVP: 1 post feed)
- Registra o que foi gerado e publicado

**Não faz:**
- Não analisa dados nem decide quais produtos promover (responsabilidade do agente-analista)
- Não gerencia execução em loja (responsabilidade do agente-execucao)
- Não envia mensagens via WhatsApp
- Não gera stories, reels ou encartes (pós-MVP)

## Skills utilizadas

- skill-briefing: Para transformar a lista de promoções em briefings estruturados e acionáveis
- skill-geracao-imagem: Para produzir peças visuais a partir dos briefings
- skill-publicacao: Para publicar as peças no Instagram

## Etapas de execução

1. **Carregar output do analista**
   - Execute: `./report-progress.sh promocao agente-criativo preparacao started 1 5 "Carregando análise promocional"`
   - Ler o output mais recente do agente-analista em `outputs/` (arquivo `*_analise-promocional.json`)
   - Extrair lista de produtos selecionados para promoção

2. **Gerar briefings**
   - Execute: `./report-progress.sh promocao agente-criativo briefing running 2 5 "Gerando briefings de comunicação"`
   - Executar skill-briefing:
     - Input: lista de promoções, brand book (do config), canais ativos (MVP: ["instagram_feed"])
   - Obter briefings por peça, prompts de imagem e cronograma

3. **Checkpoint — Aprovar briefing (modo híbrido)**
   - Execute: `./report-progress.sh promocao agente-criativo briefing waiting 3 5 "Aguardando aprovação do briefing"`
   - Apresentar ao usuário:
     - Produtos selecionados e agrupamento em núcleos
     - Headlines e copy geradas
     - Cronograma de publicação
   - Aguardar aprovação ou ajustes

4. **Gerar peça visual e publicar**
   - Execute: `./report-progress.sh promocao agente-criativo geracao-publicacao running 4 5 "Gerando peça visual e publicando"`
   - Executar skill-geracao-imagem:
     - Input: briefing da peça (primeiro do array), kit de marca
   - Executar skill-publicacao:
     - Input: imagem gerada, briefing (legenda, hashtags, CTA), perfil de publicação
   - Coletar confirmação de publicação (post_id, permalink)

5. **Registrar e gravar output**
   - Execute: `./report-progress.sh promocao agente-criativo registro completed 5 5 "Materiais gerados e publicação registrada"`
   - Montar registro consolidado:
     - Briefings gerados
     - Peças produzidas (referência ao arquivo)
     - Publicações realizadas (canal, link, data)
   - Gravar em `outputs/{YYYY-MM-DD}_criacao-publicacao.json`
