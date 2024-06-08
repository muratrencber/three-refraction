import * as THREE from 'three';
import Matrix, { EigenvalueDecomposition } from 'ml-matrix';

export class QEF
{
    constructor()
    {
        /** @type {Array<{point: THREE.Vector3, normal: THREE.Vector3, edgeIndex: number}>} */
        this.intersections = [];
        /** @type {THREE.Vector3} */
        this.massPoint = new THREE.Vector3();
        /** @type {THREE.Vector3} */
        this.pointSum = new THREE.Vector3();
        /** @type {number[]} */
        this.fixedPoints = [];

        this.Aarr = [];
        this.Barr = [];

        /** @type {Array<{point: THREE.Vector3, normal: THREE.Vector3, edgeIndex: number}>} */
        this.additionalIntersections = [];
    }

    init()
    {
        this.initArrays();
        this.initMatrices();
    }

    initArrays()
    {
        this.Aarr = [];
        this.Barr = [];
        this.fixedPoints = [];
        for(const intersection of this.intersections)
        {
            this.Aarr.push([intersection.normal.x, intersection.normal.y, intersection.normal.z]);
            this.Barr.push([intersection.normal.dot(intersection.point)]);
        }
        for(const intersection of this.additionalIntersections)
        {
            this.Aarr.push([intersection.normal.x, intersection.normal.y, intersection.normal.z]);
            this.Barr.push([intersection.normal.dot(intersection.point)]);
        }
        this.fixedPoints.push(null, null, null);
    }

    /** 
     * @param {THREE.Vector3} point
     * @returns {number} 
     */
    evaluate(point)
    {
        let sum = 0;
        for(const intersection of this.intersections)
        {
            sum += Math.pow(intersection.normal.dot(point.clone().sub(intersection.point)), 2);
        }
        for(const intersection of this.additionalIntersections)
        {
            sum += Math.pow(intersection.normal.dot(point.clone().sub(intersection.point)), 2);
        }
    }
    /** 
     * @param {THREE.Vector3} point
     * @returns {{solutionPoint: THREE.Vector3, error: number}}
     */
    evaluateAsSolution(point)
    {
        const result = this.evaluate(point);
        return {solutionPoint: point, error: result};
    }
    
    initMatrices()
    {
        /** @type {Matrix} */
        this.A = new Matrix(this.Aarr);
        /** @type {Matrix} */
        this.At = this.A.transpose();
        /** @type {Matrix} */
        this.B = new Matrix(this.Barr);
        /** @type {Matrix} */
        this.AtA = this.At.mmul(this.A);
    }

    /**
     * @param {THREE.Vector3} point 
     * @param {THREE.Vector3} normal 
     * @param {number} edgeIndex 
     */
    addIntersection(point, normal, edgeIndex)
    {
        this.intersections.push({point, normal, edgeIndex});
        this.pointSum.add(point);
    }

    /**
     * 
     * @param {number} axis 
     * @param {number} value
     * @returns {QEF} 
     */
    fixAxis(axis, value)
    {
        const newQEF = new QEF();
        newQEF.intersections = this.intersections;
        newQEF.massPoint = this.massPoint;
        newQEF.pointSum = this.pointSum;
        newQEF.fixedPoints = [...this.fixedPoints];
        newQEF.fixedPoints[axis] = value;
        newQEF.Barr = [...this.Barr];
        this.Barr.forEach((row, i) => {
            newQEF.Barr[i] = row - this.Aarr[i][axis] * value;
        });
        newQEF.additionalIntersections = this.additionalIntersections;
        newQEF.Aarr = [];
        this.Aarr.forEach((row, i) => {
            const newRow = [];
            for(let i = 0; i < 3; i++)
            {
                if(i == axis) continue;
                newRow.push(row[i]);
            }
            newQEF.Aarr.push(newRow);
        });
        return newQEF;
    }

    /**
     * 
     * @param {boolean} [initArrays=true] initArrays 
     * @param {*} [initMatrices=true] initMatrices
     * @returns {{solutionPoint: THREE.Vector3, error: number}}
     */
    solve(initArrays = true, initMatrices = true)
    {
        if(initArrays) this.initArrays();
        if(initMatrices) this.initMatrices();
        const eig = new EigenvalueDecomposition(this.AtA);
        const eigVals = eig.realEigenvalues;
        const Darr = [];
        const zeroRow = [];
        for(let i = 0; i < eigVals.length; i++)
            zeroRow.push(0);
        for(let i = 0; i < eigVals.length; i++)
        {
            const Drow = [...zeroRow];
            const eigval = eigVals[i];
            const adj_eigval = eigval < 0.001 ? 0 : 1 / eigval; 
            Drow[i] = adj_eigval;
            Darr.push(Drow);
        }
        const D = new Matrix(Darr);
        const AtAPseudoInv = eig.eigenvectorMatrix.mmul(D).mmul(eig.eigenvectorMatrix.transpose());
        const soln = AtAPseudoInv.mmul(this.At).mmul(this.B);
        const resultingCenter = new THREE.Vector3();
        let solnIndex = 0;
        for(let i = 0; i < 3; i++)
        {
            if(this.fixedPoints[i] !== null)
                resultingCenter.setComponent(i, this.fixedPoints[i]);
            else
                resultingCenter.setComponent(i, soln.get(solnIndex++, 0));
        }
        return {solutionPoint: resultingCenter, error: this.evaluate(resultingCenter)};
    }
}

