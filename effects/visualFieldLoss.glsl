precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uThreshold; // min: 0.0 max: 1.0 default: 0.5

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);

    // Calculate light degradation effect
    float degradation = 0.0;
    // Assume a function to compute light degradation
    // degradation = computeLightDegradation(uv);

    // Determine visual field loss
    float fieldLoss = step(uThreshold, degradation);

    // Apply visual field loss
    vec3 finalColor = mix(originalColor.rgb, vec3(0.0), fieldLoss);

    gl_FragColor = vec4(finalColor, originalColor.a);
}
