import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';


// DOM Elements
const canvas = document.getElementById('threeCanvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Three.js Scene Setup
const scene = new THREE.Scene();
let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Global Variables
let imageMesh;
let texture;
let shaderCode = null;
let allUniforms = null;

let showCirclesState = false;
let is360Mode = false;
let element360;
let texture360;
let sphereMesh = null; 

// Constants
const SIDEBAR_WIDTH = 340;

async function init() {
  try {
    // Load shader code and parse uniforms
    shaderCode = await fetch(`effects/shader.glsl`).then(r => r.text());
    allUniforms = parseShaderUniforms(shaderCode);

    // Build the UI
    buildUI();

    // Set up event listeners
    setupEventListeners();

    // Start animation loop
    animate();

    // Load default content based on mode
    if (is360Mode) {
      await loadDefault360Image();
    } else {
      await loadDefaultImage();
    }
  } catch (error) {
    console.error('Error initializing the application:', error);
  }
}

function parseShaderUniforms(shaderCode) {
  const effects = {};
  const effectStructs = extractEffectStructs(shaderCode);

  for (const { name: effectName, body: effectBody } of effectStructs) {
      if (effectName === "Effect") continue;

      const floatMetadata = extractFloatMetadata(effectBody);
      const intDropdownMetadata = extractIntDropdownMetadata(effectBody);
      const boolMetadata = extractBoolMetadata(effectBody);
      const intRangeMetadata = extractIntRangeMetadata(effectBody);

      const uniforms = extractUniforms(effectBody, floatMetadata, intDropdownMetadata, intRangeMetadata, boolMetadata);
      effects[effectName] = uniforms;
  }

  return effects;
}

function extractUniformData(match, floatMatches, intDropdownMatches, intRangeMatches, boolMatches) {
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
  const intMatch = intDropdownMatches.find(m => m.name === name);
  if (intMatch) {
      dropdownOptions = intMatch.dropdownOptions;
  }

  const boolMatch = boolMatches.find(m => m.name === name);
  if (boolMatch) {
      min = boolMatch.min;
      max = boolMatch.max;
      defaultValue = boolMatch.defaultValue;
  }

  const intRangeMatch = intRangeMatches.find(m => m.name === name);
  if (intRangeMatch) {
      min = intRangeMatch.min;
      max = intRangeMatch.max;
      defaultValue = intRangeMatch.defaultValue;
  }

  return { type, name, isArray, arrayLength, min, max, defaultValue, dropdownOptions };
}

function extractEffectStructs(code) {
  const effectRegex = /struct\s+(\w+)\s*\{\s*([^}]+)\s*\}/g;
  const results = [];
  let match;
  while ((match = effectRegex.exec(code)) !== null) {
      results.push({ name: match[1], body: match[2] });
  }
  return results;
}

function extractFloatMetadata(body) {
  const floatRegex = /float\s+(\w+)(?:\[\s*\d+\s*\])?\s*;\s*\/\/\s*min:\s*([-\d.]+)\s*max:\s*([-\d.]+)\s*default:\s*([-\d.]+)/g;
  return [...body.matchAll(floatRegex)].map(m => ({
      name: m[1],
      min: m[2],
      max: m[3],
      defaultValue: m[4]
  }));
}

function extractIntDropdownMetadata(body) {
  const intRegex = /int\s+(\w+)\s*;?\s*\/\/\s*dropdown:\s*\(([^)]+)\)/g;
  return [...body.matchAll(intRegex)].map(m => ({
      name: m[1],
      dropdownOptions: m[2] ? m[2].split(',').map(opt => opt.trim()) : null
  }));
}

function extractBoolMetadata(body) {
  const boolRegex = /bool\s+(\w+)\s*;\s*\/\/\s*min:\s*(true|false)\s*max:\s*(true|false)\s*default:\s*(true|false)/g;
  return [...body.matchAll(boolRegex)].map(m => ({
    name: m[1],
    min: m[2] === 'true',
    max: m[3] === 'true',
    defaultValue: m[4] === 'true'
  }));
}

