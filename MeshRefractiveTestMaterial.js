import { MeshRefractiveMaterial } from "./MeshRefractiveMaterial";
import * as THREE from 'three';
import { exampleVertexGLSL } from "./shaders/exampleLowRes/exampleVertex";
import { exampleFragmentGLSL } from "./shaders/exampleLowRes/exampleFragment";

export class MeshRefractiveTestMaterial extends MeshRefractiveMaterial
{
    /**
     * @param {THREE.ShaderMaterialParameters} params 
     */
    constructor(params)
    {
        super(
            exampleVertexGLSL.code,
            exampleFragmentGLSL.code,
            {},
            params
        );
    }
}