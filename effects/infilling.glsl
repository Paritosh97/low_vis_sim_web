precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform vec4 uKernels[4]; // min: (0.0, 0.0, 0.001, 0.0) max: (1.0, 1.0, 0.5, 1.0) default: (0.5, 0.5, 0.2, 0.5)

varying vec2 vUv;

float gaussian(vec2 p, vec2 mu, float sigma) {
    vec2 diff = p - mu;
    float exponent = dot(diff, diff) / (2.0 * sigma * sigma);
    return exp(-exponent);
}

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);

    vec3 infilledColor = vec3(0.0);
    float totalWeight = 0.0;

    vec2 offsetUnit = vec2(1.0) / uResolution;

    for (int i = 0; i < 4; ++i) {
        vec4 kernel = uKernels[i];
        vec2 mu = kernel.xy;
        float sigma = kernel.z;
        float weight = kernel.w;

        float g = gaussian(uv, mu, sigma);

        // Use a fixed sample offset direction to ensure visible effect
        vec2 offsetDir = normalize(uv - mu + 0.0001); // avoid zero vector

        vec3 forwardColor  = texture2D(uImage, uv + offsetDir * offsetUnit * 5.0).rgb;
        vec3 backwardColor = texture2D(uImage, uv - offsetDir * offsetUnit * 5.0).rgb;

        vec3 averagedColor = 0.5 * (forwardColor + backwardColor);
        vec3 contribution = g * averagedColor * weight;

        infilledColor += contribution;
        totalWeight += g * weight;
    }

    infilledColor /= totalWeight;
    gl_FragColor = vec4(infilledColor, originalColor.a);
}