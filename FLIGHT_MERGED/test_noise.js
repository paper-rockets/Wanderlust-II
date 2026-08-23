const perm = new Uint8Array(512);
for (let i = 0; i < 512; i++) perm[i] = Math.floor(Math.random() * 255);

function snoise(x, z) {
    let n0, n1, n2;
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    let s = (x + z) * F2;
    let i = Math.floor(x + s), j = Math.floor(z + s);
    let t = (i + j) * G2;
    let X0 = i - t, Z0 = j - t;
    let x0 = x - X0, z0 = z - Z0;
    let i1, j1;
    if (x0 > z0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    let x1 = x0 - i1 + G2, z1 = z0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2, z2 = z0 - 1.0 + 2.0 * G2;
    let ii = i & 255, jj = j & 255;
    let gi0 = perm[ii + perm[jj]] % 12;
    let gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    let gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
    let t0 = 0.5 - x0 * x0 - z0 * z0; if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * (x0 * (gi0 > 5 ? 1 : -1) + z0 * (gi0 % 2 === 0 ? 1 : -1)); }
    let t1 = 0.5 - x1 * x1 - z1 * z1; if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * (x1 * (gi1 > 5 ? 1 : -1) + z1 * (gi1 % 2 === 0 ? 1 : -1)); }
    let t2 = 0.5 - x2 * x2 - z2 * z2; if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * (x2 * (gi2 > 5 ? 1 : -1) + z2 * (gi2 % 2 === 0 ? 1 : -1)); }
    return 70.0 * (n0 + n1 + n2);
}

let min = 1000, max = -1000;
for (let i=0; i<10000; i++) {
  let v = snoise(Math.random() * 1000, Math.random() * 1000);
  if (v < min) min = v;
  if (v > max) max = v;
}
console.log({min, max});
