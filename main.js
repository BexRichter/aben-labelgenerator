// ─── Imports (bundled locally by Vite — works on Netlify) ─────────────────────
import './style.css';
import p5        from 'p5';
import * as THREE from 'three';
import { gsap }   from 'gsap';

// ─── Shared state ──────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
let circleSize = 150;
let bgColorHex = '#0d0d0d';
let primaryHex = '#f59e0b';

// ─── p5.js — Instance Mode ─────────────────────────────────────────────────────
// Must use instance mode when bundling with Vite / any bundler.
// All p5 API calls go through the `p` argument — no globals.
let p5Instance;

// ── Bubble class ───────────────────────────────────────────────────────────────
class Bubble {
  constructor(p) {
    this.p = p;
    this.reset();
    this.y = p.random(0, H); // stagger starting positions
  }
  reset() {
    const p = this.p;
    this.x      = p.random(W * 0.2, W * 0.8);
    this.y      = H + p.random(20, 80);
    this.r      = p.random(3, 16);
    this.spd    = p.random(0.6, 2.2);
    this.wobble = p.random(1000);
    this.alpha  = p.random(60, 150);
  }
  update() {
    this.y -= this.spd;
    this.x += this.p.sin(this.p.frameCount * 0.02 + this.wobble) * 0.7;
    if (this.y < -this.r * 2) this.reset();
  }
  draw(col) {
    const p = this.p;
    p.push();
    p.noFill();
    p.stroke(p.red(col), p.green(col), p.blue(col), this.alpha);
    p.strokeWeight(1.4);
    p.circle(this.x, this.y, this.r * 2);
    // glint
    p.stroke(255, this.alpha * 0.5);
    p.strokeWeight(1);
    p.point(this.x - this.r * 0.3, this.y - this.r * 0.35);
    p.pop();
  }
}

// ── Particle class (burst on load) ─────────────────────────────────────────────
class Particle {
  constructor(p, x, y, col) {
    this.p   = p;
    this.x   = x;  this.y  = y;
    this.col = col;
    this.vx  = p.random(-5, 5);
    this.vy  = p.random(-6, -1);
    this.life = 255;
    this.r   = p.random(3, 8);
  }
  update() {
    this.x   += this.vx;
    this.y   += this.vy;
    this.vy  += 0.14;   // gravity
    this.life -= 5;
  }
  draw() {
    const p = this.p;
    if (this.life <= 0) return;
    p.push();
    p.noStroke();
    p.fill(p.red(this.col), p.green(this.col), p.blue(this.col), this.life);
    p.circle(this.x, this.y, this.r * 2);
    p.pop();
  }
  isDead() { return this.life <= 0; }
}

// ── Sketch ─────────────────────────────────────────────────────────────────────
const sketch = (p) => {
  let bubbles   = [];
  let particles = [];
  let angle     = 0;
  let bursted   = false;

  p.setup = () => {
    const canvas = p.createCanvas(W, H);
    canvas.parent('canvas-container');

    for (let i = 0; i < 45; i++) bubbles.push(new Bubble(p));

    // GSAP entrance
    gsap.from('#canvas-container canvas', {
      duration: 0.9,
      scale: 0.85,
      opacity: 0,
      ease: 'back.out(1.7)',
    });
  };

  p.draw = () => {
    p.background(p.color(bgColorHex));

    const cx = W / 2;
    const cy = H / 2;
    const col = p.color(primaryHex);

    // ── Rising bubbles (behind label) ────────────────────────────────────────
    for (const b of bubbles) { b.update(); b.draw(col); }

    // ── Outer glow ────────────────────────────────────────────────────────────
    for (let r = circleSize + 22; r > circleSize; r -= 3) {
      const a = p.map(r, circleSize, circleSize + 22, 50, 0);
      p.push();
      p.noFill();
      p.stroke(p.red(col), p.green(col), p.blue(col), a);
      p.strokeWeight(1.5);
      p.circle(cx, cy, r * 2);
      p.pop();
    }

    // ── Rotating dot ring ─────────────────────────────────────────────────────
    const ringR = circleSize * 0.84;
    const dots  = 28;
    for (let i = 0; i < dots; i++) {
      const a   = (p.TWO_PI / dots) * i + angle;
      const dx  = cx + p.cos(a) * ringR;
      const dy  = cy + p.sin(a) * ringR;
      const sz  = (p.sin(angle * 4 + i * 0.8) * 0.5 + 0.5) * 5 + 1.5;
      const alp = p.map(p.sin(angle * 2 + i), -1, 1, 70, 255);
      p.push();
      p.noStroke();
      p.fill(p.red(col), p.green(col), p.blue(col), alp);
      p.circle(dx, dy, sz);
      p.pop();
    }

    // ── Main label circle ─────────────────────────────────────────────────────
    p.push();
    p.fill(p.color(bgColorHex));
    p.stroke(col);
    p.strokeWeight(3);
    p.circle(cx, cy, circleSize * 2);
    p.pop();

    // ── Inner decorative ring ─────────────────────────────────────────────────
    p.push();
    p.noFill();
    p.stroke(p.red(col), p.green(col), p.blue(col), 60);
    p.strokeWeight(1);
    p.circle(cx, cy, circleSize * 1.72);
    p.pop();

    // ── ÅBEN logotype ─────────────────────────────────────────────────────────
    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();

    // shadow
    p.fill(0, 140);
    p.textStyle(p.BOLD);
    p.textSize(circleSize * 0.39);
    p.text('ÅBEN', cx + 2, cy - circleSize * 0.07 + 2);

    // main text
    p.fill(col);
    p.text('ÅBEN', cx, cy - circleSize * 0.07);
    p.pop();

    // horizontal rule
    p.push();
    p.stroke(col);
    p.strokeWeight(1);
    const ruleW = circleSize * 0.65;
    p.line(cx - ruleW, cy + circleSize * 0.18, cx + ruleW, cy + circleSize * 0.18);
    p.pop();

    // subtitle
    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.NORMAL);
    p.textSize(circleSize * 0.12);
    p.noStroke();
    p.fill(180);
    p.text('B R E W E R Y', cx, cy + circleSize * 0.32);
    p.pop();

    // ── Burst on frame 80 ─────────────────────────────────────────────────────
    if (p.frameCount === 80 && !bursted) {
      bursted = true;
      for (let i = 0; i < 70; i++) particles.push(new Particle(p, cx, cy, col));
    }
    for (const pt of particles) { pt.update(); pt.draw(); }
    particles = particles.filter(pt => !pt.isDead());

    angle += 0.008;
  };
};

