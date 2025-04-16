import * as THREE from 'https://esm.sh/three';

// DOM Elements
const canvas = document.getElementById('threeCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Three.js Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const loader = new THREE.TextureLoader();

// Global Variables
let imageMesh;
let texture;
let shaderCode = null;
let allUniforms = null;

// Initialize the application
async function init() {
    shaderCode = await fetch(`effects/shader.glsl`).then(r => r.text());
    allUniforms = parseShaderUniforms(shaderCode);
    // Build the UI
    buildUI();

    // Set up event listeners
    setupEventListeners();

    // Start animation loop
    animate();

    // Call this instead of the original default image loading code
    await loadDefaultImage();

    const material = new THREE.MeshBasicMaterial({ map: texture });
    const geometry = new THREE.PlaneGeometry(2, 2);
    imageMesh = new THREE.Mesh(geometry, material);
    scene.add(imageMesh);
}

function extractUniformData(match, effectBody, floatMatches, intMatches) {
    const type = match[1];
    const name = match[2];
    const isArray = match[3] !== undefined;
    const arrayLength = isArray ? parseInt(match[3], 10) : null;

    let min = null, max = null, defaultValue = null, dropdownOptions = null;

    // Check for float properties
    const floatMatch = floatMatches.find(m => m.name === name);
    if (floatMatch) {
        min = parseFloat(floatMatch.min);
        max = parseFloat(floatMatch.max);
        defaultValue = parseFloat(floatMatch.defaultValue);
    }

    // Check for int properties
    const intMatch = intMatches.find(m => m.name === name);
    if (intMatch) {
        dropdownOptions = intMatch.dropdownOptions;
    }

    return { type, name, isArray, arrayLength, min, max, defaultValue, dropdownOptions };
}

function parseShaderUniforms(shaderCode) {
    const effectRegex = /struct\s+(\w+)\s*\{\s*([^}]+)\s*\}/g;
    const propertyRegex = /(\w+)\s+(\w+)(?:\s*\[\s*(\d+)\s*\])?\s*;/g;
    const floatRegex = /float\s+(\w+)\s*(?:\/\/\s*min:\s*([\d\.]+)\s*max:\s*([\d\.]+)\s*default:\s*([\d\.]+))?/g;
    const intRegex = /int\s+(\w+)\s*(?:\/\/\s*dropdown:\s*\(([^)]+)\))?/g;

    const effects = {};

    let effectMatch;
    while ((effectMatch = effectRegex.exec(shaderCode)) !== null) {
        const effectName = effectMatch[1];
        if (effectName == "Effect") continue;
        const effectBody = effectMatch[2];

        const uniforms = [];

        // Extract all float and int matches at once
        const floatMatches = [...effectBody.matchAll(floatRegex)].map(m => ({
            name: m[1],
            min: m[2],
            max: m[3],
            defaultValue: m[4]
        }));

        const intMatches = [...effectBody.matchAll(intRegex)].map(m => ({
            name: m[1],
            dropdownOptions: m[2] ? m[2].split(',').map(option => option.trim()) : null
        }));

        let propertyMatch;
        // Parse properties within the effect
        while ((propertyMatch = propertyRegex.exec(effectBody)) !== null) {
            const uniformData = extractUniformData(propertyMatch, effectBody, floatMatches, intMatches);

            if (uniformData.dropdownOptions) {
                uniforms.push({
                    name: uniformData.name,
                    ...createDropdownUniform(uniformData.type, uniformData.isArray, uniformData.arrayLength, uniformData.dropdownOptions)
                });
            } else {
                uniforms.push({
                    name: uniformData.name,
                    ...createUniform(uniformData.type, uniformData.isArray, uniformData.arrayLength, uniformData.min, uniformData.max, uniformData.defaultValue)
                });
            }
        }

        effects[effectName] = uniforms;
    }

    return effects;
}

function createDropdownUniform(type, isArray, arrayLength, dropdownOptions) {
    return {
        type,
        array: isArray,
        arrayLength: isArray ? arrayLength : 1,
        defaultValue: 0,
        value: 0,
        min: 0,
        max: dropdownOptions.length - 1,
        step: 1,
        dropdownOptions
    };
}

