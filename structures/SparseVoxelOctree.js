import * as THREE from 'three';
import { ContouringMethod } from "./VoxelSettings";
import { Voxel, voxelizeMesh } from "./temp/gridVoxelization";
import { SVO } from "./temp/SVO";
import { voxelizeMeshSVO } from "./temp/gridVoxelization";
import { Capabilities } from '../Capabilities';

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

export class SparseVoxelOctree
{
    constructor()
    {
        /** @type {THREE.Vector3} */
        this.gridMin = new THREE.Vector3();
        /** @type {THREE.Vector3} */
        this.gridMax = new THREE.Vector3();
        /** @type {SVO} */
        this.svo = null;
        /** @type {number} */
        this.svoDepth = 0;

        /** @type {THREE.DataTexture} */
        this.svoDataTexture = null;
        /** @type {[number, number]} */
        this.svoDataTextureSize = [0,0];
    }

    /**
     * 
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {string} url
     * @returns {Promise<{model: THREE.Object3D, svo: SparseVoxelOctree}>}
     */
    async loadWithModel(modelPromise, url)
    {
        const model = await modelPromise;
        await this.load(url);
        return {model, svo: this};
    }

    /**
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {number} svoDepth
     * @param {ContouringMethod} [contouringMethod=ContouringMethod.AverageNormals] contouringMethod
     * @returns {Promise<{model: THREE.Object3D, svo: SparseVoxelOctree}>}
     */
    async loadModelAndConstruct(modelPromise, svoDepth, contouringMethod=ContouringMethod.AverageNormals)
    {
        const model = await modelPromise;
        await this.construct(model, svoDepth, contouringMethod);
        return {model, svo: this};
    }

    /**
     * @param {string} url 
     * @returns {Promise<VoxelGrid>} */
    async load(url)
    {
        return this;
    }

    /** @returns {{svoMin: THREE.Vector3, svoMax: THREE.Vector3, svoDepth: number, svoTexSize: [number, number], svoData: THREE.DataTexture}} */
    getUniforms()
    {
        return {
            svoMin: this.gridMin,
            svoMax: this.gridMax,
            svoDepth: this.svoDepth,
            svoTexSize: this.svoDataTextureSize,
            svoData: this.svoDataTexture
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
     * @param {number} svoDepth 
     * @param {ContouringMethod} [contouringMethod=ContouringMethod.AverageNormals] contouringMethod 
     */
    async construct(target, svoDepth, contouringMethod=ContouringMethod.AverageNormals)
    {
        /** @type {ContouringMethod} */
        this.method = contouringMethod;
        const triarr = this.getObjectTriangles(target);
        const svo = voxelizeMeshSVO(triarr, svoDepth, contouringMethod);
        this.gridMin = svo.min;
        this.gridMax = svo.max;
        this.svo = svo;
        this.svoDepth = svo.depth;
        this.createGridData(svo);
    }

    /** @param {SVO} svo  */
    createGridData(svo)
    {
        const linearSVOs = svo.linearize();
        const nodeCount = linearSVOs.length;
        const maxTexSize = Math.floor((Capabilities.maxTextureSize ?? 2048));
        const width = Math.min(maxTexSize, nodeCount);
        const height = Math.ceil(nodeCount / maxTexSize);
        const elemCount = width * height;
        const int32arr = new Float32Array(elemCount * 4);
        for(let i = 0; i < nodeCount; i++) {
            const node = linearSVOs[i];
            const cmBits = node.childMask & 0xFF;
            const leafBit = node.isLeaf ? 0x100 : 0;
            const offsetBits = (node.childOffset & 0x7FFFFF) << 9;
            const packedInt = cmBits | leafBit | offsetBits;
            int32arr[i * 4] = intAsFloat(packedInt);
            int32arr[i * 4 + 1] = node.avgNormal.x;
            int32arr[i * 4 + 2] = node.avgNormal.y;
            int32arr[i * 4 + 3] = node.avgNormal.z;
        }
        const tex = new THREE.DataTexture(int32arr, width, height, THREE.RGBAFormat, THREE.FloatType);
        tex.internalFormat = 'RGBA32F';
        tex.needsUpdate = true;
        this.svoDataTexture = tex;
        this.svoDataTextureSize = [width, height];
    }

    /**
     * @returns {Blob}
     */
    getBlob()
    {
    }

    dispose()
    {
    }
}