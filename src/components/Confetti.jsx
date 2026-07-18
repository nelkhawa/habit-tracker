import { useEffect, useRef } from "react";

export default function Confetti({ run }) {
  const ref = useRef();
  useEffect(() => {
    if (!run) return;
    const cv = ref.current; if (!cv) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const ctx = cv.getContext("2d");
    const cols = ["#8B7EC8", "#7BAFC4", "#7AB5A0", "#6B7FA3", "#B87A6B"];
    let pts = Array.from({ length: 100 }, () => ({ x: Math.random() * cv.width, y: -10, vx: (Math.random() - .5) * 3, vy: Math.random() * 3 + 1.5, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() * 7 + 3, r: Math.random() * 360, vr: (Math.random() - .5) * 7, life: 1 }));
    let raf;
    const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); pts = pts.filter(p => p.life > 0); pts.forEach(p => { ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.r * Math.PI / 180); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.r += p.vr; if (p.y > cv.height) p.life -= 0.06; }); if (pts.length) raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 999 }} />;
}
