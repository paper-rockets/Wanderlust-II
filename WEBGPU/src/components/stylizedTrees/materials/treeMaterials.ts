import * as THREE from "three";
import type { PineLeafUniforms, BarkUniforms } from "../treeUniforms";
import { PINE_WIND_UNIFORMS, PINE_WIND_VERTEX } from "../shaders/pineLeafShader";
import { BARK_FRAGMENT_HEAD } from "../shaders/barkShader";

export function canopyBounds(mesh: THREE.Mesh) {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  return {
    uLeafYMin: { value: bb.min.y } as THREE.IUniform<number>,
    uLeafYMax: { value: bb.max.y } as THREE.IUniform<number>,
  };
}

export function createPineLeafMaterial(
  src: THREE.MeshStandardMaterial | THREE.Material | null,
  mesh: THREE.Mesh,
  u: PineLeafUniforms,
): THREE.MeshLambertMaterial {
  const bounds = canopyBounds(mesh);
  const map = src && "map" in src ? (src as any).map : null;
  const alphaTest = src && "alphaTest" in src && (src as any).alphaTest > 0 ? (src as any).alphaTest : 0.6;

  const mat = new THREE.MeshLambertMaterial({
    map: map,
    alphaTest: alphaTest,
    transparent: false,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, bounds);

    shader.vertexShader =
      PINE_WIND_UNIFORMS +
      "varying vec3 vLeafLocal;\nvarying vec3 vLeafWorld;\n" +
      shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      PINE_WIND_VERTEX +
        `
      vLeafLocal = position;
      vLeafWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;`,
    );

    shader.fragmentShader =
      `varying vec3  vLeafLocal;
      varying vec3  vLeafWorld;
      uniform vec3  uLeafBottom;
      uniform vec3  uLeafTop;
      uniform float uLeafBrightness;
      uniform float uLeafGradPower;
      uniform vec3  uLeafVarColor;
      uniform float uLeafVarStrength;
      uniform float uLeafVarScale;
      uniform float uLeafYMin;
      uniform float uLeafYMax;

      float _lfHash(vec3 p) {
        p = fract( p * vec3( 127.1, 311.7, 74.7 ) );
        p += dot( p, p.yzx + 19.19 );
        return fract( ( p.x + p.y ) * p.z );
      }
      float _lfNoise(vec3 p) {
        vec3 i = floor( p );
        vec3 f = fract( p );
        vec3 w = f * f * ( 3.0 - 2.0 * f );
        return mix(
          mix( mix( _lfHash( i ),               _lfHash( i + vec3(1,0,0) ), w.x ),
               mix( _lfHash( i + vec3(0,1,0) ), _lfHash( i + vec3(1,1,0) ), w.x ), w.y ),
          mix( mix( _lfHash( i + vec3(0,0,1) ), _lfHash( i + vec3(1,0,1) ), w.x ),
               mix( _lfHash( i + vec3(0,1,1) ), _lfHash( i + vec3(1,1,1) ), w.x ), w.y ),
          w.z );
      }\n` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        float _t = clamp( ( vLeafLocal.y - uLeafYMin ) / max( uLeafYMax - uLeafYMin, 0.001 ), 0.0, 1.0 );
        _t = pow( _t, uLeafGradPower );
        vec3 _leaf = mix( uLeafBottom, uLeafTop, _t );
        float _n = _lfNoise( vLeafWorld * uLeafVarScale ) - 0.5;
        _leaf += ( uLeafVarColor - _leaf ) * _n * uLeafVarStrength;
        diffuseColor.rgb = max( _leaf, vec3( 0.0 ) ) * uLeafBrightness;
      }`,
    );
  };

  return mat;
}

export function createPineLeafDepthMaterial(
  src: THREE.MeshStandardMaterial | THREE.Material | null,
): THREE.MeshDepthMaterial {
  const map = src && "map" in src ? (src as any).map : null;
  const alphaTest = src && "alphaTest" in src && (src as any).alphaTest > 0 ? (src as any).alphaTest : 0.6;
  return new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: map,
    alphaTest: alphaTest,
    side: THREE.DoubleSide,
  });
}

export function createBarkMaterial(mesh: THREE.Mesh, u: BarkUniforms & Partial<PineLeafUniforms>): THREE.MeshLambertMaterial {
  const bounds = canopyBounds(mesh);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, bounds);

    shader.vertexShader = PINE_WIND_UNIFORMS + "varying vec2 vBarkUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      PINE_WIND_VERTEX + "\n      vBarkUv = uv;",
    );

    shader.fragmentShader = BARK_FRAGMENT_HEAD + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>
      if ( uBarkRelief > 0.001 ) {
        float _bh = texture2D( uBarkHeightMap, vBarkUv * uBarkScale ).r;
        normal = normalize( normal - uBarkRelief * vec3( dFdx( _bh ), dFdy( _bh ), 0.0 ) );
      }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        vec2 _buv = vBarkUv * uBarkScale;
        vec3 _bark = texture2D( uBarkColorMap, _buv ).rgb;

        float _luma = dot( _bark, vec3( 0.2126, 0.7152, 0.0722 ) );
        _bark = mix( vec3( _luma ), _bark, uBarkSaturation );
        _bark = mix( _bark, _bark * uBarkTint, uBarkTintStrength );

        float _ao = texture2D( uBarkAOMap, _buv ).r;
        _bark *= mix( 1.0, _ao, uBarkAOStrength );

        diffuseColor.rgb = _bark * uBarkBrightness;
      }`,
    );
  };

  return mat;
}
