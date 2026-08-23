const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. Update initial counts
content = content.replace('const ROCK_COUNT = 800;', 'const ROCK_COUNT = 1000;');
content = content.replace('const BUSH_COUNT = 1500, ANIMAL_COUNT = 50, CLOUD_COUNT = 80;', 'const BUSH_COUNT = 3000, ANIMAL_COUNT = 50, CLOUD_COUNT = 80;');
content = content.replace('const FLOWER_COUNT = 15000, GRASS_COUNT = 40000;', 'const FLOWER_COUNT = 20000, GRASS_COUNT = 30000;');

// 2. Update instTrees
content = content.replace(/const instTree1 = new THREE\.InstancedMesh\(geoTree1, matTree, \d+\);/g, 'const instTree1 = new THREE.InstancedMesh(geoTree1, matTree, 3500);');
content = content.replace(/const instTree2 = new THREE\.InstancedMesh\(geoTree2, matTree, \d+\);/g, 'const instTree2 = new THREE.InstancedMesh(geoTree2, matTree, 3500);');
content = content.replace(/const instTree3 = new THREE\.InstancedMesh\(geoTree3, matTree, \d+\);/g, 'const instTree3 = new THREE.InstancedMesh(geoTree3, matTree, 3500);');
content = content.replace(/const instTree4 = new THREE\.InstancedMesh\(geoTree4, matTree, \d+\);/g, 'const instTree4 = new THREE.InstancedMesh(geoTree4, matTree, 3000);');
content = content.replace(/const instTree5 = new THREE\.InstancedMesh\(geoTree5, matTree, \d+\);/g, 'const instTree5 = new THREE.InstancedMesh(geoTree5, matTree, 3000);');
content = content.replace(/const instTree6 = new THREE\.InstancedMesh\(geoTree6, matTree, \d+\);/g, 'const instTree6 = new THREE.InstancedMesh(geoTree6, matTree, 3000);');

// 3. Update dist
content = content.replace(/const dist = 750;/, 'const dist = 450;');

// 4. Update the loops block
const loopBlockStart = `        // Trees`;
const loopBlockEnd = `        instAnimals.instanceMatrix.needsUpdate = true;`;

let oldBlock = content.substring(content.indexOf(loopBlockStart), content.indexOf(loopBlockEnd) + loopBlockEnd.length);

