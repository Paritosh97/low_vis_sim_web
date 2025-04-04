// lightDegradation.glsl
uniform sampler2D tDiffuse;
uniform float intensity; // min:0, max:1, step:0.01
uniform float decayRate; // min:0, max:2, step:0.05
uniform vec3 tintColor; // default:vec3(1.0,1.0,1.0)

varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  color.rgb *= (1.0 - intensity * decayRate);
  color.rgb *= tintColor;
  gl_FragColor = color;
}