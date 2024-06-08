import { MeshRefractiveMaterial } from "./MeshRefractiveMaterial";
import * as THREE from 'three';
import { exampleVertexGLSL } from "./shaders/exampleLowRes/exampleVertex";
import { exampleFragmentGLSL } from "./shaders/exampleLowRes/exampleFragment";

export class MeshRefractiveTestMaterial extends MeshRefractiveMaterial
{
    /**
     * @param {import("./MeshRefractiveMaterial").RefractiveMaterialParameters} params 
     */
    constructor(params)
    {
        super(
            {},
            params,
            exampleVertexGLSL.code,
            exampleFragmentGLSL.code,
        );
    }
}