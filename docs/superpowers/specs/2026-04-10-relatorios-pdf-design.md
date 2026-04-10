# Relatórios PDF da Promoção — Design

**Data:** 2026-04-10
**Processo afetado:** `promocao/`
**Componentes novos:** 1 skill compartilhada do framework + 2 skills específicas do processo
**Componentes adaptados:** `skill-distribuicao`, `agente-execucao`

---

## Visão geral

Hoje a `skill-distribuicao` envia mensagens de texto via webhook n8n para WhatsApp. Este design substitui isso por **dois relatórios PDF bem redigidos** entregues como anexo no WhatsApp:

- **Relatório de Concorrentes** → equipe comercial — análise estratégica das promoções identificadas pela `skill-pesquisa-concorrente`.
- **Resumo da Promoção** → gerentes de loja — justificativa estratégica do que está sendo promovido + plano de ação operacional.

Mensagens só-texto continuam suportadas para casos como "confirmação de publicação".

## Contexto e motivação

Texto cru no WhatsApp não comporta a complexidade dos dois relatórios. A equipe comercial precisa de tabelas comparativas, conclusões estratégicas e dados de confiança. Os gerentes precisam de justificativa, lista de produtos com preços, cronograma e checklist operacional. Ambos merecem um documento legível, com hierarquia visual e identidade.

Também identificamos que a geração de PDF é uma **capacidade técnica reutilizável** — outros processos (compras, gestão de estoque) provavelmente vão querer relatórios em PDF também. Por isso, parte da solução é uma extensão arquitetural do framework, não apenas uma mudança no processo de Promoção.

## Decisões arquiteturais

### 1. Geração local de PDF

Geração de PDF acontece localmente no framework, não delegada ao n8n. Isso preserva o PDF como artefato versionado em `outputs/`, permite reuso futuro para outros canais (e-mail, Drive, etc.) e mantém a redação testável em sandbox sem depender do n8n.

### 2. Tooling: `md-to-pdf` (Node + Puppeteer headless)

A escolha é `md-to-pdf`, wrapper sobre Puppeteer. Justificativa:

- O framework já depende de Node (Mission Control). Sem runtime novo.
- Markdown como formato de entrada combina com o estilo do framework.
- Suporte a CSS moderno, fontes custom, gradientes, SVG — qualquer coisa que o Chrome renderiza.
- Cross-platform (Mac, Linux, Windows).
- Custo: ~200 MB de disco no primeiro `npm install` (Chromium baixado pelo Puppeteer). Sem dependências de sistema.

Descartados: WeasyPrint (instalação frágil em Windows), wkhtmltopdf (pouco mantido, CSS limitado), pandoc+LaTeX (visual acadêmico, install pesado).

### 3. Skills compartilhadas do framework — nova categoria

Esta entrega introduz formalmente o conceito de **skill compartilhada do framework** (já registrado em `.dev/CLAUDE.dev.md`, `.dev/templates/criar-skill.md` e `.dev/templates/convencoes-framework.md`).

- **Skill de processo** — `{processo}/skills/skill-{nome}.md` — conhece o domínio do processo. Não reutilizável.
- **Skill compartilhada** — `.skills/skill-{nome}.md` — domain-agnostic. Qualquer processo pode invocar.

A pasta `.skills/` segue a convenção dot-prefix de infraestrutura do framework (`.dev/`, `.mission-control/`, `.claude/`) e é excluída pelo Orquestrador no comando `/processos`.

### 4. Divisão de skills

| Skill | Tipo | Responsabilidade |
|---|---|---|
| `skill-renderizar-pdf` | **compartilhada** (`.skills/`) | Recebe markdown + nome do template + variáveis visuais. Devolve caminho do PDF gerado. Domain-agnostic. |
| `skill-redacao-relatorio-concorrentes` | processo Promoção | Recebe `relatorio_concorrentes` da `skill-pesquisa-concorrente`. Produz markdown narrativo bem redigido. |
| `skill-redacao-resumo-promocao` | processo Promoção | Recebe outputs do `agente-analista` e do `agente-criativo`. Produz markdown narrativo bem redigido. |
| `skill-distribuicao` | processo Promoção (existente, **adaptada**) | Ganha suporte a anexo PDF (base64 no payload) e **fallback local quando o webhook do n8n não está configurado** (abre PDF no visualizador padrão do sistema; imprime texto só-texto no stdout). Mantém o caminho só-texto para casos sem PDF. |

