# Backup PostgreSQL para Cloudflare R2

Este backup é independente das imagens. O bucket de media (`R2_BUCKET`) continua só com presells, favicons e avatares. O dump vai para outro bucket, privado, e a API não o executa.

Enquanto as variáveis abaixo não existirem no serviço de backup, o comando termina sem fazer nada e sem falhar.

O bucket `dclickora-pg-backups` já existe: privado, classe Standard, localização automática na Europa Ocidental, acesso público desligado. O token `clickora-pg-backups` tem Object Read & Write só nesse bucket. As chaves ficam nas variáveis da Railway, não neste ficheiro.

## O que fica guardado

Formato custom do `pg_dump` (`-Fc`). Dá para restaurar a base inteira ou uma tabela com `pg_restore -t`.

O nome é único, em UTC:

`postgres/<base>/<AAAAMMDDTHHMMSSZ>-<execucao>.dump`

Ao lado fica `<ficheiro>.dump.sha256`. Depois do envio, o programa confirma o tamanho e volta a ler o objeto para calcular o SHA-256. Se não bater, a cópia não conta como válida e o sidecar não é gravado.

Retenção por defeito: 14 dias (`BACKUP_RETENTION_DAYS`). Cópias mais antigas saem só se ficar pelo menos uma cópia válida. Um objeto de media nunca entra nesta limpeza.

Um cadeado `postgres/_lock` impede duas execuções ao mesmo tempo. Se outra ainda estiver dentro do prazo (`BACKUP_LOCK_TTL_MS`, 3 horas), a nova sai sem erro.

## Espaço

O `pg_dump` escreve um ficheiro temporário e apaga-o no fim. Não escreve no volume do Postgres. É preciso espaço livre no contentor de backup para um dump de cada vez.

Por defeito o dump aborta acima de 2 GiB (`BACKUP_MAX_BYTES`) e nem começa se houver menos de 512 MiB livres (`BACKUP_MIN_FREE_BYTES`). O processo é morto se o ficheiro passar o teto.

O R2 não é ilimitado nem gratuito. Conta armazenamento (cerca de 0,015 USD por GB-mês na classe standard) e operações. Um dump de 200 MB por dia, durante 14 dias, fica à volta de 3 GB. Não há URL pública: o bucket de backup não deve ter domínio `r2.dev`.

## Variáveis

Só no serviço de backup, não no serviço da API. Token R2 com leitura e escrita **apenas** nesse bucket.

| Variável | Função |
| --- | --- |
| `BACKUP_DATABASE_URL` | Ligação de leitura à base. Pode ser a mesma origem, com um utilizador que só tenha permissão de leitura. |
| `BACKUP_R2_ACCOUNT_ID` | Conta Cloudflare. |
| `BACKUP_R2_ACCESS_KEY_ID` | Chave do token limitado ao bucket de backup. |
| `BACKUP_R2_SECRET_ACCESS_KEY` | Segredo desse token. |
| `BACKUP_R2_BUCKET` | Bucket privado, diferente de `R2_BUCKET`. |
| `BACKUP_RETENTION_DAYS` | Dias a manter. Defeito 14. |
| `BACKUP_MAX_BYTES` | Teto do ficheiro temporário. |
| `BACKUP_MIN_FREE_BYTES` | Espaço livre mínimo antes de começar. |
| `BACKUP_ALERT_WEBHOOK_URL` | Opcional. Recebe só `ok`, `backup_id`, `duration_ms` e `error_code`. |
| `BACKUP_PG_DUMP_BIN` | Opcional. Tem de ser `pg_dump` 16 ou mais recente, igual ou acima do servidor. |

O `pg_dump` desta máquina de desenvolvimento é o 14 e não chega para o servidor. A imagem do Postgres na Railway é `postgres-ssl:18`, por isso `backend/Dockerfile.backup` instala o cliente 18. Um cliente mais antigo recusa o dump.

Sem `BACKUP_ALERT_WEBHOOK_URL`, o resultado sai numa linha JSON no stdout (`alert: unconfigured`). Não há outro aviso. Uma falha termina com código 1 nesse serviço e não reinicia a API.

## Serviço na Railway

O bucket e o token já estão criados. Falta um serviço à parte da API:

1. Imagem `backend/Dockerfile.backup`, uma réplica, cron `15 3 * * *`.
2. Variáveis `BACKUP_*` só nesse serviço. `BACKUP_R2_BUCKET` tem de ser `dclickora-pg-backups`, nunca o bucket das imagens.
3. `BACKUP_DATABASE_URL` aponta para a base por referência do serviço Postgres, sem copiar a senha para outro sítio.

## Restauro numa base isolada

Não uses a URL da Railway. O script recusa hosts `rlwy.net` e `railway.app`, e também recusa restaurar para a mesma URL de origem.

```bash
# descarrega o .dump e o .dump.sha256 para um disco local
RESTORE_DATABASE_URL='postgresql://postgres:e2e@127.0.0.1:55434/clickora_restore' \
BACKUP_FILE=./backup.dump \
RESTORE_EXPECT_TABLES=users,plans,presell_pages,subscriptions \
BACKUP_PG_RESTORE_BIN=pg_restore \
npx tsx scripts/postgres-restore-from-r2.ts
```

O `pg_restore` tem de ser da versão 18 ou superior, a mesma linha do servidor. O script confirma o SHA-256, recusa um ficheiro que não comece por `PGDMP` e, no fim, verifica se as tabelas esperadas existem.

Perante corrupção ou apagão do Postgres: cria uma instância nova vazia, aponta `RESTORE_DATABASE_URL` para ela e corre o restauro do dump mais recente cujo sidecar coincida. A base antiga não é alterada por este comando. Compara o SHA-256 impresso com o ficheiro `.dump.sha256`.

Um restauro só conta como provado quando este fluxo corre, com sucesso, contra uma base que não é a de produção.
