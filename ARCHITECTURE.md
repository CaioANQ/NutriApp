# NutriApp — Arquitetura Técnica e Segurança

## Por que React + Next.js?

Segundo o Stack Overflow Developer Survey 2025 (49.000+ devs):
- **React**: framework frontend mais popular com **44.7%** de uso
- **Next.js**: meta-framework padrão para React em produção (SSR, roteamento, API Routes)
- **TypeScript**: adotado por 78% dos projetos React em produção para type safety
- **React Native + Expo**: padrão mobile para equipes React (reutiliza lógica, componentes e tipos)

## Stack Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTES (Frontends)                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Web Browser │  Web Browser │  Mobile iOS  │  Mobile iOS    │
│  (Paciente)  │  (Admin)     │  Android     │  Android       │
│  Next.js 14  │  Next.js 14  │  React Native│  React Native  │
│  React 19    │  React 19    │  Expo (Pat.) │  Expo (Admin)  │
│  TypeScript  │  TypeScript  │  TypeScript  │  TypeScript    │
│  Tailwind    │  Tailwind    │              │                │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬────────┘
       │              │              │               │
       └──────────────┴──────────────┴───────────────┘
                              │ HTTPS/TLS 1.3
                    ┌─────────▼─────────┐
                    │   BACKEND API     │
                    │  Node.js 20 LTS   │
                    │  Express 4.x      │
                    │  TypeScript 5     │
                    │  Prisma ORM 5     │
                    └─────┬───────┬─────┘
                          │       │
               ┌──────────▼──┐ ┌──▼──────────┐
               │ PostgreSQL  │ │    Redis     │
               │ 15 (dados)  │ │ 7 (sessões, │
               │             │ │  rate limit)│
               └─────────────┘ └─────────────┘