function createUniform(type, isArray, arrayLength, min, max, defaultValue) {
    if (type.match(/^[bi]?vec[234]$/)) {
        return createVectorUniform(type, isArray, arrayLength, min, max, defaultValue);
    } else if (type.match(/^mat[234]$/)) {
        return createMatrixUniform(type, isArray, arrayLength, min, max, defaultValue);
    } else {
        return createScalarUniform(type, isArray, arrayLength, min, max, defaultValue);
    }
}

function createVectorUniform(type, isArray, arrayLength, min, max, defaultValue) {
    const vecSize = parseInt(type.slice(-1));
    const def = defaultValue || Array(vecSize).fill(type.startsWith('b') ? false : 0.5);
    const mn = min || Array(vecSize).fill(type.startsWith('b') ? false : 0);
    const mx = max || Array(vecSize).fill(type.startsWith('b') ? true : 1);

    return {
        type,
        array: isArray,
        arrayLength: isArray ? arrayLength : 1,
        defaultValue: isArray ? createArray(arrayLength, def) : def,
        value: isArray ? createArray(arrayLength, def) : def,
        min: mn,
        max: mx,
        step: type.startsWith('i') ? 1 : 0.01
    };
}

function createMatrixUniform(type, isArray, arrayLength, min, max, defaultValue) {
    const matrixSize = parseInt(type.slice(-1));
    const def = defaultValue || Array(matrixSize).fill(0.5);
    const mn = min || Array(matrixSize).fill(0);
    const mx = max || Array(matrixSize).fill(1);

    return {
        type,
        array: isArray,
        arrayLength: isArray ? arrayLength : 1,
        defaultValue: isArray ? createArray(arrayLength, def) : def,
        value: isArray ? createArray(arrayLength, def) : def,
        min: mn,
        max: mx,
        step: 0.01
    };
}

function createScalarUniform(type, isArray, arrayLength, min, max, defaultValue) {
    const def = defaultValue !== null ? defaultValue :
                (type === 'float' ? 0.5 :
                 (type === 'int' ? 0 : false));
    const mn = min !== null ? min :
                (type === 'float' ? 0 :
                 (type === 'int' ? -100 : false));
    const mx = max !== null ? max :
                (type === 'float' ? 1 :
                 (type === 'int' ? 100 : true));

    return {
        type,
        array: isArray,
        arrayLength: isArray ? arrayLength : 1,
        defaultValue: isArray ? Array(arrayLength).fill(def) : def,
        value: isArray ? Array(arrayLength).fill(def) : def,
        min: mn,
        max: mx,
        step: type === 'int' ? 1 : 0.01
    };
}

function createArray(length, defaultValue) {
    return Array.from({ length }, () => [...defaultValue]);
}

async function buildUI() {
  const container = document.getElementById('effectsContainer');
  container.innerHTML = '';

  console.log(allUniforms);
  
  // Get list of enabled effects in current order
  const enabledEffects = getEnabledEffects();
  
  for (const [effectName, effectUniforms] of Object.entries(allUniforms)) {
    const div = createEffectDiv(effectName, effectUniforms, enabledEffects);
    container.appendChild(div);
  }
}

function getEnabledEffects() {
  const enabledEffects = [];

  for (const [effectName, effectUniforms] of Object.entries(allUniforms)) {
    if (effectUniforms[0].defaultValue === true) {
      enabledEffects.push(effectName);
    }
  }

  return enabledEffects;
}


function createEffectDiv(name, uniforms, enabledEffects) {
  const div = document.createElement('div');
  div.className = 'effect';
  div.dataset.effectName = name;

  const header = createEffectHeader(name, uniforms, enabledEffects);
  div.appendChild(header);

  const paramsContainer = createParamsContainer(name, uniforms);
  div.appendChild(paramsContainer);

  // Initialize visibility
  //paramsContainer.style.maxHeight = effect.enabled ? '500px' : '0';
  //paramsContainer.style.paddingTop = effect.enabled ? '10px' : '0';

  return div;
}

