'use client';

import { useEffect, useRef } from 'react';

export default function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    let animId: number;
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    let t = 0;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; color: string;
      pulse: number; pulseSpeed: number;
    }

    const COLORS = ['#c9a84c', '#e8d5a3', '#ffffff', '#2d6a4f', '#c9a84c'];
    const particles: Particle[] = Array.from({ length: 100 }, () => ({
      x:          Math.random() * W,
      y:          Math.random() * H,
      vx:         (Math.random() - 0.5) * 0.25,
      vy:         (Math.random() - 0.5) * 0.25,
      size:       Math.random() * 1.8 + 0.4,
      alpha:      Math.random() * 0.5 + 0.05,
      color:      COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse:      Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    }));

    const priceData: number[] = [];
    const N_PTS = 80;
    let bp = H * 0.58;
    for (let i = 0; i < N_PTS; i++) {
      bp += (Math.random() - 0.44) * 12;
      bp = Math.max(H * 0.25, Math.min(H * 0.78, bp));
      priceData.push(bp);
    }
    let chartOffset = 0;

    function drawAurora() {
      const cx1 = W * 0.12 + Math.sin(t * 0.4) * W * 0.04;
      const cy1 = H * 0.25 + Math.cos(t * 0.3) * H * 0.06;
      const g1  = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, W * 0.45);
      g1.addColorStop(0, 'rgba(45,106,79,0.18)');
      g1.addColorStop(0.4, 'rgba(45,106,79,0.07)');
      g1.addColorStop(1, 'rgba(45,106,79,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      const cx2 = W * 0.88 + Math.cos(t * 0.25) * W * 0.05;
      const cy2 = H * 0.72 + Math.sin(t * 0.35) * H * 0.05;
      const g2  = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, W * 0.3);
      g2.addColorStop(0, 'rgba(201,168,76,0.12)');
      g2.addColorStop(0.5, 'rgba(201,168,76,0.04)');
      g2.addColorStop(1, 'rgba(201,168,76,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      const cx3 = W * 0.5 + Math.sin(t * 0.18) * W * 0.08;
      const cy3 = H * 0.45 + Math.cos(t * 0.22) * H * 0.08;
      const g3  = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, W * 0.28);
      g3.addColorStop(0, 'rgba(10,40,30,0.15)');
      g3.addColorStop(1, 'rgba(10,40,30,0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, W, H);
    }

    function drawGrid() {
      const vpX  = W / 2;
      const vpY  = H * 0.42;
      const LINES = 16;
      const HORIZ = 14;
      const base  = 0.04 + Math.sin(t * 0.5) * 0.01;

      ctx.save();
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth   = 0.5;

      for (let i = 0; i <= LINES; i++) {
        const x = (W / LINES) * i;
        ctx.globalAlpha = base * (1 - Math.abs((i / LINES) - 0.5) * 0.5);
        ctx.beginPath();
        ctx.moveTo(vpX + (x - vpX) * 0.01, vpY);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      for (let i = 0; i < HORIZ; i++) {
        const progress = Math.pow(i / HORIZ, 1.8);
        const y        = vpY + (H - vpY) * progress;
        const xSpread  = (W * 0.5) * (1 - Math.pow(1 - progress, 2) * 0.8);
        ctx.globalAlpha = base * 0.8 * (i / HORIZ);
        ctx.beginPath();
        ctx.moveTo(vpX - xSpread, y);
        ctx.lineTo(vpX + xSpread, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPriceChart() {
      const scrolled = priceData.map((_, i) =>
        priceData[(i + Math.floor(chartOffset)) % N_PTS]
      );
      const stepX = W / (N_PTS - 1);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, H);
      scrolled.forEach((y, i) => { ctx.lineTo(i * stepX, y); });
      ctx.lineTo(W, H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, H * 0.2, 0, H);
      grad.addColorStop(0, 'rgba(45,106,79,0.12)');
      grad.addColorStop(0.6, 'rgba(45,106,79,0.04)');
      grad.addColorStop(1, 'rgba(45,106,79,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glow en 3 passes
      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        scrolled.forEach((y, i) => {
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * stepX, y);
        });
        if (pass === 0) {
          ctx.globalAlpha = 0.04; ctx.strokeStyle = '#c9a84c';
          ctx.lineWidth = 8; ctx.filter = 'blur(8px)';
        } else if (pass === 1) {
          ctx.globalAlpha = 0.12; ctx.strokeStyle = '#c9a84c';
          ctx.lineWidth = 3; ctx.filter = 'blur(2px)';
        } else {
          ctx.globalAlpha = 0.22; ctx.strokeStyle = '#2d6a4f';
          ctx.lineWidth = 1.2; ctx.filter = 'none';
        }
        ctx.stroke();
      }
      ctx.filter = 'none';
      ctx.restore();
    }

    function drawConnections() {
      const MAX = 130;
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX) {
            ctx.globalAlpha = (1 - d / MAX) * 0.06;
            ctx.strokeStyle = '#c9a84c';
            ctx.lineWidth   = 0.4;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    function drawParticles() {
      ctx.save();
      particles.forEach(p => {
        p.pulse += p.pulseSpeed;
        ctx.globalAlpha = p.alpha * (0.7 + Math.sin(p.pulse) * 0.3);
        ctx.fillStyle   = p.color;
        if (p.color === '#c9a84c') { ctx.shadowColor = '#c9a84c'; ctx.shadowBlur = 6; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10)    p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10)    p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
      });
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, '#0a0f0d');
      bg.addColorStop(0.5, '#0b1410');
      bg.addColorStop(1, '#0a0f0d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      drawAurora();
      drawGrid();
      drawPriceChart();
      drawConnections();
      drawParticles();

      t           += 0.012;
      chartOffset += 0.04;
      animId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
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
