# Pomodoro — RafaMass Blueprint

Timer livre e ciclo Pomodoro local, instalável e confiável.

## Recursos

- relógio baseado em horário absoluto;
- retomada correta após bloqueio de tela;
- sessão persistente;
- até três temporizadores livres;
- ciclo opcional com quatro sessões de foco;
- interface RafaMass Blueprint;
- áudio local com voz única;
- PWA offline;
- sem conta ou nuvem obrigatória.

## Arquitetura

```text
index.html                              estrutura semântica
assets/css/rafamass-blueprint.css       sistema visual compartilhado
assets/css/app.css                      composição do Pomodoro
assets/js/timer-engine.js               motor independente do DOM
assets/js/cycle-model.js                sequência do ciclo
assets/js/app.js                        interface e persistência
assets/tomato-seal.svg                  selo de progresso
scripts/audit-timer.js                  auditoria do relógio
scripts/audit-cycle.js                  auditoria do ciclo
sw.js                                   cache offline
```

## Desenvolvimento

```bash
python3 -m http.server 4173
node scripts/audit-timer.js
node scripts/audit-cycle.js
```

Abra `http://localhost:4173`.

## Dados locais

- `pomodoro_v1`: temporizadores livres;
- `pomodoro_preferences_v1`: modo, seleção e etapa do ciclo;
- `pomodoro_session_v2`: sessão em andamento.

## Licença

MIT.
