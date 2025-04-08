import * as THREE from 'https://esm.sh/three';
import { EffectComposer } from 'https://esm.sh/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://esm.sh/three/examples/jsm/postprocessing/ShaderPass.js';

// DOM Elements
const canvas = document.getElementById('threeCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Three.js Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const loader = new THREE.TextureLoader();

// Global Variables
let composer;
let imageMesh;
let texture;
let shaderPasses = {};

// Effect Order and State
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

let effectsState = {};

// Initialize the application
async function init() {
  // Initialize effect states
  await initializeAllEffects();
  
  // Build the UI
  buildUI();
  
  // Set up event listeners
  setupEventListeners();
  
  // Start animation loop
  animate();
}

// Initialize all effects
async function initializeAllEffects() {
  for (const name of effectOrder) {
    effectsState[name] = await initializeEffectState(name);
  }
}

// Parse uniforms with handling for static arrays
function parseShaderUniforms(shaderCode) {
  const uniformRegex = /uniform\s+(\w+)\s+(\w+)(\[\d+\])?\s*;\s*\/\/\s*(?:min:\s*\(([^)]+)\))?.*?(?:max:\s*\(([^)]+)\))?.*?(?:default:\s*\(([^)]+)\))?/g;

  const uniforms = {};
  let match;

  while ((match = uniformRegex.exec(shaderCode)) !== null) {
    const [_, type, name, isArray, min, max, defaultValue] = match;

    const parseNumbers = str => str?.match(/[\d.\-]+/g)?.map(Number);

    let parsedMin = min ? parseNumbers(min) : [];
    let parsedMax = max ? parseNumbers(max) : [];
    let parsedDefault = defaultValue ? parseNumbers(defaultValue) : [];

    if (isArray) {
      // Extract the size of the array (e.g., uKernels[16])
      const arrayLength = parseInt(isArray.match(/\d+/)[0], 10);
      
      // Ensure the min, max, and default values are correctly sized
      parsedMin = parsedMin.length === 1 ? Array(arrayLength).fill(parsedMin[0]) : parsedMin;
      parsedMax = parsedMax.length === 1 ? Array(arrayLength).fill(parsedMax[0]) : parsedMax;
      parsedDefault = parsedDefault.length === 1 ? Array(arrayLength).fill(parsedDefault[0]) : parsedDefault;
    }

    uniforms[name] = {
      type,
      array: !!isArray,
      arrayLength: isArray ? parseInt(isArray.match(/\d+/)[0], 10) : 0,
      defaultValue: parsedDefault,
      value: parsedDefault,
      min: parsedMin,
      max: parsedMax,
      step: 0.01, // Default step
    };
  }

  return uniforms;
}

// Initialize a single effect state
async function initializeEffectState(name) {
  try {
    const shaderCode = await fetch(`effects/${name}.glsl`).then(r => r.text());
    const uniforms = parseShaderUniforms(shaderCode);
    
    // Remove Three.js managed uniforms
    delete uniforms.tDiffuse;
    
    const params = {};
    Object.keys(uniforms).forEach(uniform => {
      if (uniform !== 'intensity') {
        params[uniform] = uniforms[uniform].defaultValue;
      }
    });

    return {
      enabled: false,
      intensity: 0.5,
      params,
      uniforms
    };
  } catch (error) {
    console.error(`Error initializing effect ${name}:`, error);
    return {
      enabled: false,
      intensity: 0.5,
      params: {},
      uniforms: {}
    };
  }
}

// Helper function to create a checkbox for boolean type uniforms
function createCheckboxControl(name, value, onChange) {
  const container = document.createElement('div');
  container.className = 'param-control';

  const label = document.createElement('label');
  label.textContent = name;
  container.appendChild(label);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = value;

  checkbox.addEventListener('change', () => {
    const newValue = checkbox.checked;
    onChange(newValue);
  });

  container.appendChild(checkbox);

  return container;
}