A redação fica process-specific porque escrever bem sobre concorrentes ou promoção exige conhecimento de domínio (o que é "alta confiança", "produto recomendado com score X", "cross-selling"). Renderização é puro "markdown + template → PDF", domínio agnóstico.

## Estrutura de arquivos

### Skills compartilhadas

```
.skills/
├── skill-renderizar-pdf.md
└── _lib/
    └── pdf-renderer/
        ├── package.json              ← dependências (md-to-pdf)
        ├── render.mjs                ← script wrapper (~30 linhas)
        ├── templates/
        │   └── report-default.html   ← template estrutural genérico (capa, header, footer, paginação)
        └── styles/
            └── default.css           ← CSS padrão sóbrio, com variáveis CSS no topo
```

**Importante — domain-agnostic estrito:** os templates e CSS dentro de `.skills/_lib/pdf-renderer/` têm nomes e conteúdo **genéricos**. Não há `relatorio-concorrentes.html` nem `resumo-promocao.html` aqui — esses nomes seriam vocabulário de domínio e violariam a regra de skills compartilhadas. O template estrutural conhece apenas conceitos genéricos: capa, título, header, footer, seções, tabelas, paginação. O conteúdo específico de cada relatório vem como **markdown** produzido pelas skills de redação do processo, e é injetado no template em tempo de geração.

`node_modules/` entra no `.gitignore`.

### Skills de processo (Promoção)

```
promocao/skills/
├── skill-redacao-relatorio-concorrentes.md   ← novo
├── skill-redacao-resumo-promocao.md          ← novo
└── skill-distribuicao.md                     ← adaptado
```

### Outputs gerados

```
promocao/outputs/
├── {YYYY-MM-DD}_relatorio-concorrentes.md    ← markdown (artefato textual)
├── {YYYY-MM-DD}_relatorio-concorrentes.pdf   ← PDF gerado
├── {YYYY-MM-DD}_resumo-promocao.md
└── {YYYY-MM-DD}_resumo-promocao.pdf
```

Tanto o markdown quanto o PDF ficam em `outputs/`. O markdown é o artefato textual reusável; o PDF é o produto final entregue.

## Reorganização do `agente-execucao` (Fase 3)

A Fase 3 cresce de 4 para 6 etapas:

| # | Etapa | Status | Skills invocadas |
|---|---|---|---|
| 1 | Carregar promoções ativas | (existente) | — |
| 2 | Checklist de loja | (existente, `disabled`) | — |
| 3 | **Preparar e distribuir relatório de concorrentes** | **nova** | `skill-redacao-relatorio-concorrentes` → `skill-renderizar-pdf` → `skill-distribuicao` (com PDF, destinatário: equipe comercial) |
| 4 | **Preparar e distribuir resumo da promoção** | **nova** | `skill-redacao-resumo-promocao` → `skill-renderizar-pdf` → `skill-distribuicao` (com PDF, destinatário: gerentes) |
| 5 | Distribuir confirmação de publicação | adaptada da etapa 3 antiga | `skill-distribuicao` (só texto, destinatário: marketing) |
| 6 | Consolidar e gravar status final | (existente) | — |

Etapas 3 e 4 ficam separadas (em vez de fundidas em "distribuir tudo") porque vão para públicos diferentes, podem falhar independentemente, e o Mission Control fica mais claro sobre qual passo travou se algo der errado.

## Estrutura dos relatórios

### Relatório de Concorrentes (PDF)

**Público:** equipe comercial. Eles querem decisões: precificação, posicionamento, reação.

| Seção | Conteúdo | Origem dos dados |
|---|---|---|
| Capa | Título, data da análise, perfis monitorados, resumo executivo (2-3 frases) | `data_analise`, `concorrentes[].perfil`, redação |
| Resumo Executivo | 1 parágrafo destacando os 3-5 achados mais relevantes | Redação |
| Panorama por Concorrente | Para cada concorrente: username, posts analisados, tabela de promoções (produto, marca, variação, preço, prazo, link), observações qualitativas | `concorrentes[]` |
| Comparativo Consolidado | Tabela cruzada produto × concorrentes × preço, com destaque para sobreposições (potencial guerra de preço) | `comparativo[]` |
| Conclusões e Recomendações | Categorias mais promovidas, faixas de preço, oportunidades, ameaças, sugestões de ação | Redação |
| Notas de Confiança | Contagem de extrações por nível (alta/média/baixa). Aviso de validação humana para "baixa" | `confianca` |
| Rodapé | Data, processo, lista de perfis com link público | Constantes |

