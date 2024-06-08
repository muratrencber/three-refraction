import * as THREE from 'three';

export class LinearSVO
{
    constructor()
    {
        this.childMask = 0;
        this.avgNormal = new THREE.Vector3(0, 0, 0);
        this.childOffset = -1;
        this.isLeaf = false;
    }
}

export class SVO
{
    /**
     * 
     * @param {number} depth 
     * @param {Vec3} min
     * @param {Vec3} max
     */
    constructor(depth, min, max)
    {
        /**
         * @type {(SVO|null)[]}
         */
        this.children = [];
        for(let i = 0; i < 8; i++)
            this.children.push(null);
        /**
         * @type {number}
         */
        this.depth = depth;
        /**
         * @type {THREE.Vector3}
         */
        this.min = min;
        /**
         * @type {THREE.Vector3}
         */
        this.max = max;
        /**
         * @type {THREE.Vector3}
         */
        this.normal = new THREE.Vector3(0, 0, 0);
    }

    /**
     * 
     * @param {THREE.Vector3} center 
     * @param {THREE.Vector3} averageNormal 
     */
    insertVoxel(center, averageNormal)
    {
        if(this.depth == 0)
        {
            this.normal = averageNormal.clone();
            return;
        }
        let index = this.pointIndex(center);
        if(this.children[index] == null)
            this.createChild(index);
        this.children[index].insertVoxel(center, averageNormal);
    }

    /**
     * 
     * @param {Vec3} point
     * @returns {number} 
     */
    pointIndex(point)
    {
        let index = 0;
        if(point.x > (this.min.x + this.max.x) / 2)
            index |= 1;
        if(point.y > (this.min.y + this.max.y) / 2)
            index |= 2;
        if(point.z > (this.min.z + this.max.z) / 2)
            index |= 4;
        return index;
    }

    createChild(index)
    {
        let newMin = [0,0,0];
        let newMax = [0,0,0];
        for(let i = 0; i < 3; i++)
        {
            if((index & (1 << i)) != 0)
            {
                newMin[i] = (this.min.getComponent(i) + this.max.getComponent(i)) / 2;
                newMax[i] = this.max.getComponent(i);
            }
            else
            {
                newMin[i] = this.min.getComponent(i);
                newMax[i] = (this.min.getComponent(i) + this.max.getComponent(i)) / 2;
            }
        }
        const newMinVec3 = new THREE.Vector3().fromArray(newMin);
        const newMaxVec3 = new THREE.Vector3().fromArray(newMax);
        this.children[index] = new SVO(this.depth - 1, newMinVec3, newMaxVec3);
    }

    /**
     * @typedef {[SVO, number]} SVOPair
     */

    /**
     * 
     * @returns {LinearSVO[]}
     */
    linearize()
    {
        const svoList = [];
        /**
         * @type {SVOPair[]}
         */
        const svoStack = [[this, -1]];
        while(svoStack.length > 0)
        {
            const thisIndex = svoList.length;
            const rrr = svoStack.shift();
            const svo = rrr[0];
            const parentIndex = rrr[1];
            const res = new LinearSVO();
            for(let i = 0; i < 8; i++)
            {
                const mask = 1 << i;
                if(svo.children[i] != null)
                {
                    res.childMask |= mask;
                    svoStack.push([svo.children[i], thisIndex]);
                }
            }
            res.isLeaf = svo.depth == 0;
            res.avgNormal = svo.normal.clone();
            if(parentIndex != -1)
            {
                const parent = svoList[parentIndex];
                if(parent.childOffset == -1)
                    parent.childOffset = thisIndex - parentIndex;
            }
            svoList.push(res);
        }
        return svoList;
    }

    addCubePoints(pointarr)
    {
        const size = this.max.clone().sub(this.min);
        const center = this.min.clone().add(size.clone().multiplyScalar(0.5));
        const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z).toNonIndexed();
        const pos = boxGeo.attributes.position.array;
        for(let i = 0; i < pos.length; i += 3)
        {
            const point = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
            point.add(center);
            pointarr.push(point.x, point.y, point.z);
        }
    }

    getMeshPoints(pointArr, onlyLeaves = false)
    {
        let fullChildren = false;
        for(let i = 0; i < 8; i++)
        {
            if(this.children[i] == null)
            {
                fullChildren = false;
                break;
            }
            fullChildren = true;
        }
        const isLeaf = this.depth == 0;
        if(isLeaf)
            this.addCubePoints(pointArr);
        else if(!fullChildren && !onlyLeaves)
            this.addCubePoints(pointArr);
        for(let i = 0; i < 8; i++)
        {
            if(this.children[i] != null)
                this.children[i].getMeshPoints(pointArr, onlyLeaves);
        }
    }
}