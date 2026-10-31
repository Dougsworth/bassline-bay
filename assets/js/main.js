(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header state and mobile menu ---------- */
  var header = document.querySelector(".site-header");
  var heroEl = document.getElementById("hero");
  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 40);
    header.classList.toggle("in-hero", window.scrollY < heroEl.offsetHeight - 140);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }
  toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); toggle.focus(); }
  });

  /* ---------- Countdown (Jamaica stays on UTC minus 5 all year) ---------- */
  var target = Date.UTC(2027, 6, 22, 22, 0, 0); // 5 PM in Montego Bay
  var cd = {
    d: document.querySelector('[data-cd="d"]'),
    h: document.querySelector('[data-cd="h"]'),
    m: document.querySelector('[data-cd="m"]'),
    s: document.querySelector('[data-cd="s"]')
  };
  function pad(n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; }
  function tick() {
    var s = Math.floor(Math.max(0, target - Date.now()) / 1000);
    cd.d.textContent = pad(Math.floor(s / 86400), 3);
    cd.h.textContent = pad(Math.floor((s % 86400) / 3600), 2);
    cd.m.textContent = pad(Math.floor((s % 3600) / 60), 2);
    cd.s.textContent = pad(s % 60, 2);
  }
  tick();
  setInterval(tick, 1000);

  /* =========================================================
     Hero sea: raw WebGL fragment shader
     ========================================================= */
  var bass = { level: 0, smooth: 0 }; // fed by the audio analyser
  var sea = (function initSea() {
    var canvas = document.getElementById("sea");
    var hero = document.getElementById("hero");
    if (!canvas) return null;
    var gl = null;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" }) ||
           canvas.getContext("experimental-webgl");
    } catch (e) { gl = null; }
    if (!gl) return null;

    var vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    var fs = [
      "precision mediump float;",
      "uniform vec2 uRes;uniform float uTime;uniform vec2 uPtr;uniform float uBass;uniform float uHz;",
      "const vec3 DEEP=vec3(.031,.067,.161);",
      "const vec3 NIGHT=vec3(.055,.102,.227);",
      "const vec3 PLUM=vec3(.24,.16,.29);",
      "const vec3 EMBER=vec3(.79,.28,.12);",
      "const vec3 SUN=vec3(1.,.353,.122);",
      "const vec3 GOLD=vec3(1.,.70,.36);",
      "const vec3 SAND=vec3(.949,.847,.655);",
      "float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}",
      // the bass waveform: a few stacked sines, louder near the pointer
      "float wave(float x,float t,float amp){",
      "  float w=sin(x*7.0+t*1.3)*.55+sin(x*13.0-t*2.1)*.3+sin(x*29.0+t*3.7)*.15;",
      "  return w*amp;}",
      "void main(){",
      "  vec2 uv=gl_FragCoord.xy/uRes;",
      "  float asp=uRes.x/uRes.y;",
      "  float x=uv.x*asp;",
      "  float t=uTime;",
      "  float near=exp(-pow((uv.x-uPtr.x)*3.2,2.0));",
      "  float amp=.006+uBass*.05+near*(.008+.012*uPtr.y);",
      "  float hz=uHz+wave(x,t,amp);",
      "  vec3 col;",
      "  vec2 sc=vec2((.64+(uPtr.x-.5)*.06)*asp,uHz+.02);",
      "  float r=.27*clamp(asp*.9,.5,1.0);",
      "  if(uv.y>hz){",
      // sky, posterised into print bands
      "    float k=clamp((uv.y-hz)/(1.0-hz),0.,1.);",
      "    float kb=floor(k*16.0)/16.0;",
      "    col=mix(EMBER,PLUM,smoothstep(0.,.18,kb));",
      "    col=mix(col,NIGHT,smoothstep(.15,.55,kb));",
      "    col=mix(col,DEEP,smoothstep(.55,1.,kb));",
      // sun disk with bands that thicken toward the horizon and pulse with the bass
      "    vec2 d=vec2(x,uv.y)-sc;",
      "    float dist=length(d);",
      "    if(dist<r){",
      "      vec3 sunc=mix(SUN,GOLD,smoothstep(-.05,.8,d.y/r));",
      "      float s=1.0-(uv.y-hz)/(r*.6);",
      "      float cut=0.;",
      "      if(s>0.&&s<1.){float f=fract(s*5.0-t*.12);cut=step(1.0-s*(.5+uBass*.45),f);}",
      "      col=mix(sunc,col,cut);",
      "    }",
      // thin stars
      "    vec2 g=floor(gl_FragCoord.xy/3.0);",
      "    float st=step(.9975,hash(g))*smoothstep(.45,.9,k);",
      "    col=mix(col,SAND,st*.8);",
      "  }else{",
      // sea with perspective swell
      "    float dep=clamp((hz-uv.y)/hz,0.,1.);",
      "    float z=1.0/(dep+.035);",
      "    float sw=sin(z*1.6-t*1.4+sin(x*2.2+z*.25+t*.4)*1.2+wave(x,t*.8,1.0)*(.4+uBass*2.5+near*.8));",
      "    col=mix(NIGHT,DEEP,smoothstep(0.,.9,dep));",
      "    col=mix(col,PLUM*.9,(1.0-smoothstep(0.,.12,dep))*.7);",
      // sun reflection broken into ripples
      "    float spread=.05+dep*.32;",
      "    float off=sin(z*2.3+t*2.0)*.012*(1.0+uBass*3.0);",
      "    float col_x=abs(x+off-sc.x)/spread;",
      "    float beam=(1.0-smoothstep(.6,1.0,col_x))*step(.45,sw)*(1.0-smoothstep(.02,.22,dep*max(1.0,1.4/asp)));",
      "    col=mix(col,mix(SUN,GOLD,step(.75,sw)*(1.0-dep)),beam);",
      // sand coloured waveform lines across the water
      "    for(int i=0;i<6;i++){",
      "      float fi=float(i);",
      "      float ly=hz*(1.0-.62*pow((fi+1.0)/6.0,1.25));",
      "      float a=(.003+.0035*fi)*(1.0+uBass*6.0+near*1.4);",
      "      float lw=wave(x*(1.0-fi*.06)+fi*1.7,t*(1.0+fi*.15),a);",
      "      float th=(.9+fi*.55)/uRes.y;",
      "      float ln=1.0-smoothstep(th*.4,th,abs(uv.y-(ly+lw)));",
      "      col=mix(col,SAND,ln*(.5-.06*fi));",
      "    }",
      "  }",
      // bright horizon line
      "  if(uv.y<hz){col=mix(col,DEEP,smoothstep(.45,.0,uv.y/hz)*.55);}",
      "  float hl=1.0-smoothstep(0.,1.6/uRes.y,abs(uv.y-hz));",
      "  col=mix(col,GOLD,hl*.85);",
      "  gl_FragColor=vec4(col,1.);",
      "}"
    ].join("\n");

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      if (window.console) console.warn("Sea shader unavailable", err);
      return null; // CSS and SVG fallback stays visible
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      ptr: gl.getUniformLocation(prog, "uPtr"),
      bass: gl.getUniformLocation(prog, "uBass"),
      hz: gl.getUniformLocation(prog, "uHz")
    };

    document.documentElement.classList.add("gl");
    var ptr = { x: .62, y: .3 }, ptrT = { x: .62, y: .3 };
    var visible = true, running = false, start = performance.now(), raf = 0;
    var horizon = .4;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      // keep the horizon just above the hero copy on every screen
      var foot = document.querySelector(".hero-foot");
      if (foot) {
        var hr = hero.getBoundingClientRect(), fr = foot.getBoundingClientRect();
        var above = (hr.bottom - fr.top) / hr.height;
        horizon = Math.min(.62, Math.max(.3, above + .05));
      }
    }

    function draw(now) {
      var t = (now - start) / 1000;
      ptr.x += (ptrT.x - ptr.x) * .06;
      ptr.y += (ptrT.y - ptr.y) * .06;
      bass.smooth += (bass.level - bass.smooth) * .35;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, reduceMotion ? 12.0 : t);
      gl.uniform2f(u.ptr, ptr.x, ptr.y);
      gl.uniform1f(u.bass, bass.smooth);
      gl.uniform1f(u.hz, horizon);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    function play() {
      if (running || reduceMotion || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function pause() { running = false; cancelAnimationFrame(raf); }

    resize();
    draw(performance.now());
    canvas.classList.add("ready");

    window.addEventListener("resize", function () { resize(); if (!running) draw(performance.now()); });
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      ptrT.x = (e.clientX - r.left) / r.width;
      ptrT.y = 1 - (e.clientY - r.top) / r.height;
    });
    hero.addEventListener("pointerleave", function () { ptrT.x = .62; ptrT.y = .3; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) play(); else pause();
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
    play();

    return { redraw: function () { draw(performance.now()); } };
  })();

  /* =========================================================
     Play the vibe: synthesised one drop bass pulse
     ========================================================= */
  var vibeBtn = document.getElementById("vibe");
  var vibeText = vibeBtn.querySelector(".vibe-text");
  var audio = null;

  function buildAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC();
    var master = ctx.createGain();
    master.gain.value = 0;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 6;
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    lp.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    var bpm = 76, beat = 60 / bpm, step = beat / 2; // eighth notes
    // A minor line, one bar of eight steps, rests are 0
    var line = [55, 0, 0, 55, 65.41, 0, 73.42, 0, 55, 0, 0, 55, 82.41, 0, 73.42, 65.41];
    var idx = 0, nextT = ctx.currentTime + .1, timer = null;

    function note(f, when, dur) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o2.type = "triangle"; o2.frequency.value = f * 2;
      var g2 = ctx.createGain(); g2.gain.value = .18;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(.9, when + .02);
      g.gain.exponentialRampToValueAtTime(.001, when + dur);
      o.start(when); o2.start(when); o.stop(when + dur + .05); o2.stop(when + dur + .05);
    }
    function kick(when) { // one drop: the kick lands on beat three
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, when);
      o.frequency.exponentialRampToValueAtTime(42, when + .18);
      g.gain.setValueAtTime(.8, when);
      g.gain.exponentialRampToValueAtTime(.001, when + .32);
      o.connect(g); g.connect(master);
      o.start(when); o.stop(when + .35);
    }
    function schedule() {
      while (nextT < ctx.currentTime + .25) {
        var f = line[idx % line.length];
        if (f) note(f, nextT, step * 1.7);
        if (idx % 8 === 4) kick(nextT);
        idx++;
        nextT += step;
      }
    }
    var data = new Uint8Array(analyser.fftSize);
    function level() {
      analyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / data.length) * 3.2);
    }
    var meter = 0;
    function meterLoop() {
      bass.level = level();
      if (reduceMotion && sea) { /* keep the sea still for reduced motion */ }
      meter = requestAnimationFrame(meterLoop);
    }
    return {
      start: function () {
        ctx.resume();
        nextT = ctx.currentTime + .1;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(.5, ctx.currentTime, .3);
        schedule();
        timer = setInterval(schedule, 60);
        meterLoop();
      },
      stop: function () {
        master.gain.setTargetAtTime(0, ctx.currentTime, .15);
        clearInterval(timer);
        setTimeout(function () { cancelAnimationFrame(meter); bass.level = 0; ctx.suspend(); }, 700);
      }
    };
  }

  vibeBtn.addEventListener("click", function () {
    var on = vibeBtn.getAttribute("aria-pressed") !== "true";
    if (!audio) audio = buildAudio();
    if (!audio) { vibeText.textContent = "Sound not supported here"; return; }
    vibeBtn.setAttribute("aria-pressed", String(on));
    vibeText.textContent = on ? "Stop the vibe" : "Play the vibe";
    if (on) audio.start(); else audio.stop();
  });

  /* ---------- Schedule ---------- */
  var schedule = {
    thu: { label: "Thursday 22 July", sets: [
      ["5:30 PM", "Linstead Hi Fi", "Yard Stage", "Roots sound system"],
      ["6:15 PM", "Selector Juno", "Reef Stage", "Lovers rock and dub"],
      ["7:00 PM", "Treasure Beach Rockers", "Sunset Stage", "Roots reggae"],
      ["8:15 PM", "Sister Calabash", "Reef Stage", "Conscious reggae"],
      ["9:00 PM", "Ochi Bloom Band", "Sunset Stage", "Live reggae band"],
      ["10:15 PM", "Ras Caliber", "Sunset Stage", "Nyabinghi and dub"],
      ["11:30 PM", "Iyah Bloom", "Sunset Stage", "Roots reggae"],
      ["12:45 AM", "Marcus Tidewater", "Sunset Stage", "Reggae", true]
    ]},
    fri: { label: "Friday 23 July", sets: [
      ["5:30 PM", "Yard Kontrol Sound", "Yard Stage", "Dancehall selection"],
      ["7:00 PM", "MC Breadfruit", "Reef Stage", "Dancehall"],
      ["8:00 PM", "Duchess Ninety", "Sunset Stage", "Old school dancehall"],
      ["9:00 PM", "Bogle Street Crew", "Reef Stage", "Dance crew showcase"],
      ["10:00 PM", "Jada Kingston", "Sunset Stage", "Dancehall"],
      ["11:15 PM", "Kemar Blaze", "Sunset Stage", "Dancehall"],
      ["12:30 AM", "Shanique Fire", "Sunset Stage", "Dancehall"],
      ["1:45 AM", "Vexx Montana", "Sunset Stage", "Dancehall", true]
    ]},
    sat: { label: "Saturday 24 July", sets: [
      ["5:30 PM", "DJ Ackee", "Yard Stage", "Afrobeats and amapiano"],
      ["7:00 PM", "Kizzy Mas", "Reef Stage", "Soca"],
      ["8:00 PM", "Wala Wala Sound", "Yard Stage", "Afroswing selection"],
      ["9:00 PM", "Belmont Brass Collective", "Sunset Stage", "Soca brass band"],
      ["10:00 PM", "Ife Marlowe", "Reef Stage", "Afrobeats"],
      ["11:15 PM", "Tobi Sunset", "Sunset Stage", "Afrobeats"],
      ["12:30 AM", "Carnival Theory", "Sunset Stage", "Power soca"],
      ["1:45 AM", "Adaeze", "Sunset Stage", "Afrobeats", true]
    ]}
  };

  var body = document.getElementById("sched-body");
  var status = document.getElementById("sched-status");
  var filterBtns = document.querySelectorAll(".filter-btn");
  var dayNames = { thu: "Thursday", fri: "Friday", sat: "Saturday" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rowHtml(set, k, idx) {
    return '<div class="sched-row' + (set[4] ? " is-head" : "") + (reduceMotion ? "" : " enter") + '" role="row" style="--i:' + idx + '">' +
      '<span class="sched-time" role="cell">' + esc(set[0]) + "<small>" + dayNames[k] + "</small></span>" +
      '<span class="sched-artist" role="cell">' + esc(set[1]) + "</span>" +
      '<span class="sched-stage" role="cell"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(set[2]) + "</span>" +
      '<span class="sched-genre" role="cell">' + esc(set[3]) + "</span></div>";
  }

  function renderSchedule(night) {
    var html = "", count = 0, idx = 0;
    var keys = night === "all" ? ["thu", "fri", "sat"] : [night];
    keys.forEach(function (k) {
      if (night === "all") html += '<div class="sched-day" role="row"><span role="cell">' + schedule[k].label + "</span></div>";
      schedule[k].sets.forEach(function (s) { html += rowHtml(s, k, idx++); count++; });
    });
    body.innerHTML = html;
    status.textContent = night === "all"
      ? "Showing all " + count + " sets across three nights. Times are local and can shift a little on the night."
      : "Showing " + count + " sets for " + schedule[night].label + ". Times are local and can shift a little on the night.";
    filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.night === night)); });
  }
  filterBtns.forEach(function (b) {
    b.addEventListener("click", function () { renderSchedule(b.dataset.night); });
  });
  renderSchedule("thu");

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".acc-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      if (reduceMotion) { panel.hidden = open; return; }
      if (open) {
        panel.style.height = panel.scrollHeight + "px";
        requestAnimationFrame(function () {
          panel.style.transition = "height .35s cubic-bezier(.2,.7,.1,1)";
          panel.style.height = "0px";
        });
        panel.addEventListener("transitionend", function done() {
          panel.hidden = true; panel.style.height = ""; panel.style.transition = "";
          panel.removeEventListener("transitionend", done);
        });
      } else {
        panel.hidden = false;
        var h = panel.scrollHeight;
        panel.style.height = "0px";
        requestAnimationFrame(function () {
          panel.style.transition = "height .4s cubic-bezier(.2,.7,.1,1)";
          panel.style.height = h + "px";
        });
        panel.addEventListener("transitionend", function done() {
          panel.style.height = ""; panel.style.transition = "";
          panel.removeEventListener("transitionend", done);
        });
      }
    });
  });

  /* ---------- Checkout drawer ---------- */
  var prices = { general: 24000, vip: 52000, cabana: 285000 };
  var names = { general: "General", vip: "VIP", cabana: "Cabana" };
  var RATE = 155; // JMD per USD, indicative only
  var FEE = 0.05;
  var MAX_QTY = 8;

  var drawer = document.getElementById("checkout");
  var coForm = document.getElementById("co-form");
  var coDone = document.getElementById("co-done");
  var qtyOut = document.getElementById("qty");
  var stepDown = drawer.querySelector('[data-step="-1"]');
  var stepUp = drawer.querySelector('[data-step="1"]');
  var coEmail = document.getElementById("co-email");
  var coEmailErr = document.getElementById("co-email-err");
  var qty = 1;
  var lastTrigger = null;

  function jmd(n) { return "JMD " + Math.round(n).toLocaleString("en-US"); }
  function usd(n) { return "About US$" + Math.round(n / RATE).toLocaleString("en-US"); }
  function currentTier() { return coForm.querySelector('input[name="tier"]:checked').value; }

  function updateTotals() {
    var max = currentTier() === "cabana" ? 3 : MAX_QTY;
    if (qty > max) qty = max;
    qtyOut.textContent = qty;
    stepDown.disabled = qty <= 1;
    stepUp.disabled = qty >= max;
    var sub = prices[currentTier()] * qty;
    var fee = sub * FEE;
    document.getElementById("sum-sub").textContent = jmd(sub);
    document.getElementById("sum-fee").textContent = jmd(fee);
    document.getElementById("sum-total").textContent = jmd(sub + fee);
    document.getElementById("sum-usd").textContent = usd(sub + fee);
  }

  function openCheckout(tier, trigger) {
    lastTrigger = trigger || null;
    coForm.hidden = false;
    coDone.hidden = true;
    coForm.reset();
    coEmailErr.textContent = "";
    coEmail.removeAttribute("aria-invalid");
    var radio = coForm.querySelector('input[value="' + (tier || "general") + '"]');
    if (radio) radio.checked = true;
    qty = 1;
    updateTotals();
    setMenu(false);
    drawer.classList.remove("closing");
    drawer.showModal();
    document.body.style.overflow = "hidden";
    if (radio) radio.focus();
  }

  function finishClose() { drawer.classList.remove("closing"); drawer.close(); }
  function closeCheckout() {
    if (!drawer.open) return;
    if (reduceMotion) { finishClose(); return; }
    drawer.classList.add("closing");
    setTimeout(finishClose, 280);
  }
  drawer.addEventListener("close", function () {
    document.body.style.overflow = "";
    if (lastTrigger) lastTrigger.focus();
  });
  drawer.addEventListener("cancel", function (e) { e.preventDefault(); closeCheckout(); });
  drawer.addEventListener("click", function (e) { if (e.target === drawer) closeCheckout(); });

  document.querySelectorAll("[data-open-checkout]").forEach(function (b) {
    b.addEventListener("click", function () { openCheckout(b.dataset.tier, b); });
  });
  drawer.querySelectorAll("[data-close-checkout]").forEach(function (b) {
    b.addEventListener("click", closeCheckout);
  });
  coForm.addEventListener("change", function (e) { if (e.target.name === "tier") updateTotals(); });
  [stepDown, stepUp].forEach(function (b) {
    b.addEventListener("click", function () { qty = Math.max(1, qty + Number(b.dataset.step)); updateTotals(); });
  });

  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  coForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = coEmail.value.trim();
    if (!emailRe.test(v)) {
      coEmailErr.textContent = v ? "That email does not look quite right." : "We need an email to send your passes to.";
      coEmail.setAttribute("aria-invalid", "true");
      coEmail.focus();
      return;
    }
    coEmail.removeAttribute("aria-invalid");
    coEmailErr.textContent = "";
    var tier = currentTier();
    var total = prices[tier] * qty * (1 + FEE);
    document.getElementById("co-done-text").textContent =
      qty + " " + names[tier] + (qty > 1 ? " passes" : " pass") + " for " + jmd(total) +
      ". Your passes are on their way to " + v + ".";
    document.getElementById("co-ref").textContent = "BB27" + Math.random().toString(36).slice(2, 8).toUpperCase();
    coForm.hidden = true;
    coDone.hidden = false;
    coDone.focus();
  });

  /* ---------- Newsletter ---------- */
  var nf = document.getElementById("news-form");
  var nName = document.getElementById("nf-name");
  var nEmail = document.getElementById("nf-email");
  function setErr(input, msg) {
    document.getElementById(input.id + "-err").textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    return !msg;
  }
  function checkName() { return setErr(nName, nName.value.trim() ? "" : "Tell us what to call you."); }
  function checkEmail() {
    var v = nEmail.value.trim();
    return setErr(nEmail, !v ? "Add your email so we can reach you." : (emailRe.test(v) ? "" : "That email does not look quite right."));
  }
  nName.addEventListener("blur", function () { if (nName.value) checkName(); });
  nEmail.addEventListener("blur", function () { if (nEmail.value) checkEmail(); });
  nf.addEventListener("submit", function (e) {
    e.preventDefault();
    var okN = checkName(), okE = checkEmail();
    if (!okN) { nName.focus(); return; }
    if (!okE) { nEmail.focus(); return; }
    var done = document.getElementById("news-done");
    done.querySelector(".news-done-title").textContent = "Nice one, " + nName.value.trim() + ". You are on the list.";
    nf.classList.add("is-done");
    done.hidden = false;
    done.focus();
  });
})();
