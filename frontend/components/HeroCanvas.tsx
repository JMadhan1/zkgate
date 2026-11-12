"use client";

import { useEffect, useRef } from "react";

/**
 * Live hero: ~1,100 particles first spell out a citizen's private details
 * (the synthetic test citizen, not a real person), then swirl into a rotating
 * 24-spoke chakra in the tricolour — the proof. The data never "leaves"; it is
 * consumed and re-formed into something that reveals nothing. Particles shy
 * away from the pointer.
 *
 * Pure canvas 2D: no libraries, no inline scripts (CSP-safe). Pauses when off
 * screen or in a background tab; renders a still chakra for reduced motion.
 */

type Phase = "data" | "proof";

const DATA_LINES = ["Madhan Kumar", "DOB 10·07·1998", "12/4 MG Road", "Chittoor 517001", "XXXX XXXX 3632"];
const SAFFRON = [255, 122, 26];
const WHITE = [244, 240, 231];
const GREEN = [44, 196, 102];
const RED = [255, 112, 102];

// Visual jitter only, but keep the codebase free of Math.random entirely.
const _buf = new Uint32Array(256);
let _pos = 256;
function rnd(): number {
  if (_pos >= 256) { crypto.getRandomValues(_buf); _pos = 0; }
  return _buf[_pos++] / 4294967296;
}

