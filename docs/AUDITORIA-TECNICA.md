# Auditoria técnica do Pomodoro

## Escopo

Esta etapa estabiliza o relógio antes do redesenho RafaMass Blueprint.

## Problemas corrigidos

- o contador antigo dependia da frequência de `setInterval` e perdia precisão em segundo plano;
- nomes personalizados eram inseridos com `innerHTML`;
- era possível ficar sem temporizadores e ainda tentar iniciar;
- os botões de ícone não tinham nomes acessíveis;
- o painel de criação não controlava foco nem semântica de diálogo;
- havia manifesto, mas não service worker;
- não existia persistência de uma sessão em andamento.

## Motor

`assets/js/timer-engine.js` mede tempo pelo horário final (`endsAt`). O intervalo apenas solicita atualização visual; ele não é a fonte de verdade.

Uma sessão salva contém:

```json
{
  "version": 2,
  "durationMs": 1500000,
  "remainingMs": 900000,
  "endsAt": 1720000000000,
  "status": "running"
}
```

Ao voltar do bloqueio de tela ou de outra aba, o motor recalcula o restante por `Date.now()`.

## Compatibilidade de dados

Os temporizadores existentes continuam usando a chave `pomodoro_v1`. Entradas inválidas são descartadas; nomes são normalizados e limitados a 30 caracteres.

A sessão em andamento usa a nova chave `pomodoro_session_v2`.

## Segurança do DOM

Listas e botões são construídos com `createElement` e `textContent`. Nenhum nome fornecido pela pessoa é concatenado como HTML.

## PWA

`sw.js` mantém um cache explícito dos arquivos essenciais e remove caches antigos na ativação.

## Auditoria automática

```bash
node scripts/audit-timer.js
```

O script cobre:

- tempo absoluto;
- pausa;
- retomada;
- restauração após suspensão;
- conclusão emitida uma única vez;
- bloqueio do estado vazio.
