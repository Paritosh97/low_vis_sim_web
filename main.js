import * as THREE from 'https://esm.sh/three';
import { EffectComposer } from 'https://esm.sh/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://esm.sh/three/examples/jsm/postprocessing/ShaderPass.js';

const canvas = document.getElementById('threeCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const loader = new THREE.TextureLoader();

let composer;
let imageMesh;
let texture;

let effectOrder = [
  "lightDegradation",
  "visualFieldLoss",
  "rotationDistortion",
  "spatialDistortion",
  "infilling",
  "visualAcuityLoss",
  "colorShift",
  "fovReduction",
  "contrastChange"
];

const defaultEffectState = {
  enabled: false,
  intensity: 0.5,
  params: {}
};

let effectsState = {};
effectOrder.forEach(name => {
  effectsState[name] = { ...defaultEffectState, name };
});

function createPlane(tex) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({ map: tex });
  imageMesh = new THREE.Mesh(geometry, material);
  scene.add(imageMesh);
}

function loadImage(file) {
  const url = URL.createObjectURL(file);
  loader.load(url, tex => {
    texture = tex;
    if (imageMesh) scene.remove(imageMesh);
    createPlane(tex);
    setupPostProcessing();
  });
}

async function setupPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  for (let name of effectOrder) {
    const state = effectsState[name];
    if (state.enabled) {
      const shaderCode = await fetch(`effects/${name}.glsl`).then(r => r.text());
      const shader = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          intensity: { value: state.intensity },
          ...state.params
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: shaderCode
      });
      composer.addPass(shader);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (composer) composer.render();
}
animate();

document.getElementById('imageLoader').addEventListener('change', e => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

function buildUI() {
  const container = document.getElementById('effectsContainer');
  container.innerHTML = '';

  effectOrder.forEach((name, index) => {
    const effect = effectsState[name];
    const div = document.createElement('div');
    div.className = 'effect';

    const header = document.createElement('div');
    header.className = 'effect-header';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = effect.enabled;
    checkbox.addEventListener('change', () => {
      effect.enabled = checkbox.checked;
      setupPostProcessing();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(name));
    header.appendChild(label);

    const controls = document.createElement('div');

    if (index > 0) {
      const upBtn = document.createElement('button');
      upBtn.textContent = '🔼';
      upBtn.onclick = () => {
        [effectOrder[index - 1], effectOrder[index]] = [effectOrder[index], effectOrder[index - 1]];
        buildUI();
        setupPostProcessing();
      };
      controls.appendChild(upBtn);
    }

    if (index < effectOrder.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.textContent = '🔽';
      downBtn.onclick = () => {
        [effectOrder[index + 1], effectOrder[index]] = [effectOrder[index], effectOrder[index + 1]];
        buildUI();
        setupPostProcessing();
      };
      controls.appendChild(downBtn);
    }

    header.appendChild(controls);
    div.appendChild(header);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = effect.intensity;
    slider.addEventListener('input', () => {
      effect.intensity = parseFloat(slider.value);
      setupPostProcessing();
    });
    div.appendChild(slider);

    container.appendChild(div);
  });
}

document.getElementById('exportBtn').addEventListener('click', () => {
  const config = {
    effectOrder,
    effectsState
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'low_vis_config.json';
  a.click();
});

document.getElementById('importConfig').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      effectOrder = data.effectOrder;
      effectsState = data.effectsState;
      buildUI();
      setupPostProcessing();
    } catch (err) {
      alert('Invalid config file!');
    }
  };
  reader.readAsText(file);
});

buildUI();
