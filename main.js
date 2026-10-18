/* haru luna — 月夜から、夜明けへ。
   イージングは CSS トークン（--ease-signature / --ease-utility）と同値の2本のみ。
   例外：開幕ローダーの円描画進捗だけ linear。 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);

  /* ---------- トークン ---------- */
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function b(p1, p2) { return 3 * p2 - 6 * p1; }
    function c(p1) { return 3 * p1; }
    function calc(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      return calc(t, y1, y2);
    };
  }
  var EASE_SIGNATURE = bezier(0.16, 1, 0.3, 1); // --ease-signature
  var EASE_UTILITY = bezier(0.4, 0, 0.2, 1); // --ease-utility
  var DUR_REVEAL = 1.0; // --dur-reveal
  var DUR_HERO = 1.2;
  var STAGGER = 0.08; // --stagger

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- 月齢アイコン（0=新月 / 1=満月、右から満ちる） ---------- */
  function moonPath(k, cx, cy, r) {
    k = clamp(k, 0, 1);
    if (k < 0.01) return "";
    if (k > 0.99) return "M" + cx + " " + (cy - r) + "A" + r + " " + r + " 0 1 1 " + cx + " " + (cy + r) + "A" + r + " " + r + " 0 1 1 " + cx + " " + (cy - r) + "Z";
    var rx = Math.abs(1 - 2 * k) * r;
    var sweep = k < 0.5 ? 0 : 1;
    return "M" + cx + " " + (cy - r) + "A" + r + " " + r + " 0 0 1 " + cx + " " + (cy + r) + "A" + rx + " " + r + " 0 0 " + sweep + " " + cx + " " + (cy - r) + "Z";
  }

  document.querySelectorAll("[data-phase]").forEach(function (el) {
    var k = parseFloat(el.getAttribute("data-phase"));
    el.innerHTML =
      '<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="moon-base" cx="20" cy="20" r="17"/><path class="moon-lit" d="' +
      moonPath(k, 20, 20, 17) +
      '"/></svg>';
  });

  /* ---------- 要素 ---------- */
  var header = document.querySelector("[data-header]");
  var hud = document.querySelector("[data-hud]");
  var hudTime = document.querySelector("[data-hud-time]");
  var hudLabel = document.querySelector("[data-hud-label]");
  var hudMoon = document.querySelector("[data-hud-moon]");
  var hudPct = document.querySelector("[data-hud-pct]");
  var chapters = Array.prototype.slice.call(document.querySelectorAll("[data-chapter]"));
  var dawn = document.getElementById("dawn");
  var dawnStage = document.querySelector("[data-dawn-stage]");
  var dawnWindow = document.querySelector("[data-dawn-window]");
  var dawnRing = document.querySelector("[data-dawn-ring]");
  var dawnCaps = document.querySelectorAll("[data-dawn-cap]");
  var dawnHint = document.querySelector("[data-dawn-hint]");
  var dawnVideo = document.querySelector("[data-dawn-video]");

  /* ---------- 星空（夜明けとともに消える） ---------- */
  var stars = (function () {
    var canvas = document.querySelector("[data-stars]");
    if (!canvas || !canvas.getContext) return { setOpacity: function () {} };
    var ctx = canvas.getContext("2d");
    var list = [];
    var w = 0, h = 0, dpr = 1, alpha = 1, running = false;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round((w * h) / 9000);
      list = [];
      for (var i = 0; i < n; i++) {
        list.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.1 + 0.25,
          base: Math.random() * 0.5 + 0.25,
          speed: Math.random() * 0.0012 + 0.0004,
          phase: Math.random() * Math.PI * 2,
          gold: Math.random() < 0.18
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      if (alpha <= 0.01) return;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        var tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        ctx.globalAlpha = s.base * tw * alpha;
        ctx.fillStyle = s.gold ? "#e9d3a0" : "#f3ecdf";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(t) {
      draw(t);
      if (alpha > 0.01 && !reduced) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }

    function start() {
      if (running) return;
      running = true;
      requestAnimationFrame(loop);
    }

    build();
    draw(0);
    window.addEventListener("resize", function () {
      build();
      draw(performance.now());
    });

    return {
      setOpacity: function (a) {
        var prev = alpha;
        alpha = a;
        if (reduced) {
          if (Math.abs(prev - a) > 0.02 || a === 0) draw(0);
          return;
        }
        if (a > 0.01) start();
        else draw(0);
      },
      start: start
    };
  })();

  /* ---------- スクロール連動（HUD・章・見せ場） ---------- */
  var current = null;
  var dawnColors = [
    [38, 39, 72], // --sky-3
    [122, 90, 120],
    [240, 196, 168] // --sky-4
  ];

  function mixColor(p) {
    var a, b, t;
    if (p < 0.5) {
      a = dawnColors[0]; b = dawnColors[1]; t = p / 0.5;
    } else {
      a = dawnColors[1]; b = dawnColors[2]; t = (p - 0.5) / 0.5;
    }
    return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")";
  }

  function updateDawn(vh, vw) {
    if (!dawn) return 0;
    var rect = dawn.getBoundingClientRect();
    var total = rect.height - vh;
    var p = clamp(-rect.top / total, 0, 1);
    if (reduced) p = rect.top < vh * 0.5 ? 1 : 0;

    var minR = Math.min(vw, vh) * (vw < 720 ? 0.3 : 0.17);
    var maxR = Math.hypot(vw, vh) / 2 + 4;
    var e = EASE_UTILITY(seg(p, 0.1, 0.8));
    var r = lerp(minR, maxR, e);
    dawnStage.style.setProperty("--r", r.toFixed(1) + "px");
    dawnStage.style.backgroundColor = mixColor(seg(p, 0, 0.8));

    var capOut = seg(p, 0.06, 0.34);
    dawnCaps.forEach(function (cap, i) {
      cap.style.opacity = String(1 - capOut);
      var dir = i === 0 ? -1 : 1;
      cap.style.transform = vw < 720 ? "translateY(" + (dir * capOut * 30).toFixed(1) + "px)" : "translateX(" + (dir * capOut * 60).toFixed(1) + "px)";
    });
    dawnRing.style.opacity = String(1 - seg(p, 0.35, 0.7));
    dawnHint.style.opacity = String(1 - seg(p, 0.02, 0.18));
    return p;
  }

  function onScroll() {
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var y = window.scrollY || window.pageYOffset;

    header.classList.toggle("is-scrolled", y > 24);

    // 章の判定（ビューポート中央を含む章）
    var mid = vh * 0.5;
    var found = null;
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        found = chapters[i];
        break;
      }
    }
    if (found && found !== current) {
      current = found;
      root.setAttribute("data-tone", found.getAttribute("data-tone"));
      hudTime.textContent = found.getAttribute("data-time");
      hudLabel.textContent = found.getAttribute("data-label");
    }
    hud.classList.toggle("is-hidden", !!(found && found.hasAttribute("data-hud-hide")));

    // 月が満ちる（ページ全体の進捗）
    var max = document.documentElement.scrollHeight - vh;
    var prog = max > 0 ? clamp(y / max, 0, 1) : 0;
    hudMoon.setAttribute("d", moonPath(Math.max(prog, 0.02), 20, 20, 15));
    hudPct.textContent = String(Math.round(prog * 100));

    // 見せ場
    var dp = updateDawn(vh, vw);

    // 星：夜明けの進行で消える
    var dawnTop = dawn ? dawn.getBoundingClientRect().top : Infinity;
    var starA = dawnTop > 0 ? 1 : 1 - seg(dp, 0, 0.55);
    stars.setOpacity(starA);

    // 動画は見えている間だけ再生
    if (dawnVideo) {
      var dr = dawn.getBoundingClientRect();
      var visible = dr.top < vh && dr.bottom > 0;
      if (visible && dawnVideo.paused && !reduced) {
        var pr = dawnVideo.play();
        if (pr && pr.catch) pr.catch(function () {});
      } else if (!visible && !dawnVideo.paused) {
        dawnVideo.pause();
      }
    }
  }

  var ticking = false;
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      onScroll();
    });
  }
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  onScroll();

  /* ---------- 行マスク・フェードアップ ---------- */
  function showAllStatic() {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    document.querySelectorAll("[data-mask], [data-hero-title]").forEach(function (el) {
      el.style.visibility = "visible";
    });
    document.querySelectorAll("[data-light-seq] li, [data-light-close]").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
      if (el.tagName === "LI") el.classList.add("is-lit");
    });
  }

  var lenis = null;

  if (!hasGsap || reduced) {
    showAllStatic();
  } else {
    gsap.registerPlugin(ScrollTrigger);

    // 見出し：行マスクせり上げ（transform は JS が占有）
    document.querySelectorAll("[data-mask]").forEach(function (el) {
      var lines = el.querySelectorAll(".line > span");
      gsap.set(lines, { y: 0, yPercent: 110 });
      gsap.set(el, { visibility: "visible" });
      gsap.to(lines, {
        yPercent: 0,
        duration: DUR_REVEAL,
        ease: EASE_SIGNATURE,
        stagger: STAGGER,
        scrollTrigger: { trigger: el, start: "top 86%", once: true }
      });
    });

    // グループ
    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      var items = group.querySelectorAll("[data-reveal]");
      ScrollTrigger.batch(items, {
        start: "top 88%",
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { opacity: 1, y: 0, duration: DUR_REVEAL, ease: EASE_SIGNATURE, stagger: STAGGER, overwrite: true });
        }
      });
    });

    // 単体
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      if (el.closest("[data-reveal-group]")) return;
      if (el.hasAttribute("data-hero-sub")) return;
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: DUR_REVEAL,
        ease: EASE_SIGNATURE,
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    // 届けたい未来：01→05 の順にひとつずつ現れ、番号に灯りがともる
    var lightSeq = document.querySelector("[data-light-seq]");
    if (lightSeq) {
      var lamps = lightSeq.querySelectorAll("li");
      var lightClose = document.querySelector("[data-light-close]");
      var GAP = 0.55; // 1つ灯ってから次が現れるまでの間
      var seqTl = gsap.timeline({
        paused: true
      });
      lamps.forEach(function (li, i) {
        var at = i * GAP;
        seqTl
          .to(li, { opacity: 1, y: 0, duration: DUR_REVEAL, ease: EASE_SIGNATURE }, at)
          .add(function () {
            li.classList.add("is-lit");
          }, at + 0.25);
      });
      if (lightClose) {
        seqTl.to(lightClose, { opacity: 1, y: 0, duration: DUR_REVEAL, ease: EASE_SIGNATURE }, lamps.length * GAP + 0.3);
      }
      ScrollTrigger.create({
        trigger: lightSeq,
        start: "top 78%",
        once: true,
        onEnter: function () {
          seqTl.play();
        }
      });
    }

    // Lenis 接続
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", function () {
        ScrollTrigger.update();
        requestTick();
      });
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
  }

  /* アンカーリンク（Lenis 経由で滑らかに） */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      var target = id.length > 1 ? document.querySelector(id) : null;
      if (!target) return;
      closeMenu();
      if (lenis) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: id === "#main" ? 0 : -10 });
        if (id === "#main") target.setAttribute("tabindex", "-1"), target.focus({ preventScroll: true });
      }
    });
  });

  /* ---------- 開幕：月＋深呼吸 ---------- */
  var loader = document.querySelector("[data-loader]");
  var heroTitleLines = document.querySelectorAll("[data-hero-title] .line > span");
  var heroTitle = document.querySelector("[data-hero-title]");
  var heroSubs = document.querySelectorAll("[data-hero-sub]");
  var heroLure = document.querySelector("[data-hero-lure]");
  var heroMoon = document.querySelector("[data-hero-moon]");
  var heroBack = document.querySelector("[data-hero-back]");

  var seen = false;
  try {
    seen = sessionStorage.getItem("hl-opening") === "1";
  } catch (e) {}

  function finishOpening() {
    if (loader) loader.classList.add("is-done");
    document.body.classList.remove("is-locked");
    if (lenis) lenis.start();
    hud.classList.add("is-on");
    stars.start && stars.start();
    try {
      sessionStorage.setItem("hl-opening", "1");
    } catch (e) {}
  }

  function playHero(delay) {
    if (!hasGsap || reduced) {
      heroTitle.style.visibility = "visible";
      return;
    }
    gsap.set(heroTitleLines, { y: 0, yPercent: 110 });
    gsap.set(heroTitle, { visibility: "visible" });
    gsap.set(heroSubs, { opacity: 0, y: 28 });
    gsap.set(heroLure, { opacity: 0 });
    var tl = gsap.timeline({ delay: delay });
    tl.fromTo(heroMoon, { opacity: 0, scale: 0.92 }, { opacity: window.innerWidth < 720 ? 0.55 : 0.92, scale: 1, duration: DUR_HERO * 1.4, ease: EASE_SIGNATURE }, 0)
      .fromTo(heroBack, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: DUR_HERO * 1.4, ease: EASE_SIGNATURE }, 0.1)
      .to(heroTitleLines, { yPercent: 0, duration: DUR_HERO, ease: EASE_SIGNATURE, stagger: STAGGER * 1.5 }, 0.15)
      .to(heroSubs, { opacity: 1, y: 0, duration: DUR_REVEAL, ease: EASE_SIGNATURE, stagger: STAGGER }, 0.7)
      .to(heroLure, { opacity: 1, duration: DUR_REVEAL * 0.6, ease: EASE_UTILITY }, 1.0);
  }

  if (!loader || seen || reduced || !hasGsap) {
    if (loader) loader.classList.add("is-done");
    finishOpening();
    playHero(0.1);
  } else {
    document.body.classList.add("is-locked");
    if (lenis) lenis.stop();
    var ring = loader.querySelector("[data-loader-ring]");
    var glow = loader.querySelector("[data-loader-glow]");
    var logo = loader.querySelector("[data-loader-logo]");
    var bIn = loader.querySelector("[data-breath-in]");
    var bOut = loader.querySelector("[data-breath-out]");

    var tl = gsap.timeline({
      onComplete: finishOpening
    });
    tl.to(ring, { strokeDashoffset: 0, duration: 2.0, ease: "none" }, 0) // 例外：linear
      .to(logo, { opacity: 0.9, duration: 0.8, ease: EASE_UTILITY }, 0.1)
      .to(bIn, { opacity: 1, duration: 0.35, ease: EASE_UTILITY }, 0.05)
      .to(glow, { scale: 1.12, duration: 1.0, ease: EASE_UTILITY }, 0)
      .to(bIn, { opacity: 0, duration: 0.3, ease: EASE_UTILITY }, 0.95)
      .to(bOut, { opacity: 1, duration: 0.35, ease: EASE_UTILITY }, 1.05)
      .to(glow, { scale: 0.86, duration: 1.0, ease: EASE_UTILITY }, 1.0)
      .to(loader, { autoAlpha: 0, duration: 0.5, ease: EASE_UTILITY }, 2.0)
      .add(function () {
        playHero(0);
      }, 1.95);

    loader.querySelector("[data-loader-skip]").addEventListener("click", function () {
      tl.progress(1);
    });
  }

  /* ---------- マグネティック（応答） ---------- */
  if (finePointer && !reduced) {
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.28;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.36;
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------- モバイルメニュー ---------- */
  var toggle = document.querySelector("[data-menu-toggle]");
  var nav = document.querySelector("[data-nav]");
  function closeMenu() {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- ギャラリー拡大 ---------- */
  var lightbox = document.querySelector("[data-lightbox]");
  var lbImg = document.querySelector("[data-lightbox-img]");
  var lbCap = document.querySelector("[data-lightbox-cap]");
  var shots = Array.prototype.slice.call(document.querySelectorAll("[data-gallery] img"));
  var lbIndex = 0;

  function showShot(i) {
    lbIndex = (i + shots.length) % shots.length;
    var img = shots[lbIndex];
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = img.alt + "（" + (lbIndex + 1) + " / " + shots.length + "）";
  }

  if (lightbox && typeof lightbox.showModal === "function") {
    shots.forEach(function (img, i) {
      img.parentElement.setAttribute("aria-label", img.alt + "を拡大");
      img.parentElement.addEventListener("click", function () {
        showShot(i);
        lightbox.showModal();
        if (lenis) lenis.stop();
      });
    });
    lightbox.addEventListener("close", function () {
      if (lenis) lenis.start();
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) lightbox.close();
    });
    lightbox.querySelector("[data-lb-close]").addEventListener("click", function () { lightbox.close(); });
    lightbox.querySelector("[data-lb-prev]").addEventListener("click", function () { showShot(lbIndex - 1); });
    lightbox.querySelector("[data-lb-next]").addEventListener("click", function () { showShot(lbIndex + 1); });
    lightbox.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") showShot(lbIndex - 1);
      if (e.key === "ArrowRight") showShot(lbIndex + 1);
    });
  }
})();
