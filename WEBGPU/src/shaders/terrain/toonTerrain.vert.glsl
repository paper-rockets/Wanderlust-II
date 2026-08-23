varying vec3 vWorldPos;
varying vec3 vViewPos;

void main() {
    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vViewPos = - (modelViewMatrix * vec4(transformed, 1.0)).xyz;
}
