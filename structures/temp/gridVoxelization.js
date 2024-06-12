import * as THREE from 'three';
import { ContouringMethod } from '../VoxelSettings';
import Matrix, { EigenvalueDecomposition } from 'ml-matrix';
import { QEF, solveQEF } from './QEF';
import {SVO} from './SVO';
import { Capabilities } from '../../Capabilities';

export const edgeOffsets = [
    [[0,0,0],[0,0,1]], //0
    [[0,1,0],[0,1,1]], //1
    [[1,0,0],[1,0,1]], //2
    [[1,1,0],[1,1,1]], //3
    [[0,0,0],[1,0,0]], //4
    [[0,1,0],[1,1,0]],  //5
    [[0,0,1],[1,0,1]], //6
    [[0,1,1],[1,1,1]], //7
    [[0,0,0],[0,1,0]], //8
    [[1,0,0],[1,1,0]], //9
    [[0,0,1],[0,1,1]], //10
    [[1,0,1],[1,1,1]]]; //11
    
export const edgeNeighbours = [
[[-1,0,0], [0,0,0] ,  [-1,-1,0], [0,-1,0] ,[0,0,0] ,  [-1,-1,0]],
[[0,1,0] , [-1,1,0], [-1,0,0] , [0,1,0] , [0,0,0]  , [-1,0,0]],
[[1,0,0] , [0,0,0] , [0,-1,0] , [1,-1,0] ,[1,0,0] ,  [0,-1,0]],
[[0,1,0] ,[1,1,0] ,  [0,0,0]  , [1,1,0] , [1,0,0]  , [0,0,0]],
[[0,0,0] , [0,0,-1], [0,-1,-1], [0,-1,0] , [0,0,0] ,  [0,-1,-1]],
[[0,1,0] , [0,1,-1], [0,0,-1] , [0,0,0]  ,[0,1,0] ,  [0,0,-1]],
[[0,0,1] , [0,0,0] , [0,-1,0] , [0,-1,1] ,[0,0,1] ,  [0,-1,0]],
[[0,1,1] , [0,1,0] , [0,0,0]  , [0,0,1]  ,[0,1,1] ,  [0,0,0]],
[[0,0,0] ,[0,0,-1],  [-1,0,0] , [0,0,-1],[-1,0,-1],  [-1,0,0]],
[[1,0,0] ,[1,0,-1],  [0,0,0]  , [0,0,-1] ,[1,0,-1],  [0,0,0]],
[[0,0,1] ,[0,0,0] ,  [-1,0,1] , [-1,0,0] ,[0,0,0] ,  [-1,0,1]],
[[1,0,0] , [1,0,1] , [0,0,1]  , [0,0,0]  ,[1,0,0] ,  [0,0,1]]];

/**
 * @param {Float32Array} arr
 * @returns {THREE.Triangle[]}
 */
const f32arrtotriangles = (arr) => {
    const tris = [];
    for(let i = 0; i < arr.length; i += 9)
    {
        const p1nums = arr.slice(i, i + 3);
        const p2nums = arr.slice(i + 3, i + 6);
        const p3nums = arr.slice(i + 6, i + 9);

        const p1 = new THREE.Vector3(p1nums[0], p1nums[1], p1nums[2]);
        const p2 = new THREE.Vector3(p2nums[0], p2nums[1], p2nums[2]);
        const p3 = new THREE.Vector3(p3nums[0], p3nums[1], p3nums[2]);

        const tri = new THREE.Triangle(p1, p2, p3);
        tris.push(tri);
    }
    return tris;
}

export class Voxel
{
    constructor()
    {
        this.normal = new THREE.Vector3(0,0,0);
        this.childCount = 0;
        this.edgeMask = 0;
        this.qef = new QEF();
    }
}

