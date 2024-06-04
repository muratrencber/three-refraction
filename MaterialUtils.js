import *  as THREE from 'three';

/** @typedef {Object.<THREE.Mesh,THREE.Material>} MaterialMap */

/**
 * 
 * @param {THREE.Object3D} obj
 * @returns {MaterialMap} 
 */
export const getMaterialMap = (obj) => {
    const materialMap = {};
    obj.traverse((child) => {
        if (child.isMesh)
            materialMap[child] = child.material;
    });
    return materialMap;
}

/**
 * @param {THREE.Object3D} obj
 * @param {MaterialMap} materialMap
 * @param {THREE.Material} defaultMaterial
 */
export const applyMaterialMap = (obj, materialMap, defaultMaterial) => {
    obj.traverse((child) => {
        if (child.isMesh)
        {
            const material = materialMap[child] ?? defaultMaterial ?? child.material;
            child.material = material;
        }
    });
}

/**
 * @param {THREE.Object3D} obj
 * @param {THREE.Material} material
 */
export const applyMaterial = (obj, material) => {
    obj.traverse((child) => {
        if (child.isMesh)
            child.material = material;
    });
}