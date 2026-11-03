/* three-d-stage: ตัวแสดงฉาก 3D แบบเบาสำหรับไฟล์ที่ export จาก Claude Design
   API ที่ไฟล์ต้นฉบับใช้: element.ready -> { THREE }, element.setObject(obj), element._scene
   ต้องมี importmap ของ "three" และ "three/addons/controls/OrbitControls.js" ในหน้าเดียวกัน */
(function () {
  class ThreeDStage extends HTMLElement {
    constructor() {
      super();
      let res; this.ready = new Promise(r => (res = r)); this._resolve = res;
    }
    async connectedCallback() {
      if (this._started) return; this._started = true;
      Object.assign(this.style, { position: 'fixed', inset: '0', display: 'block' });
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      const bg = this.getAttribute('background') || '#eeece7';
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
      const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8678, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(30, 50, 40); scene.add(sun);
      const fill = new THREE.DirectionalLight(0xffffff, .6); fill.position.set(-40, 20, -30); scene.add(fill);
      const camera = new THREE.PerspectiveCamera(40, 1, .1, 2000); camera.position.set(40, 30, 50);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = this.hasAttribute('autorotate') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.autoRotateSpeed = .6;
      renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });
      this._scene = scene; this._camera = camera; this._controls = controls; this._renderer = renderer; this.THREE = THREE;
      const resize = () => { const w = this.clientWidth || innerWidth, h = this.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      new ResizeObserver(resize).observe(this); resize();
      const loop = () => { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }; loop();
      this._resolve({ THREE, scene, camera, controls, renderer });
    }
    setObject(obj) {
      const THREE = this.THREE; if (this._obj) this._scene.remove(this._obj);
      this._obj = obj; this._scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const r = size.length() / 2 || 10;
      this._controls.target.copy(c);
      this._camera.position.copy(c).add(new THREE.Vector3(r * 1.05, r * .7, r * 1.25));
      this._camera.near = r / 100; this._camera.far = r * 20; this._camera.updateProjectionMatrix();
    }
  }
  if (!customElements.get('three-d-stage')) customElements.define('three-d-stage', ThreeDStage);
})();
