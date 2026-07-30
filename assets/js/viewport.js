(function () {
  'use strict';

  var frame = 0;
  var viewport = window.visualViewport;

  function measure() {
    frame = 0;
    var height = viewport ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-vh', Math.max(320, Math.round(height)) + 'px');
  }

  function scheduleMeasure() {
    if (frame) return;
    frame = window.requestAnimationFrame(measure);
  }

  measure();
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('orientationchange', scheduleMeasure, { passive: true });
  if (viewport) {
    viewport.addEventListener('resize', scheduleMeasure, { passive: true });
    viewport.addEventListener('scroll', scheduleMeasure, { passive: true });
  }
}());