function extractIntRangeMetadata(body) {
  const intRangeRegex = /int\s+(\w+)\s*;\s*\/\/\s*min:\s*(\d+)\s*max:\s*(\d+)\s*default:\s*(\d+)/g;
  return [...body.matchAll(intRangeRegex)].map(m => ({
    name: m[1],
    min: parseInt(m[2], 10),
    max: parseInt(m[3], 10),
    defaultValue: parseInt(m[4], 10)
  }));
}

function extractUniforms(effectBody, floatMetadata, intDropdownMetadata, intRangeMetadata, boolMetadata) {
  const propertyRegex = /(\w+)\s+(\w+)(?:\s*\[\s*(\d+)\s*\])?\s*;/g;
  const uniforms = [];
  let match;
  while ((match = propertyRegex.exec(effectBody)) !== null) {
      const uniformData = extractUniformData(match, floatMetadata, intDropdownMetadata, intRangeMetadata, boolMetadata);

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
  return uniforms;
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
  
  // Create UI elements for "Show Circles"
  const showCirclesUI = createShowCirclesUI(container);

  // Store references to UI elements for event listener setup
  window.showCirclesUI = showCirclesUI;

  // Collect enabled and disabled effects
  const enabled = [];
  const disabled = [];

  // Split effects into enabled and disabled arrays
  for (const [name, uniforms] of Object.entries(allUniforms)) {
      if (uniforms[0].value) enabled.push([name, uniforms]);
      else disabled.push([name, uniforms]);
  }

  // Sort and build the UI as before
  enabled.sort((a, b) => a[1][1].value - b[1][1].value);
  enabled.forEach(([, uniforms], i) => {
      uniforms[1].value = i;  // Reassign order based on position
  });

  const sorted = [...enabled, ...disabled];

  for (const [effectName, effectUniforms] of sorted) {
      const div = createEffectDiv(effectName, effectUniforms);
      container.appendChild(div);
  }
}

function createShowCirclesUI(container) {
  const showCirclesContainer = document.createElement('div');
  showCirclesContainer.className = 'special-control'; // Use the special class for styling

  const showCirclesToggle = document.createElement('input');
  showCirclesToggle.type = 'checkbox';
  showCirclesToggle.id = 'showCirclesToggle';
  showCirclesToggle.checked = showCirclesState; // Set the initial state

  const showCirclesLabel = document.createElement('label');
  showCirclesLabel.htmlFor = 'showCirclesToggle';
  showCirclesLabel.textContent = 'Show Reference Circles';

  const circleControlsContainer = document.createElement('div');
  circleControlsContainer.style.display = showCirclesState ? 'block' : 'none';
  circleControlsContainer.style.paddingTop = '10px';

  // Retrieve the current value from the shader uniform
  const currentCircleEccStepValue = imageMesh
    ? imageMesh.material.uniforms.circleEccStep.value
    : sphereMesh
    ? sphereMesh.material.uniforms.circleEccStep.value
    : 10; // Default to 10 if no mesh is present

  const circleEccStepSlider = document.createElement('input');
  circleEccStepSlider.type = 'range';
  circleEccStepSlider.id = 'circleEccStepSlider';
  circleEccStepSlider.min = 1;
  circleEccStepSlider.max = 40;
  circleEccStepSlider.value = currentCircleEccStepValue; // Use the shader value
  circleEccStepSlider.step = 1;

  const circleEccStepValue = document.createElement('span');
  circleEccStepValue.textContent = currentCircleEccStepValue; // Use the shader value
  circleEccStepValue.style.color = '#fff'; // Ensure text is visible
  circleEccStepValue.id = 'circleEccStepValue'; // Add an ID to easily reference this element

  // Add event listener to update the displayed number and call updateEffects
  circleEccStepSlider.addEventListener('input', function() {
      circleEccStepValue.textContent = this.value;
      updateEffects();
  });

  const showSliderButton = document.createElement('button');
  showSliderButton.textContent = 'Adjust Circle Step';
  showSliderButton.style.marginTop = '10px';
  showSliderButton.style.backgroundColor = '#444'; // Darker button background
  showSliderButton.style.color = '#fff'; // White text for contrast
  showSliderButton.style.border = 'none';
  showSliderButton.style.padding = '5px 10px';
  showSliderButton.style.cursor = 'pointer';
  showSliderButton.addEventListener('click', () => {
      circleControlsContainer.style.display = circleControlsContainer.style.display === 'none' ? 'block' : 'none';
  });

  // Add event listener to the toggle to update the state and call updateEffects
  showCirclesToggle.addEventListener('change', function() {
      showCirclesState = this.checked;
      updateEffects();
  });

  circleControlsContainer.appendChild(document.createTextNode('Visual Angle Step (degrees): '));
  circleControlsContainer.appendChild(circleEccStepSlider);
  circleControlsContainer.appendChild(circleEccStepValue);

  showCirclesContainer.appendChild(showCirclesToggle);
  showCirclesContainer.appendChild(showCirclesLabel);
  showCirclesContainer.appendChild(showSliderButton);
  showCirclesContainer.appendChild(circleControlsContainer);

  container.appendChild(showCirclesContainer);

  return {
      showCirclesToggle,
      circleControlsContainer,
      circleEccStepSlider,
      circleEccStepValue,
      showSliderButton
  };
}

function createEffectDiv(name, uniforms) {
  const div = document.createElement('div');
  div.className = 'effect';
  div.dataset.effectName = name;

  const header = createEffectHeader(name, uniforms);
  div.appendChild(header);

  const paramsContainer = createParamsContainer(name, uniforms.filter(uniform => uniform.name !== 'isActive' && uniform.name !== 'order'));
  div.appendChild(paramsContainer);

  // Initialize visibility
  paramsContainer.style.maxHeight = uniforms[0].value ? '500px' : '0';
  paramsContainer.style.paddingTop = uniforms[0].value ? '10px' : '0';

  return div;
}

function createEffectHeader(name, uniforms) {
  const header = document.createElement('div');
  header.className = 'effect-header';

  const checkbox = createCheckbox(name, uniforms);
  const label = createLabel(name);

  header.appendChild(checkbox);
  header.appendChild(label);

  if (uniforms[0].value) {
    const moveControls = createMoveControls(name, uniforms[1].value);
    header.appendChild(moveControls);
  }

  return header;
}

function createCheckbox(name, uniforms) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `effect-${name}`;
  checkbox.checked = uniforms[0].value;

  checkbox.addEventListener('change', () => {
    uniforms[0].value = checkbox.checked;
    updateEffects();
    buildUI();
  });

  return checkbox;
}

