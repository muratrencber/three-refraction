import * as THREE from 'three';
import { setupShaders } from './ShaderSetup';

export class MeshRefractiveMaterial extends THREE.RawShaderMaterial
{
    /**
     * 
     * @param {string} vertexShader 
     * @param {string} fragmentShader 
     * @param {Object.<string, any>} defines
     * @param {THREE.ShaderMaterialParameters} rawShaderOptions 
     */
    constructor(vertexShader, fragmentShader, defines, rawShaderOptions)
    {
        setupShaders();
        super({
            ...rawShaderOptions,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            glslVersion: THREE.GLSL3
        });
        this.defines = defines;
        this.isRefractiveMaterial = true;
    }

    saveDefines()
    {
        this.savedDefines = {...this.defines};
    }

    addToDefines(defines)
    {
        this.defines = {...this.defines, ...defines};
        this.needsUpdate = true;
    }

    resetDefines()
    {
        this.defines = {...this.savedDefines};
        this.needsUpdate = true;
    }
}