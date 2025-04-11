precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform vec4 uKernels[16]; // min: (0.0, 0.0, 0.0, 0.0) max: (1.0, 1.0, 0.5, 1.0) default: (0.5, 0.5, 0.05, 0.25)

varying vec2 vUv;

float gaussian(vec2 p, vec2 mu, float sigma) {
    vec2 diff = p - mu;
    float exponent = dot(diff, diff) / (2.0 * sigma * sigma);
    return exp(-exponent);
}

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture(uImage, uv);

    float degradation = 0.0;

    for (int i = 0; i < 16; ++i) {
        vec4 kernel = uKernels[i];
        vec2 mu = vec2(kernel.x, kernel.y);  // Mean (mu_x, mu_y)
        float sigma = kernel.z;             // Standard deviation (sigma)
        float omega = kernel.w;             // Weight (omega)

        degradation += omega * gaussian(uv, mu, sigma);
    }

    degradation = clamp(degradation, 0.0, 1.0);
    vec3 finalColor = mix(originalColor.rgb, vec3(0.0), degradation);

    gl_FragColor = vec4(finalColor, originalColor.a);
}