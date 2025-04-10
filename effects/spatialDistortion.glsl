uniform sampler2D tDiffuse;
uniform float intensity; // min: (0.0) max: (1.0) default: (0.5)
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  color.rgb *= 1.0 - intensity; // Dummy degradation
  gl_FragColor = color;
}