p5Instance = new p5(sketch);

// ─── Three.js ────────────────────────────────────────────────────────────────
let threeScene, threeCamera, threeRenderer, threeMesh, threeAnimId;

function setupThreeJS() {
  const container = document.getElementById('three-container');

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(bgColorHex);

  threeCamera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
  threeCamera.position.z = 5;

  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(W, H);
  threeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(threeRenderer.domElement);

  // Beer-can cylinder
  const geo = new THREE.CylinderGeometry(1, 1, 3, 64);
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(primaryHex) });
  threeMesh = new THREE.Mesh(geo, mat);
  threeScene.add(threeMesh);

  // Lights
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 8, 5);
  threeScene.add(sun);

  // Entrance animation
  gsap.from(threeCamera.position, { duration: 1.4, z: 12, ease: 'power3.out' });

  runThree();
}

function runThree() {
  threeAnimId = requestAnimationFrame(runThree);
  if (threeMesh) threeMesh.rotation.y += 0.012;
  threeRenderer.render(threeScene, threeCamera);
}

// ─── Mode switcher ───────────────────────────────────────────────────────────
const p5Btn    = document.getElementById('p5-mode');
const threBtn  = document.getElementById('three-mode');
const p5wrap   = document.getElementById('canvas-container');
const threwrap = document.getElementById('three-container');

p5Btn.addEventListener('click', () => {
  p5wrap.classList.remove('hidden');
  threwrap.classList.add('hidden');
  p5Btn.classList.replace('bg-gray-200', 'bg-blue-600');
  p5Btn.classList.replace('text-gray-700', 'text-white');
  threBtn.classList.replace('bg-blue-600', 'bg-gray-200');
  threBtn.classList.replace('text-white', 'text-gray-700');
  if (threeAnimId) cancelAnimationFrame(threeAnimId);
  p5Instance.loop();
});

threBtn.addEventListener('click', () => {
  threwrap.classList.remove('hidden');
  p5wrap.classList.add('hidden');
  threBtn.classList.replace('bg-gray-200', 'bg-blue-600');
  threBtn.classList.replace('text-gray-700', 'text-white');
  p5Btn.classList.replace('bg-blue-600', 'bg-gray-200');
  p5Btn.classList.replace('text-white', 'text-gray-700');
  p5Instance.noLoop();
  if (!threeRenderer) setupThreeJS();
  else runThree();
});

// ─── Design controls ─────────────────────────────────────────────────────────
document.getElementById('bg-color').addEventListener('input', (e) => {
  bgColorHex = e.target.value;
  if (threeScene) threeScene.background = new THREE.Color(bgColorHex);
});

document.getElementById('primary-color').addEventListener('input', (e) => {
  primaryHex = e.target.value;
  if (threeMesh) threeMesh.material.color = new THREE.Color(primaryHex);
});

document.getElementById('size-slider').addEventListener('input', (e) => {
  circleSize = Number(e.target.value);
  document.getElementById('size-label').textContent = e.target.value;
  if (threeMesh) {
    const s = circleSize / 150;
    gsap.to(threeMesh.scale, { duration: 0.3, x: s, y: s, z: s, ease: 'power2.out' });
  }
});