
# OneBridge CFO Virtual

Este repositório contém o MVP local-first do CFO da **OneBridge Stalwart LLC**, desenvolvido para registrar lançamentos financeiros, acompanhar meses, emitir invoices locais e preservar fechamentos mensais.

## Current MVP Status

- The app runs entirely **locally in the browser** — no server needed.
- Data is saved in the browser's **`localStorage`**.
- **Regular backup export is recommended** (especially after closing a month or issuing invoices), since clearing browser data also clears local records.
- **No Supabase or remote database is required** at runtime.
- **Invoices and monthly closings persist locally** alongside transactions and configurable options.
- Financial logic is covered by tests — run them with **`npm run test:financial`**.
- The production build runs with **`npm run build`** (currently warning-free).

## Local-first MVP

O app roda localmente no navegador e salva os dados em `localStorage`. Ele não exige Supabase, login, banco remoto, migrations, RLS, SQL Editor ou credenciais administrativas para o MVP atual.

Use o recurso de exportação/importação de backup para preservar o histórico financeiro. Se os dados do navegador forem apagados, os registros locais também podem ser apagados.

Chaves locais usadas pelo app:

- `onebridge_cfo_transactions_v1`
- `onebridge_cfo_configurable_options_v1`
- `onebridge_cfo_period_closings_v1` — fechamentos oficiais **quinzenais** (semi-monthly)
- `onebridge_cfo_monthly_closings_v1` — fechamentos mensais **legados** (preservados, não oficiais)
- `onebridge_cfo_invoices_v1`
- `onebridge_cfo_invoice_sequence_v1`

### Fechamento oficial: quinzenal (semi-monthly)

O fechamento oficial e a lógica de distribuição são **quinzenais**:

- **1ª quinzena (H1):** dia 1 até o dia 15.
- **2ª quinzena (H2):** dia 16 até o último dia do mês (considera meses curtos e anos bissextos).

Cada fechamento gera um snapshot quinzenal (`onebridge_cfo_period_closings_v1`) com chave de período como `2026-05-H1` / `2026-05-H2`. A visão mensal continua disponível apenas como **resumo gerencial** — ela não é o fechamento oficial. Fechamentos mensais antigos são preservados como dados legados e exportados no backup, mas não são usados como fechamento oficial quinzenal.

Recomendação operacional: exporte backups JSON regularmente, especialmente após fechar um mês ou emitir invoices.

As regras financeiras atuais do MVP estão documentadas em [docs/FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md), incluindo os pontos que ainda exigem aprovação formal de negócio.

## Funcionalidades
- **Cálculo Automático**: Distribuição conforme Operating Agreement.
- **Taxas de Originação**: 10% para o sócio originador.
- **Reserva de Capital**: Retenção automática de 12%.
- **Fechamento Quinzenal Oficial**: Fechamentos semi-mensais (H1: 1–15, H2: 16–fim) com snapshots por período; visão mensal mantida como resumo gerencial.
- **Invoices Locais**: Numeração e status persistidos no navegador.
- **Backup JSON**: Exportação/importação de transações, opções, fechamentos e invoices.

## Como usar
1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Execute o app:
   ```bash
   npm run dev
   ```

Variáveis de ambiente de IA/Gemini são opcionais para o MVP financeiro local-first. O app deve abrir e operar sem Supabase.

## Estrutura da Distribuição
- **Evandro (Profiscal)**: 33.34%
- **Julia/Samuel (Elevated)**: 33.33%
- **Walter (Moraes D'Angelo)**: 33.33%
