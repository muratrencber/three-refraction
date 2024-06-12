import { Capabilities } from "../Capabilities";
import bvhModule from "../wasm/bvh/bvh";
import * as THREE from 'three';

let bvhWASM = null;
let constructBVH = null;

/**
 * @returns {Promise<void>}
 */
const loadBVHModule = async () => {
    if(bvhWASM)
        return await Promise.resolve();
    bvhWASM = await bvhModule();
    constructBVH = bvhWASM.cwrap('constructLinearBVH', 'number', ['number', 'number', 'number']);
}

export class BVH
{
    constructor()
    {
        /** @type {Float32Array} */
        this.linearData = null;
        /** @type {Float32Array} */
        this.boundsData = null;
        /** @type {Float32Array} */
        this.primData = null;

        /** @type {THREE.DataTexture} */
        this.linearDataTexture = null;
        /** @type {THREE.DataTexture} */
        this.boundsDataTexture = null;
        /** @type {THREE.DataTexture} */
        this.primDataTexture = null;
    }

    /**
     * 
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {string} url
     * @returns {Promise<{model: THREE.Object3D, bvh: BVH}>}
     */
    async loadWithModel(modelPromise, url)
    {
        const model = await modelPromise;
        await this.load(url);
        return {model, bvh: this};
    }

    /**
     * @param {Promise<THREE.Object3D>} modelPromise 
     * @param {number} [maxPrimsPerLeaf=2] maxPrimsPerLeaf
     * @returns {Promise<{model: THREE.Object3D, bvh: BVH}>}
     */
    async loadModelAndConstruct(modelPromise, maxPrimsPerLeaf = 2)
    {
        const model = await modelPromise;
        await this.construct(model, maxPrimsPerLeaf);
        return {model, bvh: this};
    }

    /**
     * @param {string} url 
     * @returns {Promise<BVH>} */
    async load(url)
    {
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        const headerInfo = new Int32Array(bytes, 0, 2);
        const nodeCount = headerInfo[0];
        const primCount = headerInfo[1];

        const linearNodesStart = 2;
        const linearNodesEnd = linearNodesStart + nodeCount * 2;
        const boundsDataEnd = linearNodesEnd + nodeCount * 6;
        const primDataEnd = boundsDataEnd + primCount * 9;

        this.linearData = new Float32Array(bytes.slice(linearNodesStart * 4, linearNodesEnd * 4));
        this.boundsData = new Float32Array(bytes.slice(linearNodesEnd * 4, boundsDataEnd * 4));
        this.primData = new Float32Array(bytes.slice(boundsDataEnd * 4, primDataEnd * 4));

        return this;
    }
    
    createTextureFor(data, propCount, format, internalFormat, type)
    {
        const texLen = data.length / propCount;
        const height = Capabilities.maxTextureSize ? Math.ceil(texLen / Capabilities.maxTextureSize) : 1;
        const width = Capabilities.maxTextureSize ? Math.min(texLen, Capabilities.maxTextureSize) : texLen;
        const texture = new THREE.DataTexture(data, width, height, format, type);
        texture.internalFormat = internalFormat;
        texture.needsUpdate = true;
        return texture;
    }

    /** @returns {{linearData: THREE.DataTexture, boundsData: THREE.DataTexture, primData: THREE.DataTexture}} */
    getDataTextures()
    {
        if(this.linearDataTexture) this.linearDataTexture.dispose();
        if(this.boundsDataTexture) this.boundsDataTexture.dispose();
        if(this.primDataTexture) this.primDataTexture.dispose();
        this.linearDataTexture = this.createTextureFor(this.linearData, 2, THREE.RGFormat, "RG32F", THREE.FloatType);
        this.boundsDataTexture = this.createTextureFor(this.boundsData, 3, THREE.RGBFormat, "RGB32F", THREE.FloatType);
        this.primDataTexture = this.createTextureFor(this.primData, 3, THREE.RGBFormat, "RGB32F", THREE.FloatType);
        return {
            linearData: this.linearDataTexture,
            boundsData: this.boundsDataTexture,
            primData: this.primDataTexture
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
     * @param {number} maxPrimsPerLeaf 
     */
    async construct(target, maxPrimsPerLeaf = 2)
    {
        await loadBVHModule();
        const traingles = this.getObjectTriangles(target);
        const triLoc = bvhWASM._malloc(traingles.length * 4);
        bvhWASM.HEAPF32.set(traingles, triLoc >> 2);
        const bvhLoc = constructBVH(triLoc, traingles.length / 9, maxPrimsPerLeaf);
        const fpointer = bvhLoc >> 2;
        const dat = bvhWASM.HEAP32.subarray(fpointer, fpointer + 2);
        const nodeCount = dat[0];
        const primCount = dat[1];
        
        const linearDataStart = fpointer + 2;
        const linearDataEnd = linearDataStart + nodeCount * 2;
        const boundsDataEnd = linearDataEnd + nodeCount * 6;
        const primDataEnd = boundsDataEnd + primCount * 9;

        this.linearData = bvhWASM.HEAPF32.slice(linearDataStart, linearDataEnd);
        this.boundsData = bvhWASM.HEAPF32.slice(linearDataEnd, boundsDataEnd);
        this.primData = bvhWASM.HEAPF32.slice(boundsDataEnd, primDataEnd);

        bvhWASM._free(triLoc);
        bvhWASM._free(bvhLoc);
    }

    /**
     * @returns {Blob}
     */
    getBlob()
    {
        const header = new Int32Array([this.linearData.length / 2, this.primData.length / 9]);
        const headerBytes = header.buffer;
        const linearBytes = this.linearData.buffer;
        const boundsBytes = this.boundsData.buffer;
        const primBytes = this.primData.buffer;
        return new Blob([headerBytes, linearBytes, boundsBytes, primBytes]);
    }

    dispose()
    {
        if(this.linearDataTexture) this.linearDataTexture.dispose();
        if(this.boundsDataTexture) this.boundsDataTexture.dispose();
        if(this.primDataTexture) this.primDataTexture.dispose();
        this.linearDataTexture = null;
        this.boundsDataTexture = null;
        this.primDataTexture = null;
        this.linearData = null;
        this.boundsData = null;
        this.primData = null;
    }
}