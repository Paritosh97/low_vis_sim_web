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

vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}

void main() {
    // TODO pass this from the js side
    vec2 uResolution = vec2(1.0, 1.0);
    vec2 p = vUv * uResolution;

    vec2 rotatedP = p;

    for (int i = 0; i < 3; ++i) {
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