/**
 * @typedef {Object} QEFSolveSettings
 * @property {boolean} addBias
 * @property {boolean} constrainBoundaries
 * @property {boolean} clipToBounds
 * @property {number} biasStrength
 * @property {number} boundarySize
 */


    /**
     * 
     * @param {QEF} qef 
     * @param {QEFSolveSettings} solveSettings 
     * @returns {THREE.Vector3}
     */
    export function solveQEF(qef, solveSettings)
    {
        if(qef.intersections.length == 0) return new THREE.Vector3(0,0,0);
        if(solveSettings.addBias)
        {
            qef.additionalIntersections = [];
            const meanPoint = new THREE.Vector3();
            qef.intersections.forEach(i => meanPoint.add(i.point));
            meanPoint.divideScalar(qef.intersections.length);

            qef.additionalIntersections.push({point: meanPoint, normal: new THREE.Vector3(solveSettings.biasStrength,0,0), edgeIndex: -1});
            qef.additionalIntersections.push({point: meanPoint, normal: new THREE.Vector3(0,solveSettings.biasStrength,0), edgeIndex: -1});
            qef.additionalIntersections.push({point: meanPoint, normal: new THREE.Vector3(0,0,solveSettings.biasStrength), edgeIndex: -1});
        }
        qef.initArrays();
        /** @type {{solutionPoint: THREE.Vector3, error: number}} */
        let result = qef.solve(false, true);
        /** @type {Array<{solutionPoint: THREE.Vector3, error: number}>} */
        let otherResults = [];
        const halfBoundary = solveSettings.boundarySize / 2;

        if(solveSettings.constrainBoundaries)
        {
            /**
             * @param {THREE.Vector3} pos
             * @returns {boolean} 
             */
            const inside = (pos) => {
                if(pos.x < -halfBoundary || pos.x > halfBoundary) return false;
                if(pos.y < -halfBoundary || pos.y > halfBoundary) return false;
                if(pos.z < -halfBoundary || pos.z > halfBoundary) return false;
                return true;
            }

            if(inside(result)) return result.solutionPoint;

            let r1 = qef.fixAxis(0, -halfBoundary).solve(false, true);
            let r2 = qef.fixAxis(0, halfBoundary).solve(false, true);
            let r3 = qef.fixAxis(1, -halfBoundary).solve(false, true);
            let r4 = qef.fixAxis(1, halfBoundary).solve(false, true);
            let r5 = qef.fixAxis(2, -halfBoundary).solve(false, true);
            let r6 = qef.fixAxis(2, halfBoundary).solve(false, true);

            let otherResults = [r1, r2, r3, r4, r5, r6].filter(r => inside(r.solutionPoint));

            if(otherResults.length == 0)
            {
                r1 = qef.fixAxis(0, -halfBoundary).fixAxis(1, -halfBoundary).solve(false, true);
                r2 = qef.fixAxis(0, halfBoundary).fixAxis(1, -halfBoundary).solve(false, true);
                r3 = qef.fixAxis(0, -halfBoundary).fixAxis(1, halfBoundary).solve(false, true);
                r4 = qef.fixAxis(0, halfBoundary).fixAxis(1, halfBoundary).solve(false, true);
                r5 = qef.fixAxis(0, -halfBoundary).fixAxis(2, -halfBoundary).solve(false, true);
                r6 = qef.fixAxis(0, halfBoundary).fixAxis(2, -halfBoundary).solve(false, true);
                let r7 = qef.fixAxis(0, -halfBoundary).fixAxis(2, halfBoundary).solve(false, true);
                let r8 = qef.fixAxis(0, halfBoundary).fixAxis(2, halfBoundary).solve(false, true);
                let r9 = qef.fixAxis(1, -halfBoundary).fixAxis(2, -halfBoundary).solve(false, true);
                let r10 = qef.fixAxis(1, halfBoundary).fixAxis(2, -halfBoundary).solve(false, true);
                let r11 = qef.fixAxis(1, -halfBoundary).fixAxis(2, halfBoundary).solve(false, true);
                let r12 = qef.fixAxis(1, halfBoundary).fixAxis(2, halfBoundary).solve(false, true);

                otherResults = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12].filter(r => inside(r.solutionPoint));
            }

            if(otherResults.length == 0)
            {
                r1 = qef.evaluateAsSolution(new THREE.Vector3(halfBoundary,halfBoundary,halfBoundary));
                r2 = qef.evaluateAsSolution(new THREE.Vector3(-halfBoundary,halfBoundary,halfBoundary));
                r3 = qef.evaluateAsSolution(new THREE.Vector3(halfBoundary,-halfBoundary,halfBoundary));
                r4 = qef.evaluateAsSolution(new THREE.Vector3(-halfBoundary,-halfBoundary,halfBoundary));
                r5 = qef.evaluateAsSolution(new THREE.Vector3(halfBoundary,halfBoundary,-halfBoundary));
                r6 = qef.evaluateAsSolution(new THREE.Vector3(-halfBoundary,halfBoundary,-halfBoundary));
                let r7 = qef.evaluateAsSolution(new THREE.Vector3(halfBoundary,-halfBoundary,-halfBoundary));
                let r8 = qef.evaluateAsSolution(new THREE.Vector3(-halfBoundary,-halfBoundary,-halfBoundary));

                otherResults = [r1, r2, r3, r4, r5, r6, r7, r8];
            }

            result = otherResults.sort((a,b) => a.error - b.error)[0];
        }

        if(solveSettings.clipToBounds)
        {
            result.solutionPoint.clamp(new THREE.Vector3(-halfBoundary,-halfBoundary,-halfBoundary), new THREE.Vector3(halfBoundary,halfBoundary,halfBoundary));
        }

        return result.solutionPoint;
    }