/**
 * @param {THREE.Triangle[]}
 * @param {number[]} size 
 * @param {THREE.Vector3} minPoint 
 * @param {number} voxelSize 
 * @param {ContouringMethod} contouringMethod 
 * @param {(voxel: Voxel, vCenter: THREE.Vector3) => void} onVoxelFullyConstructed
 * @returns {Voxel[][][]}
 */
const initVoxelArr = (tris, size, minPoint, voxelSize, contouringMethod, onVoxelFullyConstructed) => {
    const getIndexOf = (point) => {
        const x = Math.floor((point.x - minPoint.x) / voxelSize);
        const y = Math.floor((point.y - minPoint.y) / voxelSize);
        const z = Math.floor((point.z - minPoint.z) / voxelSize);
        return [x, y, z];
    }

    const [xsize, ysize, zsize] = size;

    /**
     * @type {Voxel[][][]}
     */
    const voxels = [];
    for(let x = 0; x < xsize; x++)
    {
        voxels.push([]);
        for(let y = 0; y < ysize; y++)
        {
            voxels[x].push([]);
            for(let z = 0; z < zsize; z++)
            {
                const voxel = new Voxel();
                voxels[x][y].push(voxel);
            }
        }
    }
    let vPos = new THREE.Vector3();
    let vMax = new THREE.Vector3();
    let vCenter = new THREE.Vector3();
    let box = new THREE.Box3();
    for(const tri of tris)
    {
        const [p1x, p1y, p1z] = getIndexOf(tri.a);
        const [p2x, p2y, p2z] = getIndexOf(tri.b);
        const [p3x, p3y, p3z] = getIndexOf(tri.c);
        const pminx = Math.min(p1x, p2x, p3x);
        const pminy = Math.min(p1y, p2y, p3y);
        const pminz = Math.min(p1z, p2z, p3z);
        const pmaxx = Math.max(p1x, p2x, p3x);
        const pmaxy = Math.max(p1y, p2y, p3y);
        const pmaxz = Math.max(p1z, p2z, p3z);
        for(let ix = pminx; ix <= pmaxx; ix++)
        {
            for(let iy = pminy; iy <= pmaxy; iy++)
            {
                for(let iz = pminz; iz <= pmaxz; iz++)
                {
                    vPos.set(minPoint.x + ix * voxelSize, minPoint.y + iy * voxelSize, minPoint.z + iz * voxelSize);
                    vMax.set(vPos.x + voxelSize, vPos.y + voxelSize, vPos.z + voxelSize);
                    vCenter.set(vPos.x + voxelSize / 2, vPos.y + voxelSize / 2, vPos.z + voxelSize / 2);
                    box.set(vPos, vMax);
                    if(box.intersectsTriangle(tri))
                    {
                        const voxel = voxels[ix][iy][iz];
                        const oldChildCount = voxel.childCount;
                        voxel.childCount++;
                        if(contouringMethod === ContouringMethod.AverageNormals)
                        {
                            const newNormal = voxel.normal.clone().multiplyScalar(oldChildCount);
                            newNormal.add(tri.getNormal(new THREE.Vector3()).multiplyScalar(-1));
                            newNormal.divideScalar(voxel.childCount);
                            voxel.normal.set(newNormal.x, newNormal.y, newNormal.z);
                        }
                        else if(contouringMethod == ContouringMethod.DualContouring)
                        {
                            for(let edgeidx = 0; edgeidx < 12; edgeidx++)
                            {
                                const [ep1arr, ep2arr] = edgeOffsets[edgeidx];
                                const ep1 = new THREE.Vector3().fromArray(ep1arr).multiplyScalar(voxelSize).add(vPos);
                                const ep2 = new THREE.Vector3().fromArray(ep2arr).multiplyScalar(voxelSize).add(vPos);
                                const ep1to2 = ep2.clone().sub(ep1).normalize();
                                let eRay = new THREE.Ray(ep1, ep1to2);
                                let intersection = eRay.intersectTriangle(tri.a, tri.b, tri.c, true, new THREE.Vector3());
                                let flip = false;
                                if(!intersection || intersection.distanceTo(ep1) > voxelSize) {
                                    eRay = new THREE.Ray(ep2, ep1to2.clone().negate());
                                    intersection = eRay.intersectTriangle(tri.a, tri.b, tri.c, true, new THREE.Vector3());
                                    flip = true;
                                    if(!intersection || intersection.distanceTo(ep2) > voxelSize) continue;
                                };
                                const ep1toTri = intersection.clone().sub(eRay.origin);
                                if(ep1toTri.length() > voxelSize) continue;
                                const normal = tri.getNormal(new THREE.Vector3()).multiplyScalar(-1);
                                const edgeMask = 1 << edgeidx;
                                const flipMask = flip ? (edgeMask << 12) : 0;
                                voxel.edgeMask |= edgeMask | flipMask;
                                const translatedIntersection = intersection.clone().sub(vCenter);
                                voxel.qef.addIntersection(translatedIntersection, normal, edgeidx);
                            }
                        }
                    }
                }
            }
        }
    }
        
    for(let x = 0; x < xsize; x++)
    {
        for(let y = 0; y < ysize; y++)
        {
            for(let z = 0; z < zsize; z++)
            {
                const cell = voxels[x][y][z];
                const cellCenter = new THREE.Vector3(minPoint.x + x * voxelSize + voxelSize / 2, minPoint.y + y * voxelSize + voxelSize / 2, minPoint.z + z * voxelSize + voxelSize / 2);
                if(contouringMethod === ContouringMethod.DualContouring)
                {
                    const solveResult = solveQEF(cell.qef, {addBias: true, clipToBounds: true, constrainBoundaries: true, biasStrength: 1, boundarySize: voxelSize});
                    cell.normal = solveResult.clone().add(cellCenter);
                }
                if(onVoxelFullyConstructed) onVoxelFullyConstructed(cell, cellCenter);
            }
        }
    }

    return voxels;
}
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
/**
 * 
 * @param {Float32Array} triarr 
 * @param {number} gridSize
 * @param {ContouringMethod} contouringMethod
 * @returns {{minPoint: THREE.Vector3, size: [number, number, number], voxelSize: number, voxelData: Float32Array}}
 */
