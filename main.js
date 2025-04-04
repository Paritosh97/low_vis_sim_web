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
const effectOrder = [
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

// Parse shader uniforms from GLSL code
function parseShaderUniforms(shaderCode) {
  const uniformRegex = /uniform\s+(\w+)\s+(\w+)\s*(?:=\s*([^;]+))?;\s*\/\/.*?(min:([^,]+))?.*?(max:([^,]+))?.*?(step:([^,)+))?.*?(default:([^)]+))?/g;
  const uniforms = {};
  let match;

  while ((match = uniformRegex.exec(shaderCode)) !== null) {
    const type = match[1];
    const name = match[2];
    const explicitDefault = match[3];
    const min = match[5];
    const max = match[7];
    const step = match[9];
    const commentDefault = match[11];

    let defaultValue;
    if (explicitDefault) {
      defaultValue = parseFloat(explicitDefault);
    } else if (commentDefault) {
      if (type === 'vec3') {
        // Handle vec3 defaults
        const values = commentDefault.match(/[\d.]+/g);
        defaultValue = values ? values.map(parseFloat) : [1.0, 1.0, 1.0];
      } else {
        defaultValue = parseFloat(commentDefault);
      }
    } else {
      defaultValue = type === 'vec3' ? [1.0, 1.0, 1.0] : 0;
    }

    uniforms[name] = {
      type,
      defaultValue,
      value: defaultValue,
      min: min ? parseFloat(min) : (type === 'vec3' ? 0 : 0),
      max: max ? parseFloat(max) : (type === 'vec3' ? 1 : 1),
      step: step ? parseFloat(step) : (type === 'float' ? 0.01 : 1)
    };
  }

  return uniforms;
}

// Initialize all effects
async function initializeAllEffects() {
  for (const name of effectOrder) {
    effectsState[name] = await initializeEffectState(name);
  }
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

// Build the UI based on effect states
async function buildUI() {
  const container = document.getElementById('effectsContainer');
  container.innerHTML = '';

  for (const name of effectOrder) {
    const effect = effectsState[name];
    const div = document.createElement('div');
    div.className = 'effect';

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

      const paramControl = document.createElement('div');
      paramControl.className = 'param-control';
      
      const paramLabel = document.createElement('label');
      paramLabel.textContent = uniformName.replace(/([A-Z])/g, ' $1');
      paramControl.appendChild(paramLabel);

      if (uniform.type === 'vec3') {
        // Create three controls for vec3 (RGB)
        ['Red', 'Green', 'Blue'].forEach((channel, index) => {
          const channelControl = document.createElement('div');
          channelControl.className = 'channel-control';
          
          const channelLabel = document.createElement('span');
          channelLabel.textContent = channel;
          channelControl.appendChild(channelLabel);

          const channelSlider = document.createElement('input');
          channelSlider.type = 'range';
          channelSlider.min = uniform.min;
          channelSlider.max = uniform.max;
          channelSlider.step = uniform.step;
          channelSlider.value = effect.params[uniformName] ? effect.params[uniformName][index] : uniform.defaultValue[index];
          
          const channelValue = document.createElement('input');
          channelValue.type = 'number';
          channelValue.min = uniform.min;
          channelValue.max = uniform.max;
          channelValue.step = uniform.step;
          channelValue.value = effect.params[uniformName] ? effect.params[uniformName][index] : uniform.defaultValue[index];

          channelSlider.addEventListener('input', () => {
            if (!effect.params[uniformName]) effect.params[uniformName] = [...uniform.defaultValue];
            effect.params[uniformName][index] = parseFloat(channelSlider.value);
            channelValue.value = effect.params[uniformName][index];
            updateEffect(name);
          });
          
          channelValue.addEventListener('input', () => {
            if (!effect.params[uniformName]) effect.params[uniformName] = [...uniform.defaultValue];
            effect.params[uniformName][index] = parseFloat(channelValue.value);
            channelSlider.value = effect.params[uniformName][index];
            updateEffect(name);
          });

          channelControl.appendChild(channelSlider);
          channelControl.appendChild(channelValue);
          paramControl.appendChild(channelControl);
        });
      } else {
        // Standard float uniform
        const paramSlider = document.createElement('input');
        paramSlider.type = 'range';
        paramSlider.min = uniform.min;
        paramSlider.max = uniform.max;
        paramSlider.step = uniform.step;
        paramSlider.value = effect.params[uniformName] || uniform.defaultValue;
        
        const paramValue = document.createElement('input');
        paramValue.type = 'number';
        paramValue.min = uniform.min;
        paramValue.max = uniform.max;
        paramValue.step = uniform.step;
        paramValue.value = effect.params[uniformName] || uniform.defaultValue;

        paramSlider.addEventListener('input', () => {
          effect.params[uniformName] = parseFloat(paramSlider.value);
          paramValue.value = effect.params[uniformName];
          updateEffect(name);
        });
        
        paramValue.addEventListener('input', () => {
          effect.params[uniformName] = parseFloat(paramValue.value);
          paramSlider.value = effect.params[uniformName];
          updateEffect(name);
        });

        paramControl.appendChild(paramSlider);
        paramControl.appendChild(paramValue);
      }

      paramsContainer.appendChild(paramControl);
    }

    // Add intensity control if the shader has an intensity uniform
    if (effect.uniforms.intensity) {
      const intensityControl = document.createElement('div');
      intensityControl.className = 'param-control';
      
      const intensityLabel = document.createElement('label');
      intensityLabel.textContent = 'Intensity';
      intensityControl.appendChild(intensityLabel);

      const intensitySlider = document.createElement('input');
      intensitySlider.type = 'range';
      intensitySlider.min = effect.uniforms.intensity.min;
      intensitySlider.max = effect.uniforms.intensity.max;
      intensitySlider.step = effect.uniforms.intensity.step;
      intensitySlider.value = effect.intensity;
      
      const intensityValue = document.createElement('input');
      intensityValue.type = 'number';
      intensityValue.min = effect.uniforms.intensity.min;
      intensityValue.max = effect.uniforms.intensity.max;
      intensityValue.step = effect.uniforms.intensity.step;
      intensityValue.value = effect.intensity;

      intensitySlider.addEventListener('input', () => {
        effect.intensity = parseFloat(intensitySlider.value);
        intensityValue.value = effect.intensity;
        updateEffect(name);
      });
      
      intensityValue.addEventListener('input', () => {
        effect.intensity = parseFloat(intensityValue.value);
        intensitySlider.value = effect.intensity;
        updateEffect(name);
      });

      intensityControl.appendChild(intensitySlider);
      intensityControl.appendChild(intensityValue);
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
      updateEffect(name);
    });
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

  // Add enabled effects
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