import * as THREE from 'three';
import { setupShaders } from './ShaderSetup';
import { refractionVertexGLSL } from './shaders/materials/refractionVertex';
import { refractionFragmentGLSL } from './shaders/materials/refractionFragment';

/**
 * @typedef {Object} RefractiveMaterialParameters
 * @property {number} ior
 * @property {number} critical_cos
 * @property {number} bounceCount
 * @property {THREE.Texture} map
 * @property {THREE.CubeTexture} envMap
 * @property {number} roughness
 * @property {THREE.ColorRepresentation} color
 * @property {THREE.Matrix4} invMWorldMatrix
 * @property {boolean} [isConvex=false]
 */

export class MeshRefractiveMaterial extends THREE.RawShaderMaterial
{
    /**
     * @param {Object.<string, any>} defines
     * @param {RefractiveMaterialParameters} shaderOptions 
     * @param {string} [overrideVertexShader=null] overrideVertexShader
     * @param {string} [overrideFragmentShader=null] overrideFragmentShader
     */
    constructor(defines, shaderOptions, overrideVertexShader = null, overrideFragmentShader = null)
    {

        setupShaders();
        super({
            uniforms: {
                ior: {value: shaderOptions.ior ?? 1.0},
                critical_cos: {value: shaderOptions.critical_cos ?? 0.0},
                bounceCount: {value: shaderOptions.bounceCount ?? 1},
                map: {value: shaderOptions.map ?? null},
                envMap: {value: shaderOptions.envMap ?? null},
                roughness: {value: shaderOptions.roughness ?? 0.0},
                color: {value: new THREE.Color(shaderOptions.color ?? 0xffffff)},
                invMWorldMatrix: {value: shaderOptions.invMWorldMatrix ?? new THREE.Matrix4()},
            },
            vertexShader: overrideVertexShader ?? refractionVertexGLSL.code,
            fragmentShader: overrideFragmentShader ?? refractionFragmentGLSL.code,
            glslVersion: THREE.GLSL3
        });
        const isConvex = shaderOptions.isConvex ?? false;
        let definesWithConvex = {...defines};
        if(isConvex)
            definesWithConvex["IS_CONVEX"] = 1;
        this.defines = definesWithConvex;
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

    /**
     * 
     * @param {THREE.Mesh} mesh 
     */
    setupForMesh(mesh)
    {
        const inverseMatrix = mesh.matrixWorld.clone().invert();
        this.uniforms.invMWorldMatrix.value = inverseMatrix;
        this.uniforms.needsUpdate = true;
    }
}