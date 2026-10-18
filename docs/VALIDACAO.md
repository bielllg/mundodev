# Validação desta entrega

Data: 18 de outubro de 2026.

- `npm run lint`: aprovado.
- `npm test`: 16 testes aprovados, cobrindo regras, contratos de dados e migrações reais em PostgreSQL embarcado (PGlite).
- `npm run test:e2e`: 8 testes aprovados, em Chromium desktop (1440 × 900) e mobile (390 × 844).
- `npm run build`: aprovado. Vite informa um chunk PixiJS acima de 500 kB antes de gzip; ele é necessário para o mapa. O tamanho comprimido desse chunk é de aproximadamente 168 kB.
- `deno check` nas três Edge Functions: aprovado.

Os fluxos do navegador verificam entrada em demonstração, busca, perfil, presets do mural, notas com salvamento persistente, Markdown seguro, restrições do visitante, zoom, arraste, seleção de lotes, modo leve e evolução com movimento reduzido.

Os testes de banco verificam RLS entre duas contas, conflito de edição, bloqueio de escritas administrativas, reservas concorrentes no mesmo lote, um terreno por usuário, segurança do mural, renomeação da identidade GitHub, leases, teto diário, reprocessamento idempotente e expansão sem mover terrenos.

O PGlite serializa as solicitações concorrentes. Contenção entre conexões remotas, OAuth real com duas contas, chamadas reais ao GitHub, cron no Supabase e publicação Cloudflare **não foram executados**, pois dependem de credenciais e projetos externos. O README descreve a configuração e a validação desses serviços.

As artes são sprites procedurais simplificados. As imagens originais são referências; não são usadas como cenário estático.
