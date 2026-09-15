# Clínica Sagrada Esperança

Marque a sua consulta de forma rápida, simples e sem filas.

Aplicação web (e instalável no telemóvel) para marcar e organizar consultas.
Três portas de entrada: **paciente**, **receção/administração** e **médico**.

---

## Abrir

Duplo clique em `abrir.cmd`. Na primeira vez instala as dependências; depois
abre `http://localhost:5180`.

Ou, num terminal:

```bash
npm install
npm run dev
```

### Os dois modos

| | Sem `.env.local` | Com `.env.local` (Supabase) |
|---|---|---|
| Dados | no navegador, gerados para o dia de hoje | na base de dados do projecto |
| Contas | três contas de demonstração no ecrã de entrada | email e palavra-passe |
| Tempo real | entre separadores do mesmo navegador | entre todos os dispositivos |

Para forçar a demonstração com o Supabase configurado: `VITE_MODO=demo` no `.env.local`.

**Para mostrar a clientes:** https://clinica-se.vercel.app/demo liga a demonstração nesse
navegador, mesmo no site publicado. Os dados são fictícios e não saem do navegador; o Supabase
não é tocado. No ecrã de entrada ficam "Repor os dados" (para começar cada apresentação do
zero) e "Sair da demonstração" (volta ao site real).

O site publicado (`npm run build`, Vercel em https://clinica-se.vercel.app) liga-se sempre ao
Supabase da clínica, sem precisar de variáveis de ambiente no alojamento: os valores públicos
estão em `src/lib/dados/configuracao.ts`.

**Demonstração:** paciente Maria Kiala (mãe de dois), receção Teresa Sambo,
médico Dr. João Silva. Abra dois separadores — um como paciente, outro como
receção — e marque no primeiro: a vaga desaparece do segundo sem recarregar.
O botão "Repor os dados de demonstração" está no fundo do Perfil do paciente.

---

## Supabase

O projecto `xhiboteecmbbohmoroli` já tem o esquema, as regras, as permissões e
os dados iniciais (8 especialidades e 9 médicos de demonstração com horário de
segunda a sexta). Os ficheiros estão em `supabase/`:

| Ficheiro | O que faz |
|---|---|
| `migrations/0001_esquema.sql` | tabelas: users, patients, doctors, specialties, appointments, schedules, blocked_slots, notifications, family_members, waitlist, clinic_settings |
| `migrations/0002_regras_de_agenda.sql` | validação de vagas, marcar / reagendar / cancelar, avisos, lembretes 24 h antes, lista de espera, tempo real, criação de perfis |
| `migrations/0003_permissoes.sql` | RLS: cada paciente só vê a família; o médico só a agenda dele; a receção gere a clínica |
| `migrations/0004_ajustes_de_seguranca.sql` | telefone e email dos médicos só para a equipa; pedidos do Security Advisor |
| `seed.sql` | dados iniciais (só numa base vazia) |
| `functions/enviar-lembretes` | envia os lembretes por WhatsApp |
| `functions/convidar-medico` | convida um médico a criar conta |

`npm run test:sql` corre as migrações num Postgres em memória e verifica 38
regras: duas pessoas nunca no mesmo horário, nada no passado nem em horário
bloqueado, quem vê o quê, avisos, lembretes e lista de espera.

### Falta fazer no painel do Supabase

1. **URLs** (feito) — Authentication → URL Configuration: *Site URL*
   `https://clinica-se.vercel.app`; *Redirect URLs* com esse endereço e `http://localhost:5180`.
2. **A sua conta de administração** — crie a conta na aplicação e depois, no
   SQL Editor:
   ```sql
   update users set papel = 'admin' where email = 'o-seu-email@exemplo.com';
   ```
   Para a receção, o mesmo com `papel = 'rececao'`.
3. **Email "Esqueci-me da palavra-passe" em português** — Authentication → Emails →
   *Reset Password*: assunto "Criar uma palavra-passe nova" e o HTML de
   `supabase/emails/repor-palavra-passe.html`. O link leva a `/nova-palavra-passe`,
   que já está autorizado nas Redirect URLs. O serviço de email incluído no Supabase
   só envia poucos emails por hora: para uso real, ligue um SMTP (Authentication →
   Emails → SMTP Settings).
4. **Médicos** — na página Médicos, troque os de demonstração pelos reais,
   ponha o email de cada um e carregue em "Enviar convite" (precisa da função
   `convidar-medico` publicada).

### Funções e lembretes por WhatsApp

```bash
npx supabase functions deploy convidar-medico --project-ref xhiboteecmbbohmoroli
npx supabase functions deploy enviar-lembretes --project-ref xhiboteecmbbohmoroli --no-verify-jwt
npx supabase secrets set --project-ref xhiboteecmbbohmoroli CRON_SECRET=... SITE_URL=https://...
```

Os lembretes aparecem na aplicação sozinhos (24 horas antes; 2 horas antes se
a consulta foi marcada em cima da hora). A cópia por WhatsApp fica guardada em
`notifications` com `canal = 'whatsapp'` até haver conta da WhatsApp Business
API. Quando houver:

1. aprovar na Meta o modelo `lembrete_consulta`:
   *"Lembrete: você tem uma consulta amanhã às {{1}} na {{2}}."*
2. `npx supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=...`
3. agendar a função de 10 em 10 minutos (SQL Editor, extensões `pg_cron` e `pg_net`):
   ```sql
   select cron.schedule('enviar-lembretes', '*/10 * * * *', $$
     select net.http_post(
       url := 'https://xhiboteecmbbohmoroli.supabase.co/functions/v1/enviar-lembretes',
       headers := jsonb_build_object('x-cron-secret', 'o-mesmo-CRON_SECRET')
     )
   $$);
   ```

Os botões "Agendar pelo WhatsApp", "Falar com a clínica" e "Enviar confirmação
pelo WhatsApp" já funcionam hoje, por ligação `wa.me`.

---

## Como está feito

- **React + Vite + TypeScript + Tailwind**, rotas com React Router.
- `src/lib/disponibilidade.ts` — o motor de vagas (funções puras, testadas).
  A mesma regra vive na base de dados, que tem a última palavra: restrições
  `exclude using gist` impedem sobreposições mesmo com pedidos simultâneos.
- `src/lib/dados/repositorio.ts` — o contrato de dados. Duas implementações:
  `demo/loja.ts` (navegador, com as mesmas regras e permissões) e
  `supabase/repositorio.ts`.
- `src/lib/tempo.ts` — Luanda é UTC+1 todo o ano; os instantes guardam-se em UTC.
- Páginas em `src/paginas/{paciente,rececao,medico}`; as da receção e do médico
  carregam à parte, para o telemóvel do paciente abrir depressa.

```bash
npm test          # motor de vagas, regras e permissões (demonstração)
npm run test:sql  # migrações e RLS num Postgres em memória
npm run build     # verificação de tipos e pacote de produção
```

### Identidade

- **Verde-esperança** `#0F5C4A` como única cor forte, sobre branco frio `#F4F7F6`.
- **Atkinson Hyperlegible Next** no texto e nos números (desenhada para quem vê
  mal: distingue 0/O e 1/l nas horas e nos telefones); **Newsreader** nos títulos.
- **A senha**: a próxima consulta aparece como a senha das filas que a aplicação
  substitui, com picotado e a hora em grande. No fim da marcação, sai da ranhura.

Fora desta versão: prontuário, telemedicina, prescrições, internamentos,
laboratório, farmácia e faturação.
