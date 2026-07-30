# Pomodoro — RafaMass Blueprint

## Direção

O Pomodoro usa a assinatura RafaMass Blueprint sem imitar o tabuleiro do Dirlizanu.

A aplicação é organizada como um aparato temporal:

- palco técnico escuro;
- superfície de papel gesso;
- linhas cyan de construção;
- relógio como objeto principal;
- comandos retangulares e neutros;
- tomate vermelhão como único sinal de alta prioridade;
- metadados monoespaçados como segunda voz.

## Hierarquia

1. tempo restante;
2. estado da sessão;
3. iniciar, pausar, reiniciar e encerrar;
4. seleção de timer ou etapa do ciclo;
5. metadados e ornamento.

Durante a execução, elementos secundários perdem contraste. Os controles e o relógio permanecem legíveis em telas de toque.

## Modos

### Timer livre

Preserva os temporizadores personalizados existentes. São permitidas até três configurações locais.

### Ciclo Pomodoro

Sequência opcional:

```text
foco 25
pausa 5
foco 25
pausa 5
foco 25
pausa 5
foco 25
pausa longa 15
```

A próxima etapa não inicia automaticamente. A pessoa confirma a transição no dossiê de conclusão.

## Progresso

O tomate é um selo, não uma ilustração flutuante. Dez marcas mostram a fração consumida da sessão. O relógio continua sendo a fonte principal de informação.

## Movimento

- linhas blueprint desenham o aparato uma vez ao abrir;
- uma marca nova produz um assentamento curto do selo;
- a conclusão recebe um carimbo;
- não há animação infinita;
- `prefers-reduced-motion` elimina desenho progressivo e carimbo animado.

## Som

O áudio é sintetizado localmente com Web Audio.

Existe uma única voz ativa. Antes de qualquer novo som, a voz anterior é encerrada com uma rampa de 7 ms. Isso impede sobreposição e estalos.

## Responsividade

- desktop: relógio e banco de sessões em duas colunas;
- tablet: banco de sessões abaixo do relógio em composição horizontal;
- celular: uma coluna, relógio central e selo compacto;
- tela baixa em paisagem: metadados e instruções cedem antes da área funcional;
- nenhuma altura fixa impede rolagem quando o conteúdo realmente precisa dela;
- nenhuma rolagem horizontal é aceita.

## Acessibilidade

- zoom do navegador permitido;
- comandos com texto explícito;
- áreas principais com pelo menos 44 px;
- diálogos semânticos;
- status em região `aria-live`;
- foco visível;
- atalho de espaço para iniciar ou pausar fora de campos e diálogos.
