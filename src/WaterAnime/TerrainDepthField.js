/**
 * TerrainDepthField.js — CPU-baked terrain height field for shoreline shading
 *
 * Bakes `getWorldHeight(x, z)` into a single-channel float DataTexture covering the
 * same 4000x4000 world footprint as the live terrain mesh in main.js, at 512x512
 * (7.8 m per texel — 4x finer than the 31.25 m terrain tessellation).
 *
 * The water shader samples this to recover `depth = waterLevel - terrainHeight`, which
 * lets the shore gradient (sand band / foam line / opacity falloff) be *painted* at
 * 7.8 m resolution instead of being limited by the terrain polygon edges.
 *
 * Baking is amortised across frames (row blocks) and double-buffered, so the live
 * texture is never sampled while half-written.
 *
 * Texel <-> world mapping (must stay in lockstep with the shader):
 *   origin  = (centerX - worldSize/2, centerZ - worldSize/2)
 *   worldX  = origin.x + (col + 0.5) * worldSize / res
 *   worldZ  = origin.y + (row + 0.5) * worldSize / res
 *   index   = row * res + col
 *   shader uv = (worldXZ - origin) / worldSize
 * DataTexture has flipY = false, so data row 0 is v = 0. No vertical flip anywhere.
 */

import * as THREE from 'three';
import { getWorldHeight } from '../world/TerrainGenerator.js';
import {
  DEPTH_FIELD_SENTINEL,
  depthFieldOriginUniform,
  depthFieldSizeUniform,
  depthFieldValidUniform
} from './OpenSeaOcean.js';

export class TerrainDepthField {

  /**
   * @param {number} [res=512]        Texture resolution (square).
   * @param {number} [worldSize=4000] World footprint in metres — must track the terrain mesh.
   * @param {number} [rowsPerTick=32] Rows baked per tick(). 32 => 16 ticks for a full 512 bake.
   */
  constructor(res = 512, worldSize = 4000, rowsPerTick = 32) {
    this.res = res;
    this.worldSize = worldSize;
    this.rowsPerTick = Math.max(1, rowsPerTick | 0);

    const texelCount = res * res;

    // Live (front) buffer — what the GPU sees. Back buffer — where the bake writes.
    this._front = new Float32Array(texelCount).fill(DEPTH_FIELD_SENTINEL);
    this._back = new Float32Array(texelCount).fill(DEPTH_FIELD_SENTINEL);

    // Allocated eagerly (before createOpenSeaMaterial) so the TSL graph always
    // captures a valid texture. Only its *contents* ever change after this.
    this._texture = new THREE.DataTexture(this._front, res, res, THREE.RedFormat, THREE.FloatType);
    this._texture.minFilter = THREE.LinearFilter;
    this._texture.magFilter = THREE.LinearFilter;
    this._texture.wrapS = THREE.ClampToEdgeWrapping;
    this._texture.wrapT = THREE.ClampToEdgeWrapping;
    this._texture.generateMipmaps = false;
    this._texture.flipY = false;
    this._texture.unpackAlignment = 1;
    this._texture.name = 'TerrainDepthField';
    this._texture.needsUpdate = true;

    // Bake state
    this._baking = false;
    this._bakeRow = 0;
    this._bakeOriginX = 0;
    this._bakeOriginZ = 0;

    // Live (published) state
    this._valid = false;
    this._liveOriginX = 0;
    this._liveOriginZ = 0;

    depthFieldSizeUniform.value = worldSize;
    depthFieldValidUniform.value = 0.0;
    depthFieldOriginUniform.value.set(0, 0);
  }

  /** @returns {THREE.DataTexture} The live, fully-baked height texture. */
  get texture() {
    return this._texture;
  }

  /** @returns {boolean} True once at least one bake has completed. */
  get valid() {
    return this._valid;
  }

  /** @returns {boolean} True while a bake is in flight. */
  get baking() {
    return this._baking;
  }

  /** @returns {number} 0..1 progress of the in-flight bake (1 when idle). */
  get progress() {
    return this._baking ? this._bakeRow / this.res : 1.0;
  }

