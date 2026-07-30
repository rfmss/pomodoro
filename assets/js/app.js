(function () {
  'use strict';

  var TIMER_KEY = 'pomodoro_v1';
  var SESSION_KEY = 'pomodoro_session_v2';
  var MAX_TIMERS = 3;
  var DEFAULT_TIMERS = [
    { id: 't1', name: 'foco', minutes: 25 },
    { id: 't2', name: 'longo', minutes: 55 }
  ];

  var elements = {
    body: document.body,
    name: document.getElementById('timer-name'),
    display: document.getElementById('timer-display'),
    status: document.getElementById('timer-status'),
    progress: document.getElementById('progress-mask'),
    play: document.getElementById('play-button'),
    reset: document.getElementById('reset-button'),
    finish: document.getElementById('finish-button'),
    list: document.getElementById('preset-list'),
    empty: document.getElementById('empty-state'),
    openDialog: document.getElementById('open-dialog'),
    dialog: document.getElementById('timer-dialog'),
    cancelDialog: document.getElementById('cancel-dialog'),
    form: document.getElementById('timer-form'),
    inputName: document.getElementById('timer-input-name'),
    inputMinutes: document.getElementById('timer-input-minutes'),
    formError: document.getElementById('form-error'),
    toast: document.getElementById('toast')
  };

  var timers = loadTimers();
  var selectedId = timers.length ? timers[0].id : null;
  var tickHandle = null;
  var toastHandle = null;
  var activeAudio = null;

  var engine = new TimerEngine({
    durationMs: selectedTimer() ? selectedTimer().minutes * 60000 : 0,
    onChange: handleEngineChange,
    onComplete: handleCompletion
  });

  restoreSession();
  renderPresets();
  render(engine.snapshotWithoutSync());
  registerEvents();
  registerServiceWorker();

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

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) { return null; }
  }

  function saveSession(snapshot) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ selectedId: selectedId, engine: snapshot }));
    } catch (error) {}
  }

  function restoreSession() {
    var session = loadSession();
    if (!session) return;
    var found = timers.some(function (timer) { return timer.id === session.selectedId; });
    if (!found) return;
    selectedId = session.selectedId;
    var timer = selectedTimer();
    if (!timer || !session.engine || Number(session.engine.durationMs) !== timer.minutes * 60000) {
      engine.setDuration(timer ? timer.minutes * 60000 : 0);
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

  function render(snapshot) {
    var timer = selectedTimer();
    var ratio = snapshot.durationMs > 0 ? snapshot.remainingMs / snapshot.durationMs : 0;
    elements.name.textContent = timer ? timer.name : 'sem temporizador';
    elements.display.textContent = formatTime(snapshot.remainingMs);
    elements.display.setAttribute('datetime', 'PT' + Math.ceil(snapshot.remainingMs / 1000) + 'S');
    elements.status.textContent = statusLabel(snapshot.status);
    elements.progress.style.setProperty('--remaining-turn', Math.max(0, Math.min(1, ratio)) + 'turn');
    elements.play.textContent = snapshot.status === 'running' ? 'Pausar' : (snapshot.status === 'paused' ? 'Continuar' : 'Iniciar');
    elements.play.setAttribute('aria-pressed', snapshot.status === 'running' ? 'true' : 'false');
    elements.play.disabled = !timer;
    elements.reset.disabled = !timer;
    elements.finish.disabled = !timer || snapshot.status === 'complete';
    elements.body.classList.toggle('is-running', snapshot.status === 'running');
    document.title = timer ? formatTime(snapshot.remainingMs) + ' · ' + timer.name : 'Pomodoro';
    manageTicking(snapshot.status === 'running');
  }

  function handleEngineChange(snapshot) {
    render(snapshot);
    saveSession(snapshot);
  }

  function handleCompletion() {
    playCompletionSound();
    showToast('temporizador concluído');
  }

  function manageTicking(shouldRun) {
    if (shouldRun && tickHandle === null) {
      tickHandle = window.setInterval(function () { engine.sync(); }, 250);
    } else if (!shouldRun && tickHandle !== null) {
      window.clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function selectTimer(id) {
    if (selectedId === id) return;
    selectedId = id;
    var timer = selectedTimer();
    engine.setDuration(timer ? timer.minutes * 60000 : 0);
    renderPresets();
  }

  function renderPresets() {
    elements.list.replaceChildren();
    elements.empty.hidden = timers.length > 0;
    elements.openDialog.disabled = timers.length >= MAX_TIMERS;

    timers.forEach(function (timer) {
      var item = document.createElement('div');
      item.className = 'preset-item';

      var select = document.createElement('button');
      select.type = 'button';
      select.className = 'preset-select';
      select.setAttribute('aria-pressed', timer.id === selectedId ? 'true' : 'false');
      select.textContent = timer.name + ' · ' + timer.minutes + ' min';
      select.addEventListener('click', function () { selectTimer(timer.id); });

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'preset-delete';
      remove.setAttribute('aria-label', 'Excluir ' + timer.name);
      remove.textContent = '×';
      remove.addEventListener('click', function () { deleteTimer(timer.id); });

      item.append(select, remove);
      elements.list.appendChild(item);
    });
  }

  function deleteTimer(id) {
    timers = timers.filter(function (timer) { return timer.id !== id; });
    if (selectedId === id) selectedId = timers.length ? timers[0].id : null;
    saveTimers();
    var timer = selectedTimer();
    engine.setDuration(timer ? timer.minutes * 60000 : 0);
    renderPresets();
    showToast('temporizador removido');
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
    saveTimers();
    engine.setDuration(minutes * 60000);
    renderPresets();
    closeDialog();
    showToast('temporizador salvo');
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    window.clearTimeout(toastHandle);
    toastHandle = window.setTimeout(function () { elements.toast.classList.remove('visible'); }, 1800);
  }

  function stopActiveAudio() {
    if (!activeAudio) return;
    try {
      var now = activeAudio.context.currentTime;
      activeAudio.gain.gain.cancelScheduledValues(now);
      activeAudio.gain.gain.setValueAtTime(Math.max(.0001, activeAudio.gain.gain.value), now);
      activeAudio.gain.gain.exponentialRampToValueAtTime(.0001, now + .007);
      activeAudio.oscillator.stop(now + .009);
    } catch (error) {}
    activeAudio = null;
  }

  function playCompletionSound() {
    stopActiveAudio();
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      var context = new AudioContext();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(659.25, context.currentTime + .18);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .44);
      activeAudio = { context: context, oscillator: oscillator, gain: gain };
      oscillator.addEventListener('ended', function () {
        if (activeAudio && activeAudio.oscillator === oscillator) activeAudio = null;
        context.close().catch(function () {});
      });
    } catch (error) {}
  }

  function registerEvents() {
    elements.play.addEventListener('click', function () {
      if (engine.status === 'running') engine.pause();
      else engine.start();
    });
    elements.reset.addEventListener('click', function () { engine.reset(); });
    elements.finish.addEventListener('click', function () { engine.complete(); });
    elements.openDialog.addEventListener('click', openDialog);
    elements.cancelDialog.addEventListener('click', closeDialog);
    elements.form.addEventListener('submit', saveNewTimer);

    elements.dialog.addEventListener('click', function (event) {
      if (event.target === elements.dialog) closeDialog();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) engine.sync();
    });
    window.addEventListener('focus', function () { engine.sync(); });
    window.addEventListener('pageshow', function () { engine.sync(); });
    window.addEventListener('beforeunload', function () { saveSession(engine.snapshot()); });

    document.addEventListener('keydown', function (event) {
      var target = event.target;
      var editing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!editing && event.code === 'Space' && !elements.dialog.open) {
        event.preventDefault();
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
