import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const COLORS = { seismic: 0xff7167, natural: 0x75d3b4, conflict: 0xf3a352, fire: 0xffa04e, weather: 0x6bbcf2, flight: 0x73c0f5, ship: 0x68d6af, infrastructure: 0xb19cf3 };
const LANDMASSES = [
  [[-168, 69], [-150, 72], [-136, 68], [-130, 60], [-124, 55], [-128, 49], [-123, 42], [-117, 33], [-110, 31], [-105, 24], [-97, 19], [-91, 18], [-86, 22], [-82, 26], [-80, 32], [-73, 38], [-66, 45], [-59, 51], [-68, 55], [-80, 53], [-91, 56], [-102, 59], [-114, 64], [-128, 68], [-145, 72]],
  [[-59, 60], [-49, 59], [-42, 61], [-36, 68], [-25, 72], [-23, 79], [-40, 83], [-53, 80], [-61, 72]],
  [[-99, 19], [-91, 17], [-86, 14], [-83, 10], [-77, 8], [-78, 13], [-84, 17], [-92, 19]],
  [[-81, 12], [-73, 8], [-64, 10], [-56, 6], [-49, 1], [-46, -7], [-42, -18], [-49, -28], [-54, -35], [-59, -41], [-63, -54], [-70, -52], [-73, -42], [-76, -29], [-79, -15]],
  [[-10, 36], [-10, 44], [-6, 49], [-8, 55], [-1, 58], [5, 54], [8, 59], [15, 56], [18, 61], [27, 58], [32, 65], [43, 67], [55, 68], [72, 72], [94, 74], [113, 70], [130, 63], [145, 59], [159, 57], [170, 52], [165, 46], [151, 44], [140, 48], [131, 42], [125, 34], [121, 24], [115, 20], [111, 24], [106, 21], [104, 15], [100, 12], [98, 19], [91, 22], [86, 21], [81, 8], [77, 8], [72, 14], [69, 22], [61, 25], [55, 24], [51, 28], [47, 30], [44, 38], [40, 40], [35, 37], [31, 35], [28, 41], [21, 40], [17, 37], [13, 38], [10, 43], [5, 43], [2, 41], [-3, 36]],
  [[-17, 36], [-8, 35], [0, 37], [10, 36], [16, 32], [23, 32], [32, 31], [35, 20], [42, 12], [51, 11], [47, 2], [42, -11], [34, -19], [29, -34], [19, -35], [14, -29], [11, -18], [12, -6], [8, 5], [0, 5], [-5, 10], [-14, 14], [-17, 25]],
  [[35, 31], [43, 29], [51, 25], [57, 22], [55, 17], [49, 12], [43, 12], [39, 18]],
  [[67, 24], [72, 21], [77, 8], [81, 7], [88, 20], [85, 24], [80, 29], [75, 33], [72, 29]],
  [[93, 21], [100, 23], [106, 20], [109, 14], [107, 8], [112, 2], [118, 5], [122, 10], [127, 12], [130, 5], [126, 0], [120, -3], [115, -6], [109, -8], [105, -4], [103, 1], [98, 5], [95, 12]],
  [[112, -11], [121, -11], [132, -12], [139, -17], [151, -24], [153, -31], [146, -39], [136, -36], [129, -34], [121, -31], [115, -24]],
  [[-8, 50], [-5, 58], [0, 57], [2, 52]], [[130, 31], [133, 34], [137, 36], [141, 42], [145, 44], [143, 37], [139, 34], [135, 33]],
  [[-180, -72], [-150, -70], [-120, -73], [-90, -71], [-60, -75], [-30, -72], [0, -74], [30, -71], [60, -74], [90, -71], [120, -73], [150, -70], [180, -72], [180, -90], [-180, -90]],
];

function createEarthTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const ocean = context.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#092028');
  ocean.addColorStop(0.52, '#0a3034');
  ocean.addColorStop(1, '#06191f');
  context.fillStyle = ocean;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = 'rgba(95, 178, 157, 0.14)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 36) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y <= height; y += height / 12) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }

  const project = ([longitude, latitude]) => [((longitude + 180) / 360) * width, ((90 - latitude) / 180) * height];
  for (const polygon of LANDMASSES) {
    context.beginPath();
    polygon.forEach((point, index) => {
      const [x, y] = project(point);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = '#244c43';
    context.shadowColor = 'rgba(78, 214, 164, 0.16)';
    context.shadowBlur = 7;
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(113, 216, 174, 0.62)';
    context.lineWidth = 2;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function surfacePoint(latitude, longitude, radius = 1.016) {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

export default function OrbitalGlobe({ state }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let renderer;
    let animationFrame;
    let dragging = false;
    let lastPointer = { x: 0, y: 0 };
    let autoRotate = 0;
    const dragRotation = { x: 0, y: 0 };
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#071014');
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 3.5);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
      container.appendChild(renderer.domElement);
      const world = new THREE.Group();
      scene.add(world);
      const earthTexture = createEarthTexture();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshPhongMaterial({ map: earthTexture, color: 0xd2e6dd, emissive: 0x031312, shininess: 18, specular: 0x456d65 }));
      world.add(sphere);
      const grid = new THREE.Mesh(new THREE.SphereGeometry(1.004, 24, 16), new THREE.MeshBasicMaterial({ color: 0x34776b, wireframe: true, transparent: true, opacity: 0.25 }));
      world.add(grid);
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.075, 48, 32), new THREE.MeshBasicMaterial({ color: 0x2f9f8a, side: THREE.BackSide, transparent: true, opacity: 0.10 }));
      world.add(atmosphere);
      const points = new THREE.Group();
      const arcs = new THREE.Group();
      world.add(points, arcs);
      scene.add(new THREE.AmbientLight(0x89c9bc, 1.2));
      const light = new THREE.DirectionalLight(0xb2fff0, 2.2);
      light.position.set(-3, 2, 4);
      scene.add(light);
      const starGeometry = new THREE.BufferGeometry();
      const starPositions = [];
      for (let index = 0; index < 420; index += 1) {
        const radius = 4 + Math.random() * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
      }
      starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
      const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x82a39c, size: 0.018, transparent: true, opacity: 0.56 }));
      scene.add(stars);
      sceneRef.current = { scene, camera, renderer, world, points, arcs, dragRotation };

      const resize = () => {
        if (!container.clientWidth || !container.clientHeight) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      const onPointerDown = (event) => { dragging = true; lastPointer = { x: event.clientX, y: event.clientY }; renderer.domElement.setPointerCapture?.(event.pointerId); };
      const onPointerMove = (event) => {
        if (!dragging) return;
        dragRotation.y += (event.clientX - lastPointer.x) * 0.006;
        dragRotation.x = Math.max(-1.25, Math.min(1.25, dragRotation.x + (event.clientY - lastPointer.y) * 0.006));
        lastPointer = { x: event.clientX, y: event.clientY };
      };
      const onPointerUp = () => { dragging = false; };
      const onWheel = (event) => { event.preventDefault(); camera.position.z = Math.max(2.1, Math.min(5.2, camera.position.z + event.deltaY * 0.002)); };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointerleave', onPointerUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      const animate = () => {
        animationFrame = requestAnimationFrame(animate);
        if (!dragging) autoRotate += 0.0007;
        world.rotation.x = dragRotation.x;
        world.rotation.y = dragRotation.y + autoRotate;
        stars.rotation.y -= 0.00003;
        renderer.render(scene, camera);
      };
      animate();
      setError('');
      return () => {
        cancelAnimationFrame(animationFrame);
        observer.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointerleave', onPointerUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
        scene.traverse((object) => {
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) { material?.map?.dispose?.(); material?.dispose?.(); }
        });
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        sceneRef.current = null;
      };
    } catch (initializationError) {
      setError(initializationError.message || 'WebGL is not available in this browser.');
      return () => { renderer?.dispose(); };
    }
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const group of [scene.points, scene.arcs]) {
      while (group.children.length) {
        const child = group.children.pop();
        group.remove(child);
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    }
    const all = [
      ...(state.events || []), ...(state.conflicts || []), ...(state.fires || []),
      ...(state.weather || []), ...(state.flights || []).slice(0, 100), ...(state.ships || []).slice(0, 100),
    ].filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))).slice(0, 500);
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    for (const item of all) {
      const point = surfacePoint(Number(item.latitude), Number(item.longitude));
      positions.push(point.x, point.y, point.z);
      const color = new THREE.Color(COLORS[item.type] || (item.military ? 0xff7167 : 0x76cfaa));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const cloud = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true }));
    scene.points.add(cloud);
    for (let index = 0; index < Math.min(all.length - 1, 14); index += 1) {
      const start = surfacePoint(Number(all[index].latitude), Number(all[index].longitude), 1.018);
      const end = surfacePoint(Number(all[index + 1].latitude), Number(all[index + 1].longitude), 1.018);
      const middle = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.12);
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const arcGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
      scene.arcs.add(new THREE.Line(arcGeometry, new THREE.LineBasicMaterial({ color: 0x3ba984, transparent: true, opacity: 0.36 })));
    }
  }, [state.events, state.conflicts, state.fires, state.weather, state.flights, state.ships]);

  return <div className="orbital-stage">
    <div className="orbital-overlay"><span><i /> ORBITAL VIEW</span><small>DRAG TO ROTATE · SCROLL TO ZOOM</small></div>
    <div className="orbital-container" ref={containerRef} role="img" aria-label="Interactive three-dimensional globe showing global signals" />
    {error && <div className="globe-error"><strong>3D view unavailable</strong><span>{error}</span></div>}
    <div className="orbital-legend"><span><i style={{ background: '#ff7167' }} /> SEISMIC</span><span><i style={{ background: '#f3a352' }} /> CONFLICT</span><span><i style={{ background: '#75d3b4' }} /> NATURAL</span><span>{state.events.length.toLocaleString()} SIGNALS</span></div>
  </div>;
}