function createLabel(name) {
  const label = document.createElement('label');
  label.htmlFor = `effect-${name}`;
  label.textContent = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  return label;
}

function createMoveControls(name) {
  const moveControls = document.createElement('div');
  moveControls.className = 'move-controls';

  const activeEffects = Object.entries(allUniforms)
    .filter(([_, uniforms]) => uniforms[0].value)
    .sort((a, b) => a[1][1].value - b[1][1].value);

  if (activeEffects.length <= 1) return moveControls; // only one active effect

  const index = activeEffects.findIndex(([key]) => key === name);

  // Up button (not shown for first)
  if (index > 0) {
    const upBtn = createMoveButton('↑', 'up', () => moveEffectUp(name));
    moveControls.appendChild(upBtn);
  }

  // Down button (not shown for last)
  if (index < activeEffects.length - 1) {
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

function moveEffect(name, direction) {
  const activeEffects = Object.entries(allUniforms)
    .filter(([_, uniforms]) => uniforms[0].value) // Filter only enabled effects
    .sort((a, b) => a[1][1].value - b[1][1].value); // Sort by order value

  const index = activeEffects.findIndex(([key]) => key === name);
  const swapIndex = index + direction;

  if (swapIndex < 0 || swapIndex >= activeEffects.length) return; // Prevent invalid move

  const currentEffect = activeEffects[index];
  const otherEffect = activeEffects[swapIndex];

  // Swap their order values
  const temp = currentEffect[1][1].value;
  currentEffect[1][1].value = otherEffect[1][1].value;
  otherEffect[1][1].value = temp;

  // Update UI
  updateEffects();
  buildUI();
}

function moveEffectUp(name) {
  moveEffect(name, -1);
}

function moveEffectDown(name) {
  moveEffect(name, 1);
}

function createParamsContainer(name, uniforms) {
  const paramsContainer = document.createElement('div');
  paramsContainer.className = 'params-container';

  // Add controls for each uniform parameter
  for (const [uniformIndex, uniform] of Object.entries(uniforms)) {
    const paramControl = createUniformControl(uniform);
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

function createArrayDropdown(uniform) {
  const container = document.createElement('div');
  container.className = 'array-dropdown-container';

  // Label for the dropdown
  const label = document.createElement('label');
  label.textContent = uniform.name;
  container.appendChild(label);

  // Dropdown (select element)
  const dropdown = document.createElement('select');
  dropdown.id = `${uniform.name}-dropdown`;

  // Add options (using "Element 0", "Element 1", etc.)
  uniform.value.forEach((_, index) => {
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
    const selectedValue = uniform.value[selectedIndex];

    if (Array.isArray(selectedValue)) {
      // Vector types (vec2, vec3, etc.)
      const vectorLength = selectedValue.length;
      const vectorType = uniform.type.replace('[]', ''); // e.g., "vec3[]" → "vec3"
      const vectorControls = createVectorControls(
        `${uniform.name}[${selectedIndex}]`, // Label like "myArray[0]"
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
        `${uniform.name}[${selectedIndex}]`, // Label like "myArray[0]"
        selectedValue,
        uniform.min,
        uniform.max,
        uniform.step,
        (newValue) => {
          uniform.value[selectedIndex] = newValue;
          updateEffects();
        }
      );
      controlsContainer.appendChild(slider);
    } else if (typeof selectedValue === 'boolean') {
      // Boolean (checkbox)
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedValue;
      checkbox.addEventListener('change', (e) => {
        uniform.value[selectedIndex] = e.target.checked;
        updateEffects();
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
      // For bvec types (booleans), create checkboxes
      control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = params[i] || false;
      control.addEventListener('change', (e) => {
        params[i] = e.target.checked;
        updateEffects();
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
          updateEffects();
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
          updateEffects();
        }
      );
    }

    // Append the label and control
    container.appendChild(label);
    container.appendChild(control);
  }

  return container;
}

function createBoolControl(uniformName, uniform) {
  const container = document.createElement('div');
  container.className = 'bool-control';

  const label = document.createElement('label');
  label.textContent = uniformName;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = uniform.value;
  checkbox.addEventListener('change', (e) => {
    uniform.value = e.target.checked;
    updateEffects();
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
        updateEffects();
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

function createUniformControl(uniform) {
  if (uniform.dropdownOptions) {
    return createDropdownControl(
      uniform.name,
      uniform.value || 0,
      uniform.dropdownOptions,
      (newValue) => {
        uniform.value = newValue;
        updateEffects();
      }
    );
  }
  // Handle array types (create dropdown)
  if (uniform.array) {
    return createArrayDropdown(uniform, () => updateEffects());
  }

  // Handle vector types (vec2, vec3, vec4, bvec, ivec)
  if (['vec2', 'vec3', 'vec4', 'bvec2', 'bvec3', 'bvec4', 'ivec2', 'ivec3', 'ivec4'].includes(uniform.type)) {
    const vectorLength = getVectorLength(uniform.type);
    return createVectorControls(uniform.name, uniform.value, vectorLength, uniform.min, uniform.max, uniform.step);
  }

  // Handle int and float types (both use sliders)
  if (uniform.type === 'int' || uniform.type === 'float') {
    return createSliderControl(uniform.name, uniform.value || uniform.defaultValue, uniform.min, uniform.max, uniform.step, (newValue) => {
      uniform.value = newValue;
      updateEffects();
    });
  }

  // Handle bool types (checkbox)
  if (uniform.type === 'bool') {
    return createBoolControl(uniform.name, uniform);
  }

  // Handle matrix types (mat2, mat3, mat4)
  if (uniform.type.startsWith('mat')) {
    const size = parseInt(uniform.type.charAt(3), 10); // mat2 -> 2, mat3 -> 3, mat4 -> 4
    return createMatrixControls(uniform.name, uniform.value, size, uniform.min, uniform.max, uniform.step);
  }

  // If no matching type is found, log a warning (you can handle it as needed)
  console.warn(`No handler for uniform type: ${uniform.type}`);
  return null;
}

function updateEffects() {
  if (!imageMesh && !sphereMesh) return;

  const uniforms = (imageMesh ? imageMesh.material.uniforms : sphereMesh.material.uniforms);

  if (!uniforms) return;
  
  // Update ColorShift uniform
  if (uniforms.colorShift) {
    uniforms.colorShift.value.isActive = allUniforms["ColorShift"][0].value;
    uniforms.colorShift.value.order = allUniforms["ColorShift"][1].value;
    uniforms.colorShift.value.severity = allUniforms["ColorShift"][2].value;
    uniforms.colorShift.value.cvdType = allUniforms["ColorShift"][3].value;
  }

  // Update LightEffect uniform
  if (uniforms.lightEffect) {
    uniforms.lightEffect.value.isActive = allUniforms["LightEffect"][0].value;
    uniforms.lightEffect.value.order = allUniforms["LightEffect"][1].value;
    uniforms.lightEffect.value.autoDayNight = allUniforms["LightEffect"][2].value;
    uniforms.lightEffect.value.isNight = allUniforms["LightEffect"][3].value;
    uniforms.lightEffect.value.sigmaS = allUniforms["LightEffect"][4].value;
    uniforms.lightEffect.value.sigmaL = allUniforms["LightEffect"][5].value;
    uniforms.lightEffect.value.threshold = allUniforms["LightEffect"][6].value;
    uniforms.lightEffect.value.haloSize = allUniforms["LightEffect"][7].value;
    uniforms.lightEffect.value.intensity = allUniforms["LightEffect"][8].value;
  }

  // Update TunnelVision uniform
  if (uniforms.tunnelVision) {
    uniforms.tunnelVision.value.isActive = allUniforms["TunnelVision"][0].value;
    uniforms.tunnelVision.value.order = allUniforms["TunnelVision"][1].value;
    uniforms.tunnelVision.value.size = allUniforms["TunnelVision"][2].value;
    uniforms.tunnelVision.value.edge_smoothness = allUniforms["TunnelVision"][3].value;
  }

  // Update ShowCircles uniform
  if (uniforms.showCircles) {
    uniforms.showCircles.value = showCirclesState;

    const circleEccStepSlider = document.getElementById('circleEccStepSlider');
    const circleEccStepValue = document.getElementById('circleEccStepValue');

    if (circleEccStepSlider && circleEccStepValue) {
        uniforms.circleEccStep.value = parseInt(circleEccStepSlider.value);
        circleEccStepValue.textContent = circleEccStepSlider.value;
    }
  }

  // Mark all uniforms for update
  for (let effect in uniforms) {
    uniforms[effect].needsUpdate = true;
  }
}

function updateCameraAndRenderer(imgWidth, imgHeight) {
  const canvasWidth = window.innerWidth - SIDEBAR_WIDTH;
  const canvasHeight = window.innerHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  const imageAspect = imgWidth / imgHeight;

  // Update renderer
  renderer.setSize(canvasWidth, canvasHeight);

  let viewWidth, viewHeight;

  if (imageAspect > canvasAspect) {
    // Image is wider than canvas: fit width
    viewWidth = 2;
    viewHeight = 2 / imageAspect * canvasAspect;
  } else {
    // Image is taller than canvas: fit height
    viewHeight = 2;
    viewWidth = 2 * imageAspect / canvasAspect;
  }

  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;

  camera.updateProjectionMatrix();
}

// Update your window resize handler
window.addEventListener('resize', () => {
  if (texture) {
    updateCameraAndRenderer(texture.image.width, texture.image.height);
  } else {
    renderer.setSize(window.innerWidth - SIDEBAR_WIDTH, window.innerHeight);
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);  
  renderer.render(scene, camera);
}

// Set up event listeners
function setupEventListeners() {

  document.getElementById('toggle360').addEventListener('change', async (e) => {
    is360Mode = e.target.checked;
    toggleInputsVisibility();
    if (is360Mode) {
      await loadDefault360Image();
      enable360Mode();
    } else {
      await loadDefaultImage();
      enable2DMode();
    }
  });

  document.getElementById('imageLoader').addEventListener('change', e => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });

  document.getElementById('360Loader').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      load360(e.target.files[0]);
    }
  });

  // Export configuration
  document.getElementById('exportBtn').addEventListener('click', () => {
    const config = {
      effects: allUniforms,
      // Add other configuration data as needed
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
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
        allUniforms = data.effects;
        // Rebuild UI and processing pipeline
        await buildUI();
        updateEffects();
      } catch (err) {
        alert('Invalid config file!');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth - SIDEBAR_WIDTH, window.innerHeight);
  });
}

function createPlane(texture) {
  const availWidth = window.innerWidth - SIDEBAR_WIDTH;
  const availHeight = window.innerHeight;

  const windowAspectRatio = availWidth / availHeight;
  const imageAspectRatio = texture.image.width / texture.image.height;

  let W, H;
  if (imageAspectRatio > windowAspectRatio) {
    W = 2;
    H = 2 * windowAspectRatio / imageAspectRatio;
  } else {
    W = 2 * imageAspectRatio / windowAspectRatio;
    H = 2;
  }

  const geometry = new THREE.PlaneGeometry(W, H);
  const material = createCommonShaderMaterial(
    texture,
    new THREE.Vector2(texture.image.width, texture.image.height)
  );

  // Override the material side and vertex shader for plane
  material.side = THREE.FrontSide;
  material.vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;
  material.needsUpdate = true;

  return new THREE.Mesh(geometry, material);
}


function createCommonShaderMaterial(texture, resolution) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, // Will override if needed for plane
    uniforms: {
      uImage: { value: texture },
      uResolution: { value: resolution },
      showCircles: { value: false },
      circleEccStep: { value: 10 },
      colorShift: {
        value: {
          isActive: allUniforms["ColorShift"][0].defaultValue,
          order: allUniforms["ColorShift"][1].defaultValue,
          severity: allUniforms["ColorShift"][2].defaultValue,
          cvdType: allUniforms["ColorShift"][3].defaultValue
        }
      },
      lightEffect: {
        value: {
          isActive: allUniforms["LightEffect"][0].defaultValue,
          order: allUniforms["LightEffect"][1].defaultValue,
          autoDayNight: allUniforms["LightEffect"][2].defaultValue,
          isNight: allUniforms["LightEffect"][3].defaultValue,
          sigmaS: allUniforms["LightEffect"][4].defaultValue,
          sigmaL: allUniforms["LightEffect"][5].defaultValue,
          threshold: allUniforms["LightEffect"][6].defaultValue,
          haloSize: allUniforms["LightEffect"][7].defaultValue,
          intensity: allUniforms["LightEffect"][8].defaultValue,
        }
      },
      tunnelVision: {
        value: {
          isActive: allUniforms["TunnelVision"][0].defaultValue,
          order: allUniforms["TunnelVision"][1].defaultValue,
          size: allUniforms["TunnelVision"][2].defaultValue,
          edge_smoothness: allUniforms["TunnelVision"][3].defaultValue
        }
      }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = ${resolution === undefined ? 
          "projectionMatrix * modelViewMatrix * vec4(position, 1.0)" : 
          "vec4(position, 1.0)"};
      }
    `,
    fragmentShader: shaderCode
  });
}


function loadImage(file) {
  const loader = new THREE.TextureLoader();
  const url = URL.createObjectURL(file);

  loader.load(
    url,
    (tex) => {
      URL.revokeObjectURL(url);
      texture = tex;

      if (imageMesh) {
        scene.remove(imageMesh);
      }

      imageMesh = createPlane(texture);
      scene.add(imageMesh);
      updateCameraAndRenderer(texture.image.width, texture.image.height);
    },
    undefined,
    (error) => {
      URL.revokeObjectURL(url);
      console.error('An error occurred while loading the texture:', error);
    }
  );
}

function loadDefault360Image() {
  const loader = new THREE.TextureLoader();
  loader.load(
    'images/default360.jpg',
    (tex) => {
      texture = tex;

      if (sphereMesh) {
        scene.remove(sphereMesh);
      }

      const material = createCommonShaderMaterial(
        texture,
        new THREE.Vector2(window.innerWidth, window.innerHeight)
      );

      const geometry = new THREE.SphereGeometry(500, 60, 40);
      sphereMesh = new THREE.Mesh(geometry, material);
      scene.add(sphereMesh);

      updateCameraAndRenderer(texture.image.width, texture.image.height);
    },
    undefined,
    (error) => {
      console.error('An error occurred while loading the default texture:', error);
    }
  );
}


function buildUniform(name, keys) {
  const values = allUniforms[name];
  const uniform = { isActive: values[0].defaultValue, order: values[1].defaultValue };
  keys.forEach((key, i) => {
    uniform[key] = Array.isArray(values[i + 2].defaultValue)
      ? values[i + 2].defaultValue.map((x) => x)
      : values[i + 2].defaultValue;
  });
  return { value: uniform };
}

async function loadDefaultImage() {
  const loader = new THREE.TextureLoader();
  loader.load(
    'images/default.jpg',
    (tex) => {
      texture = tex;

      if (imageMesh) {
        scene.remove(imageMesh);
      }

      imageMesh = createPlane(texture);
      scene.add(imageMesh);
      updateCameraAndRenderer(texture.image.width, texture.image.height);
    },
    undefined,
    (error) => {
      console.error('An error occurred while loading the default texture:', error);
    }
  );
}

function enable360Mode() {
  // Switch to perspective camera
  camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  // Remove existing 2D plane
  if (imageMesh) {
    scene.remove(imageMesh);
    imageMesh = null;
  }

  // Initialize OrbitControls
  let controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.enableZoom = false;
  controls.enablePan = false;

  // Animation loop with controls update
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// Enable 2D Mode
function enable2DMode() {
  // Switch back to orthographic camera
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Remove sphere and re-add 2D plane
  scene.children = scene.children.filter(child => !(child instanceof THREE.Mesh));
  if (texture) {
    imageMesh = createPlane(texture);
    scene.add(imageMesh);
  }
}

function load360(file) {
  const loader = new THREE.TextureLoader();
  const url = URL.createObjectURL(file);

  loader.load(
    url,
    (tex) => {
      URL.revokeObjectURL(url);
      texture = tex;

      if (imageMesh) {
        scene.remove(imageMesh);
      }

      imageMesh = createPlane(texture);
      scene.add(imageMesh);
      updateCameraAndRenderer(texture.image.width, texture.image.height);
    },
    undefined,
    (error) => {
      URL.revokeObjectURL(url);
      console.error('An error occurred while loading the texture:', error);
    }
  );
}

function toggleInputsVisibility() {
  const imageLoader = document.getElementById('imageLoader');
  const loader360 = document.getElementById('360Loader');
  const imageLabel = document.getElementById('imageLoaderLabel');
  const label360 = document.getElementById('360LoaderLabel');

  if (is360Mode) {
    imageLoader.style.display = 'none';
    loader360.style.display = 'block';
    imageLabel.style.display = 'none';
    label360.style.display = 'block';
  } else {
    imageLoader.style.display = 'block';
    loader360.style.display = 'none';
    imageLabel.style.display = 'block';
    label360.style.display = 'none';
  }
}


// Initialize the application
init();