```

## Separação de Aplicações

| App | URL/Identificador | Usuário | Role |
|-----|------------------|---------|------|
| Web Paciente | `/patient/*` | Paciente | `PATIENT` |
| Web Admin | `/admin/*` | Nutricionista | `ADMIN` |
| Mobile Paciente | `nutriapp-patient` (Expo) | Paciente | `PATIENT` |
| Mobile Admin | `nutriapp-admin` (Expo) | Nutricionista | `ADMIN` |

**Um único backend serve todos os 4 clientes.** O login determina o role e o frontend redireciona automaticamente.

## Fluxo de Autenticação Completo

```
1. Usuário digita e-mail + senha
2. POST /api/v1/auth/login
3. Backend:
   a. Busca usuário por e-mail (constant-time comparison)
   b. Verifica bcrypt hash (custo 12)
   c. Verifica lock de conta (brute force protection)
   d. Gera JWT accessToken (15min, RS256)
   e. Gera refreshToken opaco (7 dias, armazenado no banco)
   f. Retorna accessToken no body + refreshToken em httpOnly cookie
4. Frontend:
   - Web: armazena accessToken em memória (não localStorage!)
   - Mobile: armazena no SecureStore (AES-256 via keychain/keystore)
5. Middleware Next.js lê role do JWT → redireciona para /admin/* ou /patient/*
6. Mobile: verifica role → rejeita se role errado para o app
```

## Segurança — Camadas de Proteção

### Camada 1 — Rede
- TLS 1.3 obrigatório em produção
- HSTS com preload (1 ano)
- Certificado gerenciado via Let's Encrypt / AWS ACM

### Camada 2 — HTTP Headers (Helmet.js)
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Camada 3 — Rate Limiting (Redis)
| Endpoint | Limite | Janela |
|----------|--------|--------|
| Global | 100 req | 15 min/IP |
| POST /auth/login | 5 req | 15 min/IP |
| POST /ai/* | 20 req | 15 min/usuário |

### Camada 4 — Autenticação
- JWT com expiração curta (15min)
- Refresh tokens com rotação (invalidação imediata ao reutilizar)
- JTI (JWT ID) no Redis para revogação imediata
- Lockout após 5 tentativas falhas (30 minutos)
- Timing-safe comparison (previne user enumeration)

### Camada 5 — Autorização (RBAC)
- Middleware `authenticate` → valida JWT em todas as rotas protegidas
- Middleware `authorize('ADMIN')` → bloqueia acesso de PATIENT a rotas admin
- Verificação de posse: paciente só acessa seus próprios dados

### Camada 6 — Validação de Entrada (Zod)
- Todos os body/params/query validados com Zod antes de chegar ao service
- Limite de tamanho: JSON body máximo 10kb
- Sanitização de strings (trim, lowercase para e-mail)

### Camada 7 — Criptografia de Dados Sensíveis (LGPD)
```
Dados criptografados com AES-256-GCM:
├── dateOfBirth (data de nascimento)
├── weightEncrypted (peso atual)
├── heightEncrypted (altura)
├── bodyFatEncrypted (% gordura corporal)
├── notesEncrypted (observações clínicas)
├── textEncrypted (textos do diário)
└── phoneEncrypted (telefone)

Método: AES-256-GCM
├── IV: 16 bytes aleatórios por operação
├── Auth Tag: 16 bytes (garante integridade)
└── Chave: 32 bytes via env var ENCRYPTION_KEY
```

### Camada 8 — Banco de Dados
- Prisma ORM: queries parametrizadas (SQL injection impossível)
- Soft delete: dados nunca excluídos fisicamente (auditoria LGPD)
- Índices otimizados para performance e segurança
- Connection pooling com PgBouncer

### Camada 9 — Auditoria
- Log de todas as ações: LOGIN, DATA_ACCESS, MODIFICATION, DELETION
- Retenção de 12 meses (requisito LGPD)
- IP, User-Agent, timestamp, userId em cada registro
- Imutável: logs não podem ser editados por usuários

## Conformidade LGPD

### Artigos Implementados
| Artigo | Requisito | Implementação |
|--------|-----------|---------------|
| Art. 5° II | Dados sensíveis (saúde) | AES-256-GCM em todos os dados clínicos |
| Art. 7° I | Consentimento explícito | Registro de consentimento no cadastro |
| Art. 8° | Consentimento informado | Tela de aceite com versão dos termos |
| Art. 18° | Direitos do titular | Endpoint de exportação e exclusão |
| Art. 37° | Registro de operações | AuditLog completo |
| Art. 46° | Medidas de segurança | Criptografia, controle de acesso, logs |

### Endpoints LGPD
```
GET  /api/v1/lgpd/my-data          → Exportar todos os dados do usuário (JSON)
DELETE /api/v1/lgpd/my-data        → Solicitar exclusão (process. em até 15 dias)
GET  /api/v1/lgpd/consents          → Ver consentimentos ativos
POST /api/v1/lgpd/consents/revoke  → Revogar consentimento
```

## Comunicação Entre Apps (Dados Compartilhados)

```
Admin cria/edita → [PostgreSQL] ← Paciente lê

Fluxo do Plano:
Admin cria MealPlan ──► meal_plans table ──► Paciente vê no Cardápio

Fluxo do Diário:
Paciente escreve ──► diary_entries table ──► Admin lê no Feedback

Fluxo de Resposta:
Admin responde ──► feedback_messages table ──► Paciente recebe notificação
```

## Setup de Produção Recomendado

```yaml
Infraestrutura:
  - Backend: AWS ECS Fargate ou Railway.app
  - Banco: AWS RDS PostgreSQL Multi-AZ
  - Redis: AWS ElastiCache ou Upstash
  - Web: Vercel (Next.js nativo) ou AWS CloudFront + S3
  - Mobile: Expo EAS Build → Apple TestFlight + Google Play Console

Variáveis de produção obrigatórias:
  - JWT_ACCESS_SECRET: 64 bytes hex
  - JWT_REFRESH_SECRET: 64 bytes hex (diferente do access!)
  - ENCRYPTION_KEY: 32 bytes hex
  - DATABASE_URL: com SSL mode=require
  - OPENAI_API_KEY: server-side apenas
  - OPENAI_MODEL: modelo usado pelo proxy de IA (padrão: gpt-5.4-mini)
```
