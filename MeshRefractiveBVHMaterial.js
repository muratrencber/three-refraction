import { MeshRefractiveMaterial } from "./MeshRefractiveMaterial";
import { BVH } from "./structures/BVH";

export class MeshRefractiveBVHMaterial extends MeshRefractiveMaterial
{
    /**
     * 
     * @param {BVH} bvh 
     * @param {import("./MeshRefractiveMaterial").RefractiveMaterialParameters} materialParameters 
     */
    constructor(bvh, materialParameters)
    {
        super({"ACCELERATE_BVH": 1}, materialParameters);
        this.uniforms.lbvh = {value: null};
        this.uniforms.bounds = {value: null};
        this.uniforms.primitives = {value: null};
        this.setBVH(bvh);
    }

    /**
     * @param {BVH} bvh
     * @returns {void}
     */
    setBVH(bvh)
    {
        /** @type {BVH} */
        this.bvh = bvh;
        const dataTextures = bvh.getDataTextures();
        console.log(dataTextures);
        this.uniforms.lbvh.value = dataTextures.linearData;
        this.uniforms.bounds.value = dataTextures.boundsData;
        this.uniforms.primitives.value = dataTextures.primData;
        this.uniformsNeedUpdate = true;
        console.log(this.uniforms);
    }
}