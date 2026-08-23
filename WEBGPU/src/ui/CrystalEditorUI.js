// Crystal Editor Panel Control Handlers

export class CrystalEditorUI {
    constructor(matCrystal) {
        this.matCrystal = matCrystal;
        this.init();
    }

    init() {
        const getElem = (id) => document.getElementById(id);
        if (!getElem('c-roughness') || !this.matCrystal) return;

        getElem('c-roughness').addEventListener('input', (e) => this.matCrystal.roughness = parseFloat(e.target.value));
        getElem('c-metalness').addEventListener('input', (e) => this.matCrystal.metalness = parseFloat(e.target.value));
        getElem('c-transmission').addEventListener('input', (e) => this.matCrystal.transmission = parseFloat(e.target.value));
        getElem('c-thickness').addEventListener('input', (e) => this.matCrystal.thickness = parseFloat(e.target.value));
        getElem('c-fly-opacity').addEventListener('input', (e) => this.matCrystal.opacity = parseFloat(e.target.value));

        getElem('c-fly-hue').addEventListener('input', (e) => {
            if (this.matCrystal.userData.shader) {
                this.matCrystal.userData.shader.uniforms.flyHue.value = parseFloat(e.target.value);
            }
        });
        getElem('c-fly-contrast').addEventListener('input', (e) => {
            if (this.matCrystal.userData.shader) {
                this.matCrystal.userData.shader.uniforms.flyContrast.value = parseFloat(e.target.value);
            }
        });
        getElem('c-baseGlow').addEventListener('input', (e) => {
            if (this.matCrystal.userData.shader) {
                this.matCrystal.userData.shader.uniforms.baseGlow.value = parseFloat(e.target.value);
            }
        });
        getElem('c-nightGlow').addEventListener('input', (e) => {
            if (this.matCrystal.userData.shader) {
                this.matCrystal.userData.shader.uniforms.nightGlowMult.value = parseFloat(e.target.value);
            }
        });

        const closeBtn = getElem('c-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const editor = getElem('crystal-editor');
                if (editor) editor.style.display = 'none';
            });
        }
    }
}