export const voxelizeMesh = (triarr, gridSize, contouringMethod) => {
    const tris = f32arrtotriangles(triarr);
    let minPoint = tris[0].a.clone();
    let maxPoint = tris[0].a.clone();
    for(const t of tris)
    {
        minPoint.min(t.a);
        minPoint.min(t.b);
        minPoint.min(t.c);

        maxPoint.max(t.a);
        maxPoint.max(t.b);
        maxPoint.max(t.c);
    }
    let [xExtent, yExtent, zExtent] = [maxPoint.x - minPoint.x, maxPoint.y - minPoint.y, maxPoint.z - minPoint.z];
    let maxExtent = Math.max(xExtent, yExtent, zExtent);
    let voxelSize = maxExtent / (gridSize - 1);
    minPoint.sub(new THREE.Vector3(1,1,1).multiplyScalar(voxelSize / 2));
    maxPoint.add(new THREE.Vector3(1,1,1).multiplyScalar(voxelSize / 2));
    [xExtent, yExtent, zExtent] = [maxPoint.x - minPoint.x, maxPoint.y - minPoint.y, maxPoint.z - minPoint.z];
    maxExtent = Math.max(xExtent, yExtent, zExtent);
    voxelSize = maxExtent / gridSize;
    let [xsize, ysize, zsize] = [Math.ceil(xExtent / voxelSize), Math.ceil(yExtent / voxelSize), Math.ceil(zExtent / voxelSize)];
    maxPoint = minPoint.clone().add(new THREE.Vector3(xsize, ysize, zsize).multiplyScalar(voxelSize));

    const voxels = initVoxelArr(tris, [xsize, ysize, zsize], minPoint, voxelSize, contouringMethod, null);
    const voxelData = new Float32Array(xsize * ysize * zsize * 4);
    for(let z = 0; z < zsize; z++)
    {
        for(let y = 0; y < ysize; y++)
        {
            for(let x = 0; x < xsize; x++)
            {
                const voxel = voxels[x][y][z];
                const idx = (z * ysize * xsize + y * xsize + x) * 4;
                voxelData[idx] = voxel.normal.x;
                voxelData[idx + 1] = voxel.normal.y;
                voxelData[idx + 2] = voxel.normal.z;
                const isFilled = voxel.childCount > 0 ? 1 : 0;
                const edgeMask = voxel.edgeMask << 1;
                voxelData[idx + 3] = intAsFloat(isFilled | edgeMask);
            }
        }
    }
    return {minPoint, size: [xsize, ysize, zsize], voxelSize, voxelData};
}

