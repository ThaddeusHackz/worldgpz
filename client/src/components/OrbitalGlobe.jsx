import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const COLORS = { seismic: 0xff7167, natural: 0x75d3b4, conflict: 0xf3a352, fire: 0xffa04e, weather: 0x6bbcf2, flight: 0x73c0f5, ship: 0x68d6af, infrastructure: 0xb19cf3 };
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
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshPhongMaterial({ color: 0x102b31, emissive: 0x041d1d, shininess: 12, specular: 0x30565b }));
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
        scene.traverse((object) => { object.geometry?.dispose?.(); if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose()); else object.material?.dispose?.(); });
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
