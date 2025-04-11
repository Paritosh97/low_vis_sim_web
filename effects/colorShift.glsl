precision highp float;

uniform sampler2D uImage;
uniform mat3 uNormalMatrix; // Normal vision transformation matrix
uniform mat3 uCVDMatrix;    // Color vision deficiency transformation matrix

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 originalColor = texture2D(uImage, uv);

    vec3 rgb = originalColor.rgb;
    vec3 lmsNormal = uNormalMatrix * rgb;
    vec3 lmsCVD = uCVDMatrix * lmsNormal;
    vec3 rgbCVD = inverse(uNormalMatrix) * lmsCVD;

    gl_FragColor = vec4(rgbCVD, originalColor.a);
}
