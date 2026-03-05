// ─── three-view.js — 3D Beer Can Preview ─────────────────────────────────────
// Loads beer.glb, applies the live generated label as a texture,
// and provides a static label gallery for all Åben beer types.

import * as THREE from 'three';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap }          from 'gsap';

// ── State ──────────────────────────────────────────────────────────────────────
let renderer, scene, camera;
let canModel   = null;
let canPivot   = null;    // pivot group — only this rotates on drag
let labelMesh  = null;
let labelTex   = null;
let animId     = null;
let ready      = false;
let autoSpin   = true;   // gentle continuous rotation on canPivot
let isDragging = false;
let prevX      = 0;

// ── Gallery definition ─────────────────────────────────────────────────────────
export const BEER_GALLERY = [
  { name: 'LIVE', img: null, special: 'live' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function findLabelMesh(root) {
  const candidates = [];
  root.traverse(obj => {
    if (!obj.isMesh) return;
    const n = (obj.name + ' ' + (obj.material?.name || '')).toLowerCase();
    const score =
      (n.includes('label')   ? 10 : 0) +
      (n.includes('paper')   ?  8 : 0) +
      (n.includes('sticker') ?  8 : 0) +
      (n.includes('wrap')    ?  6 : 0) +
      (n.includes('can')     ?  2 : 0);
    candidates.push({ obj, score });
  });
  candidates.sort((a, b) => b.score - a.score);
  // Fall back: pick mesh that is least metallic
  if (!candidates.length) return null;
  if (candidates[0].score > 0) return candidates[0].obj;
  // No named hit — pick mesh with lowest metalness
  return candidates.sort((a, b) =>
    (a.obj.material?.metalness ?? 0) - (b.obj.material?.metalness ?? 0)
  )[0].obj;
}

function setTexture(tex) {
  if (!labelMesh) return;
  if (labelTex && labelTex !== tex) labelTex.dispose();
  labelTex = tex;
  const mat = Array.isArray(labelMesh.material)
    ? labelMesh.material[0]
    : labelMesh.material;
  if (!mat) return;
  mat.map = tex;
  mat.needsUpdate = true;
}

// ── Initialise ─────────────────────────────────────────────────────────────────
export function init3DView(container) {
  if (ready) { start3D(); return; }

  const W = container.clientWidth  || 800;
  const H = container.clientHeight || 600;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#111111');
  // no fog — it was eating the model at close range

  // Camera — will be properly placed once GLB loads
  camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 100);
  camera.position.set(0, 0, 5);

  // No OrbitControls — we rotate the model directly via drag
  isDragging = false;
  prevX = 0;

  renderer.domElement.addEventListener('pointerdown', e => {
    isDragging = true;
    prevX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!isDragging || !canPivot) return;
    const dx = e.clientX - prevX;
    canPivot.rotation.y += dx * 0.008;
    prevX = e.clientX;
  });
  renderer.domElement.addEventListener('pointerup', e => {
    isDragging = false;
    renderer.domElement.releasePointerCapture(e.pointerId);
  });

  // Scroll to zoom (move camera z)
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomSpeed = 0.003;
    camera.position.z = Math.max(0.3, Math.min(12, camera.position.z + e.deltaY * zoomSpeed));
  }, { passive: false });

  // ── Lighting — bright, high-contrast studio ─────────────────────────────────

  // Ambient — just enough to read the dark side
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // Key light — strong warm spot from upper-right, crisp shadows
  const key = new THREE.SpotLight(0xfff0dd, 8.0, 40, Math.PI * 0.22, 0.4, 1.0);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  scene.add(key);
  scene.add(key.target);

  // Fill — cool, brighter than before so the can reads well
  const fill = new THREE.DirectionalLight(0xd0e4ff, 1.2);
  fill.position.set(-5, 4, 3);
  scene.add(fill);

  // Rim — punchy white backlight for strong edge separation
  const rim = new THREE.SpotLight(0xffffff, 6.0, 30, Math.PI * 0.3, 0.3, 0.8);
  rim.position.set(-2, 6, -7);
  rim.castShadow = false;
  scene.add(rim);
  scene.add(rim.target);

  // Kicker — warm accent from low-left
  const kicker = new THREE.PointLight(0xffcc88, 1.5, 15, 2);
  kicker.position.set(-4, -1, 4);
  scene.add(kicker);

  // Hair light — bright top-down for lid highlight
  const hair = new THREE.DirectionalLight(0xffffff, 1.5);
  hair.position.set(0, 12, 1);
  scene.add(hair);

  // ── Floor shadow receiver ──────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.45 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.8;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── Load GLB ───────────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  loader.load(
    '/beer.glb',
    gltf => {
      canModel = gltf.scene;

      // Shadows on all meshes
      canModel.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow     = true;
          obj.receiveShadow  = true;
        }
      });

      // Find the label mesh
      labelMesh = findLabelMesh(canModel);

      // Fit model to viewport
      const box    = new THREE.Box3().setFromObject(canModel);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale  = 3.8 / maxDim;
      canModel.scale.setScalar(scale);
      canModel.position.sub(center.multiplyScalar(scale));

      // Wrap model in a pivot group so drag rotates ONLY the can
      canPivot = new THREE.Group();
      canPivot.add(canModel);
      scene.add(canPivot);

      // ── Fit camera + controls to model bounds ─────────────────────────────
      const fittedBox    = new THREE.Box3().setFromObject(canModel);
      const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
      const sphere       = fittedBox.getBoundingSphere(new THREE.Sphere());
      const r            = sphere.radius;

      // Push the whole model UP so the label area is at eye level
      canModel.position.y += r * 1.012;

      // Camera: dead-on straight, same Y, very close, shifted right so can appears left
      const camY = fittedCenter.y + r * 0.85;
      const camXOff = r * 0.09;               // positive = camera right → can renders left
      camera.position.set(fittedCenter.x + camXOff, camY, fittedCenter.z + r * 0.15);
      camera.lookAt(fittedCenter.x + camXOff * 0.5, camY, fittedCenter.z);
      camera.near = 0.01;
      camera.updateProjectionMatrix();

      // Apply live label
      applyLiveLabel();

      // Entrance: spin pivot to show label
      canPivot.rotation.y = Math.PI * 0.5;
      gsap.to(canPivot.rotation, { duration: 1.5, y: Math.PI, ease: 'power3.out' });
    },
    undefined,
    err => console.error('[3D] GLB load error:', err)
  );

  // Resize handler
  window.addEventListener('resize', _onResize);

  ready = true;
  _animate();
}

