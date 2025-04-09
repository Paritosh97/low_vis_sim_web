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

// Helper function to parse numbers from a string
function parseNumbers(str) {
  return str?.match(/[\d.\-]+/g)?.map(Number);
}

// Function to handle array size and adjust min, max, default values accordingly
function handleArrayValues(isArray, arrayLength, min, max, defaultValue) {
  let parsedMin = min.length === 1 ? Array(arrayLength).fill(min[0]) : min;
  let parsedMax = max.length === 1 ? Array(arrayLength).fill(max[0]) : max;
  
  // Ensure the default values match the array length
  let parsedDefault = defaultValue.length < arrayLength
    ? Array(arrayLength).fill(defaultValue[0])
    : defaultValue;

  return { parsedMin, parsedMax, parsedDefault };
}

// Function to parse a uniform declaration and extract min, max, default values
function parseUniformDeclaration(match) {
  const [_, type, name, isArray, min, max, defaultValue] = match;
  const arrayLength = isArray ? parseInt(isArray.match(/\d+/)?.[0], 10) : 0;
  
  const parsedMin = min ? parseNumbers(min) : [];
  const parsedMax = max ? parseNumbers(max) : [];
  const parsedDefault = defaultValue ? parseNumbers(defaultValue) : [];

  // If it's an array, handle the size of min, max, and default values
  let finalParsedMin = parsedMin;
  let finalParsedMax = parsedMax;
  let finalParsedDefault = parsedDefault;

  if (isArray) {
    ({ parsedMin: finalParsedMin, parsedMax: finalParsedMax, parsedDefault: finalParsedDefault } = 
      handleArrayValues(isArray, arrayLength, parsedMin, parsedMax, parsedDefault));
  }

  return { type, name, arrayLength, finalParsedMin, finalParsedMax, finalParsedDefault };
}

function parseShaderUniforms(shaderCode) {
  const uniformRegex = /uniform\s+(\w+)\s+(\w+)(\[\s*(\d+)\s*\])?\s*;\s*\/\/\s*(?:min:\s*\(([^)]+)\))?.*?(?:max:\s*\(([^)]+)\))?.*?(?:default:\s*\(([^)]+)\))?/g;
  const uniforms = {};
  let match;

  // Iterate over all matches of the regex in the shader code
  while ((match = uniformRegex.exec(shaderCode)) !== null) {
    // Debugging output for every match
    console.log("Match found:", match);

    // Parse the uniform declaration
    const { type, name, arrayLength, finalParsedMin, finalParsedMax, finalParsedDefault } = parseUniformDeclaration(match);

    // Parse the min/max/defaults if they are missing
    const min = finalParsedMin || (type === 'float' || type === 'int' ? -Infinity : 0);
    const max = finalParsedMax || (type === 'float' || type === 'int' ? Infinity : 1);
    const defaultValue = finalParsedDefault !== undefined ? finalParsedDefault : (type === 'float' || type === 'int' ? 0 : false); 

    // Store the parsed uniform information
    uniforms[name] = {
      type,
      array: !!arrayLength,
      arrayLength,
      defaultValue,
      value: defaultValue,  // Default value is set as initial value
      min,
      max,
      step: 0.01,  // Default step size for UI controls
    };
  }

  // Debugging output for the final parsed uniforms
  console.log("Parsed uniforms:", uniforms);

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

async function buildUI() {
  const container = document.getElementById('effectsContainer');
  container.innerHTML = '';
  
  // Get list of enabled effects in current order
  const enabledEffects = getEnabledEffects();
  
  for (const name of effectOrder) {
    const effect = effectsState[name];
    const div = createEffectDiv(name, effect, enabledEffects);
    container.appendChild(div);
  }
}

function getEnabledEffects() {
  return effectOrder.filter(name => effectsState[name].enabled);
}

function createEffectDiv(name, effect, enabledEffects) {
  const div = document.createElement('div');
  div.className = 'effect';
  div.dataset.effectName = name;

  const header = createEffectHeader(name, effect, enabledEffects);
  div.appendChild(header);

  const paramsContainer = createParamsContainer(name, effect);
  div.appendChild(paramsContainer);

  // Initialize visibility
  paramsContainer.style.maxHeight = effect.enabled ? '500px' : '0';
  paramsContainer.style.paddingTop = effect.enabled ? '10px' : '0';

  return div;
}

