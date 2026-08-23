// Billboard Tree Wind Sway Vertex Shader
uniform vec3 uPlayerPos;
uniform float uTreeScale;

void main() {
    // Tree scaling
    vec3 transformed = position * uTreeScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
