# NutriApp — Projeto Exportado com Camada Segura

Este diretório contém o projeto importado do pacote exportado e uma versão servida localmente com o design visual preservado. Os HTMLs originais continuam intactos em `../NutriApp_Completo`; as cópias seguras ficam em `public/`.

## Rodar Localmente

Pré-requisito: Node.js 20+.

```bash
cd nutriapp
npm run dev
```

Abra pelo endereço exato:

- `http://127.0.0.1:3000/` — MVP web completo
- `http://127.0.0.1:3000/admin` — painel administrativo standalone
- `http://127.0.0.1:3000/mobile` — mockup mobile
- `http://127.0.0.1:3000/integrado` — versão integrada v3

## Segurança Aplicada

- Proxy server-side para IA em `/api/ai/messages`; a chave `OPENAI_API_KEY` nunca vai para o navegador.
- Bloqueio das chamadas diretas a provedores de IA nas telas servidas.
- Validação de origem para endpoints sensíveis.
- Rate limit global, rate limit específico para IA e lockout gradual no login demo.
- Headers: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Rotas públicas de governança: `/.well-known/security.txt`, `/.well-known/dpo`, `/api/lgpd/my-data`, `/api/lgpd/consents`.
- Auditoria estática com `npm run security:check`.

## IA Consultora

Sem `OPENAI_API_KEY`, a IA retorna uma mensagem local segura. Para habilitar respostas reais, crie um `.env` local:

```bash
cp .env.example .env
# edite .env e preencha OPENAI_API_KEY
npm run dev
```

O arquivo `.env` não deve ser enviado ao GitHub.

## Observação de Produção

Esta entrega preserva o design e a interatividade do protótipo. Para uso real com pacientes, use backend persistente com autenticação forte, banco criptografado, consentimento versionado, logs de auditoria imutáveis e processos formais de atendimento aos direitos do titular.
