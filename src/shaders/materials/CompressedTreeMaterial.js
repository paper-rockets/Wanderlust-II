import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { 
    Fn, vec2, vec3, vec4, float, sin, cos, dot, mix, clamp, pow, 
    reflect, normalize, positionWorld, positionLocal, positionGeometry, 
    normalWorld, cameraPosition, modelWorldMatrix, 
    attribute, max, min, smoothstep, fract, uniform
} from 'three/tsl';
import { windSwayNode } from './WindSwayNode.js';

export const createCompressedTreeMaterial = (options = {}) => {
    const {
        uTime = uniform(0.0),
        uSunDir = uniform(new THREE.Vector3(0.5, 1.0, 0.3)),
        uTreeScale = uniform(1.0),
        gradientMap = null,
        // Editable canopy colors
        canopyShadow = new THREE.Color(0x06140a), // Deep dark shadow (#06140a)
        canopyMid    = new THREE.Color(0x0e2b13), // Evergreen mountain pine (#0e2b13)
        canopyTip    = new THREE.Color(0x1c4a1d), // Lush highland tip (#1c4a1d)
        canopyCrest  = new THREE.Color(0x2e6929), // Warm sun-kissed crest (#2e6929)
        // Editable trunk colors
        trunkBase    = new THREE.Color(0x140b06), // Ground contact shadow (#140b06)
        trunkMid     = new THREE.Color(0x2e1b10), // Warm cedar trunk (#2e1b10)
        trunkHigh    = new THREE.Color(0x472a1b), // Upper sun-warmed bark (#472a1b)
        // Editable wind & subsurface scattering
        subsurfaceIntensity = 1.0,
        enableWind = true
    } = options;

    const uCanopyShadow = uniform(new THREE.Vector3(canopyShadow.r, canopyShadow.g, canopyShadow.b));
    const uCanopyMid    = uniform(new THREE.Vector3(canopyMid.r, canopyMid.g, canopyMid.b));
    const uCanopyTip    = uniform(new THREE.Vector3(canopyTip.r, canopyTip.g, canopyTip.b));
    const uCanopyCrest  = uniform(new THREE.Vector3(canopyCrest.r, canopyCrest.g, canopyCrest.b));

    const uTrunkBase    = uniform(new THREE.Vector3(trunkBase.r, trunkBase.g, trunkBase.b));
    const uTrunkMid     = uniform(new THREE.Vector3(trunkMid.r, trunkMid.g, trunkMid.b));
    const uTrunkHigh    = uniform(new THREE.Vector3(trunkHigh.r, trunkHigh.g, trunkHigh.b));
    const uSubsurface   = uniform(float(subsurfaceIntensity));

    const matTree = new MeshToonNodeMaterial({
        vertexColors: false,
        gradientMap: gradientMap,
        side: THREE.DoubleSide,
        dithering: true
    });

    if (enableWind) {
        matTree.positionNode = windSwayNode(uTime, uTreeScale);
    }

    // Read bark mask from custom _aisbark or COLOR_0 attribute
    const aIsBark = attribute('_aisbark', 'float');

    matTree.colorNode = Fn(() => {
        const localY = clamp(positionLocal.y.div(22.0), 0.0, 1.0);
        const radDist = clamp(positionLocal.xz.length().div(5.5), 0.0, 1.0);

        // Instance hash for per-tree natural color variation
        const globalPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
        const instHash = fract(sin(globalPos.x.mul(12.9898).add(globalPos.z.mul(78.233))).mul(43758.5453));

        // Blend canopy along vertical height
        const leafGrad1 = mix(uCanopyShadow, uCanopyMid, smoothstep(float(0.03), float(0.38), localY));
        const leafGrad2 = mix(leafGrad1, uCanopyTip, smoothstep(float(0.32), float(0.78), localY));
        
        // Add radial tip and crown highlight
        const tipHighlight = radDist.mul(0.25).add(smoothstep(float(0.70), float(1.0), localY).mul(0.35));
        const leafFinal = mix(leafGrad2, uCanopyCrest, tipHighlight);

        // Per-tree instance tint variation
        const tintWarm = vec3(1.08, 1.04, 0.90);
        const tintCool = vec3(0.90, 1.02, 1.10);
        const instTint = mix(tintCool, tintWarm, instHash);
        const variedLeafColor = leafFinal.mul(instTint);

        // Bark color gradient
        const barkGrad1 = mix(uTrunkBase, uTrunkMid, smoothstep(float(0.0), float(0.28), localY));
        const barkFinal = mix(barkGrad1, uTrunkHigh, smoothstep(float(0.28), float(0.70), localY));

        return mix(variedLeafColor, barkFinal, aIsBark);
    })();

    matTree.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const lightDir = normalize(uSunDir);
        const norm = normalize(normalWorld);

        // Subsurface scattering when looking toward the sun through needle canopy
        const backDot = clamp(dot(viewDir.negate(), lightDir), 0.0, 1.0);
        const foliageRim = pow(float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0)), 2.8);
        const sunSubsurface = pow(backDot, 3.2).mul(foliageRim.mul(1.2).add(0.15)).mul(uCanopyTip.mul(0.8));
        
        // Soft atmospheric sky bounce on upward surfaces
        const skyBounce = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0).mul(vec3(0.01, 0.025, 0.04));

        return sunSubsurface.mul(uSubsurface).add(skyBounce).mul(float(1.0).sub(aIsBark));
    })();

    // Expose direct uniform setters for live inspector editing
    matTree.setCanopyColors = ({ shadow, mid, tip, crest }) => {
        if (shadow) uCanopyShadow.value.set(shadow.r, shadow.g, shadow.b);
        if (mid)    uCanopyMid.value.set(mid.r, mid.g, mid.b);
        if (tip)    uCanopyTip.value.set(tip.r, tip.g, tip.b);
        if (crest)  uCanopyCrest.value.set(crest.r, crest.g, crest.b);
    };

    matTree.setTrunkColors = ({ base, mid, high }) => {
        if (base) uTrunkBase.value.set(base.r, base.g, base.b);
        if (mid)  uTrunkMid.value.set(mid.r, mid.g, mid.b);
        if (high) uTrunkHigh.value.set(high.r, high.g, high.b);
    };

    matTree.uniforms = {
        uCanopyShadow,
        uCanopyMid,
        uCanopyTip,
        uCanopyCrest,
        uTrunkBase,
        uTrunkMid,
        uTrunkHigh,
        uSubsurface
    };

    return matTree;
};
