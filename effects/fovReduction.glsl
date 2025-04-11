precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uThreshold; // min: 0.0 max: 1.0 default: 0.5

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5, 0.5);
    float distance = length(uv - center);

    float reductionFactor = step(uThreshold, distance);
    vec4 originalColor = texture2D(uImage, uv);

    vec3 finalColor = mix(originalColor.rgb, vec3(0.0), reductionFactor);

    gl_FragColor = vec4(finalColor, originalColor.a);
}
