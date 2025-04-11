precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uHorizontalScale; // min: 0.0 max: 2.0 default: 1.0
uniform float uVerticalScale;   // min: 0.0 max: 2.0 default: 1.0

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);

    // Apply contrast change
    vec3 contrastColor = originalColor.rgb * vec3(uHorizontalScale, uVerticalScale, 1.0);

    gl_FragColor = vec4(contrastColor, originalColor.a);
}
