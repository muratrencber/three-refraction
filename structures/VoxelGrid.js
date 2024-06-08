import * as THREE from 'three';
import { ContouringMethod } from "./VoxelSettings";
import { Voxel, voxelizeMesh } from "./temp/gridVoxelization";

let voxelGridWASM = null;
let constructVoxelGrid = null;

/**
 * @returns {Promise<void>}
 */
const loadVoxelGridModule = async () => {
    //if(voxelGridWASM)
    //    return await Promise.resolve();
    //voxelGridWASM = await voxelGridModule();
    //constructVoxelGrid = voxelGridWASM.cwrap('constructVoxelGrid', 'number', ['number', 'number', 'number']);
}

const intAsFloat = (num) => {
    const intView = new Int32Array(1);
    const floatView = new Float32Array(intView.buffer);
    intView[0] = num;
    return floatView[0];
}

const getBitsStr = (num, bitlen) => {
    let str = "";
    for(let i = 0; i < bitlen; i++)
    {
        str = (num & 1) + str;
        num >>= 1;
    }
    return str;
}

const floatAsInt = (num) => {
    const intView = new Int32Array(1);
    const floatView = new Float32Array(intView.buffer);
    floatView[0] = num;
    return intView[0];
}

export class VoxelGrid
{
    constructor()
    {
        /** @type {THREE.Data3DTexture} */
        this.gridData = null;
        /** @type {[number, number, number]} */
        this.gridSize = [0,0,0];
        /** @type {THREE.Vector3} */
        this.gridMin = new THREE.Vector3();
        /** @type {number} */
        this.voxelSize = 0;

        /** @type {THREE.Data3DTexture} */
        this.gridDataTexture = null;
    }

    /**
     * 
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {string} url
     * @returns {Promise<{model: THREE.Object3D, voxelGrid: VoxelGrid}>}
     */
    async loadWithModel(modelPromise, url)
    {
        const model = await modelPromise;
        await this.load(url);
        return {model, voxelGrid: this};
    }

    /**
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {number} gridSize
     * @param {ContouringMethod} [contouringMethod=ContouringMethod.AverageNormals] contouringMethod
     * @returns {Promise<{model: THREE.Object3D, voxelGrid: VoxelGrid}>}
     */
    async loadModelAndConstruct(modelPromise, gridSize, contouringMethod=ContouringMethod.AverageNormals)
    {
        const model = await modelPromise;
        await this.construct(model, gridSize, contouringMethod);
        return {model, voxelGrid: this};
    }

    /**
     * @param {string} url 
     * @returns {Promise<VoxelGrid>} */
    async load(url)
    {
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        const headerInfo = new Float32Array(bytes, 0, 8);
        this.method = floatAsInt(headerInfo[0]);
        this.gridMin = new THREE.Vector3(headerInfo[1], headerInfo[2], headerInfo[3]);
        this.gridSize = [floatAsInt(headerInfo[4]), floatAsInt(headerInfo[5]), floatAsInt(headerInfo[6])];
        const voxelInfo = new Float32Array(bytes, 32, this.gridSize[0] * this.gridSize[1] * this.gridSize[2] * 5);
        this.voxelSize = headerInfo[7];
        this.voxels = [];
        for(let x = 0; x < this.gridSize[0]; x++)
        {
            this.voxels.push([]);
            for(let y = 0; y < this.gridSize[1]; y++)
            {
                this.voxels[x].push([]);
                for(let z = 0; z < this.gridSize[2]; z++)
                {
                    const idx = (x * this.gridSize[1] * this.gridSize[2] + y * this.gridSize[2] + z) * 5;
                    const normal = new THREE.Vector3(voxelInfo[idx], voxelInfo[idx + 1], voxelInfo[idx + 2]);
                    const childCount = floatAsInt(voxelInfo[idx + 3]);
                    const edgeMask = floatAsInt(voxelInfo[idx + 4]);
                    const vx = new Voxel();
                    vx.normal = normal;
                    vx.childCount = childCount;
                    vx.edgeMask = edgeMask;
                    this.voxels[x][y].push(vx);
                }
            }
        }
        this.createGridData(this.voxels);
    }

    /** @returns {{gridData: THREE.Data3DTexture, gridMin: THREE.Vector3, gridSize: THREE.Vector3, voxelSize: number}} */
    getUniforms()
    {
        return {
            gridData: this.gridData,
            gridMin: this.gridMin,
            gridSize: this.gridSize,
            voxelSize: this.voxelSize
        };
    }