function createEffectHeader(name, uniforms, enabledEffects) {
  const header = document.createElement('div');
  header.className = 'effect-header';

  const checkbox = createCheckbox(name, uniforms);
  const label = createLabel(name);
  
  header.appendChild(checkbox);
  header.appendChild(label);

  if (uniforms[0].defaultValue) {
    const moveControls = createMoveControls(name, enabledEffects);
    header.appendChild(moveControls);
  }

  return header;
}

function createCheckbox(name, uniforms) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `effect-${name}`;
  checkbox.checked = uniforms[0].defaultValue;

  checkbox.addEventListener('change', () => {
    uniforms[0].defaultValue = checkbox.checked;
    rebuildUIForEffect();
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

function createParamsContainer(name, uniforms) {
  const paramsContainer = document.createElement('div');
  paramsContainer.className = 'params-container';

  // Add controls for each uniform parameter
  for (const [uniformName, uniform] of Object.entries(uniforms)) {

    const paramControl = createUniformControl(name, uniformName, uniform);
    paramsContainer.appendChild(paramControl);
  }

  return paramsContainer;
}

function createDropdownControl(uniformName, value, options, onChange) {
  const container = document.createElement('div');
  container.className = 'dropdown-control';

  const label = document.createElement('label');
  label.textContent = uniformName;

  const select = document.createElement('select');
  select.value = value;
  
  // Add options to the dropdown
  options.forEach((option, index) => {
    const optionElement = document.createElement('option');
    optionElement.value = index;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });

  select.addEventListener('change', (e) => {
    onChange(parseInt(e.target.value));
  });

  container.appendChild(label);
  container.appendChild(select);

  return container;
}

function createArrayDropdown(uniformName, arrayValues, effect, updateEffect, uniform) {
  const container = document.createElement('div');
  container.className = 'array-dropdown-container';

  // Label for the dropdown
  const label = document.createElement('label');
  label.textContent = uniformName;
  container.appendChild(label);

  // Dropdown (select element)
  const dropdown = document.createElement('select');
  dropdown.id = `${uniformName}-dropdown`;

  // Add options (using "Element 0", "Element 1", etc.)
  arrayValues.forEach((_, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `Element ${index}`;
    dropdown.appendChild(option);
  });

  // Container for dynamically generated controls
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'array-controls-container';

  // Function to update controls based on selected value
  const updateControls = (selectedIndex) => {
    controlsContainer.innerHTML = ''; // Clear previous controls
    const selectedValue = arrayValues[selectedIndex];

    if (Array.isArray(selectedValue)) {
      // Vector types (vec2, vec3, etc.)
      const vectorLength = selectedValue.length;
      const vectorType = uniform.type.replace('[]', ''); // e.g., "vec3[]" → "vec3"
      const vectorControls = createVectorControls(
        `${uniformName}[${selectedIndex}]`, // Label like "myArray[0]"
        selectedValue,
        vectorLength,
        uniform.min,
        uniform.max,
        uniform.step
      );
      controlsContainer.appendChild(vectorControls);
    } else if (typeof selectedValue === 'number') {
      // Single number (float/int)
      const slider = createSliderControl(
        `${uniformName}[${selectedIndex}]`, // Label like "myArray[0]"
        selectedValue,
        uniform.min,
        uniform.max,
        uniform.step,
        (newValue) => {
          arrayValues[selectedIndex] = newValue;
          updateEffect();
        }
      );
      controlsContainer.appendChild(slider);
    } else if (typeof selectedValue === 'boolean') {
      // Boolean (checkbox)
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedValue;
      checkbox.addEventListener('change', (e) => {
        arrayValues[selectedIndex] = e.target.checked;
        updateEffect();
      });
      controlsContainer.appendChild(checkbox);
    }
  };

  // Initialize with first element's controls
  updateControls(0);

  // Handle dropdown changes
  dropdown.addEventListener('change', () => {
    const selectedIndex = parseInt(dropdown.value, 10);
    updateControls(selectedIndex);
  });

  // Append dropdown and controls container
  container.appendChild(dropdown);
  container.appendChild(controlsContainer);

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

  // Component labels based on vector length
  const components = ['x', 'y', 'z', 'w'].slice(0, vectorLength);

  // Create sliders/controls for each vector element
  for (let i = 0; i < vectorLength; i++) {
    const label = document.createElement('label');
    label.textContent = `${components[i]}`;  // e.g., "color.x"

    let control;

    if (['bvec2', 'bvec3', 'bvec4'].includes(params.type)) {
      // TODO For bvec types (booleans), create checkboxes
      control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = params[i] || false;
      control.addEventListener('change', (e) => {
        params[i] = e.target.checked;
        updateEffect(uniformName);
      });
    } else if (['ivec2', 'ivec3', 'ivec4'].includes(params.type)) {
      // For ivec types (integers), create integer sliders
      control = createSliderControl(
        `${components[i]}`,
        params[i] || 0,
        min[i],
        max[i],
        step,
        (newValue) => {
          params[i] = newValue;
          updateEffect(uniformName);
        }
      );
    } else {
      // For vec types (floats), create float sliders
      control = createSliderControl(
        `${components[i]}`,
        params[i] || 0,
        min[i],
        max[i],
        step,
        (newValue) => {
          params[i] = newValue;
          updateEffect(uniformName);
        }
      );
    }

    // Append the label and control
    container.appendChild(control);
  }

  return container;
}


function createBoolControl(uniformName, value) {
  const container = document.createElement('div');
  container.className = 'bool-control';

  const label = document.createElement('label');
  label.textContent = uniformName;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = value;
  checkbox.addEventListener('change', (e) => {
    value = e.target.checked;
    updateEffect(uniformName);
  });

  container.appendChild(label);
  container.appendChild(checkbox);

  return container;
}

function createMatrixControls(uniformName, value, size, min, max, step) {
  const container = document.createElement('div');
  container.className = 'matrix-controls';

  const label = document.createElement('label');
  label.textContent = uniformName;

  const matrix = value || new THREE[`Matrix${size}`]();

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = matrix.elements[i * size + j];
      input.min = min;
      input.max = max;
      input.step = step;
      input.addEventListener('input', (e) => {
        matrix.elements[i * size + j] = parseFloat(e.target.value);
        updateEffect(uniformName);
      });
      container.appendChild(input);
    }
  }

  container.appendChild(label);

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
    inputField.value = newValue;
    onChange(newValue);
  });

  const inputField = document.createElement('input');
  inputField.type = 'number';
  inputField.value = value;
  inputField.min = min;
  inputField.max = max;
  inputField.step = step;
  inputField.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    if (newValue >= min && newValue <= max) {
      slider.value = newValue;
      onChange(newValue);
    }
  });

  // Ensure input field and slider are initialized with the same value
  slider.value = inputField.value;

  // Append label, input, and slider
  container.appendChild(label);
  container.appendChild(inputField);
  container.appendChild(slider);

  return container;
}


