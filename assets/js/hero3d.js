/*
 * hero3d.js — optional lightweight 3D hero (only loaded when features.hero3d is true).
 *
 * A stylised brick wall (one InstancedMesh + merged edge lines, ~60 bricks, no textures)
 * that rotates slowly. Three.js is loaded from cdnjs at an EXACT pinned version.
 *
 * Safety rules: rendering pauses when the hero is offscreen or the tab is hidden,
 * pixel ratio is capped at 1.5, and any failure leaves the static hero image in place.
 */
(function () {
  'use strict';

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var host = document.querySelector('[data-hero-visual][data-hero3d]');
  if (!host) return;

  var script = document.createElement('script');
  script.src = THREE_URL;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.onload = function () { try { start(window.THREE); } catch (e) { /* keep static image */ } };
  document.head.appendChild(script);

  function cssColor(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function start(THREE) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100);
    camera.position.set(0, 0.6, 11);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(4, 6, 8);
    scene.add(sun);

    // Wall: running bond, 9 rows, 6-7 bricks per row.
    var BW = 1.5, BH = 0.5, BD = 0.7, GAP = 0.06, ROWS = 9, COLS = 7;
    var geo = new THREE.BoxGeometry(BW, BH, BD);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var count = ROWS * COLS;
    var bricks = new THREE.InstancedMesh(geo, mat, count);
    var group = new THREE.Group();
    var m = new THREE.Matrix4(), col = new THREE.Color();
    var edgeGeo = new THREE.EdgesGeometry(geo);
    var edgePos = edgeGeo.attributes.position;
    var lines = [], i = 0, r, c;
    for (r = 0; r < ROWS; r++) {
      var offset = (r % 2) * (BW + GAP) / 2;
      for (c = 0; c < COLS; c++) {
        var x = (c - (COLS - 1) / 2) * (BW + GAP) + offset - (BW + GAP) / 2 * 0;
        var y = (r - (ROWS - 1) / 2) * (BH + GAP);
        m.makeTranslation(x, y, 0);
        bricks.setMatrixAt(i, m);
        // deterministic tone variation, no randomness so every load looks the same
        var t = ((i * 37) % 11) / 11;
        bricks.userData['t' + i] = t;
        for (var k = 0; k < edgePos.count; k++) {
          lines.push(edgePos.getX(k) + x, edgePos.getY(k) + y, edgePos.getZ(k));
        }
        i++;
      }
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    var lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
    var edgeLines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(bricks, edgeLines);
    group.rotation.x = -0.12;
    scene.add(group);

    function recolor() {
      var base = new THREE.Color(cssColor('--surface-2', '#e4e0d8'));
      var accent = new THREE.Color(cssColor('--accent', '#f26a1b'));
      for (var n = 0; n < count; n++) {
        var t = bricks.userData['t' + n];
        col.copy(base).lerp(accent, 0.18 + t * 0.35);
        bricks.setColorAt(n, col);
      }
      bricks.instanceColor.needsUpdate = true;
      lineMat.color.set(cssColor('--ink', '#1b1a18'));
    }
    recolor();
    document.addEventListener('themechange', recolor);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { setTimeout(recolor, 0); });

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    host.appendChild(canvas);
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);

    // Render loop: runs only while visible.
    var running = false, visible = true, last = 0, raf = 0;
    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      group.rotation.y += dt * 0.00022; // slow turn
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      var should = visible && !document.hidden;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', sync);

    renderer.render(scene, camera); // first frame, then reveal the canvas over the static image
    host.classList.add('has-3d');
    sync();
  }
})();