**Tom:** consultor comercial reportando para um diretor — direto, com números, com posição. Não é descrição neutra; é interpretação.

**Fora intencionalmente:** posts sem promoção (só a contagem aparece), capturas das imagens dos posts, dados brutos da Meta API (vivem no `.json` em `outputs/` para auditoria).

### Resumo da Promoção (PDF)

**Público:** gerentes de loja. Eles precisam **agir**.

**Timing:** gerado em Fase 3 depois que o analista e o criativo já rodaram. Quando o gerente recebe, a peça já foi publicada.

| Seção | Conteúdo | Origem dos dados |
|---|---|---|
| Capa | Título "Promoção da Semana — {período}", número de SKUs, perfil da loja, data | `analista` + constantes |
| Resumo Executivo | 1 parágrafo: o que está sendo promovido, razão estratégica, expectativa | Redação |
| Justificativa Estratégica | O **porquê**: oportunidades (estoque em pico, sazonalidade, margem), competitividade, sinergia com cross-selling | `analista.justificativa`, `score`, `panorama_concorrentes` |
| Produtos Promovidos | Para cada SKU: nome, marca, variação, preço normal, preço promocional, % desconto, prazo, justificativa específica, score | `analista.produtos_recomendados[]` |
| Cross-selling Sugerido | Para cada produto-âncora, itens correlacionados a puxar para a frente da loja | `analista.sugestoes_cross_selling[]` |
| Comunicação Programada | Cronograma das peças: o que foi publicado, canal, quando, link clicável | `criativo.publicacoes[]` |
| Ações Operacionais | Checklist do que o gerente precisa fazer: ajustar preço no PDV, exposição, briefing da equipe, monitorar ruptura | Redação heurística + constantes do processo |
| Rodapé | Data, processo | Constantes |

**Tom:** gerente sênior de operações falando com outro gerente. Linguagem do varejo. Direto, com o porquê embutido.

**Fora intencionalmente:** briefings completos das peças, dados brutos do analista, métricas a acompanhar (ficam para v2).

## Tratamento visual do PDF

### Princípio

Template HTML fixo + CSS sobrescrevível por loja. CSS default sóbrio mas profissional, com identidade visual já minimamente curada. Lojas que se importam customizam via override sem mexer no framework.

### CSS default

- **Paleta:** preto + branco + um único accent color (sugestão: azul escuro) — todas as cores em variáveis CSS no topo do arquivo, então a primeira customização é trocar 4-5 valores.
- **Tipografia:** serif para títulos (autoridade) + sans para corpo (legibilidade). Fontes do sistema, sem dependência de fonte custom para v1.
- **Tabelas:** listras alternadas, bordas leves, alinhamento numérico à direita.
- **Header:** logo da loja à esquerda (se disponível em `config.json → assets_visuais.logo`), título do relatório à direita.
- **Footer:** data de geração + processo + número da página.
- **Capa:** página dedicada com título grande, data, perfil da loja, breve resumo.

### Como o lojista customiza (futuro)

A customização visual deve ser **conversacional** com o Orquestrador, não exigir arquivos editados manualmente. O fluxo é:

1. Lojista pede ao Orquestrador algo como *"quero usar minhas cores no relatório"* ou *"o logo da minha loja está em ~/Pictures/acme.png"*.
2. Orquestrador captura, valida, e registra em `promocao/overrides.md` (sistema de overrides já existente). Exemplo do que vai parar lá:
   ```markdown
   ## Customizações visuais dos relatórios PDF
   - Cor de destaque: #C8102E (vermelho da marca Acme)
   - Logo: /Users/lojista/Pictures/acme-logo.png
   - Fonte de títulos: usar Montserrat se disponível, fallback para serif do sistema
   ```
