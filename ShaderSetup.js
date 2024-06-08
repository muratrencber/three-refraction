import { intersectionGLSL } from './shaders/includes/intersection';
import { screenSizeGLSL } from './shaders/includes/screenSize';
import { upscaleFragmentGLSL } from './shaders/upscale/upscaleFragment';
import { upscaleVertexGLSL } from './shaders/upscale/upscaleVertex';
import { bicubicSamplingGLSL } from './shaders/utils/bicubicSampling';
import { bilinearSamplingGLSL } from './shaders/utils/bilinearSampling';
import { bvhUtilsGLSL } from './shaders/utils/bvhUtils';
import { nnSamplingGLSL } from './shaders/utils/nnSampling';
import * as THREE from 'three';
import { primitiveIntersectionsGLSL } from './shaders/utils/primitiveIntersections';
import { voxelGridUtilsGLSL } from './shaders/utils/voxelGridUtils';
import { svoUtilsGLSL } from './shaders/utils/svoUtils';

let shaderSetupDone = false;

const shaderData = [
    intersectionGLSL,
    screenSizeGLSL,
    upscaleFragmentGLSL,
    upscaleVertexGLSL,
    bvhUtilsGLSL,
    nnSamplingGLSL,
    bilinearSamplingGLSL,
    bicubicSamplingGLSL,
    primitiveIntersectionsGLSL,
    voxelGridUtilsGLSL,
    svoUtilsGLSL
];

export const setupShaders = () => {
    console.log('Setting up shaders');
    if(shaderSetupDone)
        return;
    shaderSetupDone = true;
    shaderData.forEach((data) => {
        if(data.code)
            THREE.ShaderChunk[data.name] = data.code;
    });
};