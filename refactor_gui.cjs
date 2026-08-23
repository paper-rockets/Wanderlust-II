const fs = require('fs');
let code = fs.readFileSync('c:/Users/macie/OneDrive/Desktop/WANDERLUST FINAL/src/main.js', 'utf8');

// 1. Insert Master Folders right after gui is created or at line 521
// Find `const perfFolder = gui.addFolder('Performance');`
code = code.replace("const perfFolder = gui.addFolder('Performance');", `
    // === 8 MASTER DOMAIN FOLDERS ===
    const gui_weather = gui.addFolder('🌍 Weather, Atmosphere & Lighting');
    const gui_clouds = gui.addFolder('☁️ Clouds & Sky Dome');
    const gui_water = gui.addFolder('🌊 Ocean & Water');
    const gui_nature = gui.addFolder('🌿 Nature & Vegetation');
    const gui_terrain = gui.addFolder('🏔️ Terrain & Biomes');
    const gui_models = gui.addFolder('🧙‍♂️ Player, Models & Crystals');
    const gui_perf = gui.addFolder('⚡ Performance & Graphics');
    const gui_sys = gui.addFolder('🎵 Audio & System');

    const perfFolder = gui_perf;
`);

// Mappings for simple renames:
code = code.replace("const navFolder = gui.addFolder('Navigation');", "const navFolder = gui_terrain.addFolder('Navigation (Go to Biome)');");
code = code.replace("const editorFolder = gui.addFolder('Editor');", "const editorFolder = gui_terrain;"); 
// we will replace specific editorFolder.add below

code = code.replace("customModelFolder = editorFolder.addFolder('📦 Custom Model');", "customModelFolder = gui_models.addFolder('📦 Custom Model');");
code = code.replace("waterEditorFolder = editorFolder.addFolder('🌊 Water Editor');", "waterEditorFolder = gui_water;");

code = code.replace("const colorEditorFolder = editorFolder.addFolder('🎨 Terrain Color & Shimmer');", "const colorEditorFolder = gui_terrain.addFolder('🎨 Terrain Color & Shimmer');");

code = code.replace("const gameFolder = gui.addFolder('Game');", "const gameFolder = gui_models;");
code = code.replace("const envFolder = gui.addFolder('Environment');", "const envFolder = gui_weather;");

code = code.replace("skydomeFolder = gui.addFolder('🌌 Skydome & God Rays');", "skydomeFolder = gui_weather.addFolder('🌌 Skydome & God Rays');");

code = code.replace("const debugFolder = gui.addFolder('🔧 Debug Render');", "const debugFolder = gui_perf.addFolder('🔧 Debug Render');");
code = code.replace("const waterShaderFolder = debugFolder.addFolder('🌊 Water Shaders');", "const waterShaderFolder = gui_water.addFolder('🌊 Water Shaders');");

code = code.replace("const gfxFolder = gui.addFolder('Graphics (VFX)');", "const gfxFolder = gui_perf;");

code = code.replace("const atmoFolder = gui.addFolder('Atmosphere');", "const atmoFolder = gui_weather;");
code = code.replace("const moonFolder = atmoFolder.addFolder('🌙 Moonlight & Night');", "const moonFolder = gui_weather.addFolder('🌙 Moonlight & Night');");

code = code.replace("const glowFolder = envFolder.addFolder('💡 Kiki Warm Side Glow');", "const glowFolder = gui_weather.addFolder('💡 Kiki Warm Side Glow');");

code = code.replace("const cloudFolder = gui.addFolder('☁️ Cloud Editor');", "const cloudFolder = gui_clouds;");
code = code.replace("const paletteFolder = cloudFolder.addFolder('🎨 Pastel Colors');", "const paletteFolder = gui_clouds.addFolder('🎨 Pastel Colors');");
code = code.replace("const regFolder = cloudFolder.addFolder('🌥️ Regular (Cumulus)');", "const regFolder = gui_clouds.addFolder('🌥️ Regular (Cumulus)');");
code = code.replace("const highFolder = cloudFolder.addFolder('🌩️ Cumulonimbus');", "const highFolder = gui_clouds.addFolder('🌩️ Cumulonimbus');");
code = code.replace("const wispyFolder = cloudFolder.addFolder('🌫️ Wispy Clouds');", "const wispyFolder = gui_clouds.addFolder('🌫️ Wispy Clouds');");
code = code.replace("const megaFolder = cloudFolder.addFolder('🌌 Mega Clouds');", "const megaFolder = gui_clouds.addFolder('🌌 Mega Clouds');");

code = code.replace("const treeFolder = envFolder.addFolder('Tree Editor');", "const treeFolder = gui_nature;");
code = code.replace("const sfFolder = envFolder.addFolder('🌻 Sunflower Editor');", "const sfFolder = gui_nature.addFolder('🌻 Sunflower Editor');");

code = code.replace("const sysFolder = gui.addFolder('System Settings');", "const sysFolder = gui_sys;");

// Now fix the mixed items:
// 1. Crystal Editor button from editorFolder -> gui_models
code = code.replace(
    "editorFolder.add({ openCrystalEditor: () => {",
    "gui_models.add({ openCrystalEditor: () => {"
);
// 2. Tree Billboard Editor button from editorFolder -> gui_nature
code = code.replace(
    "editorFolder.add({ openTreeBillboardEditor: () => {",
    "gui_nature.add({ openTreeBillboardEditor: () => {"
);
// 3. lockSunToPlayer from editorFolder -> gui_models
code = code.replace(
    "editorFolder.add(params, 'lockSunToPlayer').name('Lock Sun To Player');",
    "gui_models.add(params, 'lockSunToPlayer').name('Lock Sun To Player');"
);
// 4. loadCustomModel from editorFolder -> gui_models
code = code.replace(
    "editorFolder.add({ loadCustomModel: () => {",
    "gui_models.add({ loadCustomModel: () => {"
);

// 5. Game folder mixing: Switch Character (models), Toggle Music (sys), Next Track (sys), Summer Filter (models), Model Visible (models)
code = code.replace(
    "gameFolder.add(guiActions, 'switchModel').name('Switch Character');",
    "gui_models.add(guiActions, 'switchModel').name('Switch Character');"
);
code = code.replace(
    "gameFolder.add(guiActions, 'toggleMusic').name('Toggle Music');",
    "gui_sys.add(guiActions, 'toggleMusic').name('Toggle Music');"
);
code = code.replace(
    "gameFolder.add(guiActions, 'nextTrack').name('Next Track');",
    "gui_sys.add(guiActions, 'nextTrack').name('Next Track');"
);
code = code.replace(
    "gameFolder.add(params, 'summerFilter').name('Summer Filter').onChange(",
    "gui_models.add(params, 'summerFilter').name('Summer Filter').onChange("
);
code = code.replace(
    "gameFolder.add(params, 'modelVisible').name('Model Visible').onChange(",
    "gui_models.add(params, 'modelVisible').name('Model Visible').onChange("
);

// 6. Tree shadows from perfFolder -> nature? 
code = code.replace(
    "perfFolder.add(params, 'treeShadows').name('Tree Shadows').onChange(",
    "gui_nature.add(params, 'treeShadows').name('Tree Shadows').onChange("
);

fs.writeFileSync('c:/Users/macie/OneDrive/Desktop/WANDERLUST FINAL/src/main.js', code, 'utf8');
console.log('Refactoring complete!');