export function HeroCanvas({ onPhase }: { onPhase?: (p: Phase) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const phaseCb = useRef(onPhase);
  phaseCb.current = onPhase;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let size = 0;
    let dpr = 1;
    let N = 0;
    // particle state (struct of arrays for speed)
    let px = new Float32Array(0), py = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0);
    let dataX = new Float32Array(0), dataY = new Float32Array(0), dataRed = new Uint8Array(0);
    let chR = new Float32Array(0), chA = new Float32Array(0); // chakra target in polar coords
    let jitter = new Float32Array(0);
    let phase: Phase = "data";
    let phaseT = 0; // seconds in current phase
    let mix = 0; // 0 = data colours, 1 = proof colours
    let rot = 0;
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const mouse = { x: -9999, y: -9999, active: false };

    function shuffle(n: number) {
      const idx = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return idx;
    }

    function sampleText(s: number, count: number) {
      const off = document.createElement("canvas");
      off.width = s; off.height = s;
      const o = off.getContext("2d")!;
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      const fs = Math.round(s * 0.088);
      o.font = `800 ${fs}px ${family}`;
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillStyle = "#fff";
      const lh = fs * 1.18;
      const top = s / 2 - ((DATA_LINES.length - 1) * lh) / 2;
      DATA_LINES.forEach((line, i) => {
        // shrink overly wide lines to fit
        let f = fs;
        o.font = `800 ${f}px ${family}`;
        while (o.measureText(line).width > s * 0.9 && f > 8) { f -= 2; o.font = `800 ${f}px ${family}`; }
        o.fillText(line, s / 2, top + i * lh);
      });
      const img = o.getImageData(0, 0, s, s).data;
      const pts: number[] = [];
      const step = Math.max(2, Math.round(s / 260));
      for (let y = 0; y < s; y += step) for (let x = 0; x < s; x += step) if (img[(y * s + x) * 4 + 3] > 140) pts.push(x, y);
      const n = pts.length / 2;
      const order = shuffle(n);
      const xs = new Float32Array(count), ys = new Float32Array(count), red = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        const k = order[i % n];
        xs[i] = pts[k * 2] + (i >= n ? (rnd() - 0.5) * step : 0);
        ys[i] = pts[k * 2 + 1];
        // the Aadhaar number line (last) and DOB read as the most sensitive
        const lineIdx = Math.min(DATA_LINES.length - 1, Math.max(0, Math.round((ys[i] - top) / lh)));
        red[i] = lineIdx === 1 || lineIdx === DATA_LINES.length - 1 ? 1 : 0;
      }
      return { xs, ys, red };
    }

    function chakraTargets(count: number) {
      const R = new Float32Array(count), A = new Float32Array(count);
      const rimOuter = 0.4, rimInner = 0.355, hub = 0.06;
      for (let i = 0; i < count; i++) {
        const u = i / count;
        if (u < 0.36) { // double rim
          const outer = i % 2 === 0;
          R[i] = outer ? rimOuter : rimInner;
          A[i] = (i / (count * 0.36)) * Math.PI * 2 * 1.0003;
        } else if (u < 0.9) { // 24 spokes
          const k = i - Math.floor(count * 0.36);
          const spoke = k % 24;
          const t = (Math.floor(k / 24) * 24) / (count * 0.54);
          R[i] = hub + t * (rimInner - hub);
          A[i] = (spoke / 24) * Math.PI * 2;
        } else { // hub disc
          R[i] = Math.sqrt(rnd()) * hub;
          A[i] = rnd() * Math.PI * 2;
        }
      }
      return { R, A };
    }

    function setup() {
      const rect = canvas!.getBoundingClientRect();
      size = Math.max(200, Math.floor(Math.min(rect.width, rect.height || rect.width)));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.floor(size * dpr);
      canvas!.height = Math.floor(size * dpr);
      const nextN = size < 420 ? 1100 : 1900;
      const t = sampleText(size, nextN);
      const c = chakraTargets(nextN);
      if (nextN !== N) {
        N = nextN;
        px = new Float32Array(N); py = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
        jitter = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const a = rnd() * Math.PI * 2, r = size * (0.5 + rnd() * 0.3);
          px[i] = size / 2 + Math.cos(a) * r; py[i] = size / 2 + Math.sin(a) * r;
          jitter[i] = rnd() * Math.PI * 2;
        }
      }
      dataX = t.xs; dataY = t.ys; dataRed = t.red; chR = c.R; chA = c.A;
    }

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function colorFor(i: number, y: number, out: number[]) {
      // data: cream, with sensitive lines in red. proof: tricolour by height.
      const d = dataRed[i] ? RED : WHITE;
      const band = y / size;
      const p = band < 0.4 ? SAFFRON : band > 0.6 ? GREEN : WHITE;
      out[0] = lerp(d[0], p[0], mix); out[1] = lerp(d[1], p[1], mix); out[2] = lerp(d[2], p[2], mix);
    }

    function setPhase(p: Phase) {
      phase = p; phaseT = 0;
      phaseCb.current?.(p);
      if (p === "proof") {
        // swirl impulse around the centre
        for (let i = 0; i < N; i++) {
          const dx = px[i] - size / 2, dy = py[i] - size / 2;
          vx[i] += -dy * 0.045; vy[i] += dx * 0.045;
        }
      } else {
        for (let i = 0; i < N; i++) { vx[i] += (rnd() - 0.5) * 14; vy[i] += (rnd() - 0.5) * 14; }
      }
    }

    const col = [0, 0, 0];
    function draw(dt: number, now: number) {
      const s = size, cx = s / 2, cy = s / 2;
      phaseT += dt;
      if (!reduce) {
        if (phase === "data" && phaseT > 3.4) setPhase("proof");
        else if (phase === "proof" && phaseT > 5.6) setPhase("data");
      }
      mix += ((phase === "proof" ? 1 : 0) - mix) * Math.min(1, dt * 2.2);
      rot += dt * (phase === "proof" ? 0.35 : 0.05);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, s, s);
      ctx!.globalCompositeOperation = "lighter";

      const k = 0.075, damp = 0.84, mr = s * 0.16, mr2 = mr * mr;
      const ps = s < 420 ? 1.6 : 1.9;
      for (let i = 0; i < N; i++) {
        let tx: number, ty: number;
        if (phase === "data") {
          tx = dataX[i]; ty = dataY[i];
        } else {
          const a = chA[i] + rot, r = chR[i] * s;
          tx = cx + Math.cos(a) * r; ty = cy + Math.sin(a) * r;
        }
        // gentle breathing so it never looks frozen
        tx += Math.sin(now * 0.0012 + jitter[i]) * 0.9;
        ty += Math.cos(now * 0.0011 + jitter[i]) * 0.9;

        let ax = (tx - px[i]) * k, ay = (ty - py[i]) * k;
        if (mouse.active) {
          const dx = px[i] - mouse.x, dy = py[i] - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < mr2 && d2 > 0.01) {
            const f = (1 - d2 / mr2) * 6 / Math.sqrt(d2);
            ax += dx * f; ay += dy * f;
          }
        }
        vx[i] = (vx[i] + ax) * damp; vy[i] = (vy[i] + ay) * damp;
        px[i] += vx[i] * dt * 60; py[i] += vy[i] * dt * 60;

        colorFor(i, py[i], col);
        const speed = Math.min(1, Math.abs(vx[i]) + Math.abs(vy[i]));
        ctx!.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${0.55 + 0.4 * (1 - speed * 0.5)})`;
        ctx!.fillRect(px[i] - ps / 2, py[i] - ps / 2, ps, ps);
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) draw(dt, now);
      raf = requestAnimationFrame(loop);
    }

    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const onMove = (e: PointerEvent) => {
      const r = canvas!.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * size;
      mouse.y = ((e.clientY - r.top) / r.height) * size;
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };

    let cancelled = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      setup();
      if (reduce) {
        // Still frame: the finished proof.
        phase = "proof"; mix = 1;
        for (let i = 0; i < N; i++) {
          px[i] = size / 2 + Math.cos(chA[i]) * chR[i] * size;
          py[i] = size / 2 + Math.sin(chA[i]) * chR[i] * size;
          vx[i] = vy[i] = 0;
        }
        phaseCb.current?.("proof");
        draw(0, 0);
        return;
      }
      phaseCb.current?.("data");
      ro = new ResizeObserver(() => setup());
      ro.observe(canvas!);
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
      io.observe(canvas!);
      canvas!.addEventListener("pointermove", onMove);
      canvas!.addEventListener("pointerleave", onLeave);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden />;
}
