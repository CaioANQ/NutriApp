# Revisão de Segurança e LGPD

Data da revisão: 2026-04-23.

## Referências Oficiais

- LGPD, Lei 13.709/2018, texto compilado no Planalto: dados de saúde são dados pessoais sensíveis no art. 5º, II; direitos do titular no art. 18; registro das operações no art. 37; encarregado no art. 41; medidas de segurança no art. 46.
- ANPD, Guia Orientativo sobre Segurança da Informação para Agentes de Tratamento de Pequeno Porte: recomenda medidas administrativas e técnicas de segurança e checklist de proteção.

## Falhas Encontradas no Export

1. Chamadas diretas à Anthropic no navegador.
2. `nutriapp-admin.html` incentivava inserir API key no browser e usava `anthropic-dangerous-direct-browser-access`.
3. Login demo era validado no JavaScript público do MVP web.
4. Não havia servidor com headers de segurança, rate limit, validação de origem ou rotas públicas de governança LGPD.

## Correções Implementadas

1. Criei `server.mjs` com proxy server-side em `/api/ai/messages`.
2. Removi das cópias servidas os padrões `x-api-key`, `anthropic-dangerous-direct-browser-access` e chamadas diretas para `https://api.anthropic.com`.
3. Mudei o login do MVP web para validar em `/api/auth/login`, com rate limit e lockout gradual.
4. Adicionei CSP e headers de segurança compatíveis com os HTMLs exportados.
5. Adicionei rotas `/.well-known/dpo`, `/.well-known/security.txt`, `/api/lgpd/my-data` e `/api/lgpd/consents`.
6. Adicionei `scripts/security-check.mjs` para impedir regressão de chaves ou chamadas de IA no frontend servido.
7. Migrei o proxy server-side de IA para a OpenAI Responses API, usando `OPENAI_API_KEY` apenas no servidor.
8. Adaptei o deploy da Vercel com `vercel.json` e funções serverless equivalentes para login, IA, DPO, security.txt, health check e rotas LGPD.

## Limites Deliberados

Os HTMLs usam scripts inline e handlers `onclick`. Para preservar 100% o desenho visual e a interatividade exportada, a CSP precisa permitir `'unsafe-inline'`. Em produção, o recomendado é migrar essa UI para React/Next sem handlers inline, usando nonce/hash estrito.

As credenciais de demonstração continuam existindo para apresentação local, mas a autenticação demo é bloqueada em produção salvo `ENABLE_DEMO_AUTH=true`. Não use estes usuários com dados reais.

Na Vercel, o rate limit em memória é uma proteção de borda demonstrativa e pode variar por instância serverless. Para produção real, use Redis/Upstash/KV ou WAF gerenciado para limite global consistente.

## Controles LGPD Relevantes

- Minimização: a versão servida não persiste dados pessoais no servidor.
- Dados sensíveis: a documentação do monorepo mantém a orientação de criptografia AES-256-GCM para dados clínicos e diário.
- Transparência: rota pública do DPO e rota de consentimentos.
- Segurança: headers, rate limit, validação de origem e não exposição de segredos no frontend.
- Direitos do titular: rota demonstrativa `/api/lgpd/my-data` para exportação/declaração de dados armazenados.

## Próximas Camadas para Produção

- Banco PostgreSQL com criptografia de campos sensíveis e rotação de chaves.
- Autenticação real com Argon2id, refresh token hasheado, rotação e detecção de reuso.
- RBAC server-side por nutricionista/paciente.
- Consentimento versionado e aceite destacado para dados de saúde.
- Audit log append-only com hash chain.
- Processo documentado para exclusão, correção, exportação e resposta a incidentes.
