import { ContouringMethod } from "./structures/VoxelSettings";
import { MeshRefractiveMaterial } from "./MeshRefractiveMaterial";
import { VoxelGrid } from "./structures/VoxelGrid";

export class MeshRefractiveVoxelGridMaterial extends MeshRefractiveMaterial
{
    /**
     * 
     * @param {VoxelGrid} grid 
     * @param {import("three-refraction/MeshRefractiveMaterial").RefractiveMaterialParameters} materialParameters 
     */
    constructor(grid, materialParameters)
    {
        const defs = {"ACCELERATE_VOXEL_GRID": 1};
        if(grid.method === ContouringMethod.AverageNormals)
            defs["CONTOURING_AVERAGE_NORMALS"] = 1;
        else if(grid.method === ContouringMethod.DualContouring)
            defs["CONTOURING_DUAL_CONTOURING"] = 1;
        super(defs, materialParameters);
        this.uniforms.grid = {value: null};
        this.uniforms.gridMin = {value: null};
        this.uniforms.gridDimensions = {value: null};
        this.uniforms.voxelSize = {value: null};
        this.setGrid(grid);
    }

    /**
     * @param {VoxelGrid} grid
     * @returns {void}
     */
    setGrid(grid)
    {
        /** @type {VoxelGrid} */
        this.grid = grid;
        const dataTextures = grid.getUniforms();
        this.uniforms.grid.value = dataTextures.gridData;
        this.uniforms.gridMin.value = dataTextures.gridMin;
        this.uniforms.gridDimensions.value = dataTextures.gridSize;
        this.uniforms.voxelSize.value = dataTextures.voxelSize;
        this.uniformsNeedUpdate = true;
    }
}