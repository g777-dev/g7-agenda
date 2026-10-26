-- =====================================================================
-- G7 Agenda de Gravações — estrutura do banco de dados (Supabase)
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo
-- inteiro > Run. Rode uma única vez, em um projeto novo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

create type public.app_role as enum ('admin', 'cliente');

-- Pessoas da equipe (admins). Quem está aqui vira admin ao criar a senha.
create table public.equipe (
  email      text primary key check (email = lower(email)),
  nome       text not null,
  created_at timestamptz not null default now()
);

-- Papéis de cada usuário (separado do perfil, por segurança)
create table public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);

create table public.clientes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete set null,
  nome_contato    text not null,
  empresa         text not null,
  email           text not null unique check (email = lower(email)),
  whatsapp        text,
  tipo            text not null default 'novo' check (tipo in ('novo', 'recorrente')),
  data_onboarding date,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Bloqueios de agenda. periodo nulo = dia inteiro bloqueado.
create table public.bloqueios (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  periodo    text check (periodo in ('manha', 'tarde')),
  motivo     text not null,
  created_at timestamptz not null default now()
);

create table public.gravacoes (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.clientes(id) on delete cascade,
  data                date not null,
  periodo             text not null check (periodo in ('manha', 'tarde')),
  local_tipo          text not null default 'estudio' check (local_tipo in ('estudio', 'cliente')),
  endereco            text,
  observacoes         text,
  status              text not null default 'confirmada' check (status in ('confirmada', 'realizada', 'cancelada')),
  motivo_cancelamento text,
  ultima_alteracao    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- No máximo UMA gravação confirmada (ou realizada) por slot
create unique index gravacoes_um_por_slot
  on public.gravacoes (data, periodo)
  where status in ('confirmada', 'realizada');

create table public.solicitacoes (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  opcao1_data      date not null,
  opcao1_periodo   text not null check (opcao1_periodo in ('manha', 'tarde')),
  opcao2_data      date not null,
  opcao2_periodo   text not null check (opcao2_periodo in ('manha', 'tarde')),
  local_tipo       text not null default 'estudio' check (local_tipo in ('estudio', 'cliente')),
  endereco         text,
  observacoes      text,
  status           text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'cancelada')),
  motivo_recusa    text,
  gravacao_id      uuid references public.gravacoes(id) on delete set null,
  ultima_alteracao text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Cada cliente só pode ter 1 solicitação pendente por vez
create unique index solicitacoes_uma_pendente
  on public.solicitacoes (cliente_id)
  where status = 'pendente';

-- Pedidos de cancelamento ou remarcação feitos pelo cliente
create table public.pedidos_alteracao (
  id            uuid primary key default gen_random_uuid(),
  gravacao_id   uuid not null references public.gravacoes(id) on delete cascade,
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  tipo          text not null check (tipo in ('cancelamento', 'remarcacao')),
  motivo        text not null,
  status        text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  resolvido_por text,
  resolvido_em  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.configuracoes (
  id              int primary key default 1 check (id = 1),
  whatsapp_equipe text
);

insert into public.configuracoes (id) values (1);

-- Primeiro admin do sistema
insert into public.equipe (email, nome) values ('solucoesdigitaisg7@gmail.com', 'G7 Soluções Digitais');


-- ---------------------------------------------------------------------
-- 2. Papéis e usuário atual
-- ---------------------------------------------------------------------

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.exigir_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode fazer isso.';
  end if;
end $$;

create or replace function public.nome_usuario_atual()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nome from public.equipe where email = lower(auth.jwt() ->> 'email')),
    auth.jwt() ->> 'email',
    'Equipe'
  )
$$;

-- Texto de auditoria, ex.: "Remarcado por Maria Eduarda em 26/10/2026 às 14:32"
create or replace function public.assinatura(acao text)
returns text language sql stable security definer set search_path = public as $$
  select acao || ' por ' || public.nome_usuario_atual() || ' em '
         || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
$$;


