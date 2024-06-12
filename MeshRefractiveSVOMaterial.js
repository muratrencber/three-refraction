import { ContouringMethod } from "./structures/VoxelSettings";
import { MeshRefractiveMaterial } from "./MeshRefractiveMaterial";
import { SparseVoxelOctree } from "./structures/SparseVoxelOctree";

export class MeshRefractiveSVOMaterial extends MeshRefractiveMaterial
{
    /**
     * 
     * @param {SparseVoxelOctree} grid 
     * @param {import("three-refraction/MeshRefractiveMaterial").RefractiveMaterialParameters} materialParameters 
     */
    constructor(svo, materialParameters)
    {
        const defs = {"ACCELERATE_SVO": 1};
        if(svo.method === ContouringMethod.AverageNormals)
            defs["CONTOURING_AVERAGE_NORMALS"] = 1;
        else if(svo.method === ContouringMethod.DualContouring)
            defs["CONTOURING_DUAL_CONTOURING"] = 1;
        super(defs, materialParameters);
        this.uniforms.svoMin = {value: null};
        this.uniforms.svoMax = {value: null};
        this.uniforms.svoDepth = {value: null};
        this.uniforms.svoData = {value: null};
        this.uniforms.svoTexSize = {value: null};
        this.setSVO(svo);
    }

    /**
     * @param {SparseVoxelOctree} svo
     * @returns {void}
     */
    setSVO(svo)
    {
        /** @type {SparseVoxelOctree} */
        this.svo = svo;
        const dataTextures = svo.getUniforms();
        for(const key in dataTextures)
            this.uniforms[key].value = dataTextures[key];
        this.uniformsNeedUpdate = true;
    }
}