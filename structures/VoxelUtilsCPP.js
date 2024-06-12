import voxelUtilsModule from "../wasm/voxelGrid/voxelUtils";
import { ContouringMethod } from "./VoxelSettings";
import { voxelizeMesh, voxelizeMeshSVO } from "./temp/gridVoxelization";
import * as THREE from 'three';

const intAsFloat = (num) => {
    const intView = new Int32Array(1);
    const floatView = new Float32Array(intView.buffer);
    intView[0] = num;
    return floatView[0];
}

const floatAsInt = (num) => {
    const intView = new Int32Array(1);
    const floatView = new Float32Array(intView.buffer);
    floatView[0] = num;
    return intView[0];
}

export class VoxelUtils
{
    static module;
    static createVoxelGridAvgNormalsCPP;
    static createSVOAvgNormalsCPP;

    static async loadModule()
    {
        if(VoxelUtils.module)
            return await Promise.resolve(VoxelUtils.module);
        VoxelUtils.module = await voxelUtilsModule();
        VoxelUtils.createVoxelGridAvgNormalsCPP = VoxelUtils.module.cwrap('constructVoxelGrid', 'number', ['number', 'number', 'number']);
        VoxelUtils.createSVOAvgNormalsCPP = VoxelUtils.module.cwrap('constructSVO', 'number', ['number', 'number', 'number']);
    }

    /**
     * @param {Float32Array} triarr
     * @param {number} gridSize 
     * @param {ContouringMethod} contouringMethod 
     * @returns {Promise<{minPoint: THREE.Vector3, size: [number, number, number], voxelSize: number, voxelData: Float32Array}>}
     */
    static async createVoxelGrid(triarr, gridSize, contouringMethod)
    {
        await VoxelUtils.loadModule();
        if(contouringMethod != ContouringMethod.AverageNormals)
        {
            return await Promise.resolve(voxelizeMesh(triarr, gridSize, contouringMethod));
        }
        const triLoc = VoxelUtils.module._malloc(triarr.length * 4);
        VoxelUtils.module.HEAPF32.set(triarr, triLoc >> 2);
        const dataLoc = VoxelUtils.createVoxelGridAvgNormalsCPP(triLoc, triarr.length / 9, gridSize);
        const fpointer = dataLoc >> 2;
        const dat = VoxelUtils.module.HEAPF32.subarray(fpointer, fpointer + 7);
        const minPoint = new THREE.Vector3(dat[0], dat[1], dat[2]);
        const size = [floatAsInt(dat[3]), floatAsInt(dat[4]), floatAsInt(dat[5])];
        const voxelSize = dat[6];
        const totalGridSize = size[0] * size[1] * size[2];
        const voxelDataStart = fpointer + 7;
        const voxelDataEnd = voxelDataStart + totalGridSize * 4;
        const voxelData = VoxelUtils.module.HEAPF32.slice(voxelDataStart, voxelDataEnd);
        VoxelUtils.module._free(triLoc);
        VoxelUtils.module._free(dataLoc);
        return {minPoint, size, voxelSize, voxelData};
    }

    /**
     * 
     * @param {Float32Array} triarr 
     * @param {number} depth 
     * @param {ContouringMethod} contouringMethod 
     * @returns {Promise<{min: THREE.Vector3, max: THREE.Vector3, nodeCount: number, voxelData: Float32Array}>}
     */
    static async createSVO(triarr, depth, contouringMethod)
    {
        await VoxelUtils.loadModule();
        if(contouringMethod != ContouringMethod.AverageNormals)
        {
            const res = await Promise.resolve(voxelizeMeshSVO(triarr, depth, contouringMethod));
        }
        const triLoc = VoxelUtils.module._malloc(triarr.length * 4);
        VoxelUtils.module.HEAPF32.set(triarr, triLoc >> 2);
        const dataLoc = VoxelUtils.createSVOAvgNormalsCPP(triLoc, triarr.length / 9, depth);
        const fpointer = dataLoc >> 2;
        const dat = VoxelUtils.module.HEAPF32.subarray(fpointer, fpointer + 8);
        const minPoint = new THREE.Vector3(dat[0], dat[1], dat[2]);
        const maxPoint = new THREE.Vector3(dat[3], dat[4], dat[5]);
        const size = floatAsInt(dat[6]);
        const dataSize = floatAsInt(dat[7]);
        const voxelDataStart = fpointer + 8;
        const voxelDataEnd = voxelDataStart + dataSize * 4;
        const voxelData = VoxelUtils.module.HEAPF32.slice(voxelDataStart, voxelDataEnd);
        VoxelUtils.module._free(triLoc);
        VoxelUtils.module._free(dataLoc);
        return {min: minPoint, max: maxPoint, nodeCount: dataSize, voxelData};
    }
}