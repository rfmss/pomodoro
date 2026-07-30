# Pomodoro

Temporizador local e instalável de Rafa Mass.

## Estado atual

A fundação do relógio usa tempo absoluto, persiste a sessão e continua correta após bloqueio de tela ou suspensão da aba.

## Arquitetura

```text
index.html                    estrutura semântica
assets/css/app.css            interface atual
assets/js/timer-engine.js     motor independente do DOM
assets/js/app.js              interface, armazenamento e PWA
scripts/audit-timer.js        auditoria determinística do motor
sw.js                         cache offline
```

## Desenvolvimento

```bash
python3 -m http.server 4173
node scripts/audit-timer.js
```

Abra `http://localhost:4173`.

## Dados locais

- `pomodoro_v1`: temporizadores salvos;
- `pomodoro_session_v2`: sessão atual.

## Licença

MIT.
