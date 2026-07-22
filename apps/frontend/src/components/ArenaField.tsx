import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Ambient 3D backdrop for the hero: a particle ring (submissions
 * orbiting the arena) split into the two duel colors, around a slowly
 * turning wireframe core. Pointer moves apply a soft parallax.
 * Respects prefers-reduced-motion (renders a single still frame) and
 * fully disposes GL resources on unmount.
 */
export function ArenaField() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0.4, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ── particle ring: two interleaved duel-colored bands ──────────
    const COUNT = 1600;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const cyan = new THREE.Color('#5ee6ff');
    const red = new THREE.Color('#ff5d73');
    const gold = new THREE.Color('#ffc24b');

    for (let i = 0; i < COUNT; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.1 + (Math.random() - 0.5) * 1.7;
      const y = (Math.random() - 0.5) * 1.4 * Math.exp(-Math.abs(radius - 3.1));
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const roll = Math.random();
      const c = roll < 0.04 ? gold : roll < 0.52 ? cyan : red;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.035,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    points.rotation.x = 0.42;
    scene.add(points);

    // ── wireframe core ─────────────────────────────────────────────
    const core = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.15, 1)),
      new THREE.LineBasicMaterial({ color: '#3a3560', transparent: true, opacity: 0.7 }),
    );
    scene.add(core);

    const inner = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
      new THREE.LineBasicMaterial({ color: '#5ee6ff', transparent: true, opacity: 0.28 }),
    );
    scene.add(inner);

    // ── sizing / parallax / loop ───────────────────────────────────
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.5;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 0.3;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.05;
      core.rotation.y = t * 0.12;
      core.rotation.x = t * 0.05;
      inner.rotation.y = -t * 0.2;
      camera.position.x += (target.x - camera.position.x) * 0.04;
      camera.position.y += (0.4 - target.y - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    if (reduceMotion) {
      renderer.render(scene, camera); // one still frame
    } else {
      frame = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      geometry.dispose();
      (points.material as THREE.Material).dispose();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      inner.geometry.dispose();
      (inner.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden className="absolute inset-0 opacity-70" />;
}