3. O `agente-execucao`, ao invocar `skill-renderizar-pdf`, lê o `overrides.md` (já é responsabilidade dele por padrão — ver contrato de overrides registrado em `.dev/CLAUDE.dev.md`), traduz as customizações em um objeto estruturado, e passa para a skill como parâmetro `customizacoes_visuais`.
4. `skill-renderizar-pdf` recebe esse objeto e injeta os valores nas variáveis CSS do template antes de gerar.

A **`skill-renderizar-pdf` permanece domain-agnostic**: ela só sabe o que é "cor de destaque", "logo", "fonte de título" — vocabulário de design genérico, não de supermercado. Quem traduz "minhas cores da Acme" para `cor_destaque: "#C8102E"` é o agente do processo, com base no `overrides.md`.

### Limites do v1

Para v1:
- A geração já lê o `assets_visuais.logo` do `config.json` automaticamente.
- A leitura de customizações visuais do `overrides.md` é estabelecida como contrato no agente, mas o parsing pode ser estruturado simples (não exige NLU sofisticada).
- Lojas sem nenhuma customização recebem o CSS default.

## Transporte ao WhatsApp via webhook n8n

### Decisão: base64 no payload JSON

A `skill-distribuicao` lê o PDF, codifica em base64 e adiciona ao payload existente. O n8n usa nó nativo "Move Binary Data" (base64 → arquivo) e anexa como documento na mensagem WhatsApp.

### Novo formato do payload

```json
{
  "relatorio": {
    "tipo": "relatorio-concorrentes",
    "data": "2026-04-10",
    "conteudo": "Texto da mensagem que acompanha o anexo"
  },
  "destinatarios": [
    { "nome": "João", "whatsapp": "+5585999999999", "loja": "Centro" }
  ],
  "arquivo": {
    "nome": "2026-04-10_relatorio-concorrentes.pdf",
    "mime": "application/pdf",
    "base64": "JVBERi0xLjQK..."
  }
}
```

Quando `arquivo` está presente, o workflow n8n anexa o documento e usa `relatorio.conteudo` como caption. Quando `arquivo` está ausente, comportamento atual (só texto). Compatibilidade preservada para o caso "confirmação de publicação".

### Tamanhos esperados

PDF típico de relatório: 200–500 KB. Em base64: 270–670 KB. Bem dentro do limite de qualquer webhook configurado em n8n.

### Mudanças no workflow n8n

O lojista (ou Leonardo, no caso de teste) precisa atualizar o workflow do n8n para:
1. Detectar a presença de `body.arquivo`.
2. Usar nó "Move Binary Data" para converter `body.arquivo.base64` em binário.
3. Enviar a mensagem WhatsApp com o documento anexado e a caption do `body.relatorio.conteudo`.

Isso fica como **dependência externa** — não faz parte da implementação do framework, mas precisa ser feito antes do teste end-to-end com WhatsApp real.

### Fallback local quando webhook não configurado

Antes de tentar o POST, a `skill-distribuicao` verifica se `webhook_url` está configurado e válido (não vazio, não `"PREENCHER"`). Se não estiver, ativa o fallback local em vez de falhar ou tentar enviar:

- **Caso com anexo PDF:** abre o arquivo no visualizador padrão do sistema, usando o comando apropriado por SO:
  - macOS: `open <arquivo>`
  - Linux: `xdg-open <arquivo>`
  - Windows: `start "" <arquivo>`

  A detecção do SO é feita via `uname` ou `$OSTYPE` no início do script. Cada PDF abre em uma janela própria do visualizador.

- **Caso só-texto** (ex: confirmação de publicação): imprime o conteúdo no stdout do terminal onde o Claude Code está rodando, com cabeçalho indicando destinatário esperado e tipo da comunicação. O lojista vê a mensagem inline na conversa.

- **Mensagem ao operador via report-progress:** a etapa que invocou a skill reporta de forma clara: *"n8n não configurado — abrindo o relatório localmente. Configure `whatsapp.url_distribuicao` para distribuição automática via WhatsApp."*

- **Não-bloqueante:** o fallback é **sucesso**, não erro. A etapa do agente termina como `completed`, não `error`. A intenção é exatamente permitir que o lojista valide o processo end-to-end antes de tocar no n8n.

- **Output da skill no fallback:** o `registro_envio` carrega `webhook_status: null`, `modo: "local"` e o path do arquivo aberto. Auditoria preservada.