// ── Animation loop ─────────────────────────────────────────────────────────────
function _animate() {
  animId = requestAnimationFrame(_animate);
  // Gentle auto-spin on the can pivot (pauses while user drags)
  if (autoSpin && canPivot && !isDragging) {
    canPivot.rotation.y += 0.003;
  }
  renderer.render(scene, camera);
}

function _onResize() {
  if (!renderer) return;
  const el = renderer.domElement.parentElement;
  if (!el) return;
  const W = el.clientWidth;
  const H = el.clientHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Build a canvas containing ONLY the label artwork (pattern + SVG overlay). */
function buildLabelCanvas() {
  const patternCanvas = window.SOUR_GET_PATTERN_CANVAS?.();
  const COMP          = window.SOUR_COMPOSITION;
  if (!patternCanvas) return null;

  // Use the natural SVG aspect ratio used everywhere else
  const svgW = 581.1, svgH = 354.33;
  const W = 2048;
  const H = Math.round(W * (svgH / svgW));

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (COMP?.template === 'Label4' && COMP.svgImg) {
    // Label4: pattern only in mask zone, then SVG on top
    const maskH = H * (61.4 / svgH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, maskH);
    ctx.clip();
    ctx.drawImage(patternCanvas, 0, 0, W, H);
    ctx.restore();
    ctx.drawImage(COMP.svgImg, 0, 0, W, H);
  } else {
    ctx.drawImage(patternCanvas, 0, 0, W, H);
    if (COMP?.svgImg) ctx.drawImage(COMP.svgImg, 0, 0, W, H);
  }

  if (COMP?.textureImg) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 1.5;
    ctx.drawImage(COMP.textureImg, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  return canvas;
}

/** Apply the current live label artwork as the label mesh texture. */
export function applyLiveLabel() {
  if (!labelMesh || !renderer) return;
  const canvas = buildLabelCanvas();
  if (!canvas) return;

  if (labelTex) labelTex.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY      = false;
  tex.wrapS      = THREE.RepeatWrapping;
  tex.wrapT      = THREE.ClampToEdgeWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  setTexture(tex);
}

/** Load a static PNG image and apply it as the label texture. */
export function applyPresetLabel(imgPath) {
  if (!labelMesh) return;
  const img   = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY      = false;
    tex.needsUpdate = true;
    setTexture(tex);
  };
  img.src = imgPath;
}

/** Call when the label is regenerated so the 3D view stays in sync. */
export function onLabelUpdated() {
  if (!labelMesh) return;
  applyLiveLabel();
}

export function start3D() {
  if (!animId) _animate();
}

export function stop3D() {
  if (animId !== null) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

export function dispose3D() {
  stop3D();
  window.removeEventListener('resize', _onResize);
  renderer?.dispose();
  ready = false;
}