    /**
     * 
     * @param {THREE.Object3D} obj
     * @returns {Float32Array} 
     */
    getObjectTriangles(obj) {
        const resultingPoints = [];
        /**
         * 
         * @param {THREE.Mesh | THREE.Object3D} child 
         */
        const onTraverse = (child) => {
            if(!child.isMesh) return;
            /** @type {THREE.BufferGeometry} */
            let geo = child.geometry;
            if(geo.index)
                geo = geo.toNonIndexed();
            const pos = geo.attributes.position.array;
            for(const p of pos)
                resultingPoints.push(p);
        }
        obj.traverse(onTraverse);
        return new Float32Array(resultingPoints);
    }

    /**
     * 
     * @param {THREE.Object3D} target
     * @param {number} gridSize 
     * @param {ContouringMethod} [contouringMethod=ContouringMethod.AverageNormals] contouringMethod 
     */
    async construct(target, gridSize, contouringMethod=ContouringMethod.AverageNormals)
    {
        /** @type {ContouringMethod} */
        this.method = contouringMethod;
        const triarr = this.getObjectTriangles(target);
        const vxres = voxelizeMesh(triarr, gridSize, contouringMethod);
        this.gridMin = vxres.minPoint;
        this.gridSize = [...vxres.size];
        this.voxelSize = vxres.voxelSize;
        /** @type {Voxel[][][]} */
        this.voxels = vxres.voxels;
        this.createGridData(vxres.voxels);
    }

    /** @param {Voxel[][][]} voxelArr  */
    createGridData(voxelArr)
    {
        let filledCount = 0;
        let edgedCount = 0;
        const pointsData = [];
        const debugPointsData = [];
        
        for(let x = 0; x < this.gridSize[0]; x++)
        {
            debugPointsData.push([]);
            for(let y = 0; y < this.gridSize[1]; y++)
            {
                debugPointsData[x].push([]);
                for(let z = 0; z < this.gridSize[2]; z++)
                {
                    debugPointsData[x][y].push([0,0,0,0]);
                }
            }
        }
        for(let z = 0; z < this.gridSize[2]; z++)
        {
            for(let y = 0; y < this.gridSize[1]; y++)
            {
                for(let x = 0; x < this.gridSize[0]; x++)
                {
                    const vx = voxelArr[x][y][z];
                    const isEmptyFlag = vx.childCount > 0 ? 1 : 0;
                    if(vx.childCount > 0) filledCount++;
                    if(vx.edgeMask != 0) edgedCount++;
                    const edgeMask = vx.edgeMask << 1;
                    const wValue = isEmptyFlag | edgeMask;
                    const wValueFloat = intAsFloat(wValue);
                    pointsData.push(vx.normal.x, vx.normal.y, vx.normal.z, wValueFloat);
                    debugPointsData[x][y][z] = [vx.normal.x, vx.normal.y, vx.normal.z, wValueFloat];
                }
            }
        }
        this.debugPointsData = debugPointsData;
        const gridArr = new Float32Array(pointsData);
        if(this.gridData) this.gridData.dispose();
        this.gridData = new THREE.Data3DTexture(gridArr, this.gridSize[0], this.gridSize[1], this.gridSize[2]);
        this.gridData.internalFormat = 'RGBA32F';
        this.gridData.type = THREE.FloatType;
        this.gridData.format = THREE.RGBAFormat;
        this.gridData.needsUpdate = true;
    }

    /**
     * @returns {Blob}
     */
    getBlob()
    {
        const headerData = new Float32Array(8);
        headerData[0] = intAsFloat(this.method);
        headerData[1] = this.gridMin.x;
        headerData[2] = this.gridMin.y;
        headerData[3] = this.gridMin.z;
        headerData[4] = intAsFloat(this.gridSize[0]);
        headerData[5] = intAsFloat(this.gridSize[1]);
        headerData[6] = intAsFloat(this.gridSize[2]);
        headerData[7] = this.voxelSize;
        const voxelData = new Float32Array(this.gridSize[0] * this.gridSize[1] * this.gridSize[2] * 5);
        for(let x = 0; x < this.gridSize[0]; x++)
        {
            for(let y = 0; y < this.gridSize[1]; y++)
            {
                for(let z = 0; z < this.gridSize[2]; z++)
                {
                    const vx = this.voxels[x][y][z];
                    const idx = (x * this.gridSize[1] * this.gridSize[2] + y * this.gridSize[2] + z) * 5;
                    voxelData[idx] = vx.normal.x;
                    voxelData[idx + 1] = vx.normal.y;
                    voxelData[idx + 2] = vx.normal.z;
                    voxelData[idx + 3] = intAsFloat(vx.childCount);
                    voxelData[idx + 4] = intAsFloat(vx.edgeMask);
                }
            }
        }
        const fullBlob = new Blob([headerData, voxelData]);
        return fullBlob;
    }

    dispose()
    {
    }
}