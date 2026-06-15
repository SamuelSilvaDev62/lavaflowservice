# Plano — Assinaturas vendáveis no LavaFlow

## 1. Banco de dados (migration única)

**`planos_assinatura`** — adicionar:
- `slug TEXT UNIQUE` (gerado a partir de owner+nome, ex: `lava-xxx-mensal-basico`)
- `descricao TEXT`
- `chave_pix TEXT` (opcional, para mostrar no checkout)

**`assinaturas_clientes`** — adicionar:
- novo valor no enum `assinatura_status`: `pendente` (já existe `ativa`, `cancelada`, `expirada`)
- `created_at TIMESTAMPTZ DEFAULT now()`
- `observacoes TEXT`
- `veiculo_id UUID` (opcional, FK)
- `metodo_pagamento TEXT` default `pix`
- `pago_em TIMESTAMPTZ`
- `gateway_ref TEXT` (preparado para futuro webhook)

**RPCs públicas (SECURITY DEFINER, para `/plano/{slug}` sem login):**
- `get_plano_by_slug(_slug)` → retorna plano + dados da empresa (nome, whatsapp, logo)
- `criar_assinatura_pendente(_slug, _nome, _telefone, _veiculo, _placa, _obs)` → cria/reaproveita cliente + veículo + assinatura status `pendente`, retorna id

GRANT EXECUTE para `anon, authenticated` apenas nessas duas funções.

## 2. Página pública `/plano/$slug`

Nova rota top-level (não em `_authenticated`). Mostra:
- Header com logo/nome da empresa
- Card do plano: nome, preço grande, X lavagens/mês, lista de benefícios, descrição
- Botão **"Assinar agora"** → abre dialog com formulário (nome, telefone, veículo, placa, observações)
- Submit chama `criar_assinatura_pendente` via serverFn pública → mostra tela de confirmação com:
  - Instruções de pagamento PIX (chave do dono)
  - Botão "Avisar pagamento no WhatsApp" (link `wa.me` para o dono com mensagem pré-pronta)
- `head()` com og:title/description do plano para compartilhamento

## 3. Tela de planos (`/assinaturas`)

Em cada card de plano adicionar:
- Botão **"Copiar link"** (`{origin}/plano/{slug}`)
- Botão **"Compartilhar WhatsApp"** — mensagem pronta: "Conheça nosso plano *{nome}* por {valor}/mês — {link}"
- Botão **"QR Code"** — modal com QR gerado client-side (lib `qrcode` ou data-uri via API)

Nova aba/seção **"Pendentes"** listando assinaturas com status `pendente`:
- Nome cliente, plano, telefone, criado há X
- Botões: **"Confirmar pagamento"** (vira `ativa`, define `pago_em`, `proxima_cobranca = today + 30d`) e **"Cancelar"**

## 4. Dashboard

Adicionar no card de receita recorrente / nova linha:
- Assinantes ativos (já existe)
- **Assinaturas pendentes** (novo, com link para aba pendentes) — destaque se >0
- MRR (já existe)
- **Próximas cobranças (7 dias)** — lista compacta: cliente, plano, data

ServerFn `getAssinaturas` ampliada para retornar `pendentes[]` e `proximasCobrancas[]`.

## 5. Estrutura para gateway futuro

- Campo `gateway_ref` já adicionado
- ServerFn `confirmarPagamento(id, { metodo, gateway_ref? })` centraliza a ativação — mesmo endpoint poderá ser chamado por webhook futuro em `/api/public/webhooks/pagamento`
- Não implementar gateway agora; apenas deixar o ponto de extensão documentado em comentário

## 6. Arquivos

**Novos**
- `supabase/migrations/<ts>_assinaturas_publicas.sql`
- `src/routes/plano.$slug.tsx`
- `src/components/qr-code-dialog.tsx`

**Editados**
- `src/lib/lavaflow.functions.ts` — `getPlanoPublico`, `criarAssinaturaPendente`, `confirmarPagamento`, `cancelarAssinatura`, ampliar `getAssinaturas`
- `src/routes/_authenticated/assinaturas.tsx` — botões compartilhar/QR, aba pendentes
- `src/routes/_authenticated/dashboard.tsx` — pendentes + próximas cobranças
- `src/lib/whatsapp.ts` — helper `linkAssinatura(plano, origin)`

## Perguntas (antes de implementar)

1. **Slug do plano**: gerar automaticamente (`{empresa-slug}-{nome-plano}`) ou deixar o dono editar?
2. **PIX**: incluir campo "chave PIX" no plano (ou na empresa) para já mostrar na página pública, ou só mostrar "combine pagamento pelo WhatsApp" no MVP?
