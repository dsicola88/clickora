# Imagens e armazenamento (guia simples)

Este guia é para quem gere a **dclickora** (conta Cloudflare + Railway).  
Não precisas de saber programação.

---

## O que isto resolve

Quando alguém coloca uma imagem na app (presell, favicon, avatar, landing), o ficheiro fica guardado na **nuvem da Cloudflare** (R2).  
Assim as imagens **não desaparecem** quando o servidor reinicia ou faz redeploy.

---

## Parte 1 — Criar o sítio das imagens (Cloudflare)

### Passo 1: Entrar no R2

1. Abre [dash.cloudflare.com](https://dash.cloudflare.com)
2. No menu: **R2 Object Storage**
3. Cria um **bucket** (pasta) com um nome simples, por exemplo: `dclickora`  
   → Guarda este nome exactamente como o escreveste.

### Passo 2: Deixar as imagens públicas

1. Abre o bucket → separador **Settings**
2. Em **Public Development URL** → **Enable**
3. Escreve `allow` e confirma
4. Copia o endereço que aparece, tipo:  
   `https://pub-xxxxx.r2.dev`  
   → Isto é o teu **link público** das imagens.

### Passo 3: Criar a chave de acesso

1. Em R2 → **Manage R2 API Tokens** → criar token
2. Nome: `dclickora`
3. Permissão: **Object Read & Write**
4. Aplicar a todos os buckets (ou só ao teu)
5. Validade: Forever (ou o que preferires)
6. Cria e **copia já**:
   - **Access Key ID**
   - **Secret Access Key** (só aparece uma vez)

### Passo 4: Account ID

Na barra de endereço do Cloudflare aparece um código longo (Account ID), por exemplo:  
`8ff7f23069e4b607cec56791bd44360b`  
→ Guarda-o.

---

## Parte 2 — Ligar à API (Railway)

1. Abre o projecto na Railway → serviço da **API** (ex.: `clickora`)
2. **Variables** → adiciona (cola os valores que guardaste):

| Nome da variável | O que coloas |
|------------------|--------------|
| `R2_ACCOUNT_ID` | O Account ID |
| `R2_ACCESS_KEY_ID` | Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |
| `R2_BUCKET` | Nome do bucket (ex. `dclickora`) — **tem de ser exactamente igual** |
| `R2_PUBLIC_URL` | O link `https://pub-….r2.dev` (sem barra no fim) |

3. Guarda
4. Faz **Redeploy** do serviço da API

**Atenção:** o nome do bucket tem de ser o da Cloudflare.  
Se escreveres outro nome (ex. `dclickora-media` quando o bucket é `dclickora`), as imagens **não** gravam.

---

## Parte 3 — Como o utilizador trabalha na app (sem Cloudflare)

Quem usa a dclickora no dia a dia **não precisa** de abrir a Cloudflare.

| O que queres fazer | Onde na app |
|--------------------|-------------|
| Imagem numa presell | Editor da página → **Carregar do PC** |
| Favicon do site | Painel admin / branding |
| Imagem do hero da página de planos | Admin → landing de planos |
| Foto de perfil | Definições da conta → avatar |

Depois do upload, a imagem fica na nuvem. Podes ver o link a começar por `https://pub-….r2.dev/…`.

---

## Checklist rápido (5 minutos)

- [ ] Bucket criado na Cloudflare
- [ ] Public Development URL activado e link copiado
- [ ] Token criado e chaves copiadas
- [ ] 5 variáveis `R2_*` na Railway
- [ ] Nome do bucket igual ao da Cloudflare
- [ ] Redeploy da API
- [ ] Teste: carregar uma imagem numa presell e abrir o link num separador novo

---

## Problemas comuns (sem jargão)

| Sintoma | Causa típica | O que fazer |
|---------|--------------|-------------|
| Upload falha / imagem some após deploy | Variáveis R2 em falta ou bucket errado | Confirmar as 5 variáveis e o nome do bucket |
| Link `pub-…` não abre | Público ainda desligado | Settings do bucket → Enable Public Development URL |
| Imagem antiga sumiu | Estava só no disco do servidor | Voltar a carregar; novas vão para a nuvem |

---

## Notas

- A Cloudflare avisa que `r2.dev` é “development”. Serve bem para começar. Mais tarde podes pôr um domínio teu (ex. `media.dclickora.com`) em **Custom Domains** no bucket e actualizar só `R2_PUBLIC_URL`.
- Dados da app (contas, cliques, textos das páginas) ficam na **base de dados** (Railway Postgres) — isso é outro sítio, não o R2.
- Ficheiros para anúncios Meta/TikTok podem continuar no servidor; o essencial da marca e das presells vai para o R2.
