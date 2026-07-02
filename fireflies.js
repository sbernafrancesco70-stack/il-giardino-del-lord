/**
 * IL GIARDINO DEL LORD — fireflies.js
 * Due effetti legati al cursore:
 *  1) Sul sito: un piccolo pallino bianco granuloso (senza alone
 *     luminoso, non emana luce) che insegue il cursore reale con un
 *     ritardo fisso di 0.2s.
 *  2) Dentro il menu overlay: il sito è avvolto nel buio e l'unica luce
 *     viene dalle lucciole che fluttuano e dal cursore, che diventa
 *     esso stesso una lucciola. Più un punto è lontano da una fonte di
 *     luce, più resta in penombra.
 *
 * Tecnica lucciole: un <canvas> a schermo intero disegna un velo scuro,
 * poi "buca" quel velo (destination-out) attorno a ogni lucciola e al
 * cursore con un gradiente radiale morbido e sfumato (blur), rivelando
 * il contenuto reale sottostante. Sopra, un passaggio "lighter" aggiunge
 * un alone caldo con grana, come una lanterna.
 */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     PUNTATORE CONDIVISO (mouse + touch)
  --------------------------------------------------------- */
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };

  window.addEventListener("mousemove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  });
  window.addEventListener("mouseleave", () => {
    pointer.active = false;
  });
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      pointer.x = t.clientX;
      pointer.y = t.clientY;
      pointer.active = true;
    },
    { passive: true }
  );

  let menuOpen = false;
  window.addEventListener("menu-overlay:toggle", (e) => {
    menuOpen = e.detail.open;
  });

  /* ===========================================================
     1) CURSORE DEL SITO
     Pallino bianco granuloso, opaco: non emana luce (nessun alone/
     gradiente) a differenza delle lucciole. Insegue il puntatore
     reale con un ritardo fisso di 0.2s (buffer temporale, non lerp).
  =========================================================== */
  (function setupSiteCursor() {
    const DELAY_MS = 100;

    // buffer delle posizioni recenti, per poter leggere quella di 0.2s fa
    const history = [{ t: performance.now(), x: pointer.x, y: pointer.y }];
    function recordPointer() {
      const now = performance.now();
      history.push({ t: now, x: pointer.x, y: pointer.y });
      const cutoff = now - DELAY_MS - 200;
      while (history.length > 2 && history[1].t < cutoff) history.shift();
    }
    function delayedPosition() {
      const targetT = performance.now() - DELAY_MS;
      if (targetT <= history[0].t) return { x: history[0].x, y: history[0].y };
      for (let i = 1; i < history.length; i++) {
        if (history[i].t >= targetT) {
          const prev = history[i - 1];
          const curr = history[i];
          const span = curr.t - prev.t || 1;
          const f = (targetT - prev.t) / span;
          return { x: prev.x + (curr.x - prev.x) * f, y: prev.y + (curr.y - prev.y) * f };
        }
      }
      const last = history[history.length - 1];
      return { x: last.x, y: last.y };
    }

    const SIZE = 40;
    const canvas = document.createElement("canvas");
    canvas.id = "site-cursor";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
      canvas.style.width = SIZE + "px";
      canvas.style.height = SIZE + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const DOT_RADIUS = 12;

    function render() {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // corpo pieno e opaco: nessun gradiente/alone, non emana luce
      ctx.fillStyle = "rgba(245, 242, 236, 0.92)";
      ctx.beginPath();
      ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // grana: piccoli granelli chiari/scuri sparsi dentro e sul bordo
      const grains = 26;
      for (let i = 0; i < grains; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * DOT_RADIUS * 1.15;
        const gx = cx + Math.cos(angle) * dist;
        const gy = cy + Math.sin(angle) * dist;
        const shade = 200 + Math.random() * 55;
        const isDark = Math.random() < 0.3;
        const c = isDark ? shade * 0.5 : shade;
        ctx.fillStyle = `rgba(${c | 0}, ${c | 0}, ${c | 0}, ${(0.25 + Math.random() * 0.4).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(gx, gy, Math.random() * 1 + 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      recordPointer();
      const p = reduceMotion ? pointer : delayedPosition();
      canvas.style.transform = `translate(${p.x - cx}px, ${p.y - cy}px)`;
      canvas.style.opacity = menuOpen || !pointer.active ? "0" : "1";
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  /* ===========================================================
     2) LUCCIOLE — attive solo dentro il menu overlay
  =========================================================== */
  const canvas = document.createElement("canvas");
  canvas.id = "firefly-overlay";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = window.innerWidth;
  let H = window.innerHeight;

  function resizeOverlay() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeOverlay);
  resizeOverlay();

  const FIREFLY_COUNT = 34;

  function spawnFirefly() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      radius: 90 + Math.random() * 90,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.6
    };
  }

  const fireflies = Array.from({ length: FIREFLY_COUNT }, spawnFirefly);

  const CURSOR_RADIUS = 170;
  const VEIL_COLOR = "8, 6, 5"; // quasi nero, leggermente caldo
  const VEIL_ALPHA = 0.9;
  const GLOW_COLOR = "255, 199, 120"; // luce calda e morbida, da lanterna
  const GLOW_BLUR = "blur(9px)"; // sfuma i bordi di lucciole e cursore
  const GRAIN_COLOR = "255, 214, 150";

  let t = 0;
  let rafId = null;

  function drawLight(x, y, radius, coreAlpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(0,0,0,${coreAlpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGlow(x, y, radius, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${GLOW_COLOR}, ${alpha})`);
    grad.addColorStop(1, `rgba(${GLOW_COLOR}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // grana: piccoli granelli caldi sparsi nel raggio di una luce, per una
  // texture "sabbiosa" invece di un alone piatto e uniforme
  function drawGrain(x, y, radius, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const gx = x + Math.cos(angle) * dist;
      const gy = y + Math.sin(angle) * dist;
      const a = Math.random() * 0.35;
      ctx.fillStyle = `rgba(${GRAIN_COLOR}, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.random() * 1.3 + 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick() {
    t += 1;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(${VEIL_COLOR}, ${VEIL_ALPHA})`;
    ctx.fillRect(0, 0, W, H);

    // 1) buca il velo attorno a ogni lucciola e al cursore, con bordo sfumato
    ctx.globalCompositeOperation = "destination-out";
    ctx.filter = GLOW_BLUR;
    fireflies.forEach((f) => {
      if (!reduceMotion) {
        f.x += f.vx;
        f.y += f.vy;
        f.vx += (Math.random() - 0.5) * 0.015;
        f.vy += (Math.random() - 0.5) * 0.015;
        f.vx = Math.max(-0.35, Math.min(0.35, f.vx));
        f.vy = Math.max(-0.35, Math.min(0.35, f.vy));

        if (f.x < -100) f.x = W + 100;
        if (f.x > W + 100) f.x = -100;
        if (f.y < -100) f.y = H + 100;
        if (f.y > H + 100) f.y = -100;
      }

      const flicker = reduceMotion ? 0.9 : 0.7 + 0.3 * Math.sin(t * 0.04 * f.speed + f.phase);
      f._flicker = flicker;
      drawLight(f.x, f.y, f.radius * flicker, 1);
    });

    if (pointer.active) {
      drawLight(pointer.x, pointer.y, CURSOR_RADIUS, 1);
    }
    ctx.filter = "none";

    // 2) alone caldo e sfumato sopra le zone rivelate, come luce di lanterna
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = GLOW_BLUR;
    fireflies.forEach((f) => {
      drawGlow(f.x, f.y, f.radius * 0.65 * f._flicker, 0.5);
    });
    if (pointer.active) {
      drawGlow(pointer.x, pointer.y, CURSOR_RADIUS * 0.6, 0.45);
    }
    ctx.filter = "none";

    // 3) grana sopra l'alone (nitida, non sfumata) + corpo luminoso della lucciola
    fireflies.forEach((f) => {
      drawGrain(f.x, f.y, f.radius * 0.55 * f._flicker, 8);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 244, 214, ${0.55 + 0.35 * f._flicker})`;
      ctx.arc(f.x, f.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    if (pointer.active) {
      drawGrain(pointer.x, pointer.y, CURSOR_RADIUS * 0.5, 14);
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 248, 224, 0.85)";
      ctx.arc(pointer.x, pointer.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    rafId = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     ATTIVAZIONE — solo mentre il menu overlay è aperto
     Il canvas entra/esce con la stessa transizione (durata + easing)
     della tendina del menu, così sembrano un'unica cosa che si apre
     insieme invece di due animazioni sfalsate.
  --------------------------------------------------------- */
  let closeTimer = null;

  window.addEventListener("menu-overlay:toggle", (e) => {
    const open = e.detail.open;
    if (open) {
      clearTimeout(closeTimer);
      if (!rafId) rafId = requestAnimationFrame(tick);
      // forza il reflow prima di alzare l'opacità, altrimenti il browser
      // potrebbe accorpare i due cambi di stile e saltare la transizione
      canvas.getBoundingClientRect();
      canvas.style.opacity = "1";
    } else {
      canvas.style.opacity = "0";
      // il loop resta attivo durante la dissolvenza, così il contenuto
      // non sparisce di scatto mentre l'opacità sta ancora calando
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
          ctx.clearRect(0, 0, W, H);
        }
      }, 700);
    }
  });
})();
