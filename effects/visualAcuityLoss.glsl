precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform vec4 uKernels[16]; // min: (0.0, 0.0, 0.001, 0.0) max: (1.0, 1.0, 0.5, 1.0) default: (0.5, 0.5, 0.2, 0.5)

varying vec2 vUv;

float gaussian(vec2 p, vec2 mu, float sigma) {
    vec2 diff = p - mu;
    float exponent = dot(diff, diff) / (2.0 * sigma * sigma);
    return exp(-exponent);
}

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);

    vec3 blurredColor = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < 16; ++i) {
        vec4 kernel = uKernels[i];
        vec2 mu = vec2(kernel.x, kernel.y);
        float sigma = kernel.z;
        float omega = kernel.w;

        vec3 sampleColor = texture2D(uImage, uv + mu * sigma).rgb;
        blurredColor += omega * gaussian(uv, mu, sigma) * sampleColor;
        totalWeight += omega;
    }

    blurredColor /= totalWeight;
    gl_FragColor = vec4(blurredColor, ori
