import * as THREE from 'three';
import { setupShaders } from './ShaderSetup';
import { upscaleVertexGLSL } from './shaders/upscale/upscaleVertex';
import { upscaleFragmentGLSL } from './shaders/upscale/upscaleFragment';

export class MeshUpscaleMaterial extends THREE.RawShaderMaterial
{
    constructor(defines)
    {
        setupShaders();
        super({
            vertexShader: upscaleVertexGLSL.code,
            fragmentShader: upscaleFragmentGLSL.code,
            defines: defines,
            glslVersion: THREE.GLSL3,
            uniforms: {
                tex1: {value: null},
                tex2: {value: null},
                tex3: {value: null},
                tex4: {value: null},
                tex5: {value: null},
                tex6: {value: null},
                tex7: {value: null},
                tex8: {value: null},
                ior: {value: 1.5},
                envMap: {value: null},
                critical_cos: {value: 0.0}
            }
        });
        this.isUpscaleMaterial = true;
    }

    setupFromRefractiveMaterial(refractiveMaterial)
    {
        this.uniforms.ior.value = refractiveMaterial.uniforms.ior.value;
        this.uniforms.envMap.value = refractiveMaterial.uniforms.envMap.value;
        this.uniforms.critical_cos.value = refractiveMaterial.uniforms.critical_cos.value;
    }
}