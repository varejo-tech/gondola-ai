# Skill: Redação do Relatório de Concorrentes

## Propósito

Receber o output estruturado da `skill-pesquisa-concorrente` (objeto `relatorio_concorrentes`) e produzir um **markdown narrativo bem redigido** voltado para a equipe comercial. O markdown gerado é depois renderizado em PDF via `skill-renderizar-pdf` (skill compartilhada do framework) para distribuição.

A redação não é descrição neutra dos dados ("foram encontradas X promoções"); é interpretação estratégica ("o concorrente está sustentando guerra de preço em proteínas — três SKUs abaixo de R$30/kg, todos com prazo curto, sinal de queima de estoque").

## Inputs

- **relatorio_concorrentes**: object — Output da `skill-pesquisa-concorrente`. Estrutura:
  - `data_analise`: string
  - `concorrentes`: array de objetos `{ perfil, posts_analisados, promocoes_encontradas[], posts_sem_promocao }`
    - `promocoes_encontradas[]`: `{ data_post, produto, marca, variacao, preco, prazo, condicoes, tipo_midia, link, confianca }`
    - `confianca`: `"alta"` | `"media"` | `"baixa"`
  - `comparativo`: array de `{ concorrente, produto, marca, variacao, preco, prazo }`
- **identificacao_loja**: string — Nome da loja onde o relatório está sendo gerado (vai no cabeçalho do documento).
- **periodo_referencia**: string (opcional) — Período de referência da análise. Default: usa `data_analise` do input.

## Outputs

- **caminho_markdown**: string — Path do arquivo `.md` gravado em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md`.
- **markdown_relatorio**: string — Conteúdo markdown completo (também retornado em memória para conveniência).

## Implementação

### Estrutura do markdown produzido

A skill produz um markdown com a seguinte estrutura. **Use estritamente esta ordem de seções** para manter consistência entre execuções:

```markdown
<div class="cover-page">

# Relatório de Concorrentes

**Período:** {periodo_referencia ou data_analise formatada em pt-BR}
**Para:** Equipe Comercial — {identificacao_loja}
**Perfis monitorados:** {N} ({lista compacta dos usernames separados por vírgula})

<p class="cover-meta">Análise estratégica das promoções identificadas em perfis de concorrentes via Instagram. Documento gerado automaticamente pelo processo de Promoção.</p>

</div>

# Resumo Executivo

{Parágrafo único de 3-5 frases. Tom de consultor reportando para diretor — direto, com números, com posição. Cobre: principais movimentações observadas, contagem total de promoções e perfis, e a oportunidade ou ameaça mais relevante do período.}

# Panorama por Concorrente

## {perfil}

**Posts analisados:** {posts_analisados} ({posts_sem_promocao} sem conteúdo promocional)

{Parágrafo curto de 2-3 frases interpretando o perfil deste concorrente: foco de categoria, frequência de comunicação, tom da comunicação, eventual padrão observado.}

| Produto | Marca | Variação | Preço | Prazo | Confiança |
|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco formatado pt-BR} | {prazo} | <span class="tag tag-{confianca-classe}">{confianca}</span> |

*Posts originais: [post 1]({link1}), [post 2]({link2}), ...*

{Repete a subseção `## {perfil}` para cada concorrente em concorrentes[].}

# Comparativo Consolidado

{Se houver sobreposição entre concorrentes (mesmo produto em 2+ perfis), gerar tabela cruzada com base no array `comparativo`. Caso contrário, escrever um parágrafo curto: "Não foram identificadas sobreposições diretas de SKU entre os concorrentes monitorados neste período."}

| Produto | Marca | Variação | {concorrente_1} | {concorrente_2} | {concorrente_N} | Observação |
|---|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco_1} | R$ {preco_2} | R$ {preco_N} | {comentário se for guerra de preço} |

# Conclusões e Recomendações

{Análise estratégica em prosa, NÃO em bullets. 2-4 parágrafos cobrindo:}

- Categorias mais aquecidas no período
- Faixas de preço praticadas, comparadas ao patamar habitual quando possível
- Oportunidades concretas para a loja
- Ameaças que exigem reação
- Sugestões de ação para a equipe comercial

# Notas de Confiança

A análise classifica cada extração em três níveis de confiança:

- **Alta** ({contagem}): preço e produto claramente legíveis na fonte
- **Média** ({contagem}): produto identificado mas preço incerto ou parcial
- **Baixa** ({contagem}): conteúdo aparenta ser promocional mas dados são ambíguos

Itens marcados como **baixa** devem ser validados manualmente antes de ações estratégicas baseadas neles.

---

*Relatório gerado pelo processo de Promoção em {data_analise}. Dados brutos disponíveis em `promocao/outputs/`.*
```

### Mapeamento de classes CSS de confiança

Use as seguintes classes ao formatar a coluna `Confiança` da tabela:

| Valor de `confianca` | Classe CSS |
|---|---|
| `"alta"` | `tag` (default azul) |
| `"media"` | `tag tag-warn` (laranja) |
| `"baixa"` | `tag tag-low` (vermelho) |

### Regras de redação

1. **Não invente dados.** Se um campo do input está vazio ou null, omita-o ou diga "não identificado". Nunca preencha com placeholder fictício.
2. **Tom de interpretação, não descrição.** Em vez de "foram encontradas 7 promoções no perfil X", escreva "o perfil X concentrou esforço em {categoria}, com 7 promoções, foco em {observação}".
3. **Use os números.** Sempre que um número for relevante (preço, contagem, percentual), inclua-o no texto.
4. **Formate preços em pt-BR.** Sempre `R$ XX,YY` (espaço, vírgula decimal, sem moeda em sigla).
5. **Datas em pt-BR.** `DD/MM/YYYY` no corpo do texto. ISO `YYYY-MM-DD` apenas em metadata.
6. **Aplique customizações da loja.** Esta skill é process-specific. O agente que invoca esta skill deve injetar instruções relevantes do `promocao/overrides.md` no contexto da redação (ex: "evitar mencionar marca X", "sempre destacar a categoria de hortifruti").

### Saída

A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md` (formato `YYYY-MM-DD` baseado em `data_analise`) e retorna o path. O agente que invoca a skill então passa esse path para a `skill-renderizar-pdf`.

## Notas

- **Process-specific**: vive em `promocao/skills/` porque conhece a estrutura específica do output da `skill-pesquisa-concorrente` e o vocabulário do domínio.
- **Inputs semânticos**: declara o input pelo significado, não pela estrutura interna do JSON.
- **Não chama `report-progress`**: quem reporta é o agente que a invoca.
