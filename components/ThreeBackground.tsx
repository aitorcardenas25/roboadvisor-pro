'use client';

import { useEffect, useRef } from 'react';

export default function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width  = window.innerWidth;
    let height = window.innerHeight;

    canvas.width  = width;
    canvas.height = height;

    // ── Partícules financeres ─────────────────────────────────────────────────
    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      size: number;
      alpha: number;
      color: string;
      type: 'dot' | 'cross' | 'diamond';
    }

    const COLORS = ['#c9a84c', '#e8d5a3', '#ffffff', '#2d6a4f'];
    const particles: Particle[] = [];
    const NUM_PARTICLES = 80;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x:     Math.random() * width,
        y:     Math.random() * height,
        vx:    (Math.random() - 0.5) * 0.3,
        vy:    (Math.random() - 0.5) * 0.3,
        size:  Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.05,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        type:  ['dot', 'cross', 'diamond'][Math.floor(Math.random() * 3)] as Particle['type'],
      });
    }

    // ── Línies de connexió ─────────────────────────────────────────────────────
    const MAX_DIST = 120;

    // ── Gràfic de preu de fons ────────────────────────────────────────────────
    const priceData: number[] = [];
    const NUM_POINTS = 60;
    let basePrice = height * 0.6;

    for (let i = 0; i < NUM_POINTS; i++) {
      basePrice += (Math.random() - 0.45) * 15;
      basePrice  = Math.max(height * 0.3, Math.min(height * 0.8, basePrice));
      priceData.push(basePrice);
    }

    let offset = 0;

    // ── Draw ──────────────────────────────────────────────────────────────────
    function drawParticle(p: Particle) {
      if (!ctx) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.strokeStyle = p.color;

      if (p.type === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'cross') {
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.size * 2, p.y);
        ctx.lineTo(p.x + p.size * 2, p.y);
        ctx.moveTo(p.x, p.y - p.size * 2);
        ctx.lineTo(p.x, p.y + p.size * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size * 2);
        ctx.lineTo(p.x + p.size * 1.5, p.y);
        ctx.lineTo(p.x, p.y + p.size * 2);
        ctx.lineTo(p.x - p.size * 1.5, p.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawConnections() {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_DIST) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / MAX_DIST) * 0.08;
            ctx.strokeStyle = '#c9a84c';
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    function drawPriceChart() {
      if (!ctx) return;
      const startX  = 0;
      const stepX   = width / (NUM_POINTS - 1);
      const scrolled = priceData.map((_, i) =>
        priceData[(i + Math.floor(offset)) % NUM_POINTS]
      );

      // Àrea sota la línia
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, height);
      scrolled.forEach((y, i) => {
        ctx.lineTo(startX + i * stepX, y);
      });
      ctx.lineTo(width, height);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, height * 0.3, 0, height);
      grad.addColorStop(0, 'rgba(45,106,79,0.15)');
      grad.addColorStop(1, 'rgba(45,106,79,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Línia del preu
      ctx.beginPath();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#2d6a4f';
      ctx.lineWidth   = 1.5;
      scrolled.forEach((y, i) => {
        i === 0 ? ctx.moveTo(startX, y) : ctx.lineTo(startX + i * stepX, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    function drawOrbs() {
      if (!ctx) return;
      // Orbe verd fosc gran
      const g1 = ctx.createRadialGradient(
        width * 0.15, height * 0.3, 0,
        width * 0.15, height * 0.3, width * 0.35
      );
      g1.addColorStop(0, 'rgba(45,106,79,0.15)');
      g1.addColorStop(1, 'rgba(45,106,79,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      // Orbe daurat
      const g2 = ctx.createRadialGradient(
        width * 0.85, height * 0.7, 0,
        width * 0.85, height * 0.7, width * 0.25
      );
      g2.addColorStop(0, 'rgba(201,168,76,0.08)');
      g2.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);
    }

    // ── Animació principal ────────────────────────────────────────────────────
    function animate() {
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      // Fons base
      ctx.fillStyle = '#0d1f1a';
      ctx.fillRect(0, 0, width, height);

      drawOrbs();
      drawPriceChart();
      drawConnections();
      particles.forEach(p => {
        drawParticle(p);

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10)     p.x = width + 10;
        if (p.x > width + 10)  p.x = -10;
        if (p.y < -10)     p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      });

      offset += 0.05;
      animationId = requestAnimationFrame(animate);
    }

    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => {
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0"
      style={{ display: 'block' }}
    />
  );
}