function createUniformControl(name, effect, uniformName, uniform) {
  if (uniform.dropdownOptions) {
    return createDropdownControl(
      uniformName,
      effect.params[uniformName] || 0,
      uniform.dropdownOptions,
      (newValue) => {
        effect.params[uniformName] = newValue;
        updateEffect(name);
      }
    );
  }
  // Handle array types (create dropdown)
  if (Array.isArray(effect.params[uniformName])) {
    return createArrayDropdown(uniformName, effect.params[uniformName], effect, updateEffect, uniform);
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
    // TODO fix
    return createBoolControl(uniformName, effect.params[uniformName] || uniform.defaultValue);
  }

  // Handle matrix types (mat2, mat3, mat4)
  if (uniform.type.startsWith('mat')) {
    const size = parseInt(uniform.type.charAt(3), 10); // mat2 -> 2, mat3 -> 3, mat4 -> 4
    // TODO fix
    return createMatrixControls(uniformName, effect.params[uniformName], size, uniform.min, uniform.max, uniform.step);
  }

  // If no matching type is found, log a warning (you can handle it as needed)
  console.warn(`No handler for uniform type: ${uniform.type}`);
  return null;
}

function rebuildUIForEffect() {
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
    if (!effect) {
      console.error(`Effect state for ${name} is undefined.`);
      continue;
    }

    if (effect.enabled) {
      try {
        const shaderCode = await fetch(`effects/shader.glsl`).then(r => r.text());

        const uniforms = {
          tDiffuse: { value: null },
          uImage: { value: texture },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        // Add all parameters to uniforms
        Object.keys(effect.params).forEach(param => {
          if (Array.isArray(effect.params[param])) {
            uniforms[param] = {
              value: effect.params[param].map(val => {
                if (Array.isArray(val)) {
                  switch (val.length) {
                    case 2: return new THREE.Vector2(...val);
                    case 3: return new THREE.Vector3(...val);
                    case 4: return new THREE.Vector4(...val);
                    default: return val;
                  }
                }
                return val; // e.g. for float arrays
              })
            };
          } else {
            uniforms[param] = { value: effect.params[param] };
          }
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
        //console.log(`Shader pass for effect ${name} added.`); // Debug log
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



function updateEffect(name) {
  if (shaderPasses[name]) {
    const pass = shaderPasses[name];
    const effect = effectsState[name];

    Object.keys(effect.params).forEach(param => {
      if (pass.uniforms[param]) {
        if (effect.params[param] !== undefined) {
          if (Array.isArray(effect.params[param])) {
            pass.uniforms[param].value = effect.params[param].map(val => {
              if (val instanceof THREE.Vector2 || val instanceof THREE.Vector3 || val instanceof THREE.Vector4) {
                return val.clone();
              }
              return val;
            });
          } else if (effect.params[param] instanceof THREE.Vector2 || effect.params[param] instanceof THREE.Vector3 || effect.params[param] instanceof THREE.Vector4) {
            pass.uniforms[param].value = effect.params[param].clone();
          } else {
            pass.uniforms[param].value = effect.params[param];
          }
        } else {
          console.error(`Parameter ${param} is undefined for effect ${name}`);
        }
      }
    });
  } else {
    setupPostProcessing();
  }
}


function loadImage(file) {
  const url = URL.createObjectURL(file);
  loader.load(url, tex => {
    texture = tex;
    if (imageMesh) scene.remove(imageMesh);
    createPlane(tex);
    setupPostProcessing();
    
    // Update camera and renderer to maintain aspect ratio
    updateCameraAndRenderer(tex.image.width, tex.image.height);
  });
}

function updateCameraAndRenderer(imgWidth, imgHeight) {
  const aspectRatio = imgWidth / imgHeight;
  const canvasAspect = (window.innerWidth - 340) / window.innerHeight; // Account for sidebar
  
  // Update renderer size
  renderer.setSize(window.innerWidth - 340, window.innerHeight);
  
  // Update camera to maintain image aspect ratio
  if (aspectRatio > canvasAspect) {
    // Image is wider than canvas
    const height = 2 / aspectRatio;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.left = -1;
    camera.right = 1;
  } else {
    // Image is taller than canvas
    const width = 2 * aspectRatio;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = 1;
    camera.bottom = -1;
  }
  
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(window.innerWidth - 340, window.innerHeight);
}

// Update your window resize handler
window.addEventListener('resize', () => {
  if (texture) {
    updateCameraAndRenderer(texture.image.width, texture.image.height);
  } else {
    renderer.setSize(window.innerWidth - 340, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth - 340, window.innerHeight);
  }
});

// Update your createPlane function
function createPlane(tex) {
  const aspectRatio = tex.image.width / tex.image.height;
  const geometry = new THREE.PlaneGeometry(2 * Math.max(1, aspectRatio), 2 * Math.max(1, 1/aspectRatio));
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

async function loadDefaultImage() {
  try {
    texture = await loader.loadAsync('amsler_grid.jpg');
    //console.log('Default image loaded:', texture); // Debug log
    createPlane(texture);
    updateCameraAndRenderer(texture.image.width, texture.image.height);
    setupPostProcessing();
  } catch (error) {
    console.error('Error loading default image:', error);
  }
}
