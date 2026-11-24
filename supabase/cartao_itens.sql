-- Tabela da aba "Cartões" (financas.html).
-- Rode uma vez no SQL Editor do Supabase. A página insere os itens iniciais
-- das faturas sozinha na primeira vez que encontrar a tabela vazia.
create table if not exists public.cartao_itens (
  id uuid primary key default gen_random_uuid(),
  cartao text not null check (cartao in ('bradesco','c6')),
  tipo text not null check (tipo in ('parcelado','recorrente')),
  descricao text not null,
  valor numeric(10,2) not null,
  parcela_ref int,          -- nº da parcela na fatura de mes_ref
  total_parcelas int,
  mes_ref text,             -- 'YYYY-MM' da fatura de referência
  categoria text,
  observacao text,          -- anotação livre (o que é a compra)
  ativo boolean not null default true,
  created_at timestamptz default now()
);
alter table public.cartao_itens enable row level security;
create policy "anon full access" on public.cartao_itens for all using (true) with check (true);

-- Se a tabela já existir sem a coluna de observação:
alter table public.cartao_itens add column if not exists observacao text;
