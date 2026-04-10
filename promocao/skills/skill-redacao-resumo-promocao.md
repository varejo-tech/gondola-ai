# Skill: Redação do Resumo da Promoção

## Propósito

Receber os outputs estruturados do `agente-analista` (análise promocional consolidada) e do `agente-criativo` (briefings, peças geradas e publicações realizadas) e produzir um **markdown narrativo bem redigido** voltado para os gerentes de loja. O markdown gerado é depois renderizado em PDF via `skill-renderizar-pdf` (skill compartilhada do framework).

O público-alvo são gerentes de loja que precisam **agir** — ajustar preço no PDV, preparar exposição, treinar equipe, monitorar estoque. O documento equilibra "o que está acontecendo" com "o que cabe a você fazer".

**Timing:** este resumo é gerado em Fase 3 do processo, depois que o analista e o criativo já rodaram. Quando o gerente recebe, **a peça já está publicada**. É um memorando do que está rolando + plano de ação operacional, não um plano hipotético.

## Inputs

- **analise_promocional**: object — Output do `agente-analista`. Estrutura esperada (ver agente-analista para detalhes):
  - `produtos_recomendados`: array de `{ produto, marca, variacao, preco_normal, preco_promocional, prazo, justificativa, score, panorama_concorrentes }`
  - `sugestoes_cross_selling`: array de `{ produto_ancora, produtos_correlacionados[], observacao }`
  - `recomendacao_final`: string — síntese estratégica do analista
- **registro_publicacao**: object — Output do `agente-criativo`. Estrutura:
  - `briefings`: array
  - `pecas`: array de `{ tipo, arquivo, briefing }`
  - `publicacoes`: array de `{ canal, link, data, post_id }`
- **identificacao_loja**: string — Nome da loja.
- **periodo_promocao**: string — Período em que a promoção fica ativa (ex.: "10/04 a 16/04").

## Outputs

- **caminho_markdown**: string — Path do arquivo `.md` gravado em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md`.
- **markdown_resumo**: string — Conteúdo markdown completo.

## Implementação

### Estrutura do markdown produzido

```markdown
<div class="cover-page">

# Promoção da Semana

**Período:** {periodo_promocao}
**Para:** Gerentes de Loja — {identificacao_loja}
**SKUs envolvidos:** {N} produtos

<p class="cover-meta">Resumo estratégico e plano de ação para a promoção em vigor. Documento gerado automaticamente pelo processo de Promoção.</p>

</div>

# Resumo Executivo

{Um parágrafo único de 3-5 frases. O que está sendo promovido, a razão estratégica em uma frase, e o que se espera. Tom de gerente sênior falando com outro gerente. Use linguagem do varejo.}

# Justificativa Estratégica

{Análise em prosa, 2-3 parágrafos. Cobre o **porquê** desta promoção:}

- Oportunidades observadas (estoque em pico, sazonalidade, margem disponível)
- Posicionamento competitivo (panorama de concorrentes — sem repetir o relatório de concorrentes; só o que justifica esta seleção específica)
- Sinergias com cross-selling (puxar categoria adjacente)
- Risco gerenciado (o que pode dar errado e o que está sendo monitorado)

{Use os campos `justificativa`, `score` e `panorama_concorrentes` de cada produto recomendado, mas **agregue em narrativa**, não em lista de SKUs.}

# Produtos Promovidos

{Tabela com todos os SKUs do `produtos_recomendados`. Uma linha por produto.}

| Produto | Marca | Variação | De | Por | Desconto | Prazo | Score |
|---|---|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco_normal} | **R$ {preco_promocional}** | -{percentual}% | {prazo} | {score}/10 |

{Para cada produto que tenha justificativa específica notável, adicionar logo abaixo da tabela um bloco curto:}

**{produto}** — {1-2 frases interpretando a justificativa específica deste SKU}

# Cross-selling Sugerido

{Para cada item em `sugestoes_cross_selling`:}

## {produto_ancora}

{Parágrafo curto explicando o cross-selling — por que estes produtos correlacionados, qual a sugestão de exposição conjunta na loja, qual o argumento de venda.}

- {produto_correlacionado_1}
- {produto_correlacionado_2}
- ...

{Repete para cada produto-âncora.}

# Comunicação Programada

{Listar as publicações em ordem cronológica.}

| Canal | Data/Hora | Tipo | Link |
|---|---|---|---|
| Instagram Feed | {data_publicacao} | Post promocional | [ver publicação]({link}) |

{Se houver mais peças programadas mas ainda não publicadas, indicar em parágrafo curto após a tabela.}

# Ações Operacionais

{Checklist do que o gerente precisa fazer. Use bullet list. Itens devem ser concretos e acionáveis.}

- [ ] Ajustar preços no sistema/PDV para todos os SKUs promovidos antes do início do prazo
- [ ] Preparar exposição em ponta de gôndola dos produtos-âncora
- [ ] Garantir reposição contínua durante o período (alta probabilidade de ruptura nos top 3)
- [ ] Briefar a equipe de frente sobre o argumento de venda de cada produto
- [ ] Monitorar diariamente: vendas dos SKUs promovidos, ruptura, ticket médio
- [ ] Acompanhar concorrentes durante a vigência (próximo relatório sai em {próxima data})

{Heurísticas para popular este checklist — use os dados do input para personalizar:}
- Se algum produto for perecível: adicionar item "checar validade da reposição"
- Se o `score` indicar alta rotatividade: reforçar a recomendação de reposição
- Se houver cross-selling: adicionar "garantir disponibilidade dos itens correlacionados"

---

*Resumo gerado pelo processo de Promoção em {data}. Dados completos da análise e da publicação disponíveis em `promocao/outputs/`.*
```

### Regras de redação

1. **Não invente dados.** Se um campo do input está vazio ou null, omita-o ou diga "não disponível". Nunca crie informação fictícia.
2. **Tom de gerente sênior.** Direto, com o porquê embutido. Linguagem do varejo, não da TI. Diga "ponta de gôndola", "reposição", "ruptura", "frente de loja".
3. **Use números sempre que possível.** Score, percentual de desconto, contagem de SKUs, datas. Números dão credibilidade.
4. **Formate preços em pt-BR.** Sempre `R$ XX,YY`.
5. **Datas em pt-BR.** `DD/MM/YYYY` no corpo do texto.
6. **Aplique customizações da loja.** O agente que invoca esta skill deve injetar instruções relevantes do `promocao/overrides.md`. Customizações comuns: omitir seção de Ações Operacionais (loja com processo próprio), adicionar instruções padrão (ex: "sempre avisar a equipe da gôndola fria às 6h"), tom de comunicação ("se referir aos clientes como 'fregueses'").
7. **Não duplique o relatório de concorrentes.** Mencione concorrentes só onde isso justifica uma decisão deste resumo. O panorama detalhado vai em outro documento.

### Saída

A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md` (formato `YYYY-MM-DD` baseado na data de execução) e retorna o path.

## Notas

- **Process-specific**: vive em `promocao/skills/` porque conhece o vocabulário e a estrutura dos outputs do analista e do criativo.
- **Inputs semânticos**: declara o input pelo significado.
- **Não chama `report-progress`**: quem reporta é o agente que a invoca.
- **Customizável via overrides**: especialmente a seção "Ações Operacionais", que tem heurísticas defaults mas pode ser sobrescrita pela loja.
