precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCenters[3]; // min: (-1.0, -1.0) max: (1.0, 1.0) default: (0.0, 0.0)
uniform float uSigmas[3]; // min: 0.001 max: 1.0 default: 0.5
uniform float uWeights[3]; // min: 0.0 max: 1.0 default: 0.5

varying vec2 vUv;

float gaussian(vec2 p, vec2 center, float sigma) {
    vec2 diff = p - center;
    float lenSq = dot(diff, diff);
    return exp(-lenSq / (2.0 * sigma * sigma));
}

void main() {
    vec2 uv = vUv;
    vec2 distortedUv = uv;

    for (int i = 0; i < 3; ++i) {
        vec2 center = uCenters[i];
        float sigma = uSigmas[i];
        float weight = uWeights[i];

        float falloff = gaussian(uv, center, sigma);
        distortedUv += weight * falloff * (uv - center);
    }

    gl_FragColor = texture2D(uTexture, distortedUv);
}
