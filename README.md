# G7 Agenda de Gravações

Sistema de agendamento de gravações da G7 Soluções Digitais. Os clientes pedem horário (1ª e 2ª opção) e a equipe aprova, agenda, remarca e cancela pelo painel.

- Slots: segunda a sexta, Manhã (09:00–12:00) e Tarde (14:00–17:30)
- Cliente novo: só pode pedir entre o 5º e o 7º dia útil depois do onboarding
- Cancelamento/remarcação pelo cliente: até 48 horas antes; depois disso, só falando com a equipe
- Equipe (admins): acesso total, sem as travas de 48h e da janela do cliente novo

Tecnologias: React + TypeScript + Vite + Tailwind, banco e login no Supabase.

---

## 1. Criar o banco no Supabase

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor > New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Rode uma única vez.
3. Vá em **Authentication > URL Configuration**:
   - **Site URL**: o endereço onde o sistema vai ficar no ar (ex.: `https://agenda.suaagencia.com.br`). Para testar no computador, use `http://localhost:5173`.
   - **Redirect URLs**: adicione o mesmo endereço e também `.../redefinir-senha` (ex.: `https://agenda.suaagencia.com.br/redefinir-senha`).
4. (Opcional) Em **Authentication > Providers > Email**, você pode desligar "Confirm email" para o cliente entrar logo após criar a senha. Se deixar ligado, ele recebe um e-mail de confirmação.

O primeiro admin já vem cadastrado: `solucoesdigitaisg7@gmail.com`. Para trocar, edite a linha `insert into public.equipe` no `schema.sql` antes de rodar.

## 2. Configurar as chaves

Copie `.env.example` para `.env` e preencha com os dados de **Supabase > Project Settings > API**:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

O arquivo `.env` não vai para o GitHub (está no `.gitignore`). Na hospedagem, cadastre essas duas variáveis no painel dela.

## 3. Rodar no computador (opcional)

```
npm install
npm run dev
```

Abra http://localhost:5173

## 4. Subir no GitHub

Crie um repositório e envie todos os arquivos desta pasta (sem `node_modules` e sem `.env`).

## 5. Colocar no ar (quando quiser)

Na Vercel: **Add New > Project**, escolha o repositório, cadastre as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e clique em Deploy. A partir daí, toda alteração enviada ao GitHub atualiza o sistema sozinha. O arquivo `vercel.json` já cuida das rotas. (Na Netlify, o arquivo `public/_redirects` faz o mesmo papel.)

---

## Primeiros passos no sistema

1. Entre em **Primeiro acesso** com `solucoesdigitaisg7@gmail.com` e crie a senha.
2. Em **Equipe e ajustes**, adicione a Maria Eduarda (nome e e-mail). Ela entra em **Primeiro acesso** com o e-mail dela e cria a senha. Já entra como admin.
3. Ainda em **Equipe e ajustes**, cadastre o **WhatsApp de contato da equipe** (aparece no botão "Falar com a equipe").
4. Em **Clientes**, cadastre cada cliente (empresa, contato, e-mail, tipo e data do onboarding). Avise o cliente para criar a senha em **Primeiro acesso** com esse mesmo e-mail.
5. Em **Bloqueios**, feche feriados municipais, folgas e dias sem equipamento. Feriados nacionais já são fechados automaticamente.

## Estrutura

```
supabase/schema.sql          banco: tabelas, regras, segurança e funções
src/lib/datas.ts             feriados, dias úteis, janela do cliente novo, prazo de 48h
src/pages/Login.tsx          entrar, primeiro acesso, esqueci minha senha
src/pages/cliente/           tela inicial e pedido de gravação do cliente
src/pages/painel/            solicitações, agenda, clientes, bloqueios, equipe
src/components/painel/       conflito de horário, remarcar/trocar, nova gravação
```

As regras importantes (janela do cliente novo, 48 horas, 1 solicitação pendente, 1 gravação por horário, só a equipe aprova) são validadas no banco, não só na tela.
