Here's a **README** for your project:

---

# Low Vision Simulation Web App

This project is a web-based application designed to simulate various low vision effects on images. It allows users to apply multiple image effects such as light degradation, color shift, spatial distortion, and more to understand how different visual impairments affect perception.

## Features

- **Import Image:** Upload an image to apply various visual effects.
- **Apply Effects:** Select from a list of 9 visual impairments, and adjust their intensity with sliders.
- **Reorder Effects:** Effects can be reordered to change the order in which they're applied.
- **Export Configurations:** Save the current effect settings as a JSON file.
- **Import Configurations:** Load previously saved configurations to restore the effect settings.
- **Adjust Intensity:** Each effect has a range slider to control the intensity of the effect.

## Effects Included

The following visual effects can be applied to the image:

1. **Light Degradation**
2. **Visual Field Loss**
3. **Rotation Distortion**
4. **Spatial Distortion**
5. **Infilling**
6. **Visual Acuity Loss**
7. **Color Shift**
8. **Field of View Reduction**
9. **Contrast Change**

## Requirements

This project uses modern web technologies and requires a browser that supports:

- **WebGL** for 3D rendering.
- **Three.js** for the rendering library.
- **ES Modules** for JavaScript imports.

## Installation

You can use this app directly on GitHub Pages or set it up locally. To run the project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies (if any):**
   If the project uses a bundler like Webpack or a package manager like npm, install the necessary dependencies:
   ```bash
   npm install
   ```

3. **Run the app locally:**
   Use a local server to serve the app (e.g., using `http-server` or a similar tool):
   ```bash
   npm run start
   ```

4. Open your browser and go to `http://localhost:8000` (or the appropriate local address).

## Usage

1. **Upload an image:** Click the "Import Image" button to upload an image from your computer.
2. **Choose Effects:** Select the checkboxes to enable the effects you want to apply.
3. **Adjust Intensity:** Use the sliders to adjust the intensity of each effect.
4. **Reorder Effects:** Click the "Up" and "Down" buttons to rearrange the effects' order.
5. **Export Settings:** After configuring the effects, click "Export JSON" to download the settings as a JSON file.
6. **Import Settings:** To load a previous configuration, click the "Import JSON" button and select the file.

## Customization

You can modify the effects by adjusting the GLSL shaders stored in the `effects/` folder. Each effect has its own `.glsl` shader file that can be edited to fine-tune the visual impairment simulation.

### Adding New Effects
To add a new effect:
1. Write a new GLSL shader file in the `effects/` folder.
2. Add the new effect to the `effectsList` array in the JavaScript code.
3. Implement any necessary UI for controlling the new effect.

## License

This project is open-source and available under the [MIT License](LICENSE).

---