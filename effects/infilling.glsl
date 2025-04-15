precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uInfillX; // min: 0.001 max: 1.0 default: 0.5
uniform float uInfillY; // min: 0.001 max: 1.0 default: 0.5
uniform float uInfillSize; // min: 0.001 max: 10.0 default: 10.0

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);
    vec3 resultColor = originalColor.rgb;

    vec2 center = vec2(uInfillX, uInfillY);
    float radius = uInfillSize;

    // If outside the infill zone, keep original
    float dist = distance(uv, center);
    if (dist > radius) {
        gl_FragColor = originalColor;
        return;
    }

    // Otherwise, compute infill using 4 directional samples
    vec2 texel = vec2(1.0) / uResolution;
    float delta = radius * min(uResolution.x, uResolution.y); // convert radius to texel units

    vec2 offset = vec2(delta) * texel;

    vec3 up    = texture2D(uImage, center + vec2(0.0,  offset.y)).rgb;
    vec3 right = texture2D(uImage, center + vec2( offset.x, 0.0)).rgb;
    vec3 down  = texture2D(uImage, center - vec2(0.0,  offset.y)).rgb;
    vec3 left  = texture2D(uImage, center - vec2( offset.x, 0.0)).rgb;

    float d1 = offset.y;
    float d2 = offset.x;
    float d3 = offset.y;
    float d4 = offset.x;

    float w1 = 1.0 / (d1 * d1 + 1e-6);
    float w2 = 1.0 / (d2 * d2 + 1e-6);
    float w3 = 1.0 / (d3 * d3 + 1e-6);
    float w4 = 1.0 / (d4 * d4 + 1e-6);
    float wSum = w1 + w2 + w3 + w4;

    vec3 infilled = (
        up    * w1 +
        right * w2 +
        down  * w3 +
        left  * w4
    ) / wSum;

    gl_FragColor = vec4(infilled, originalColor.a);
}
