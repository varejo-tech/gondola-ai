# Skill: Publicação

## Propósito

Publicar peças visuais nos canais da loja. No MVP, publica 1 post no feed do Instagram.

## Inputs

- imagem: object — Peça visual finalizada (output da skill-geracao-imagem): arquivo, formato, canal
- briefing_peca: object — Briefing correspondente (output da skill-briefing): legenda, hashtags, cta
- perfil_publicacao: string — ID do perfil Instagram para publicação (lido de `config.json` → `instagram.perfil_publicacao`)
- access_token: string — Token de acesso Meta API (lido de `config.json` → `instagram.access_token`)

## Outputs

- publicacao: object — Registro da publicação:
  - status: string — "publicado" | "erro"
  - post_id: string — ID do post no Instagram
  - permalink: string — URL do post publicado
  - canal: string — "instagram_feed"
  - data_publicacao: string — Timestamp da publicação
  - mensagem_erro: string (opcional) — Mensagem de erro se falhou

## Implementação

### Passos

1. Montar legenda completa:
   - Texto da legenda (do briefing)
   - Hashtags concatenadas
   - CTA no final
2. Fazer upload da imagem para o container do Instagram:
   - Endpoint: `POST /{ig_user_id}/media`
   - Parâmetros: `image_url` ou `image_data`, `caption`, `access_token`
3. Publicar o container:
   - Endpoint: `POST /{ig_user_id}/media_publish`
   - Parâmetros: `creation_id` (do passo anterior), `access_token`
4. Verificar publicação:
   - Endpoint: `GET /{media_id}?fields=id,permalink,timestamp`
5. Retornar `publicacao` com dados do post

### Funcionalidades futuras (pós-MVP)

- Agendamento de stories com intervalos
- Publicação de reels em horário de pico
- Carrossel de encarte (múltiplas imagens)
- Geração de alt-text para acessibilidade
- Localização geográfica no post

### API/MCP

**Endpoint:** Instagram Graph API — `https://graph.facebook.com/v19.0`

**Autenticação:** Bearer token (lido de `config.json` → `instagram.access_token`)

**Chamadas:**

1. Criar container de mídia:
   - `POST /{ig_user_id}/media`
   - Body: `{ "image_url": "...", "caption": "...", "access_token": "..." }`
   - Resposta: `{ "id": "17889455560051444" }`

2. Publicar container:
   - `POST /{ig_user_id}/media_publish`
   - Body: `{ "creation_id": "17889455560051444", "access_token": "..." }`
   - Resposta: `{ "id": "17920238422030506" }`

3. Verificar publicação:
   - `GET /17920238422030506?fields=id,permalink,timestamp&access_token=...`
   - Resposta: `{ "id": "...", "permalink": "https://www.instagram.com/p/...", "timestamp": "..." }`

### Fallback

- Se Meta API indisponível ou token expirado: informar ao operador "Não foi possível publicar no Instagram. Verifique o token de acesso no config.json." Retornar com `status: "erro"` e `mensagem_erro` descritiva.
- Se upload falhar: tentar novamente 1 vez. Se persistir, reportar erro.
- Se publicação falhar mas upload ok: informar ao operador com o `creation_id` para retry manual.
