import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Params, DEFAULT_PARAMS, CalculatedOutputs } from './params';
import {
  calculateOutputs,
  createNaturalGradeMesh,
  createStructureMesh,
  createCapMesh,
  createSideSlopeMesh,
  createFrontClosureMesh,
  createBackSlopeMesh,
  createWalkoutMesh,
} from './geometry';

// Scene setup
const container = document.getElementById('canvas-container')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  50,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(30, -30, 25);
camera.lookAt(0, 10, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 10, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(20, -10, 30);
scene.add(directional);

// Grid helper
const gridHelper = new THREE.GridHelper(60, 30, 0x444444, 0x333333);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

// Axes helper
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Model group
let modelGroup = new THREE.Group();
scene.add(modelGroup);

// Current parameters
const params: Params = { ...DEFAULT_PARAMS };
let outputs: CalculatedOutputs;

// UI elements
const sliders: Record<string, HTMLInputElement> = {
  'slope-angle': document.getElementById('slope-angle') as HTMLInputElement,
  'structure-width': document.getElementById('structure-width') as HTMLInputElement,
  'structure-depth': document.getElementById('structure-depth') as HTMLInputElement,
  'structure-height': document.getElementById('structure-height') as HTMLInputElement,
  'setback': document.getElementById('setback') as HTMLInputElement,
  'min-cover': document.getElementById('min-cover') as HTMLInputElement,
  'overhang': document.getElementById('overhang') as HTMLInputElement,
  'cap-slope': document.getElementById('cap-slope') as HTMLInputElement,
  'side-slope': document.getElementById('side-slope') as HTMLInputElement,
  'walkout-slope': document.getElementById('walkout-slope') as HTMLInputElement,
};

const valueDisplays: Record<string, HTMLElement> = {
  'slope-angle': document.getElementById('slope-angle-val')!,
  'structure-width': document.getElementById('structure-width-val')!,
  'structure-depth': document.getElementById('structure-depth-val')!,
  'structure-height': document.getElementById('structure-height-val')!,
  'setback': document.getElementById('setback-val')!,
  'min-cover': document.getElementById('min-cover-val')!,
  'overhang': document.getElementById('overhang-val')!,
  'cap-slope': document.getElementById('cap-slope-val')!,
  'side-slope': document.getElementById('side-slope-val')!,
  'walkout-slope': document.getElementById('walkout-slope-val')!,
};

const outputDisplays = {
  burial: document.getElementById('out-burial')!,
  walkoutDist: document.getElementById('out-walkout-dist')!,
  walkoutWidth: document.getElementById('out-walkout-width')!,
  cut: document.getElementById('out-cut')!,
  fill: document.getElementById('out-fill')!,
  balance: document.getElementById('out-balance')!,
};

// View buttons
const viewButtons = {
  iso: document.getElementById('view-iso')!,
  section: document.getElementById('view-section')!,
  plan: document.getElementById('view-plan')!,
};

function updateValueDisplay(key: string, value: number) {
  const suffix = key.includes('angle') || key.includes('slope') ? '°' : ' ft';
  valueDisplays[key].textContent = `${value}${suffix}`;
}

function updateOutputDisplays() {
  outputDisplays.burial.textContent = `${outputs.effective_burial.toFixed(1)} ft`;
  outputDisplays.walkoutDist.textContent = `${outputs.walkout_distance.toFixed(1)} ft`;
  outputDisplays.walkoutWidth.textContent = `${outputs.walkout_width.toFixed(1)} ft`;
  outputDisplays.cut.textContent = `${outputs.cut_volume.toFixed(1)} yd³`;
  outputDisplays.fill.textContent = `${outputs.fill_volume.toFixed(1)} yd³`;

  const balance = outputs.earth_balance;
  outputDisplays.balance.textContent = `${balance >= 0 ? '+' : ''}${balance.toFixed(1)} yd³`;
  outputDisplays.balance.className = `value ${balance >= 0 ? 'positive' : 'negative'}`;
}

function rebuildModel() {
  // Clear existing
  while (modelGroup.children.length > 0) {
    const child = modelGroup.children[0];
    modelGroup.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }

  outputs = calculateOutputs(params);

  // Natural grade
  const grade = createNaturalGradeMesh(params);
  modelGroup.add(grade);

  // Structure
  const structure = createStructureMesh(params);
  modelGroup.add(structure);

  // Cap
  const cap = createCapMesh(params, outputs);
  if (cap) modelGroup.add(cap);

  // Side slopes
  const leftSlope = createSideSlopeMesh(params, outputs, 'left');
  if (leftSlope) modelGroup.add(leftSlope);

  const rightSlope = createSideSlopeMesh(params, outputs, 'right');
  if (rightSlope) modelGroup.add(rightSlope);

  // Front closures
  const leftClosure = createFrontClosureMesh(params, outputs, 'left');
  if (leftClosure) modelGroup.add(leftClosure);

  const rightClosure = createFrontClosureMesh(params, outputs, 'right');
  if (rightClosure) modelGroup.add(rightClosure);

  // Back slope
  const back = createBackSlopeMesh(params, outputs);
  if (back) modelGroup.add(back);

  // Walkout
  const walkout = createWalkoutMesh(params, outputs);
  modelGroup.add(walkout);

  updateOutputDisplays();
}

// Slider event handlers
function setupSlider(key: string, paramKey: keyof Params) {
  const slider = sliders[key];
  slider.addEventListener('input', () => {
    const value = parseFloat(slider.value);
    params[paramKey] = value;
    updateValueDisplay(key, value);
    rebuildModel();
  });
}

setupSlider('slope-angle', 'slope_angle');
setupSlider('structure-width', 'structure_width');
setupSlider('structure-depth', 'structure_depth');
setupSlider('structure-height', 'structure_height');
setupSlider('setback', 'setback');
setupSlider('min-cover', 'min_cover');
setupSlider('overhang', 'overhang');
setupSlider('cap-slope', 'cap_slope');
setupSlider('side-slope', 'side_slope');
setupSlider('walkout-slope', 'walkout_slope');

// View switching
function setView(view: 'iso' | 'section' | 'plan') {
  Object.values(viewButtons).forEach(btn => btn.classList.remove('active'));
  viewButtons[view].classList.add('active');

  switch (view) {
    case 'iso':
      camera.position.set(30, -30, 25);
      camera.up.set(0, 0, 1);
      controls.target.set(0, 10, 0);
      controls.enableRotate = true;
      break;
    case 'section':
      camera.position.set(40, 10, 0);
      camera.up.set(0, 0, 1);
      controls.target.set(0, 10, 0);
      controls.enableRotate = false;
      break;
    case 'plan':
      camera.position.set(0, 10, 50);
      camera.up.set(0, 1, 0);
      controls.target.set(0, 10, 0);
      controls.enableRotate = false;
      break;
  }

  controls.update();
}

viewButtons.iso.addEventListener('click', () => setView('iso'));
viewButtons.section.addEventListener('click', () => setView('section'));
viewButtons.plan.addEventListener('click', () => setView('plan'));

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Initialize
rebuildModel();
animate();