function createEffectHeader(name, effect, enabledEffects) {
  const header = document.createElement('div');
  header.className = 'effect-header';

  const checkbox = createCheckbox(name, effect);
  const label = createLabel(name);
  
  header.appendChild(checkbox);
  header.appendChild(label);

  if (effect.enabled) {
    const moveControls = createMoveControls(name, enabledEffects);
    header.appendChild(moveControls);
  }

  return header;
}

function createCheckbox(name, effect) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `effect-${name}`;
  checkbox.checked = effect.enabled;

  checkbox.addEventListener('change', () => {
    effect.enabled = checkbox.checked;
    rebuildUIForEffect(name, effect);
  });

  return checkbox;
}

function createLabel(name) {
  const label = document.createElement('label');
  label.htmlFor = `effect-${name}`;
  label.textContent = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  return label;
}

function createMoveControls(name, enabledEffects) {
  const moveControls = document.createElement('div');
  moveControls.className = 'move-controls';

  // Up button (not shown for first enabled effect)
  if (enabledEffects.indexOf(name) > 0) {
    const upBtn = createMoveButton('↑', 'up', () => moveEffectUp(name));
    moveControls.appendChild(upBtn);
  }

  // Down button (not shown for last enabled effect)
  if (enabledEffects.indexOf(name) < enabledEffects.length - 1) {
    const downBtn = createMoveButton('↓', 'down', () => moveEffectDown(name));
    moveControls.appendChild(downBtn);
  }

  return moveControls;
}

function createMoveButton(label, direction, onClick) {
  const button = document.createElement('button');
  button.innerHTML = label;
  button.className = `move-btn ${direction}`;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  return button;
}

function createParamsContainer(name, effect) {
  const paramsContainer = document.createElement('div');
  paramsContainer.className = 'params-container';

  // Add controls for each uniform parameter
  for (const [uniformName, uniform] of Object.entries(effect.uniforms)) {
    //if (uniformName === 'intensity') continue; // Handled separately

    const paramControl = createUniformControl(name, effect, uniformName, uniform);
    paramsContainer.appendChild(paramControl);
  }

  return paramsContainer;
}

function createArrayDropdown(uniformName, arrayValues) {
  const container = document.createElement('div');
  container.className = 'array-dropdown-container';
  
  // Create the label for the dropdown
  const label = document.createElement('label');
  label.textContent = uniformName;
  container.appendChild(label);
  
  // Create the dropdown (select element)
  const dropdown = document.createElement('select');
  dropdown.id = `${uniformName}-dropdown`;

  // Add options to the dropdown based on array values
  arrayValues.forEach((value, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `Element ${index}: ${value}`;
    dropdown.appendChild(option);
  });

  // Handle changes in the dropdown
  dropdown.addEventListener('change', () => {
    const selectedIndex = dropdown.value;
    // Here, you can update the effect parameter based on the selected value.
    // Assuming that the effect.params[uniformName] is an array that holds the uniform's values.
    effect.params[uniformName] = arrayValues[selectedIndex];  // Update with selected value
    updateEffect();  // Function to apply the effect based on updated values
  });

  // Append the dropdown to the container
  container.appendChild(dropdown);

  return container;
}

function getVectorLength(type) {
  const vectorTypes = {
    'vec2': 2,
    'vec3': 3,
    'vec4': 4,
    'bvec2': 2,
    'bvec3': 3,
    'bvec4': 4,
    'ivec2': 2,
    'ivec3': 3,
    'ivec4': 4
  };
  return vectorTypes[type] || 0;
}