-- ---------------------------------------------------------------------
-- 3. Datas, feriados e slots
-- ---------------------------------------------------------------------

create or replace function public.hoje_br()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
create or replace function public.pascoa(ano int)
returns date language plpgsql immutable as $$
declare
  a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  a := ano % 19;  b := ano / 100;  c := ano % 100;
  d := b / 4;     e := b % 4;      f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;     k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  return make_date(ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end $$;

-- Feriados nacionais: fixos + Carnaval (seg e ter), Sexta-feira Santa e Corpus Christi
create or replace function public.is_feriado(d date)
returns boolean language plpgsql immutable as $$
declare
  p date := public.pascoa(extract(year from d)::int);
begin
  return to_char(d, 'MM-DD') in ('01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25')
      or d in (p - 48, p - 47, p - 2, p + 60);
end $$;

-- Dia útil = segunda a sexta, sem feriado e sem bloqueio de dia inteiro
create or replace function public.is_dia_util(d date)
returns boolean language sql stable security definer set search_path = public as $$
  select extract(isodow from d) < 6
     and not public.is_feriado(d)
     and not exists (select 1 from public.bloqueios b where b.data = d and b.periodo is null)
$$;

create or replace function public.slot_existe(d date, p text)
returns boolean language sql stable security definer set search_path = public as $$
  select p in ('manha', 'tarde')
     and public.is_dia_util(d)
     and not exists (select 1 from public.bloqueios b where b.data = d and b.periodo = p)
$$;

-- N-ésimo dia útil depois de d0 (d0 é o dia 0)
create or replace function public.dia_util_n(d0 date, n int)
returns date language plpgsql stable security definer set search_path = public as $$
declare
  d date := d0;
  c int := 0;
begin
  while c < n and d < d0 + 400 loop
    d := d + 1;
    if public.is_dia_util(d) then c := c + 1; end if;
  end loop;
  return d;
end $$;

-- Início do slot no horário de Brasília (manhã 09:00, tarde 14:00)
create or replace function public.inicio_slot(d date, p text)
returns timestamptz language sql stable as $$
  select (d + case when p = 'manha' then time '09:00' else time '14:00' end) at time zone 'America/Sao_Paulo'
$$;

create or replace function public.slot_ocupado(d date, p text, ignorar uuid default null)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.gravacoes
   where data = d and periodo = p and status in ('confirmada', 'realizada')
     and (ignorar is null or id <> ignorar)
   limit 1
$$;

-- Ocupação dos slots para a tela do cliente (sem nomes de outros clientes)
create or replace function public.ocupacao_slots(p_inicio date, p_fim date)
returns table (data date, periodo text, tipo_cliente text, proprio boolean)
language sql stable security definer set search_path = public as $$
  select g.data, g.periodo, c.tipo, coalesce(c.user_id = auth.uid(), false)
    from public.gravacoes g
    join public.clientes c on c.id = g.cliente_id
   where auth.uid() is not null
     and g.status in ('confirmada', 'realizada')
     and g.data between p_inicio and p_fim
$$;


-- ---------------------------------------------------------------------
-- 4. Cadastro de acesso (primeiro acesso)
-- ---------------------------------------------------------------------

-- Verifica, antes do cadastro, se o e-mail foi liberado pela equipe
create or replace function public.email_pode_cadastrar(p_email text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
begin
  if exists (select 1 from auth.users where lower(email) = v_email) then
    return 'ja_cadastrado';
  end if;
  if exists (select 1 from public.equipe where email = v_email)
     or exists (select 1 from public.clientes where email = v_email and ativo) then
    return 'ok';
  end if;
  return 'nao_encontrado';
end $$;

-- Ao criar a conta: equipe vira admin; cliente é ligado ao cadastro; outros são recusados
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
begin
  if exists (select 1 from public.equipe where email = v_email) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  elsif exists (select 1 from public.clientes where email = v_email and ativo) then
    update public.clientes set user_id = new.id where email = v_email;
    insert into public.user_roles (user_id, role) values (new.id, 'cliente') on conflict do nothing;
  else
    raise exception 'E-mail não cadastrado pela equipe.';
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ao adicionar alguém na equipe que já tem conta, vira admin na hora
create or replace function public.equipe_ao_inserir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  select u.id, 'admin' from auth.users u where lower(u.email) = new.email
  on conflict do nothing;
  return new;
end $$;

create trigger equipe_inserida
  after insert on public.equipe
  for each row execute function public.equipe_ao_inserir();

-- Ao remover alguém da equipe, perde o acesso de admin (mantém pelo menos 1 pessoa)
create or replace function public.equipe_ao_remover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.equipe) <= 1 then
    raise exception 'É preciso manter pelo menos uma pessoa na equipe.';
  end if;
  delete from public.user_roles
   where role = 'admin'
     and user_id in (select u.id from auth.users u where lower(u.email) = old.email);
  return old;
end $$;

create trigger equipe_removida
  before delete on public.equipe
  for each row execute function public.equipe_ao_remover();


-- ---------------------------------------------------------------------
-- 5. Ações do cliente
-- ---------------------------------------------------------------------

create or replace function public.validar_opcao_cliente(c public.clientes, d date, p text)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date;
  v_fim date;
begin
  if not public.slot_existe(d, p) then
    raise exception 'O horário de % não está disponível (fim de semana, feriado ou bloqueio).', to_char(d, 'DD/MM');
  end if;
  if d <= public.hoje_br() then
    raise exception 'Escolha datas a partir de amanhã.';
  end if;

  if c.tipo = 'novo' then
    if c.data_onboarding is null then
      raise exception 'Sua data de onboarding ainda não foi cadastrada. Fale com a equipe.';
    end if;
    v_ini := public.dia_util_n(c.data_onboarding, 5);
    v_fim := public.dia_util_n(c.data_onboarding, 7);
    if d < v_ini or d > v_fim then
      raise exception 'Sua gravação precisa ser entre % e %.', to_char(v_ini, 'DD/MM'), to_char(v_fim, 'DD/MM');
    end if;
    -- Pode pedir horário de cliente recorrente (sob consulta), mas não de outro cliente novo
    if exists (
      select 1 from public.gravacoes g join public.clientes x on x.id = g.cliente_id
       where g.data = d and g.periodo = p and g.status in ('confirmada', 'realizada')
         and (x.tipo = 'novo' or g.cliente_id = c.id)
    ) then
      raise exception 'O horário de % não está mais disponível.', to_char(d, 'DD/MM');
    end if;
  else
    if d > public.hoje_br() + 60 then
      raise exception 'Escolha datas dentro dos próximos 60 dias.';
    end if;
    if public.slot_ocupado(d, p) is not null then
      raise exception 'O horário de % não está mais disponível.', to_char(d, 'DD/MM');
    end if;
  end if;
end $$;

create or replace function public.criar_solicitacao(
  p_opcao1_data date, p_opcao1_periodo text,
  p_opcao2_data date, p_opcao2_periodo text,
  p_local_tipo text, p_endereco text, p_observacoes text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.clientes;
  v_id uuid;
begin
  select * into c from public.clientes where user_id = auth.uid() and ativo;
  if not found then
    raise exception 'Cadastro de cliente não encontrado ou inativo. Fale com a equipe.';
  end if;
  if exists (select 1 from public.solicitacoes where cliente_id = c.id and status = 'pendente') then
    raise exception 'Você já tem uma solicitação em análise. Aguarde a resposta ou cancele a atual.';
  end if;
  if p_opcao1_data = p_opcao2_data and p_opcao1_periodo = p_opcao2_periodo then
    raise exception 'A 1ª e a 2ª opção precisam ser horários diferentes.';
  end if;
  if p_local_tipo not in ('estudio', 'cliente') then
    raise exception 'Local inválido.';
  end if;
  if p_local_tipo = 'cliente' and coalesce(trim(p_endereco), '') = '' then
    raise exception 'Informe o endereço da gravação.';
  end if;

  perform public.validar_opcao_cliente(c, p_opcao1_data, p_opcao1_periodo);
  perform public.validar_opcao_cliente(c, p_opcao2_data, p_opcao2_periodo);

  insert into public.solicitacoes (
    cliente_id, opcao1_data, opcao1_periodo, opcao2_data, opcao2_periodo,
    local_tipo, endereco, observacoes
  ) values (
    c.id, p_opcao1_data, p_opcao1_periodo, p_opcao2_data, p_opcao2_periodo,
    p_local_tipo, nullif(trim(p_endereco), ''), nullif(trim(p_observacoes), '')
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.cancelar_solicitacao(p_solicitacao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.solicitacoes s
     set status = 'cancelada', ultima_alteracao = 'Cancelada pelo cliente', updated_at = now()
   where s.id = p_solicitacao_id
     and s.status = 'pendente'
     and s.cliente_id in (select id from public.clientes where user_id = auth.uid());
  if not found then
    raise exception 'Esta solicitação não pode mais ser cancelada.';
  end if;
end $$;

-- Pedido de cancelamento/remarcação: só até 48 horas antes do início do slot
create or replace function public.pedir_alteracao(p_gravacao_id uuid, p_tipo text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.gravacoes;
begin
  select g2.* into g from public.gravacoes g2
    join public.clientes c on c.id = g2.cliente_id
   where g2.id = p_gravacao_id and c.user_id = auth.uid();
  if not found or g.status <> 'confirmada' then
    raise exception 'Gravação não encontrada.';
  end if;
  if p_tipo not in ('cancelamento', 'remarcacao') then
    raise exception 'Tipo de pedido inválido.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Conte o motivo do pedido.';
  end if;
  if now() > public.inicio_slot(g.data, g.periodo) - interval '48 hours' then
    raise exception 'O prazo para cancelar ou remarcar pelo sistema terminou. Para qualquer alteração, fale com a equipe.';
  end if;
  if exists (select 1 from public.pedidos_alteracao where gravacao_id = g.id and status = 'pendente') then
    raise exception 'Já existe um pedido em análise para esta gravação.';
  end if;

  insert into public.pedidos_alteracao (gravacao_id, cliente_id, tipo, motivo)
  values (g.id, g.cliente_id, p_tipo, trim(p_motivo));
end $$;


-- ---------------------------------------------------------------------
-- 6. Ações da equipe (sem trava de 48h e sem janela do cliente novo)
-- ---------------------------------------------------------------------

create or replace function public.validar_slot_equipe(d date, p text, ignorar uuid default null)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p not in ('manha', 'tarde') then
    raise exception 'Período inválido.';
  end if;
  if d < public.hoje_br() then
    raise exception 'Não é possível agendar em uma data que já passou.';
  end if;
  if not public.slot_existe(d, p) then
    raise exception 'Esse horário não está na agenda (fim de semana, feriado ou bloqueio).';
  end if;
  if public.slot_ocupado(d, p, ignorar) is not null then
    raise exception 'Esse horário já tem uma gravação confirmada.';
  end if;
end $$;

create or replace function public.resolver_pedidos_da_gravacao(p_gravacao_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.pedidos_alteracao
     set status = 'resolvido', resolvido_por = public.nome_usuario_atual(), resolvido_em = now()
   where gravacao_id = p_gravacao_id and status = 'pendente'
$$;

create or replace function public.aprovar_solicitacao(p_solicitacao_id uuid, p_data date, p_periodo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.solicitacoes;
  v_id uuid;
begin
  perform public.exigir_admin();
  select * into s from public.solicitacoes where id = p_solicitacao_id for update;
  if not found or s.status <> 'pendente' then
    raise exception 'Esta solicitação não está mais pendente.';
  end if;
  perform public.validar_slot_equipe(p_data, p_periodo);

  insert into public.gravacoes (cliente_id, data, periodo, local_tipo, endereco, observacoes, ultima_alteracao)
  values (s.cliente_id, p_data, p_periodo, s.local_tipo, s.endereco, s.observacoes, public.assinatura('Aprovado'))
  returning id into v_id;

  update public.solicitacoes
     set status = 'aprovada', gravacao_id = v_id, ultima_alteracao = public.assinatura('Aprovada'), updated_at = now()
   where id = s.id;

  return v_id;
end $$;

create or replace function public.recusar_solicitacao(p_solicitacao_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da recusa.';
  end if;
  update public.solicitacoes
     set status = 'recusada', motivo_recusa = trim(p_motivo),
         ultima_alteracao = public.assinatura('Recusada'), updated_at = now()
   where id = p_solicitacao_id and status = 'pendente';
  if not found then
    raise exception 'Esta solicitação não está mais pendente.';
  end if;
end $$;

-- Agendar direto para um cliente, sem ele precisar pedir
create or replace function public.agendar_direto(
  p_cliente_id uuid, p_data date, p_periodo text,
  p_local_tipo text, p_endereco text, p_observacoes text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.exigir_admin();
  if not exists (select 1 from public.clientes where id = p_cliente_id and ativo) then
    raise exception 'Cliente não encontrado ou inativo.';
  end if;
  if p_local_tipo not in ('estudio', 'cliente') then
    raise exception 'Local inválido.';
  end if;
  perform public.validar_slot_equipe(p_data, p_periodo);

  insert into public.gravacoes (cliente_id, data, periodo, local_tipo, endereco, observacoes, ultima_alteracao)
  values (p_cliente_id, p_data, p_periodo, p_local_tipo, nullif(trim(p_endereco), ''),
          nullif(trim(p_observacoes), ''), public.assinatura('Agendado'))
  returning id into v_id;

  -- Se o cliente tinha uma solicitação em análise, ela fica resolvida com este agendamento
  update public.solicitacoes
     set status = 'aprovada', gravacao_id = v_id,
         ultima_alteracao = public.assinatura('Agendada pela equipe'), updated_at = now()
   where cliente_id = p_cliente_id and status = 'pendente';

  return v_id;
end $$;

create or replace function public.mover_gravacao(p_gravacao_id uuid, p_data date, p_periodo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  if not exists (select 1 from public.gravacoes where id = p_gravacao_id and status = 'confirmada') then
    raise exception 'Só é possível remarcar gravações confirmadas.';
  end if;
  perform public.validar_slot_equipe(p_data, p_periodo, p_gravacao_id);

  update public.gravacoes
     set data = p_data, periodo = p_periodo,
         ultima_alteracao = public.assinatura('Remarcado'), updated_at = now()
   where id = p_gravacao_id;

  perform public.resolver_pedidos_da_gravacao(p_gravacao_id);
end $$;

-- Troca dois clientes de horário (usado ao arrastar na agenda)
create or replace function public.trocar_gravacoes(p_gravacao_a uuid, p_gravacao_b uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.gravacoes;
  b public.gravacoes;
begin
  perform public.exigir_admin();
  select * into a from public.gravacoes where id = p_gravacao_a for update;
  select * into b from public.gravacoes where id = p_gravacao_b for update;
  if a.id is null or b.id is null or a.status <> 'confirmada' or b.status <> 'confirmada' then
    raise exception 'Só é possível trocar gravações confirmadas.';
  end if;
  if a.data < public.hoje_br() or b.data < public.hoje_br() then
    raise exception 'Não é possível trocar gravações de datas que já passaram.';
  end if;

  -- Libera temporariamente o slot de A para evitar conflito no índice único
  update public.gravacoes set status = 'cancelada' where id = a.id;
  update public.gravacoes
     set data = a.data, periodo = a.periodo,
         ultima_alteracao = public.assinatura('Remarcado'), updated_at = now()
   where id = b.id;
  update public.gravacoes
     set status = 'confirmada', data = b.data, periodo = b.periodo,
         ultima_alteracao = public.assinatura('Remarcado'), updated_at = now()
   where id = a.id;

  perform public.resolver_pedidos_da_gravacao(a.id);
  perform public.resolver_pedidos_da_gravacao(b.id);
end $$;

create or replace function public.cancelar_gravacao(p_gravacao_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  update public.gravacoes
     set status = 'cancelada', motivo_cancelamento = trim(p_motivo),
         ultima_alteracao = public.assinatura('Cancelado'), updated_at = now()
   where id = p_gravacao_id and status = 'confirmada';
  if not found then
    raise exception 'Só é possível cancelar gravações confirmadas.';
  end if;
  perform public.resolver_pedidos_da_gravacao(p_gravacao_id);
end $$;

-- Marca como realizada; a primeira gravação realizada torna o cliente novo em recorrente
create or replace function public.marcar_realizada(p_gravacao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.gravacoes;
begin
  perform public.exigir_admin();
  update public.gravacoes
     set status = 'realizada', ultima_alteracao = public.assinatura('Marcado como realizado'), updated_at = now()
   where id = p_gravacao_id and status = 'confirmada'
  returning * into g;
  if g.id is null then
    raise exception 'Só é possível marcar como realizada uma gravação confirmada.';
  end if;
  update public.clientes set tipo = 'recorrente' where id = g.cliente_id and tipo = 'novo';
  perform public.resolver_pedidos_da_gravacao(g.id);
end $$;

create or replace function public.resolver_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  update public.pedidos_alteracao
     set status = 'resolvido', resolvido_por = public.nome_usuario_atual(), resolvido_em = now()
   where id = p_pedido_id and status = 'pendente';
end $$;


-- ---------------------------------------------------------------------
-- 7. Segurança (Row Level Security)
-- Gravações, solicitações e pedidos só mudam pelas funções acima.
-- ---------------------------------------------------------------------

alter table public.equipe            enable row level security;
alter table public.user_roles        enable row level security;
alter table public.clientes          enable row level security;
alter table public.bloqueios         enable row level security;
alter table public.gravacoes         enable row level security;
alter table public.solicitacoes      enable row level security;
alter table public.pedidos_alteracao enable row level security;
alter table public.configuracoes     enable row level security;

create policy "equipe: admin gerencia" on public.equipe
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "roles: o próprio ou admin" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "clientes: o próprio ou admin" on public.clientes
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "clientes: admin cadastra" on public.clientes
  for insert to authenticated with check (public.is_admin());
create policy "clientes: admin edita" on public.clientes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "clientes: admin exclui" on public.clientes
  for delete to authenticated using (public.is_admin());

create policy "bloqueios: todos leem" on public.bloqueios
  for select to authenticated using (true);
create policy "bloqueios: admin cria" on public.bloqueios
  for insert to authenticated with check (public.is_admin());
create policy "bloqueios: admin remove" on public.bloqueios
  for delete to authenticated using (public.is_admin());

create policy "gravacoes: o próprio ou admin" on public.gravacoes
  for select to authenticated
  using (public.is_admin() or cliente_id in (select id from public.clientes where user_id = auth.uid()));

create policy "solicitacoes: o próprio ou admin" on public.solicitacoes
  for select to authenticated
  using (public.is_admin() or cliente_id in (select id from public.clientes where user_id = auth.uid()));

create policy "pedidos: o próprio ou admin" on public.pedidos_alteracao
  for select to authenticated
  using (public.is_admin() or cliente_id in (select id from public.clientes where user_id = auth.uid()));

create policy "configuracoes: todos leem" on public.configuracoes
  for select to authenticated using (true);
create policy "configuracoes: admin edita" on public.configuracoes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Funções internas não ficam expostas
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.equipe_ao_inserir() from public, anon, authenticated;
revoke execute on function public.equipe_ao_remover() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. Atualização em tempo real (status na tela sem recarregar)
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.solicitacoes, public.gravacoes, public.pedidos_alteracao;
