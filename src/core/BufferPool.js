// BufferPool.js - High-Performance TypedArray and Buffer Pooling for WebGPU
// Prevents GC stalls and memory fragmentation during terrain, particles, and instancing updates.

class TypedBufferPool {
    constructor() {
        this._float32Pool = new Map(); // size -> Array<Float32Array>
        this._uint32Pool = new Map();  // size -> Array<Uint32Array>
        this._uint16Pool = new Map();  // size -> Array<Uint16Array>
        this._stats = {
            f32Allocations: 0,
            f32Reuses: 0,
            u32Allocations: 0,
            u32Reuses: 0,
            totalPooledArrays: 0
        };
    }

    /**
     * Acquire a Float32Array of the requested length.
     * Reuses a pooled array if available, otherwise creates a new buffer.
     * @param {number} length 
     * @param {boolean} zeroOut Whether to zero-fill the array
     * @returns {Float32Array}
     */
    getFloat32(length, zeroOut = false) {
        const pool = this._float32Pool.get(length);
        if (pool && pool.length > 0) {
            this._stats.f32Reuses++;
            this._stats.totalPooledArrays--;
            const arr = pool.pop();
            if (zeroOut) arr.fill(0);
            return arr;
        }

        this._stats.f32Allocations++;
        return new Float32Array(length);
    }

    /**
     * Return a Float32Array back to the pool.
     * @param {Float32Array} array 
     */
    releaseFloat32(array) {
        if (!array || !(array instanceof Float32Array)) return;
        const len = array.length;
        let pool = this._float32Pool.get(len);
        if (!pool) {
            pool = [];
            this._float32Pool.set(len, pool);
        }
        // Cap max pooled arrays per bucket to 8 to avoid hoarding VRAM/RAM
        if (pool.length < 8) {
            pool.push(array);
            this._stats.totalPooledArrays++;
        }
    }

    /**
     * Acquire a Uint32Array of the requested length.
     * @param {number} length 
     * @param {boolean} zeroOut 
     * @returns {Uint32Array}
     */
    getUint32(length, zeroOut = false) {
        const pool = this._uint32Pool.get(length);
        if (pool && pool.length > 0) {
            this._stats.u32Reuses++;
            this._stats.totalPooledArrays--;
            const arr = pool.pop();
            if (zeroOut) arr.fill(0);
            return arr;
        }

        this._stats.u32Allocations++;
        return new Uint32Array(length);
    }

    /**
     * Return a Uint32Array back to the pool.
     * @param {Uint32Array} array 
     */
    releaseUint32(array) {
        if (!array || !(array instanceof Uint32Array)) return;
        const len = array.length;
        let pool = this._uint32Pool.get(len);
        if (!pool) {
            pool = [];
            this._uint32Pool.set(len, pool);
        }
        if (pool.length < 8) {
            pool.push(array);
            this._stats.totalPooledArrays++;
        }
    }

    getStats() {
        return { ...this._stats };
    }

    clear() {
        this._float32Pool.clear();
        this._uint32Pool.clear();
        this._uint16Pool.clear();
        this._stats.totalPooledArrays = 0;
    }
}

export const bufferPool = new TypedBufferPool();
