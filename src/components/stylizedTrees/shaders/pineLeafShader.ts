export const PINE_WIND_UNIFORMS = /* glsl */ `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uWindFreq;
  uniform vec2  uWindDir;
  uniform float uLeafWindStrength;  // 0 = still
  uniform float uLeafFlutterAmp;    // fast, small-scale shimmer on top of the sway
  uniform float uLeafFlutterSpeed;
  uniform float uLeafDip;           // pendulum: the canopy dips as it swings out
  uniform float uLeafYMin;
  uniform float uLeafYMax;
`;

export const PINE_WIND_VERTEX = /* glsl */ `
  #include <begin_vertex>

  // Height mask over the canopy's own bounding box, squared: the branches near
  // the trunk barely move, the outer/upper foliage moves most.
  float _pnT    = clamp( ( position.y - uLeafYMin ) / max( uLeafYMax - uLeafYMin, 0.001 ), 0.0, 1.0 );
  float _pnMask = _pnT * _pnT;

  vec3 _pnWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;

  // Wind is a world-space vector but transformed is mesh-local, and the trees are
  // rotated — so bring it into local space by inverting the model rotation.
  mat3 _pnRot = mat3(
    normalize( vec3( modelMatrix[0] ) ),
    normalize( vec3( modelMatrix[1] ) ),
    normalize( vec3( modelMatrix[2] ) )
  );
  vec3 _pnWindLocal = transpose( _pnRot ) * vec3( uWindDir.x, 0.0, uWindDir.y );

  // Slow sway, phase-shifted by world position so neighbouring trees are never in lockstep,
  // plus a fast low-amplitude flutter for the leaves themselves.
  float _pnSway    = sin( dot( _pnWorld.xz, uWindDir ) * uWindFreq + uTime * uWindSpeed );
  float _pnFlutter = sin( uTime * uWindSpeed * uLeafFlutterSpeed + _pnWorld.y * 2.3 + _pnWorld.x )
                   * uLeafFlutterAmp;
  float _pnWave    = _pnSway + _pnFlutter;

  transformed += _pnWindLocal * ( _pnWave * uLeafWindStrength * _pnMask );
  // Pendulum arc: a branch swinging out also drops a little, instead of sliding along a flat line.
  transformed.y -= abs( _pnWave ) * uLeafWindStrength * _pnMask * uLeafDip;
`;
