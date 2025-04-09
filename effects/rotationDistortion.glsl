precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;

const int NUM_KERNELS = 3;

uniform vec2 uCenters[NUM_KERNELS];
uniform float uSigmas[NUM_KERNELS];
uniform float uWeights[NUM_KERNELS];

varying vec2 vUv;

float gaussian(vec2 p, vec2 center, float sigma) {
    vec2 diff = p - center;
    float lenSq = dot(diff, diff);
    return exp(-lenSq / (2.0 * sigma * sigma));
}

vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}

void main() {
    vec2 p = vUv * uResolution;

    vec2 rotatedP = p;

    for (int i = 0; i < NUM_KERNELS; ++i) {
        vec2 center = uCenters[i];
        float sigma = uSigmas[i];
        float weight = uWeights[i];

        float falloff = gaussian(p, center, sigma);
        float angle = weight * falloff;

        vec2 relativeP = p - center;
        vec2 rotated = rotate(relativeP, angle) + center;

        rotatedP += (rotated - p);
    }

    vec2 distortedUv = rotatedP / uResolution;
    gl_FragColor = texture2D(uTexture, distortedUv);
}