**Por que isso importa para o v1:** o fluxo de configuração natural é (1) lojista instala o framework, (2) roda `/promocao` pela primeira vez, (3) vê o resultado em PDF, (4) decide configurar n8n para automatizar a entrega. Sem o fallback, o lojista bate no muro do n8n na primeira execução e perde o "uau" do processo. Com o fallback, a primeira execução já entrega valor visual completo.

## Customização por loja — fluxo end-to-end

Recapitulando como tudo se conecta:

1. Lojista conversa com o Orquestrador: *"quero personalizar os relatórios da promoção com as cores da minha loja e meu logo"*.
2. Orquestrador identifica que é uma customização operacional (não estrutural), pergunta os detalhes que faltam (cores específicas, caminho do logo), e registra em `promocao/overrides.md`.
3. Na próxima execução do processo de Promoção, o `agente-execucao` (que já é obrigado a ler `overrides.md` por padrão do framework) interpreta a seção visual.
4. Ao chamar `skill-renderizar-pdf`, passa as customizações como parâmetro estruturado.
5. `skill-renderizar-pdf` injeta as customizações nas variáveis CSS do template e gera o PDF.

**Nada disso exige o lojista editar arquivo nenhum, conhecer CSS ou interagir com qualquer ferramenta técnica.** É exatamente o tipo de promessa do framework: o Orquestrador é a interface única, conversacional.

## Atualizações no framework já registradas

Para suportar este design, os seguintes arquivos do framework foram atualizados (esta sessão):

- **`.dev/CLAUDE.dev.md`** — estrutura de pastas inclui `.skills/`; hierarquia conceitual atualizada com as duas categorias de skill; seção "Criar uma skill" explicando os dois tipos; regras adicionais.
- **`.dev/templates/criar-skill.md`** — checklist passa a perguntar tipo de skill; mostra paths para ambos os tipos; regras adicionais (domain-agnostic, runtime isolado, bootstrap idempotente).
- **`.dev/templates/convencoes-framework.md`** — nova seção "Skills Compartilhadas do Framework" com tabela, regra de decisão, estrutura padrão, 5 regras adicionais.
- **`CLAUDE.orquestrador.md`** — `.skills/` adicionado à exclusão do `/processos`.

## Compatibilidade e impacto

**Quebra retrocompatibilidade?** Não. O `skill-distribuicao` mantém o caminho só-texto. Cases existentes continuam funcionando. A novidade é o caminho com anexo.

**Impacto em outros processos:** nenhum. Compras, gestão de estoque etc. continuam intactos. Mas ganham, gratuitamente, acesso à `skill-renderizar-pdf` quando precisarem de relatórios próprios.

**Impacto no Mission Control:** as 2 etapas novas no `agente-execucao` aparecem normalmente como `started`/`running`/`completed` via `report-progress.sh`. Sem nenhum tratamento especial.

## Próximos passos

Este design vai virar um plano de implementação detalhado (próximo passo do brainstorming) cobrindo:

1. Bootstrap da infraestrutura: criar `.skills/_lib/pdf-renderer/`, instalar `md-to-pdf`, escrever o `render.mjs`, definir o template HTML genérico (`report-default.html`) e o CSS default (`default.css`) com variáveis CSS no topo.
2. Criar `.skills/skill-renderizar-pdf.md` (definição declarativa).
3. Criar `promocao/skills/skill-redacao-relatorio-concorrentes.md`.
4. Criar `promocao/skills/skill-redacao-resumo-promocao.md`.
5. Adaptar `promocao/skills/skill-distribuicao.md` para suportar (a) anexo PDF via base64 no payload, (b) **fallback local quando o webhook n8n não estiver configurado** (abre PDF via `open`/`xdg-open`/`start` conforme SO; imprime texto só-texto no stdout), e (c) caminho só-texto preservado para casos sem PDF.
6. Reescrever o `agente-execucao` com as 6 etapas novas, incluindo as chamadas a report-progress correspondentes.
7. Atualizar `promocao/CLAUDE.md` (Fase 3 expandida).
8. Criar fixtures de teste para os novos relatórios.
9. Teste sandbox end-to-end.

**Dependência externa (fora do escopo do framework):** atualizar o workflow n8n para tratar `body.arquivo` e anexar como documento WhatsApp. Leonardo é responsável.
