precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uThreshold; // 0 = original, 1 = full zoom

varying vec2 vUv;

void main() {
    vec2 center = vec2(0.5, 0.5);

    // Define max zoom scale factor (e.g., 4.0x zoom when uThreshold = 1.0)
    float maxZoom = 4.0;

    // Compute current zoom scale based on threshold (linearly scaled)
    float zoom = mix(1.0, maxZoom, uThreshold);

    // Interpolate between center and UV based on the zoom
    vec2 zoomedUv = mix(center, vUv, 1.0 / zoom);

    vec4 color = texture2D(uImage, zoomedUv);
    gl_FragColor = color;
}
