#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform vec2 u_rotation; // x = yaw (radians), y = pitch (radians)
uniform float u_zoom;    // zoom factor (1.0 = normal, >1.0 = zoomed in)

#define time (iTime * 0.4)

mat2 mm2(in float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);

float tri(in float x){ return clamp(abs(fract(x) - 0.5), 0.001, 0.499); }
vec2 tri2(in vec2 p){ return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x))); }

// 2D Tri-Noise with animated domain warping
float triNoise2d(in vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
    float rz = 0.0;
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
    for (float i = 0.0; i < 5.0; i += 1.0) {
        vec2 dg = tri2(bp * 1.85) * 0.75;
        dg *= mm2(time * spd);
        p -= dg / z2;

        bp *= 1.3;
        z2 *= 0.45;
        z *= 0.42;
        p *= 1.21 + (rz - 1.0) * 0.02;
        
        rz += tri(p.x + tri(p.y)) * z;
        p *= -m2;
    }
    return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
}

float hash21(in vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

// Emerald green with pink crown volumetric aurora
vec4 aurora(vec3 ro, vec3 rd) {
    vec4 col = vec4(0.0);
    vec4 avgCol = vec4(0.0);
    
    // Step through vertical curtain layers
    for (float i = 0.0; i < 50.0; i += 1.0) {
        float of = 0.006 * hash21(gl_FragCoord.xy) * smoothstep(0.0, 15.0, i);
        float pt = ((0.8 + pow(i, 1.4) * 0.002) - ro.y) / (rd.y * 2.0 + 0.4);
        pt -= of;
        
        if (pt > 0.0) {
            vec3 bpos = ro + pt * rd;
            vec2 p = bpos.zx;
            float rzt = triNoise2d(p, 0.06);
            
            // Emerald-green base to radiant pink/magenta crown
            // Lower layers (i near 0): Emerald green
            // Upper layers (i near 40-50): Vivid pink / magenta crown
            float h = i / 48.0;
            vec3 emeraldGreen = vec3(0.05, 0.98, 0.42);
            vec3 seafoamAqua   = vec3(0.12, 0.95, 0.68);
            vec3 radiantPink   = vec3(0.98, 0.20, 0.65);
            vec3 deepCrownPink = vec3(0.88, 0.12, 0.75);
            
            vec3 gradColor;
            if (h < 0.35) {
                gradColor = mix(emeraldGreen, seafoamAqua, h / 0.35);
            } else if (h < 0.75) {
                gradColor = mix(seafoamAqua, radiantPink, (h - 0.35) / 0.40);
            } else {
                gradColor = mix(radiantPink, deepCrownPink, (h - 0.75) / 0.25);
            }
            
            vec4 col2 = vec4(gradColor * rzt, rzt);
            avgCol = mix(avgCol, col2, 0.5);
            col += avgCol * exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
        }
    }
    
    // Smooth horizon fade
    col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
    return col * 1.9;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    
    // Apply zoom factor
    float zoom = (u_zoom > 0.0) ? u_zoom : 1.0;
    uv /= zoom;
    
    // Camera ray direction
    vec3 rd = normalize(vec3(uv, 1.3));
    vec3 ro = vec3(0.0, 0.0, -6.7);
    
    // Camera rotation (Euler yaw and pitch)
    vec2 rot = u_rotation;
    if (rot == vec2(0.0) && iMouse.z > 0.0) {
        vec2 mo = (iMouse.xy / iResolution.xy - 0.5) * 3.0;
        rot = vec2(mo.x, mo.y);
    }
    
    // Apply pitch (Y) then yaw (X)
    rd.yz *= mm2(-rot.y);
    rd.xz *= mm2(-rot.x + sin(time * 0.05) * 0.1);
    
    // Pitch-black background: No stars, no atmosphere, no ground
    vec3 col = vec3(0.0);
    
    if (rd.y > 0.0) {
        float fade = smoothstep(0.0, 0.02, rd.y);
        vec4 aur = smoothstep(0.0, 1.5, aurora(ro, rd)) * fade;
        col = aur.rgb; // Pure volumetric emerald & pink aurora
    }
    
    fragColor = vec4(col, 1.0);
}