function createSliderControl(name, value, min, max, step, onInput, onChange) {
  const container = document.createElement('div');
  container.className = 'param-control';

  const label = document.createElement('label');
  label.textContent = name;
  container.appendChild(label);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;

  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.min = min;
  valueInput.max = max;
  valueInput.step = step;
  valueInput.value = value;

  slider.addEventListener('input', () => {
    const newValue = parseFloat(slider.value);
    valueInput.value = newValue;
    onInput(newValue);
  });

  valueInput.addEventListener('input', () => {
    const newValue = parseFloat(valueInput.value);
    slider.value = newValue;
    onChange(newValue);
  });

  container.appendChild(slider);
  container.appendChild(valueInput);

  return container;
}

function createArrayControl(name, value, min, max, step) {
  const container = document.createElement('div');
  container.className = 'param-control';

  // Dropdown to select the index of the array
  const selectContainer = document.createElement('div');
  const selectLabel = document.createElement('span');
  selectLabel.textContent = `Select Element of ${name}:`;
  selectContainer.appendChild(selectLabel);

  const selectElement = document.createElement('select');
  const arrayLength = value.length;
  
  // Populate dropdown with the length of the array
  for (let i = 0; i < arrayLength; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Element ${i}`;
    selectElement.appendChild(option);
  }

  // Initially, set the selected element index to the first element
  let selectedElementIndex = 0;
  const slidersContainer = createVecControl(name, value[selectedElementIndex], min, max, step, 4); // 4 for vec4

  // Add change event listener for the dropdown to update sliders based on selected element
  selectElement.addEventListener('change', (e) => {
    selectedElementIndex = parseInt(e.target.value);
    const selectedElement = value[selectedElementIndex];
    // Update the sliders for the selected vec4 element
    updateSliders(slidersContainer, selectedElement, min, max, step);
  });

  container.appendChild(selectContainer);
  container.appendChild(selectElement);
  container.appendChild(slidersContainer);

  return container;
}

function updateSliders(slidersContainer, value, min, max, step) {
  const sliders = slidersContainer.querySelectorAll('.channel-control input[type="range"]');
  const valueInputs = slidersContainer.querySelectorAll('.channel-control input[type="number"]');

  // Update sliders and inputs based on the new value
  value.forEach((val, index) => {
    sliders[index].value = val;
    valueInputs[index].value = val;

    sliders[index].min = min;
    sliders[index].max = max;
    sliders[index].step = step;

    valueInputs[index].min = min;
    valueInputs[index].max = max;
    valueInputs[index].step = step;
  });
}


function createVecControl(name, value, min, max, step, dimension) {
  const container = document.createElement('div');
  container.className = 'param-control';

  // Create sliders for the components of the vector
  for (let i = 0; i < dimension; i++) {
    const channelContainer = document.createElement('div');
    channelContainer.className = 'channel-control';

    const channelLabel = document.createElement('span');
    channelLabel.textContent = `${['X', 'Y', 'Z', 'W'][i]}`;  // X, Y, Z, W for each component
    channelContainer.appendChild(channelLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value ? value[i] : 0;

    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.min = min;
    valueInput.max = max;
    valueInput.step = step;
    valueInput.value = value ? value[i] : 0;

    slider.addEventListener('input', () => {
      value[i] = parseFloat(slider.value);
      valueInput.value = value[i];
      onChange(value);
    });

    valueInput.addEventListener('input', () => {
      value[i] = parseFloat(valueInput.value);
      slider.value = value[i];
      onChange(value);
    });

    channelContainer.appendChild(slider);
    channelContainer.appendChild(valueInput);
    container.appendChild(channelContainer);
  }

  return container;
}

async function buildUI() {
  const container = document.getElementById('effectsContainer');
  container.innerHTML = '';

  // Get list of enabled effects in current order
  const enabledEffects = effectOrder.filter(name => effectsState[name].enabled);

  for (const name of effectOrder) {
    const effect = effectsState[name];
    const div = document.createElement('div');
    div.className = 'effect';
    div.dataset.effectName = name;

    // Create checkbox and label
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `effect-${name}`;
    checkbox.checked = effect.enabled;

    const label = document.createElement('label');
    label.htmlFor = `effect-${name}`;
    label.textContent = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const header = document.createElement('div');
    header.className = 'effect-header';
    header.appendChild(checkbox);
    header.appendChild(label);

    div.appendChild(header);

    // Create parameters container
    const paramsContainer = document.createElement('div');
    paramsContainer.className = 'params-container';

    // Add controls for each uniform parameter
    for (const [uniformName, uniform] of Object.entries(effect.uniforms)) {
      if (uniformName === 'intensity') continue; // Handled separately

      if (uniform.type === 'vec4') {
        // Create controls for vec4 array
        const arrayControl = createArrayControl(uniformName, effect.params[uniformName], uniform.min, uniform.max, uniform.step);
        paramsContainer.appendChild(arrayControl);
      } else if (uniform.type === 'vec2' || uniform.type === 'vec3' || uniform.type === 'vec4') {
        // Create controls for vec2, vec3, or vec4
        const vecControl = createVecControl(uniformName, effect.params[uniformName], uniform.min, uniform.max, uniform.step, uniform.arrayLength || 4);
        paramsContainer.appendChild(vecControl);
      } else {
        // Standard float uniform
        const paramControl = createSliderControl(uniformName, effect.params[uniformName] || uniform.defaultValue, uniform.min, uniform.max, uniform.step, (newValue) => {
          effect.params[uniformName] = newValue;
          updateEffect(name);
        }, (newValue) => {
          effect.params[uniformName] = newValue;
          updateEffect(name);
        });
        paramsContainer.appendChild(paramControl);
      }
    }

    // Add intensity control if the shader has an intensity uniform
    if (effect.uniforms.intensity) {
      const intensityControl = createSliderControl('Intensity', effect.intensity, effect.uniforms.intensity.min, effect.uniforms.intensity.max, effect.uniforms.intensity.step, (newValue) => {
        effect.intensity = newValue;
        updateEffect(name);
      }, (newValue) => {
        effect.intensity = newValue;
        updateEffect(name);
      });
      paramsContainer.appendChild(intensityControl);
    }

    div.appendChild(paramsContainer);
    container.appendChild(div);

    // Initialize visibility
    paramsContainer.style.maxHeight = effect.enabled ? '500px' : '0';
    paramsContainer.style.paddingTop = effect.enabled ? '10px' : '0';

    // Handle checkbox changes
    checkbox.addEventListener('change', () => {
      effect.enabled = checkbox.checked;
      paramsContainer.style.maxHeight = effect.enabled ? '500px' : '0';
      paramsContainer.style.paddingTop = effect.enabled ? '10px' : '0';

      // Rebuild UI to update move buttons
      buildUI();
      setupPostProcessing();
    });
  }
}

// Move an effect up in the order
function moveEffectUp(name) {
  const enabledEffects = effectOrder.filter(n => effectsState[n].enabled);
  const currentIndex = enabledEffects.indexOf(name);
  
  if (currentIndex > 0) {
    // Swap in the full effectOrder array
    const allIndex = effectOrder.indexOf(name);
    const prevIndex = effectOrder.indexOf(enabledEffects[currentIndex - 1]);
    
    // Swap the elements
    [effectOrder[allIndex], effectOrder[prevIndex]] = [effectOrder[prevIndex], effectOrder[allIndex]];
    
    // Rebuild UI and processing pipeline
    buildUI();
    setupPostProcessing();
  }
}

// Move an effect down in the order
function moveEffectDown(name) {
  const enabledEffects = effectOrder.filter(n => effectsState[n].enabled);
  const currentIndex = enabledEffects.indexOf(name);
  
  if (currentIndex < enabledEffects.length - 1) {
    // Swap in the full effectOrder array
    const allIndex = effectOrder.indexOf(name);
    const nextIndex = effectOrder.indexOf(enabledEffects[currentIndex + 1]);
    
    // Swap the elements
    [effectOrder[allIndex], effectOrder[nextIndex]] = [effectOrder[nextIndex], effectOrder[allIndex]];
    
    // Rebuild UI and processing pipeline
    buildUI();
    setupPostProcessing();
  }
}

// Update a specific effect
function updateEffect(name) {
  if (shaderPasses[name]) {
    // Update existing pass
    const pass = shaderPasses[name];
    const effect = effectsState[name];
    
    pass.uniforms.intensity.value = effect.intensity;
    Object.keys(effect.params).forEach(param => {
      if (pass.uniforms[param]) {
        pass.uniforms[param].value = effect.params[param];
      }
    });
  } else {
    // Rebuild the entire composer
    setupPostProcessing();
  }
}

// Set up the post-processing pipeline
async function setupPostProcessing() {
  if (!texture) return;

  // Clear existing passes
  if (composer) {
    composer.passes = [];
  } else {
    composer = new EffectComposer(renderer);
  }

  // Add render pass
  composer.addPass(new RenderPass(scene, camera));

  // Add enabled effects in current order
  for (const name of effectOrder) {
    const effect = effectsState[name];
    if (effect.enabled) {
      try {
        const shaderCode = await fetch(`effects/${name}.glsl`).then(r => r.text());
        
        const uniforms = {
          tDiffuse: { value: null },
          intensity: { value: effect.intensity }
        };

        // Add all parameters to uniforms
        Object.keys(effect.params).forEach(param => {
          uniforms[param] = { value: effect.params[param] };
        });

        const shader = new ShaderPass({
          uniforms,
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
        shaderPasses[name] = shader;
      } catch (error) {
        console.error(`Error setting up effect ${name}:`, error);
      }
    } else {
      // Remove pass if disabled
      if (shaderPasses[name]) {
        delete shaderPasses[name];
      }
    }
  }
}

// Load an image file
function loadImage(file) {
  const url = URL.createObjectURL(file);
  loader.load(url, tex => {
    texture = tex;
    if (imageMesh) scene.remove(imageMesh);
    createPlane(tex);
    setupPostProcessing();
  });
}

// Create a plane with the texture
function createPlane(tex) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({ map: tex });
  imageMesh = new THREE.Mesh(geometry, material);
  scene.add(imageMesh);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (composer) composer.render();
}

// Set up event listeners
function setupEventListeners() {
  // Image loader
  document.getElementById('imageLoader').addEventListener('change', e => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });

  // Export configuration
  document.getElementById('exportBtn').addEventListener('click', () => {
    const config = {
      effectOrder,
      effectsState: Object.fromEntries(
        Object.entries(effectsState).map(([name, state]) => [
          name, 
          {
            enabled: state.enabled,
            intensity: state.intensity,
            params: state.params
          }
        ])
      )
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'low_vis_config.json';
    a.click();
  });

  // Import configuration
  document.getElementById('importConfig').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        
        // Update effect order
        effectOrder = data.effectOrder || effectOrder;
        
        // Update effect states
        for (const [name, state] of Object.entries(data.effectsState || {})) {
          if (effectsState[name]) {
            effectsState[name].enabled = state.enabled;
            effectsState[name].intensity = state.intensity;
            effectsState[name].params = state.params;
          }
        }
        
        // Rebuild UI and processing pipeline
        await buildUI();
        setupPostProcessing();
      } catch (err) {
        alert('Invalid config file!');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
      composer.setSize(window.innerWidth, window.innerHeight);
    }
  });
}

// Initialize the application
init(); 

// Load default image
texture = await loader.loadAsync('amsler_grid.jpg');
const material = new THREE.MeshBasicMaterial({ map: texture });
const geometry = new THREE.PlaneGeometry(2, 2);
imageMesh = new THREE.Mesh(geometry, material);
scene.add(imageMesh);

// Setup post-processing
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

