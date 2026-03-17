'use client';

import React, { useState, useEffect, useRef } from 'react';

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

const ZK_CHARS = 'ZK01プロバロス∑∆πΩΨΦzk0x₿⟨⟩∫√∞≠≡';

export const KonamiEasterEgg = () => {
  const [active, setActive] = useState(false);
  const seqRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      seqRef.current = [...seqRef.current, e.key].slice(-KONAMI.length);
      if (seqRef.current.join(',') === KONAMI.join(',')) {
        setActive(true);
        timerRef.current = setTimeout(() => setActive(false), 4000);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = Math.floor(canvas.width / 20);
    const drops: number[] = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 5, 16, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = ZK_CHARS[Math.floor(Math.random() * ZK_CHARS.length)];
        const brightness = Math.random();
        if (brightness > 0.95) {
          ctx.fillStyle = '#ffffff';
        } else if (brightness > 0.7) {
          ctx.fillStyle = '#00f0ff';
        } else {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
        }
        ctx.font = '14px JetBrains Mono, monospace';
        ctx.fillText(char, i * 20, drops[i] * 20);
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="matrix-overlay" style={{ zIndex: 9998 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        zIndex: 1,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#00f0ff',
        textShadow: '0 0 20px rgba(0,240,255,0.8)',
      }}>
        <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '0.3em' }}>ZK</div>
        <div style={{ fontSize: '0.75rem', marginTop: '8px', opacity: 0.6, letterSpacing: '0.4em' }}>
          PROOF UNLOCKED
        </div>
      </div>
    </div>
  );
};