/**
 * 
 * @param {Float32Array} triarr 
 * @param {number} svoDepth
 * @param {ContouringMethod} contouringMethod
 * @returns {{min: THREE.Vector3, max: THREE.Vector3, nodeCount: number, voxelData: Float32Array}}
 */
export const voxelizeMeshSVO = (triarr, svoDepth, contouringMethod) => {
    const tris = f32arrtotriangles(triarr);
    let minPoint = tris[0].a.clone();
    let maxPoint = tris[0].a.clone();
    for(const t of tris)
    {
        minPoint.min(t.a);
        minPoint.min(t.b);
        minPoint.min(t.c);

        maxPoint.max(t.a);
        maxPoint.max(t.b);
        maxPoint.max(t.c);
    }
    let [xExtent, yExtent, zExtent] = [maxPoint.x - minPoint.x, maxPoint.y - minPoint.y, maxPoint.z - minPoint.z];
    let maxExtent = Math.max(xExtent, yExtent, zExtent);
    let svoSize = maxExtent;
    for(let i = 0; i < svoDepth; i++) svoSize /= 2;
    minPoint.sub(new THREE.Vector3(1,1,1).multiplyScalar(svoSize / 2));
    maxPoint.add(new THREE.Vector3(1,1,1).multiplyScalar(svoSize / 2));
    [xExtent, yExtent, zExtent] = [maxPoint.x - minPoint.x, maxPoint.y - minPoint.y, maxPoint.z - minPoint.z];
    maxExtent = Math.max(xExtent, yExtent, zExtent);
    svoSize = maxExtent;
    for(let i = 0; i < svoDepth; i++) svoSize /= 2;
    const size = Math.round(maxExtent / svoSize);
    maxPoint = minPoint.clone().add(new THREE.Vector3(maxExtent, maxExtent, maxExtent));
    const svo = new SVO(svoDepth, minPoint, maxPoint);
    initVoxelArr(tris, [size, size, size], minPoint, svoSize, contouringMethod, (voxel, center) => {
        if(voxel.childCount == 0) return;
        svo.insertVoxel(center, voxel.normal);
    });
    const linearSVOs = svo.linearize();
    const nodeCount = linearSVOs.length;
    const float32arr = new Float32Array(nodeCount * 4);
    for(let i = 0; i < nodeCount; i++) {
        const node = linearSVOs[i];
        const cmBits = node.childMask & 0xFF;
        const leafBit = node.isLeaf ? 0x100 : 0;
        const offsetBits = (node.childOffset & 0x7FFFFF) << 9;
        const packedInt = cmBits | leafBit | offsetBits;
        float32arr[i * 4] = intAsFloat(packedInt);
        float32arr[i * 4 + 1] = node.avgNormal.x;
        float32arr[i * 4 + 2] = node.avgNormal.y;
        float32arr[i * 4 + 3] = node.avgNormal.z;
    }
    //{min: THREE.Vector3, max: THREE.Vector3, nodeCount: number, voxelData: Float32Array}
    return {min: minPoint, max: maxPoint, nodeCount, voxelData: float32arr};
};