function createVectorControls(uniformName, params, vectorLength, min, max, step) {
  const container = document.createElement('div');
  container.className = 'vector-controls';

  // Create sliders/controls for each vector element
  for (let i = 0; i < vectorLength; i++) {
    const label = document.createElement('label');
    label.textContent = `${uniformName}[${i}]`;

    let control;

    if (['bvec2', 'bvec3', 'bvec4'].includes(params.type)) {
      // For bvec types (booleans), create checkboxes
      control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = params[i] || false;
      control.addEventListener('change', (e) => {
        params[i] = e.target.checked;
        updateEffect(uniformName);
      });
    } else if (['ivec2', 'ivec3', 'ivec4'].includes(params.type)) {
      // For ivec types (integers), create integer sliders
      control = createSliderControl(`${uniformName}[${i}]`, params[i] || 0, min, max, step, (newValue) => {
        params[i] = newValue;
        updateEffect(uniformName);
      });
    } else {
      // For vec types (floats), create float sliders
      control = createSliderControl(`${uniformName}[${i}]`, params[i] || 0, min, max, step, (newValue) => {
        params[i] = newValue;
        updateEffect(uniformName);
      });
    }

    // Append the label and control
    container.appendChild(label);
    container.appendChild(control);
  }

  return container;
}

function createSliderControl(labelText, value, min, max, step, onChange) {
  const container = document.createElement('div');
  container.className = 'slider-control';

  const label = document.createElement('label');
  label.textContent = labelText;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.value = value;
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    inputField.value = newValue;  // Update the input field when slider moves
    onChange(newValue);
  });

  const inputField = document.createElement('input');
  inputField.type = 'number';
  inputField.value = value;  // Set initial value for the input field
  inputField.min = min;
  inputField.max = max;
  inputField.step = step;
  inputField.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    if (newValue >= min && newValue <= max) {
      slider.value = newValue;  // Update slider when input changes
      onChange(newValue);
    }
  });

  // Ensure input field and slider are initialized with the same value
  inputField.value = slider.value;

  // Append label, input, and slider
  container.appendChild(label);
  container.appendChild(inputField);
  container.appendChild(slider);

  return container;
}


function createUniformControl(name, effect, uniformName, uniform) {
  // Handle array types (create dropdown)
  if (Array.isArray(effect.params[uniformName])) {
    return createArrayDropdown(uniformName, effect.params[uniformName]);
  }

  // Handle vector types (vec2, vec3, vec4, bvec, ivec)
  if (['vec2', 'vec3', 'vec4', 'bvec2', 'bvec3', 'bvec4', 'ivec2', 'ivec3', 'ivec4'].includes(uniform.type)) {
    const vectorLength = getVectorLength(uniform.type);
    return createVectorControls(uniformName, effect.params[uniformName], vectorLength, uniform.min, uniform.max, uniform.step);
  }

  // Handle int and float types (both use sliders)
  if (uniform.type === 'int' || uniform.type === 'float') {
    return createSliderControl(uniformName, effect.params[uniformName] || uniform.defaultValue, uniform.min, uniform.max, uniform.step, (newValue) => {
      effect.params[uniformName] = newValue;
      updateEffect(name);
    });
  }

  // Handle bool types (checkbox)
  if (uniform.type === 'bool') {
    return createBoolControl(uniformName, effect.params[uniformName] || uniform.defaultValue);
  }

  // Handle matrix types (mat2, mat3, mat4)
  if (uniform.type.startsWith('mat')) {
    const size = parseInt(uniform.type.charAt(3), 10); // mat2 -> 2, mat3 -> 3, mat4 -> 4
    return createMatrixControls(uniformName, effect.params[uniformName], size, uniform.min, uniform.max, uniform.step);
  }

  // If no matching type is found, log a warning (you can handle it as needed)
  console.warn(`No handler for uniform type: ${uniform.type}`);
  return null;
}

function rebuildUIForEffect(name, effect) {
  buildUI(); // Rebuild UI to update move buttons
  setupPostProcessing(); // Re-apply post-processing effects if necessary
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

function updateEffect(name) {
  if (shaderPasses[name]) {
    // Update existing pass
    const pass = shaderPasses[name];
    const effect = effectsState[name];

    // Check if intensity uniform exists
    if (pass.uniforms.intensity) {
      pass.uniforms.intensity.value = effect.intensity;
    }

    // Update other parameters
    Object.keys(effect.params).forEach(param => {
      if (pass.uniforms[param]) {
        // Ensure the value is defined
        if (effect.params[param] !== undefined) {
          // Check if the uniform is an array and needs toArray
          if (Array.isArray(effect.params[param])) {
            pass.uniforms[param].value = effect.params[param].slice(); // Use slice to create a copy
          } else {
            pass.uniforms[param].value = effect.params[param];
          }
        } else {
          console.error(`Parameter ${param} is undefined for effect ${name}`);
        }
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

