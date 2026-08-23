// Bird Wing Flap Vertex Animation Shader
uniform float time;

vec3 animateBirdWing(vec3 pos) {
    vec3 transformed = vec3(pos);
    float wingDist = abs(pos.x);
    if (wingDist > 0.3) {
        transformed.y += sin(time * 9.0 + wingDist * 0.5) * wingDist * 0.35;
    }
    return transformed;
}
