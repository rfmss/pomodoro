(function () {
  'use strict';

  var TIMER_KEY = 'pomodoro_v1';
  var SESSION_KEY = 'pomodoro_session_v2';
  var PREFERENCES_KEY = 'pomodoro_preferences_v1';
  var MAX_TIMERS = 3;
  var DEFAULT_TIMERS = [
    { id: 't1', name: 'foco', minutes: 25 },
    { id: 't2', name: 'longo', minutes: 55 }
  ];

  var elements = {
    body: document.body,
    railState: document.getElementById('rail-state'),
    kind: document.getElementById('session-kind'),
    position: document.getElementById('cycle-position'),
    name: document.getElementById('session-name'),
    display: document.getElementById('timer-display'),
    status: document.getElementById('timer-status'),
    marks: document.getElementById('progress-marks'),
    play: document.getElementById('play-button'),
    reset: document.getElementById('reset-button'),
    finish: document.getElementById('finish-button'),
    modeFree: document.getElementById('mode-free'),
    modeCycle: document.getElementById('mode-cycle'),
    freePanel: document.querySelector('.free-panel'),
    cyclePanel: document.querySelector('.cycle-panel'),
    presetList: document.getElementById('preset-list'),
    cycleList: document.getElementById('cycle-list'),
    empty: document.getElementById('empty-state'),
    openDialog: document.getElementById('open-dialog'),
    resetCycle: document.getElementById('reset-cycle'),
    dialog: document.getElementById('timer-dialog'),
    cancelDialog: document.getElementById('cancel-dialog'),
    form: document.getElementById('timer-form'),
    inputName: document.getElementById('timer-input-name'),
    inputMinutes: document.getElementById('timer-input-minutes'),
    formError: document.getElementById('form-error'),
    completionDialog: document.getElementById('completion-dialog'),
    completionTitle: document.getElementById('completion-title'),
    completionCopy: document.getElementById('completion-copy'),
    repeatSession: document.getElementById('repeat-session'),
    nextSession: document.getElementById('next-session'),
    closeCompletion: document.getElementById('close-completion'),
    toast: document.getElementById('toast')
  };

  var timers = loadTimers();
  var preferences = loadPreferences();
  var mode = preferences.mode === 'cycle' ? 'cycle' : 'free';
  var selectedId = timers.some(function (timer) { return timer.id === preferences.selectedId; })
    ? preferences.selectedId
    : (timers.length ? timers[0].id : null);
  var cycle = new CycleModel();
  cycle.restore(preferences.cycle);

  var tickHandle = null;
  var toastHandle = null;
  var audioContext = null;
  var activeVoice = null;
  var lastMarkCount = -1;

  var descriptor = currentDescriptor();
  var engine = new TimerEngine({
    durationMs: descriptor ? descriptor.minutes * 60000 : 0,
    onChange: handleEngineChange,
    onComplete: handleCompletion
  });

  buildProgressMarks();
  restoreSession();
  renderPresets();
  renderCycle();
  renderMode();
  render(engine.snapshotWithoutSync());
  registerEvents();
  registerServiceWorker();
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () { document.documentElement.classList.add('page-ready'); });
  });

  function normalizeTimer(timer) {
    if (!timer || typeof timer !== 'object') return null;
    var minutes = parseInt(timer.minutes, 10);
    if (!minutes || minutes < 1) return null;
    return {
      id: String(timer.id || generateId()),
      name: String(timer.name || 'timer').trim().slice(0, 30) || 'timer',
      minutes: Math.min(999, minutes)
    };
  }

  function loadTimers() {
    try {
      var raw = localStorage.getItem(TIMER_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var list = parsed && Array.isArray(parsed.timers) ? parsed.timers : [];
        list = list.map(normalizeTimer).filter(Boolean).slice(0, MAX_TIMERS);
        if (list.length) return list;
      }
    } catch (error) {}
    return DEFAULT_TIMERS.map(function (timer) { return normalizeTimer(timer); });
  }

  function saveTimers() {
    try { localStorage.setItem(TIMER_KEY, JSON.stringify({ timers: timers })); } catch (error) {}
  }

  function loadPreferences() {
    try {
      var raw = localStorage.getItem(PREFERENCES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) { return {}; }
  }

  function savePreferences() {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
        mode: mode,
        selectedId: selectedId,
        cycle: cycle.snapshot()
      }));
    } catch (error) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) { return null; }
  }

  function saveSession(snapshot) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        mode: mode,
        selectedId: selectedId,
        cycle: cycle.snapshot(),
        engine: snapshot
      }));
    } catch (error) {}
  }

  function restoreSession() {
    var session = loadSession();
    if (!session || !session.engine) return;

    if (session.mode === 'cycle' || session.mode === 'free') mode = session.mode;
    if (timers.some(function (timer) { return timer.id === session.selectedId; })) selectedId = session.selectedId;
    cycle.restore(session.cycle);

    var current = currentDescriptor();
    if (!current || Number(session.engine.durationMs) !== current.minutes * 60000) {
      engine.setDuration(current ? current.minutes * 60000 : 0);
      return;
    }
    engine.restore(session.engine);
  }

  function selectedTimer() {
    for (var index = 0; index < timers.length; index++) {
      if (timers[index].id === selectedId) return timers[index];
    }
    return null;
  }

  function currentDescriptor() {
    if (mode === 'cycle') {
      var step = cycle.current();
      return {
        id: step.id,
        name: step.label,
        minutes: step.minutes,
        type: step.type,
        kind: step.type === 'focus' ? 'SESSÃO DE FOCO' : (step.type === 'long-break' ? 'PAUSA LONGA' : 'PAUSA CURTA'),
        position: 'ETAPA ' + String(step.index + 1).padStart(2, '0') + ' / ' + String(step.total).padStart(2, '0')
      };
    }

    var timer = selectedTimer();
    if (!timer) return null;
    return {
      id: timer.id,
      name: timer.name,
      minutes: timer.minutes,
      type: 'free',
      kind: 'SESSÃO LIVRE',
      position: 'DURAÇÃO / ' + timer.minutes + ' MIN'
    };
  }

  function applyCurrentDuration() {
    descriptor = currentDescriptor();
    engine.setDuration(descriptor ? descriptor.minutes * 60000 : 0);
    savePreferences();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatTime(milliseconds) {
    var totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function statusLabel(status) {
    if (status === 'running') return 'em andamento';
    if (status === 'paused') return 'pausado';
    if (status === 'complete') return 'concluído';
    if (status === 'empty') return 'crie um temporizador';
    return 'pronto';
  }

  function buildProgressMarks() {
    elements.marks.replaceChildren();
    for (var index = 0; index < 10; index++) {
      var mark = document.createElement('span');
      mark.className = 'progress-mark';
      elements.marks.appendChild(mark);
    }
  }

  function renderProgress(snapshot) {
    var elapsed = snapshot.durationMs > 0 ? 1 - (snapshot.remainingMs / snapshot.durationMs) : 0;
    var count = Math.max(0, Math.min(10, Math.floor(elapsed * 10 + 0.000001)));
    var marks = elements.marks.children;
    for (var index = 0; index < marks.length; index++) marks[index].classList.toggle('done', index < count);
    if (count !== lastMarkCount && lastMarkCount >= 0 && count > lastMarkCount) {
      var seal = document.querySelector('.tomato-seal');
      if (seal && typeof seal.animate === 'function') {
        seal.animate([{ transform: 'rotate(1.2deg) scale(1)' }, { transform: 'rotate(-1deg) scale(.96)' }, { transform: 'rotate(1.2deg) scale(1)' }], { duration: 220, easing: 'ease-out' });
      }
    }
    lastMarkCount = count;
  }

  function render(snapshot) {
    descriptor = currentDescriptor();
    elements.name.textContent = descriptor ? descriptor.name : 'sem temporizador';
    elements.kind.textContent = descriptor ? descriptor.kind : 'SEM CONFIGURAÇÃO';
    elements.position.textContent = descriptor ? descriptor.position : 'DURAÇÃO / 00 MIN';
    elements.display.textContent = formatTime(snapshot.remainingMs);
    elements.display.setAttribute('datetime', 'PT' + Math.ceil(snapshot.remainingMs / 1000) + 'S');
    elements.status.textContent = statusLabel(snapshot.status);
    elements.railState.textContent = 'ESTADO / ' + statusLabel(snapshot.status).toUpperCase();
    elements.play.textContent = snapshot.status === 'running' ? 'Pausar' : (snapshot.status === 'paused' ? 'Continuar' : 'Iniciar');
    elements.play.setAttribute('aria-pressed', snapshot.status === 'running' ? 'true' : 'false');
    elements.play.disabled = !descriptor;
    elements.reset.disabled = !descriptor;
    elements.finish.disabled = !descriptor || snapshot.status === 'complete';
    elements.body.dataset.status = snapshot.status;
    elements.body.dataset.mode = mode;
    elements.body.dataset.sessionType = descriptor ? descriptor.type : 'empty';
    document.title = descriptor ? formatTime(snapshot.remainingMs) + ' · ' + descriptor.name : 'Pomodoro · RafaMass';
    renderProgress(snapshot);
    manageTicking(snapshot.status === 'running');
  }

  function renderMode() {
    var free = mode === 'free';
    elements.modeFree.setAttribute('aria-pressed', free ? 'true' : 'false');
    elements.modeCycle.setAttribute('aria-pressed', free ? 'false' : 'true');
    elements.freePanel.hidden = !free;
    elements.cyclePanel.hidden = free;
    elements.body.dataset.mode = mode;
  }

  function handleEngineChange(snapshot) {
    render(snapshot);
    saveSession(snapshot);
  }

  function handleCompletion() {
    playSound('complete');
    if (navigator.vibrate) navigator.vibrate(35);
    openCompletion();
  }

  function manageTicking(shouldRun) {
    if (shouldRun && tickHandle === null) {
      tickHandle = window.setInterval(function () { engine.sync(); }, 250);
    } else if (!shouldRun && tickHandle !== null) {
      window.clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function setMode(nextMode) {
    if (nextMode !== 'free' && nextMode !== 'cycle') return;
    if (mode === nextMode) return;
    mode = nextMode;
    lastMarkCount = -1;
    applyCurrentDuration();
    renderMode();
    renderPresets();
    renderCycle();
    playSound('tap');
  }

  function selectTimer(id) {
    if (mode !== 'free' || selectedId === id) return;
    selectedId = id;
    lastMarkCount = -1;
    applyCurrentDuration();
    renderPresets();
    playSound('tap');
  }

  function selectCycleStep(index) {
    if (mode !== 'cycle') return;
    cycle.goTo(index);
    lastMarkCount = -1;
    applyCurrentDuration();
    renderCycle();
    playSound('tap');
  }

  function renderPresets() {
    elements.presetList.replaceChildren();
    elements.empty.hidden = timers.length > 0;
    elements.openDialog.disabled = timers.length >= MAX_TIMERS;

    timers.forEach(function (timer) {
      var item = document.createElement('div');
      item.className = 'preset-item';

      var select = document.createElement('button');
      select.type = 'button';
      select.className = 'preset-select';
      select.setAttribute('aria-pressed', timer.id === selectedId ? 'true' : 'false');
      var label = document.createElement('span');
      label.textContent = timer.name;
      var duration = document.createElement('span');
      duration.textContent = timer.minutes + ' min';
      select.append(label, duration);
      select.addEventListener('click', function () { selectTimer(timer.id); });

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'preset-delete';
      remove.setAttribute('aria-label', 'Excluir ' + timer.name);
      remove.textContent = '×';
      remove.addEventListener('click', function () { deleteTimer(timer.id); });

      item.append(select, remove);
      elements.presetList.appendChild(item);
    });
  }

  function renderCycle() {
    elements.cycleList.replaceChildren();
    CycleModel.steps().forEach(function (step) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cycle-step';
      if (step.index === cycle.index) button.setAttribute('aria-current', 'step');
      var label = document.createElement('span');
      label.textContent = step.label;
      var duration = document.createElement('span');
      duration.textContent = step.minutes + ' min';
      button.append(label, duration);
      button.addEventListener('click', function () { selectCycleStep(step.index); });
      item.appendChild(button);
      elements.cycleList.appendChild(item);
    });
  }

  function deleteTimer(id) {
    timers = timers.filter(function (timer) { return timer.id !== id; });
    if (selectedId === id) selectedId = timers.length ? timers[0].id : null;
    saveTimers();
    if (mode === 'free') applyCurrentDuration();
    else savePreferences();
    renderPresets();
    showToast('temporizador removido');
    playSound('tap');
  }

  function openDialog() {
    if (timers.length >= MAX_TIMERS) {
      showToast('limite de três temporizadores');
      return;
    }
    elements.form.reset();
    elements.formError.textContent = '';
    if (typeof elements.dialog.showModal === 'function') elements.dialog.showModal();
    else elements.dialog.setAttribute('open', '');
    window.setTimeout(function () { elements.inputName.focus(); }, 30);
  }

  function closeDialog() {
    if (typeof elements.dialog.close === 'function') elements.dialog.close();
    else elements.dialog.removeAttribute('open');
  }

  function saveNewTimer(event) {
    event.preventDefault();
    var minutes = parseInt(elements.inputMinutes.value, 10);
    var name = elements.inputName.value.trim().slice(0, 30);
    if (!name) {
      elements.formError.textContent = 'Informe um nome.';
      elements.inputName.focus();
      return;
    }
    if (!minutes || minutes < 1 || minutes > 999) {
      elements.formError.textContent = 'Use uma duração entre 1 e 999 minutos.';
      elements.inputMinutes.focus();
      return;
    }
    var timer = { id: generateId(), name: name, minutes: minutes };
    timers.push(timer);
    selectedId = timer.id;
    mode = 'free';
    saveTimers();
    applyCurrentDuration();
    renderMode();
    renderPresets();
    closeDialog();
    showToast('temporizador salvo');
    playSound('tap');
  }

  function openCompletion() {
    descriptor = currentDescriptor();
    elements.completionTitle.textContent = descriptor && descriptor.type === 'focus' ? 'Foco concluído.' : 'Sessão concluída.';
    elements.completionCopy.textContent = mode === 'cycle'
      ? 'A etapa ' + String(cycle.index + 1).padStart(2, '0') + ' terminou. A próxima está pronta para ser carregada.'
      : 'O temporizador “' + (descriptor ? descriptor.name : 'livre') + '” chegou ao fim.';
    elements.nextSession.hidden = mode !== 'cycle';
    if (typeof elements.completionDialog.showModal === 'function') elements.completionDialog.showModal();
    else elements.completionDialog.setAttribute('open', '');
  }

  function closeCompletion() {
    if (typeof elements.completionDialog.close === 'function') elements.completionDialog.close();
    else elements.completionDialog.removeAttribute('open');
  }

  function repeatSession() {
    closeCompletion();
    lastMarkCount = -1;
    engine.reset();
    playSound('tap');
  }

  function nextSession() {
    closeCompletion();
    if (mode === 'cycle') cycle.next();
    lastMarkCount = -1;
    applyCurrentDuration();
    renderCycle();
    playSound('tap');
  }

  function endCompletion() {
    closeCompletion();
    lastMarkCount = -1;
    engine.reset();
    playSound('tap');
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    window.clearTimeout(toastHandle);
    toastHandle = window.setTimeout(function () { elements.toast.classList.remove('visible'); }, 1800);
  }

  function ensureAudioContext() {
    if (audioContext) return audioContext;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext = new AudioContext();
    return audioContext;
  }

  function stopActiveVoice() {
    if (!activeVoice || !audioContext) return;
    try {
      var now = audioContext.currentTime;
      activeVoice.gain.gain.cancelScheduledValues(now);
      activeVoice.gain.gain.setValueAtTime(Math.max(.0001, activeVoice.gain.gain.value), now);
      activeVoice.gain.gain.exponentialRampToValueAtTime(.0001, now + .007);
      activeVoice.oscillator.stop(now + .009);
    } catch (error) {}
    activeVoice = null;
  }

  function playSound(kind) {
    var context = ensureAudioContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume().catch(function () {});
    stopActiveVoice();

    var oscillator = context.createOscillator();
    var gain = context.createGain();
    var filter = context.createBiquadFilter();
    var now = context.currentTime;
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    oscillator.type = 'sine';

    if (kind === 'complete') {
      oscillator.frequency.setValueAtTime(440, now);
      oscillator.frequency.exponentialRampToValueAtTime(659.25, now + .28);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.12, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .52);
    } else {
      oscillator.frequency.setValueAtTime(330, now);
      oscillator.frequency.exponentialRampToValueAtTime(270, now + .07);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.035, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .085);
    }

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    if (kind === 'complete') oscillator.stop(now + .54);
    else oscillator.stop(now + .09);
    activeVoice = { oscillator: oscillator, gain: gain };
    oscillator.addEventListener('ended', function () {
      if (activeVoice && activeVoice.oscillator === oscillator) activeVoice = null;
    });
  }

  function registerEvents() {
    elements.play.addEventListener('click', function () {
      playSound('tap');
      if (engine.status === 'running') engine.pause();
      else engine.start();
    });
    elements.reset.addEventListener('click', function () { playSound('tap'); lastMarkCount = -1; engine.reset(); });
    elements.finish.addEventListener('click', function () { playSound('tap'); engine.complete(); });
    elements.modeFree.addEventListener('click', function () { setMode('free'); });
    elements.modeCycle.addEventListener('click', function () { setMode('cycle'); });
    elements.openDialog.addEventListener('click', function () { playSound('tap'); openDialog(); });
    elements.cancelDialog.addEventListener('click', function () { playSound('tap'); closeDialog(); });
    elements.form.addEventListener('submit', saveNewTimer);
    elements.resetCycle.addEventListener('click', function () {
      cycle.reset();
      lastMarkCount = -1;
      applyCurrentDuration();
      renderCycle();
      playSound('tap');
    });
    elements.repeatSession.addEventListener('click', repeatSession);
    elements.nextSession.addEventListener('click', nextSession);
    elements.closeCompletion.addEventListener('click', endCompletion);

    elements.dialog.addEventListener('click', function (event) {
      if (event.target === elements.dialog) closeDialog();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) engine.sync();
    });
    window.addEventListener('focus', function () { engine.sync(); });
    window.addEventListener('pageshow', function () { engine.sync(); });
    window.addEventListener('beforeunload', function () {
      savePreferences();
      saveSession(engine.snapshot());
    });

    document.addEventListener('keydown', function (event) {
      var target = event.target;
      var editing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      var dialogOpen = elements.dialog.open || elements.completionDialog.open;
      if (!editing && event.code === 'Space' && !dialogOpen) {
        event.preventDefault();
        playSound('tap');
        if (engine.status === 'running') engine.pause();
        else engine.start();
      }
      if (event.key === 'Escape' && elements.dialog.open) closeDialog();
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  }
}());
