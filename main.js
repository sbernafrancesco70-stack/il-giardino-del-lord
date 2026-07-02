/**
 * IL GIARDINO DEL LORD — main.js
 * Genera le sezioni da SECTIONS_DATA e gestisce:
 *  - preloader
 *  - menu overlay
 *  - reveal animation (closed -> opening -> full) legata allo scroll, via GSAP ScrollTrigger
 *  - logica responsive: aspect ratio orizzontale su desktop, verticale/ritratto su mobile
 */

(function () {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  const MAIN = document.getElementById("main");
  const MOBILE_BREAKPOINT = 768; // soglia layout (vedi --bp-mobile/--bp-desktop in CSS, qui usiamo 768 come switch comportamentale)

  /* ---------------------------------------------------------
     1) GENERA LE SEZIONI DAL DATA ARRAY
  --------------------------------------------------------- */
  function buildSections() {
    const frag = document.createDocumentFragment();

    SECTIONS_DATA.forEach((data, i) => {
      const section = document.createElement("section");
      section.className = `reveal-section color-${data.color}`;
      section.id = `section-${i}`;
      section.dataset.index = i;

      const indexLabel = String(i + 1).padStart(2, "0") + " / " + String(SECTIONS_DATA.length).padStart(2, "0");

      const titleMarkup = data.titleParts
        ? `<h2 class="reveal-title reveal-title-split" data-title>
             <span class="word word-top" data-title-top>${data.titleParts[0]}</span>
             <span class="word word-bottom" data-title-bottom>${data.titleParts[1]}</span>
           </h2>`
        : `<h2 class="reveal-title" data-title>
             <span class="word">${data.title}</span>
           </h2>`;

      section.innerHTML = `
        <div class="reveal-stage">
          <div class="reveal-frame" data-frame>
            <picture>
              <source media="(max-width: 768px)" srcset="${data.imageMobile}">
              <img src="${data.image}" alt="${data.alt || data.title}" data-reveal-img>
            </picture>
          </div>
          ${titleMarkup}
          <span class="reveal-index">${indexLabel}</span>
        </div>
      `;

      frag.appendChild(section);
    });

    MAIN.appendChild(frag);
  }

  buildSections();

  /* ---------------------------------------------------------
     2) PRELOADER
  --------------------------------------------------------- */
  function runPreloader() {
    const preloader = document.getElementById("preloader");
    const mark = preloader.querySelector(".preloader-mark");

    const tl = gsap.timeline({
      delay: 0.2,
      onComplete: () => {
        preloader.style.pointerEvents = "none";
      }
    });

    tl.to(mark, { opacity: 1, duration: 0.5, ease: "power1.out" })
      .to(mark, { opacity: 1, duration: 0.6 })
      .to(preloader, {
        autoAlpha: 0,
        duration: 0.8,
        ease: "power2.inOut",
        onComplete: () => preloader.remove()
      });
  }

  runPreloader();

  /* ---------------------------------------------------------
     3) MENU OVERLAY
  --------------------------------------------------------- */
  function setupMenu() {
    const toggle = document.getElementById("menuToggle");
    const overlay = document.getElementById("menu-overlay");
    const links = overlay.querySelectorAll("[data-menu-link]");
    let open = false;

    function notifyToggle() {
      window.dispatchEvent(new CustomEvent("menu-overlay:toggle", { detail: { open } }));
    }

    function closeMenu() {
      open = false;
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      notifyToggle();
    }

    toggle.addEventListener("click", () => {
      open = !open;
      overlay.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
      // l'evento parte subito: le lucciole sono sincronizzate via CSS
      // transition con la stessa durata/easing della tendina del menu
      notifyToggle();
    });

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        closeMenu();
        const target = document.querySelector(link.getAttribute("href"));
        if (target) {
          gsap.to(window, {
            scrollTo: { y: target, offsetY: 0 },
            duration: 1,
            ease: "power2.inOut"
          });
        }
      });
    });
  }

  setupMenu();

  /* ---------------------------------------------------------
     4) REVEAL ANIMATION — il cuore del sito
     ---------------------------------------------------------
     Per ogni sezione:
       - lo stage resta "sticky" per tutta l'altezza della section (320vh)
       - lo scroll-progress (0 -> 1) pilota la crescita del .reveal-frame
       - fase A (0 -> 0.55): il frame cresce dal centro (closed -> opening -> full)
         desktop: aspect ratio orizzontale (parte stretto e basso, si allarga di più in larghezza)
         mobile:  aspect ratio verticale/ritratto (parte stretto e alto, si allarga di più in altezza)
       - fase B (0.55 -> 0.78): il frame è già "full screen", l'immagine resta a riposo (lettura)
       - fase C (0.78 -> 1): titolo/badge si dissolvono leggermente in preparazione alla sezione successiva
  --------------------------------------------------------- */

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function buildRevealTimelines() {
    // pulizia di eventuali ScrollTrigger precedenti (in caso di resize/rebuild)
    ScrollTrigger.getAll().forEach((st) => st.kill());

    const sections = gsap.utils.toArray(".reveal-section");

    sections.forEach((section) => {
      const frame = section.querySelector("[data-frame]");
      const img = section.querySelector("[data-reveal-img]");
      const title = section.querySelector("[data-title]");
      const titleTop = section.querySelector("[data-title-top]");
      const titleBottom = section.querySelector("[data-title-bottom]");
      const isSplitTitle = !!(titleTop && titleBottom);
      const index = section.querySelector(".reveal-index");
      const stage = section.querySelector(".reveal-stage");

      const mobile = isMobile();

      // dimensioni di partenza/arrivo del frame, in funzione del breakpoint
      // CLOSED: frame invisibile (0x0)
      // OPENING: stato intermedio (vincolo diverso per asse a seconda del breakpoint)
      // FULL: 100vw x 100vh
      const vw = () => stage.clientWidth;
      const vh = () => stage.clientHeight;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 1, // lerp naturale: lo scrub interpola con un piccolo ritardo, simula la "resistenza" voluta
          // markers: true, // utile in sviluppo, disattivato in produzione
        }
      });

      // stato iniziale esplicito (closed)
      gsap.set(frame, {
        width: 0,
        height: 0,
      });
      gsap.set(img, {
        width: () => vw(),
        height: () => vh(),
      });
      gsap.set([title, index], { opacity: 1 });
      if (isSplitTitle) {
        // partono già leggermente separate (non sovrapposte), poi si allontanano
        // ulteriormente verso i bordi man mano che l'immagine si apre
        gsap.set(titleTop, { opacity: 1, top: "14%" });
        gsap.set(titleBottom, { opacity: 1, top: "89%" });
      }

      if (!mobile) {
        // ---------- DESKTOP: apertura orizzontale ----------
        // opening: cresce soprattutto in larghezza (rettangolo orizzontale ampio, basso)
        tl.to(frame, {
          width: () => vw() * 0.62,
          height: () => vh() * 0.46,
          duration: 0.55,
          ease: "expo.out"
        }, 0)
          // full: copre tutto lo schermo
          .to(frame, {
            width: () => vw(),
            height: () => vh(),
            duration: 0.45,
            ease: "power2.inOut"
          }, 0.55);
      } else {
        // ---------- MOBILE: apertura verticale/ritratto ----------
        // opening: cresce soprattutto in altezza (rettangolo verticale, stretto e alto)
        tl.to(frame, {
          width: () => vw() * 0.58,
          height: () => vh() * 0.62,
          duration: 0.55,
          ease: "expo.out"
        }, 0)
          .to(frame, {
            width: () => vw(),
            height: () => vh(),
            duration: 0.45,
            ease: "power2.inOut"
          }, 0.55);
      }

      if (isSplitTitle) {
        // titolo diviso in due righe: "Il giardino" segue l'immagine verso l'alto
        // stabilizzandosi sul bordo superiore, "del Lord" verso il basso, quasi
        // a contatto con il bordo inferiore. Il titolo resta sempre visibile,
        // non si dissolve con lo scroll.
        tl.to(titleTop, {
          top: "9%",
          duration: 0.55,
          ease: "expo.out"
        }, 0)
          .to(titleBottom, {
            top: "98%",
            duration: 0.55,
            ease: "expo.out"
          }, 0)
          .to(index, {
            opacity: 0,
            duration: 0.2
          }, 0.5);
      } else {
        // il titolo si scala leggermente verso il basso man mano che l'immagine cresce,
        // per restare leggibile e poi dissolversi quando si arriva a "full"
        tl.to(title, {
          scale: 0.82,
          duration: 0.55,
          ease: "expo.out"
        }, 0)
          .to(index, {
            opacity: 0,
            duration: 0.2
          }, 0.5)
          .to(title, {
            opacity: 0.0,
            duration: 0.25,
            ease: "power1.out"
          }, 0.85);
      }

      // leggera desaturazione/oscuramento iniziale dell'immagine quando è ancora piccola,
      // per richiamare l'idea "darkroom" già usata altrove nel progetto
      tl.fromTo(img, {
        filter: "brightness(0.55) saturate(0.7)"
      }, {
        filter: "brightness(1) saturate(1)",
        duration: 0.55,
        ease: "expo.out"
      }, 0);
    });
  }

  buildRevealTimelines();

  /* ---------------------------------------------------------
     5) RESIZE HANDLING
     ---------------------------------------------------------
     Su resize importante (es. rotazione, o passaggio desktop<->mobile)
     ricalcoliamo le timeline, perché l'aspect ratio del reveal cambia
     in base al breakpoint.
  --------------------------------------------------------- */
  let resizeTimeout;
  let lastWasMobile = isMobile();

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const nowMobile = isMobile();
      ScrollTrigger.refresh();
      if (nowMobile !== lastWasMobile) {
        lastWasMobile = nowMobile;
        buildRevealTimelines();
      }
    }, 200);
  });

})();