  /**
   * Start (or restart) an amortised bake centred on the given world position.
   * Cheap — does no height sampling itself; the work happens in tick().
   * Safe to call while a bake is already in flight: it restarts cleanly against
   * the new centre so origin and contents can never disagree.
   *
   * @param {number} centerX
   * @param {number} centerZ
   */
  rebuild(centerX, centerZ) {
    const half = this.worldSize * 0.5;
    const originX = centerX - half;
    const originZ = centerZ - half;

    // Already baking this exact centre — let it finish rather than restarting.
    if (this._baking && originX === this._bakeOriginX && originZ === this._bakeOriginZ) return;
    // Live field already covers this exact centre and nothing is pending.
    if (!this._baking && this._valid && originX === this._liveOriginX && originZ === this._liveOriginZ) return;

    this._bakeOriginX = originX;
    this._bakeOriginZ = originZ;
    this._bakeRow = 0;
    this._baking = true;
  }

  /**
   * Bake one block of rows. No-op (and near-free) when idle.
   * Call once per frame from the render loop.
   */
  tick() {
    if (!this._baking) return;

    const res = this.res;
    const data = this._back;
    const step = this.worldSize / res;
    const ox = this._bakeOriginX;
    const oz = this._bakeOriginZ;

    const startRow = this._bakeRow;
    const endRow = Math.min(res, startRow + this.rowsPerTick);

    for (let row = startRow; row < endRow; row++) {
      const worldZ = oz + (row + 0.5) * step;
      const base = row * res;
      for (let col = 0; col < res; col++) {
        data[base + col] = getWorldHeight(ox + (col + 0.5) * step, worldZ);
      }
    }

    this._bakeRow = endRow;

    if (endRow >= res) this._publish();
  }

  /**
   * Swap the completed back buffer into the live texture and publish the matching
   * origin in the same step, so the shader's origin always agrees with the contents.
   * @private
   */
  _publish() {
    this._front.set(this._back);
    this._texture.needsUpdate = true;

    this._liveOriginX = this._bakeOriginX;
    this._liveOriginZ = this._bakeOriginZ;
    this._valid = true;
    this._baking = false;
    this._bakeRow = 0;

    depthFieldOriginUniform.value.set(this._liveOriginX, this._liveOriginZ);
    depthFieldSizeUniform.value = this.worldSize;
    depthFieldValidUniform.value = 1.0;
  }

  /**
   * CPU-side lookup of the baked height, matching what the shader sees
   * (bilinear, clamped to edge). Returns DEPTH_FIELD_SENTINEL before the first bake.
   * @param {number} worldX
   * @param {number} worldZ
   * @returns {number}
   */
  sampleHeight(worldX, worldZ) {
    if (!this._valid) return DEPTH_FIELD_SENTINEL;

    const res = this.res;
    const inv = res / this.worldSize;
    let fx = (worldX - this._liveOriginX) * inv - 0.5;
    let fz = (worldZ - this._liveOriginZ) * inv - 0.5;

    fx = Math.min(Math.max(fx, 0), res - 1);
    fz = Math.min(Math.max(fz, 0), res - 1);

    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, res - 1), z1 = Math.min(z0 + 1, res - 1);
    const tx = fx - x0, tz = fz - z0;

    const d = this._front;
    const h00 = d[z0 * res + x0], h10 = d[z0 * res + x1];
    const h01 = d[z1 * res + x0], h11 = d[z1 * res + x1];

    return (h00 + (h10 - h00) * tx) * (1 - tz) + (h01 + (h11 - h01) * tx) * tz;
  }

  /** Tune the per-tick budget at runtime (e.g. from a quality setting). */
  setRowsPerTick(rows) {
    this.rowsPerTick = Math.max(1, rows | 0);
  }

  dispose() {
    this._baking = false;
    this._valid = false;
    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }
    this._front = null;
    this._back = null;
    depthFieldValidUniform.value = 0.0;
  }
}