let newBlock = `        // Trees
        treeMeshes.forEach((instMesh, meshIdx) => {
            const count = instMesh.count;
            let treeUpdated = false;
            for (let i = currentFrame % 10; i < count; i += 10) {
                instMesh.getMatrixAt(i, dummy.matrix);
                dummy.position.setFromMatrixPosition(dummy.matrix);
                
                if (Math.abs(dummy.position.x - playerX) > dist || Math.abs(dummy.position.z - playerZ) > dist || dummy.position.y < -500) {
                    
                    if (dummy.position.y > 0) {
                        treeGrid.delete(getTreeCell(dummy.position.x, dummy.position.z));
                    }
                    
                    let valid = false;
                    let nx, nz, h, clusterNoise, heroNoise, pathVal, cellKey;
                    let attempts = 0;

                    while(!valid && attempts < 10) {
                        nx = playerX + (Math.random() - 0.5) * dist * 2.0;
                        nz = playerZ + (Math.random() - 0.5) * dist * 2.0;
                        h = terrainHeightJS(nx, nz);
                        clusterNoise = snoise(nx * 0.008, nz * 0.008);
                        pathVal = getPathStrength(nx, nz);
                        cellKey = getTreeCell(nx, nz);

                        if (h > 3.5 && h < 45 && pathVal < 0.1 && (clusterNoise > 0.5 || Math.random() > 0.95)) { 
                            if (!treeGrid.has(cellKey)) {
                                valid = true;
                            }
                        }
                        attempts++;
                    }

                    if (valid) {
                        treeGrid.add(cellKey);
                        dummy.position.set(nx, h, nz);
                        dummy.rotation.set(0, Math.random() * Math.PI, 0);
                        
                        let scale = 0.7 + Math.random() * 1.1; // +30-40% scale
                        // Occasional hero trees (mostly on specific tree meshes)
                        if (Math.random() > 0.98 && (meshIdx === 2 || meshIdx === 5)) {
                            scale *= 1.5 + Math.random() * 1.0;
                        }
                        
                        dummy.scale.setScalar(scale);
                    } else {
                        dummy.position.set(0, -1000, 0); 
                    }
                    dummy.updateMatrix();
                    instMesh.setMatrixAt(i, dummy.matrix);
                    treeUpdated = true;
                }
            }
            if (treeUpdated) instMesh.instanceMatrix.needsUpdate = true;
        });

        // Rocks
        let rocksUpdated = false;
        for (let i = currentFrame % 5; i < ROCK_COUNT; i += 5) {
            instRocks.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            
            if (Math.abs(dummy.position.x - playerX) > dist || Math.abs(dummy.position.z - playerZ) > dist || dummy.position.y < -500) {
                const nx = playerX + (Math.random() - 0.5) * dist * 2.0;
                const nz = playerZ + (Math.random() - 0.5) * dist * 2.0;
                const h = terrainHeightJS(nx, nz);

                if (h > 0.0 && getPathStrength(nx, nz) < 0.1) { 
                    dummy.position.set(nx, h, nz);
                    dummy.rotation.set(Math.random(), Math.random(), Math.random());
                    dummy.scale.setScalar(0.7 + Math.random() * 2.0); // +30-40% scale
                } else {
                    dummy.position.set(0, -1000, 0);
                }
                dummy.updateMatrix();
                instRocks.setMatrixAt(i, dummy.matrix);
                rocksUpdated = true;
            }
        }

        // Bushes
        let bushesUpdated = false;
        for (let i = currentFrame % 10; i < BUSH_COUNT; i += 10) {
            instBushes.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            
            if (Math.abs(dummy.position.x - playerX) > dist || Math.abs(dummy.position.z - playerZ) > dist || dummy.position.y < -500) {
                const nx = playerX + (Math.random() - 0.5) * dist * 2.0;
                const nz = playerZ + (Math.random() - 0.5) * dist * 2.0;
                const h = terrainHeightJS(nx, nz);

                if (h > 3.0 && getPathStrength(nx, nz) < 0.1) {
                    dummy.position.set(nx, h, nz);
                    dummy.rotation.set(0, Math.random() * Math.PI, 0);
                    dummy.scale.setScalar(0.7 + Math.random() * 1.6); // +30-40% scale
                } else {
                    dummy.position.set(0, -1000, 0);
                }
                dummy.updateMatrix();
                instBushes.setMatrixAt(i, dummy.matrix);
                bushesUpdated = true;
            }
        }

        // Flowers
        let flowerColorsUpdated = false;
        let flowersUpdated = false;
        for (let i = currentFrame % 20; i < FLOWER_COUNT; i += 20) {
            instFlowers.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            
            if (Math.abs(dummy.position.x - playerX) > dist || Math.abs(dummy.position.z - playerZ) > dist || dummy.position.y < -500) {
                const nx = playerX + (Math.random() - 0.5) * dist * 2.0;
                const nz = playerZ + (Math.random() - 0.5) * dist * 2.0;
                const h = terrainHeightJS(nx, nz);
                
                const patchNoise = snoise(nx * 0.05, nz * 0.05); // For flower patches
                
                if (h > 3.2 && h < 35 && getPathStrength(nx, nz) < 0.2 && patchNoise > 0.3) { 
                    dummy.position.set(nx, h, nz);
                    dummy.rotation.set(0, Math.random() * Math.PI, 0);
                    dummy.scale.setScalar(0.5 + Math.random() * 0.8);
                    
                    const colorIndex = Math.floor((snoise(nx * 0.01, nz * 0.01) * 0.5 + 0.5) * flowerColors.length);
                    tempFlowerColor.setHex(flowerColors[colorIndex % flowerColors.length]);
                    instFlowers.setColorAt(i, tempFlowerColor);
                    flowerColorsUpdated = true;
                } else {
                    dummy.position.set(0, -1000, 0);
                }
                dummy.updateMatrix();
                instFlowers.setMatrixAt(i, dummy.matrix);
                flowersUpdated = true;
            }
        }

        // Grass Tufts
        const grassDist = 450;
        let grassUpdated = false;
        for (let i = currentFrame % 40; i < GRASS_COUNT; i += 40) {
            instGrass.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            
            if (Math.abs(dummy.position.x - playerX) > grassDist || Math.abs(dummy.position.z - playerZ) > grassDist || dummy.position.y < -500) {
                const nx = playerX + (Math.random() - 0.5) * grassDist * 2.0;
                const nz = playerZ + (Math.random() - 0.5) * grassDist * 2.0;
                const h = terrainHeightJS(nx, nz);

                if (h > 3.2 && h < 35 && getPathStrength(nx, nz) < 0.1) {
                    dummy.position.set(nx, h, nz);
                    dummy.rotation.set(0, Math.random() * Math.PI, 0);
                    const s = 0.4 + Math.random() * 0.4;
                    dummy.scale.set(s, s * (0.8 + Math.random() * 0.5), s);
                } else {
                    dummy.position.set(0, -1000, 0);
                }
                dummy.updateMatrix();
                instGrass.setMatrixAt(i, dummy.matrix);
                grassUpdated = true;
            }
        }

        // Animals
        for (let i = 0; i < ANIMAL_COUNT; i++) {
            let ax = animalData[i * 4 + 0];
            let az = animalData[i * 4 + 1];
            let offset = animalData[i * 4 + 2];
            let h = terrainHeightJS(ax, az);

            // Move animal slowly
            ax += Math.sin(time * 0.5 + offset) * dt * 2.0;
            az += Math.cos(time * 0.5 + offset) * dt * 2.0;

            // Keep within distance
            if (Math.abs(ax - playerX) > dist || Math.abs(az - playerZ) > dist) {
                 ax = playerX + (Math.random() - 0.5) * dist * 2.0;
                 az = playerZ + (Math.random() - 0.5) * dist * 2.0;
                 h = terrainHeightJS(ax, az);
                 if (h > 2.0 && h < 25 && getPathStrength(ax, az) < 0.2) {
                     animalData[i * 4 + 0] = ax;
                     animalData[i * 4 + 1] = az;
                 } else {
                     ax = 0; az = 0; // reset
                     animalData[i * 4 + 0] = ax;
                     animalData[i * 4 + 1] = az;
                 }
            } else {
                 animalData[i * 4 + 0] = ax;
                 animalData[i * 4 + 1] = az;
            }

            if (h > 2.0 && h < 25) {
                dummy.position.set(ax, h, az);
                dummy.rotation.set(0, time * 0.5 + offset, 0);
                dummy.scale.setScalar(0.8);
            } else {
                dummy.position.set(0, -1000, 0);
            }
            dummy.updateMatrix();
            instAnimals.setMatrixAt(i, dummy.matrix);
        }

        instClouds.instanceMatrix.needsUpdate = true;
        if (rocksUpdated) instRocks.instanceMatrix.needsUpdate = true;
        if (bushesUpdated) instBushes.instanceMatrix.needsUpdate = true;
        if (flowersUpdated) instFlowers.instanceMatrix.needsUpdate = true;
        if (flowerColorsUpdated) instFlowers.instanceColor.needsUpdate = true;
        if (grassUpdated) instGrass.instanceMatrix.needsUpdate = true;
        instAnimals.instanceMatrix.needsUpdate = true;`

content = content.replace(oldBlock, newBlock);

// also remove the old unconditional needsUpdate block that we replaced
// Note: our new block replaces up to instAnimals.instanceMatrix.needsUpdate = true;
// wait, the old block already had the needsUpdates inside it?
// yes, old block ends with instAnimals.instanceMatrix.needsUpdate = true;

fs.writeFileSync('index.html', content);
