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
            glslVersion: THREE.GLSL3
        });
    }
}