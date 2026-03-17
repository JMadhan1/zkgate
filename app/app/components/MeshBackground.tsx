'use client';

import React, { useRef, useEffect } from 'react';

const PARTICLE_COLORS = [
  { r: 0, g: 240, b: 255 },    // cyan
  { r: 0, g: 240, b: 255 },    // cyan (weighted)
  { r: 0, g: 240, b: 255 },    // cyan (weighted)
  { r: 139, g: 92, b: 246 },   // purple
  { r: 139, g: 92, b: 246 },   // purple
  { r: 240, g: 80, b: 240 },   // pink (rare)
];

export const MeshBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const particleCount = 65;
    const connectionDistance = 140;

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: { r: number; g: number; b: number };
      opacity: number;

      constructor() {
        this.x = Math.random() * (canvas?.width || 0);
        this.y = Math.random() * (canvas?.height || 0);
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 1.8 + 0.4;
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.opacity = Math.random() * 0.45 + 0.15;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (canvas) {
          if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
          if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
        ctx.fill();
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      resize();
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < connectionDistance) {
            const alpha = 0.12 * (1 - distance / connectionDistance);
            const c1 = particles[i].color;
            const c2 = particles[j].color;
            const r = Math.round((c1.r + c2.r) / 2);
            const g = Math.round((c1.g + c2.g) / 2);
            const b = Math.round((c1.b + c2.b) / 2);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      drawLines();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    init();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="mesh-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: 0.55,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
};
