import * as THREE from 'three';
import { applyMaterial, applyMaterialMap, getMaterialMap } from './MaterialUtils';
import { MeshRefractiveMaterial } from './MeshRefractiveMaterial';
import { MeshUpscaleMaterial } from './MeshUpscaleMaterial';
import { setupShaders } from './ShaderSetup';
import { xbrUpscaleVertexGLSL } from './shaders/upscale/xbrUpscaleVertex';
import { xbrUpscaleFragmentGLSL } from './shaders/upscale/xbrUpscaleFragment';

/**
 * @enum {number}
 */
export const UpscaleMethod = {
    NearestNeighbour: 0,
    Bilinear: 1,
    XBR: 2,
    Hardware: 3,
    Bicubic: 4
};

const UpscaleMethodDefs = {
    [UpscaleMethod.NearestNeighbour]: "NN_FILTERING",
    [UpscaleMethod.Bilinear]: "BILINEAR_FILTERING",
    [UpscaleMethod.Bicubic]: "BICUBIC_FILTERING",
    [UpscaleMethod.XBR]: "NN_FILTERING",
    [UpscaleMethod.Hardware]: "HW_FILTERING"
}

/**
 * @enum {number}
 */
export const UpscaleTarget = {
    FinalRender: 0,
    RefractedDirections: 1,
    RefractedDirectionsWithBounceData: 2,
    RefractedDirectionsWithFresnelRender: 3
}

const UpscaleTargetDefs = {
    [UpscaleTarget.FinalRender]: "TARGET_FINAL_RENDER",
    [UpscaleTarget.RefractedDirections]: "TARGET_REFRACTED_DIRECTIONS",
    [UpscaleTarget.RefractedDirectionsWithBounceData]: "TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA",
    [UpscaleTarget.RefractedDirectionsWithFresnelRender]: "TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER"
}

/**
 * @enum {number}
 */
export const DebugRenderTarget = {
    None: 0,
    NormalsOrMask: 1,
    FinalRender: 2,
    DirectionsRender: 3,
    BounceData1: 4,
    BounceData2: 5,
    BounceData3: 6,
    BounceData4: 7,
    BounceData5: 8,
    BounceData6: 9,
    BounceData7: 10,
    FresnelRender: 11
}

/**
 * @enum {number}
 */
export const DebugRenderPosition = {
    AfterLowResRender: 0,
    AfterXBR2x: 1,
    AfterXBR4x: 2
}

const RenderTargetToIndexMap = {
    [DebugRenderTarget.BounceData1]: 0,
    [DebugRenderTarget.BounceData2]: 1,
    [DebugRenderTarget.BounceData3]: 2,
    [DebugRenderTarget.BounceData4]: 3,
    [DebugRenderTarget.BounceData5]: 4,
    [DebugRenderTarget.BounceData6]: 5,
    [DebugRenderTarget.BounceData7]: 6,
    [DebugRenderTarget.FresnelRender]: 1,
    [DebugRenderTarget.FinalRender]: 0,
    [DebugRenderTarget.DirectionsRender]: 0,
}

/**
 * @typedef {Object} UpscaleOptions
 * @property {UpscaleMethod} upscaleMethod
 * @property {UpscaleTarget} upscaleTarget
 * @property {boolean} normalFiltering
 * @property {boolean} xbr4xSupported
 * @property {UpscaleMethod} xbrUpscaleMethod
 * @property {number} normalThreshold
 * @property {THREE.TextureFilter} hwFiltering
 * @property {boolean} dynamicResolution
 * @property {number} minDynamicDistance
 * @property {number} maxDynamicDistance
 */

const DefaultUpscaleOptions = {
    upscaleMethod: UpscaleMethod.Bilinear,
    upscaleTarget: UpscaleTarget.FinalRender,
    xbr4xSupported: true,
    hwFiltering: THREE.NearestFilter,
    normalFiltering: true,
    normalThreshold: 0.85,
    dynamicResolution: true,
    minDynamicDistance: 0.2,
    maxDynamicDistance: 3.,
    xbrUpscaleMethod: UpscaleMethod.NearestNeighbour
}

/**
 * @typedef {Object} RendererOptions
 * @property {number} lowResFactor
 * @property {UpscaleOptions} upscaleOptions
 * @property {number} bounceCount
 */

const DefaultRendererOptions = {
    lowResFactor: 0.5,
    upscaleOptions: DefaultUpscaleOptions,
    bounceCount: 4
}

/**
 * @param {any} trueResult
 * @param {any} falseResult
 * @param  {...boolean} conditions
 */
const evaluateConditions = (trueResult, falseResult, ...conditions) => {
    for(const condition of conditions)
    {
        if(!condition)
            return falseResult;
    }
    return trueResult;
}


export class TwoPassRefractionRenderer
{
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {RendererOptions} rendererOptions
     */
    constructor(renderer, rendererOptions)
    {
        setupShaders();
        /** @type {THREE.WebGLRenderer} */
        this.renderer = renderer;
        /** @type {Set<THREE.Object3D>} */
        this.refractiveObjects = new Set();
        /** @type {Object.<THREE.Object3D, import('./MaterialUtils').MaterialMap>} */
        this.objectMaterialMaps = null;
        /** @type {Object.<THREE.Object3D | THREE.Material, boolean>} */
        this.visibilities = {};
        /** @type {Set<MeshRefractiveMaterial>} */
        this.refractiveMaterials = new Set();
        /** @type {THREE.WebGLRenderTarget} */
        this.renderTarget = null;
        /** @type {THREE.WebGLRenderTarget} */
        this.xbrRenderTarget = null;
        /** @type {THREE.WebGLRenderTarget} */
        this.xbr4xRenderTarget = null;
        /** @type {MeshUpscaleMaterial} */
        this.upscaleMaterial = null;
        /** @type {boolean} */
        this.savedAutoClear = renderer.autoClear;
        /** @type {DebugRenderTarget} */
        this.debugRenderTarget = DebugRenderTarget.None;
        /** @type {DebugRenderPosition} */
        this.debugRenderPosition = DebugRenderPosition.AfterLowResRender;
        /** @type {number} */
        this.debugRenderTargetIndex = 0;
        /** @type {THREE.Scene} */
        this.debugScene = new THREE.Scene();

        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.quadMaterial = new THREE.RawShaderMaterial({
            vertexShader: xbrUpscaleVertexGLSL.code,
            fragmentShader: xbrUpscaleFragmentGLSL.code,
            glslVersion: THREE.GLSL3,
            uniforms: {
                lowResTextureSize: { value: [0,0] },
                targetTextureSize: { value: [0,0] },
                fullSize: { value: [0,0] },
                lowResTexture1: { value: null },
                lowResTexture2: { value: null },
                lowResTexture3: { value: null },
                lowResTexture4: { value: null },
                lowResTexture5: { value: null },
                lowResTexture6: { value: null },
                lowResTexture7: { value: null }
            },
            defines: {
                XBR_TARGET_COUNT: 0
            }
        });
        this.quadScene = new THREE.Scene();
        const quadGeometry = new THREE.PlaneGeometry(2, 2);
        const quadMesh = new THREE.Mesh(quadGeometry, this.quadMaterial);
        this.quadCamera.translateZ(1);
        this.quadScene.add(quadMesh);

        
        renderer.autoClear = false;
        this.updateOptions(rendererOptions);
    }

    /** @param {DebugRenderTarget} target */
    setDebugRenderTarget(target)
    {
        const previousRenderTarget = this.debugRenderTarget;
        const upscaleTarget = this.rendererOptions.upscaleOptions.upscaleTarget;
        const targetIndex = RenderTargetToIndexMap[target];
        if(targetIndex !== undefined)
            this.debugRenderTargetIndex = targetIndex;
        else if(target === DebugRenderTarget.NormalsOrMask)
        {
            if(upscaleTarget === UpscaleTarget.RefractedDirections || upscaleTarget === UpscaleTarget.FinalRender)
                this.debugRenderTargetIndex = 1;
            else if(upscaleTarget === UpscaleTarget.RefractedDirectionsWithFresnelRender)
                this.debugRenderTargetIndex = 2;
            else if(upscaleTarget === UpscaleTarget.RefractedDirectionsWithBounceData)
                this.debugRenderTargetIndex = this.rendererOptions.bounceCount + 1;
        }
        switch(target)
        {
            case DebugRenderTarget.None:
            case DebugRenderTarget.NormalsOrMask:
                this.debugRenderTarget = target;
            break;

            case DebugRenderTarget.FinalRender:
                this.debugRenderTarget = evaluateConditions(DebugRenderTarget.FinalRender, DebugRenderTarget.None, upscaleTarget === UpscaleTarget.FinalRender);
            break;

            case DebugRenderTarget.DirectionsRender:
                this.debugRenderTarget = evaluateConditions(DebugRenderTarget.DirectionsRender, DebugRenderTarget.None, upscaleTarget === UpscaleTarget.RefractedDirections || upscaleTarget === UpscaleTarget.RefractedDirectionsWithFresnelRender);
            break;

            case DebugRenderTarget.BounceData1:
            case DebugRenderTarget.BounceData2:
            case DebugRenderTarget.BounceData3:
            case DebugRenderTarget.BounceData4:
            case DebugRenderTarget.BounceData5:
            case DebugRenderTarget.BounceData6:
            case DebugRenderTarget.BounceData7:
                const bounceCount = target - DebugRenderTarget.BounceData1 + 1;
                this.debugRenderTargetIndex = bounceCount - 1;
                this.debugRenderTarget = evaluateConditions(target, DebugRenderTarget.None, upscaleTarget === UpscaleTarget.RefractedDirectionsWithBounceData && bounceCount <= this.rendererOptions.bounceCount);
            break;

            case DebugRenderTarget.FresnelRender:
                this.debugRenderTarget = evaluateConditions(DebugRenderTarget.FresnelRender, DebugRenderTarget.None, upscaleTarget === UpscaleTarget.RefractedDirectionsWithFresnelRender); 
            break;

            default:
                this.debugRenderTarget = DebugRenderTarget.None;
            break;
        }
    }

    unsetDebugRenderTarget()
    {
        this.setDebugRenderTarget(DebugRenderTarget.None);
    }

    /**
     * 
     * @param {DebugRenderPosition} position 
     */
    setDebugRenderPosition(position)
    {
        this.debugRenderPosition = position;
    }

    /**
     * 
     * @param {RendererOptions} options 
     */
    updateOptions(options)
    {
        /** @type {RendererOptions} */
        this.rendererOptions = { ...DefaultRendererOptions, ...options, upscaleOptions: { ...DefaultUpscaleOptions, ...options.upscaleOptions }};
        if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.RefractedDirectionsWithBounceData)
        {   
            const maxColorAttachments = this.renderer.getContext().MAX_DRAW_BUFFERS;
            if(this.rendererOptions.bounceCount > maxColorAttachments - 1)
            {
                console.warn(`Bounce count is too high for the current hardware. Maximum bounce count is ${maxColorAttachments - 1} for UpscaleTarget.RefractedDirectionsWithBounceData. Changing to UpscaleTarget.RefractedDirectionsWithFresnelRender.`);
                this.rendererOptions.upscaleOptions.upscaleTarget = UpscaleTarget.RefractedDirectionsWithFresnelRender;
            }
        }   
        /** @type {Object.<string, any>} */
        this.defineArray = this.getDefineArray();
        const savedRenderTarget = this.debugRenderTarget;
        this.setDebugRenderTarget(DebugRenderTarget.None);
        this.createRenderTarget();
        this.updateMaterials();
        this.updateUpscaleMaterial();
        this.setDebugRenderTarget(savedRenderTarget);
    }

    updateUpscaleMaterial()
    {
        if(this.upscaleMaterial)
            this.upscaleMaterial.dispose();
        /** @type {MeshUpscaleMaterial} */
        this.upscaleMaterial = new MeshUpscaleMaterial(this.defineArray);
        this.upscaleMaterial.uniforms.screenSize = { value: this.originalRenderSize };
        this.upscaleMaterial.uniforms.lowResScreenSize = { value: this.lowResRenderSize };
        this.upscaleMaterial.uniformsNeedUpdate = true;
    }

    /**
     * 
     * @returns {Object.<string, any>}
     */
    getDefineArray()
    {
        const lines = {};
        let methodDef = UpscaleMethodDefs[this.rendererOptions.upscaleOptions.upscaleMethod];
        if(this.rendererOptions.upscaleOptions.upscaleMethod === UpscaleMethod.XBR)
            methodDef = UpscaleMethodDefs[this.rendererOptions.upscaleOptions.xbrUpscaleMethod];
        lines[methodDef] = "";
        lines["UPSCALE_RENDER"] = "";
        if(this.rendererOptions.upscaleOptions.normalFiltering)
        {
            lines["PRESERVE_NORMALS"] = "";
            lines["NORMAL_THRESHOLD"] = this.rendererOptions.upscaleOptions.normalThreshold;
        }
        const targetDef = UpscaleTargetDefs[this.rendererOptions.upscaleOptions.upscaleTarget];
        lines[targetDef] = "";
        lines["BOUNCE_COUNT"] = this.rendererOptions.bounceCount;
        return lines;
    }

    createRenderTarget()
    {
        let count = 2;
        let textureFilter = THREE.NearestFilter;
        let xbrTargetCount = 0;
        if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.RefractedDirectionsWithBounceData){
            count = this.rendererOptions.bounceCount + 1;
            xbrTargetCount = this.rendererOptions.bounceCount;
        }
        else if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.RefractedDirectionsWithFresnelRender){
            count = 3;
            xbrTargetCount = 1;
        }
        else if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.FinalRender){
            count = 2;
            xbrTargetCount = 2;
        }
        if(this.rendererOptions.upscaleOptions.upscaleMethod === UpscaleMethod.Hardware)
        {
            count -= 1;
            textureFilter = this.rendererOptions.upscaleOptions.hwFiltering;
        }
        xbrTargetCount = count;

        if(this.renderTarget)
            this.renderTarget.dispose();
        if(this.xbrRenderTarget)
            this.xbrRenderTarget.dispose();
        if(this.xbr4xRenderTarget)
            this.xbr4xRenderTarget.dispose();
        
        this.originalRenderSize = this.renderer.getSize(new THREE.Vector2());
        this.originalRenderSize.multiplyScalar(this.renderer.getPixelRatio());
        this.lowResRenderSize = new THREE.Vector2(Math.floor(this.renderer.domElement.width * this.rendererOptions.lowResFactor), Math.floor(this.renderer.domElement.height * this.rendererOptions.lowResFactor));
        this.renderTarget = new THREE.WebGLRenderTarget(this.originalRenderSize.x, this.originalRenderSize.y, {
            minFilter: textureFilter,
            magFilter: textureFilter,
            format: THREE.RGBAFormat,
            count: count,
            colorSpace: THREE.SRGBColorSpace
        });

        this.xbr4xRenderTarget = null;
        this.xbrRenderTarget = null;

        if(xbrTargetCount > 0)
        {
            this.xbrUpscaleSize = new THREE.Vector2(this.lowResRenderSize.x * 2, this.lowResRenderSize.y * 2);
            this.xbrUpscaleSize.x = Math.min(this.xbrUpscaleSize.x, this.originalRenderSize.x);
            this.xbrUpscaleSize.y = Math.min(this.xbrUpscaleSize.y, this.originalRenderSize.y);
            this.xbrRenderTarget = new THREE.WebGLRenderTarget(this.originalRenderSize.x, this.originalRenderSize.y, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                count: xbrTargetCount,
                colorSpace: THREE.SRGBColorSpace
            });
            if(this.rendererOptions.upscaleOptions.xbr4xSupported)
            {
                this.xbr4xUpscaleSize = new THREE.Vector2(this.lowResRenderSize.x * 4, this.lowResRenderSize.y * 4);
                this.xbr4xUpscaleSize.x = Math.min(this.xbr4xUpscaleSize.x, this.originalRenderSize.x);
                this.xbr4xUpscaleSize.y = Math.min(this.xbr4xUpscaleSize.y, this.originalRenderSize.y);
                this.xbr4xRenderTarget = new THREE.WebGLRenderTarget(this.originalRenderSize.x, this.originalRenderSize.y, {
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter,
                    format: THREE.RGBAFormat,
                    count: xbrTargetCount,
                    colorSpace: THREE.SRGBColorSpace
                });
            }

            
            this.quadMaterial.defines["XBR_TARGET_COUNT"] = xbrTargetCount;
            this.quadMaterial.uniforms.fullSize = { value: this.originalRenderSize };
            this.quadMaterial.needsUpdate = true;
        }
    }

    updateMaterials()
    {
        for(const material of this.refractiveMaterials)
        {
            material.resetDefines();
            material.addToDefines(this.defineArray);
        }
    }

    /**
     * @param {THREE.Object3D} obj 
     */
    addRefractiveObject(obj)
    {
        obj.traverse((child) => {
            if(!child.isMesh)
                return;
            const materialArray = Array.isArray(child.material) ? child.material : [child.material];
            for(const possibleRefractiveMaterial of materialArray)
            {
                if(!possibleRefractiveMaterial.isRefractiveMaterial)
                    continue;
                if(this.refractiveMaterials.has(possibleRefractiveMaterial))
                    continue;
                this.refractiveMaterials.add(possibleRefractiveMaterial);
                possibleRefractiveMaterial.saveDefines();
                possibleRefractiveMaterial.addToDefines(this.defineArray);
                const savedCallback = child.onBeforeRender;
                const overrideCallback = (renderer, scene, camera, geometry, material, group) => {
                    if(savedCallback)
                        savedCallback(renderer, scene, camera, geometry, material, group);
                    if(material.isRefractiveMaterial)
                        material.setupForMesh(child);
                    else if(material.isUpscaleMaterial)
                        material.setupFromRefractiveMaterial(possibleRefractiveMaterial);
                };
                child.savedCallback = savedCallback;
                child.onBeforeRender = overrideCallback;
            }
        });
        this.refractiveObjects.add(obj);
    }

    /**
     * @param {THREE.Object3D} obj 
     */
    removeRefractiveObject(obj)
    {
        obj.traverse((child) => {
            if(!child.isMesh)
                return;
            const materialArray = Array.isArray(child.material) ? child.material : [child.material];
            for(const material of materialArray)
            {
                if(!material.isRefractiveMaterial)
                    continue;
                if(!this.refractiveMaterials.has(material))
                    continue;
                this.refractiveMaterials.delete(material);
                material.resetDefines();
            }
        });
        this.refractiveObjects.delete(obj);
    }

    /**
     * 
     * @param {THREE.Scene} scene 
     * @param {THREE.Camera} camera 
     */
    render(scene, camera)
    {
        const debugRendering = this.debugRenderTarget !== DebugRenderTarget.None;
        let savedRatio = this.renderer.getPixelRatio();
        this.beforeRefractionRender(scene, camera);
        let lerpRatio = 0;
        if(this.rendererOptions.upscaleOptions.dynamicResolution)
        {
            lerpRatio = this.minDistance < this.rendererOptions.upscaleOptions.minDynamicDistance ? 0 : this.minDistance > this.rendererOptions.upscaleOptions.maxDynamicDistance ? 1 : (this.minDistance - this.rendererOptions.upscaleOptions.minDynamicDistance) / (this.rendererOptions.upscaleOptions.maxDynamicDistance - this.rendererOptions.upscaleOptions.minDynamicDistance);
        }
        let currentLowResRatio = this.rendererOptions.lowResFactor * (1 - lerpRatio) + lerpRatio * savedRatio;
        let additionalUpscaleResolution = currentLowResRatio / this.rendererOptions.lowResFactor;
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.setPixelRatio(currentLowResRatio);
        this.renderer.setClearColor(0x000000, 1.)
        this.renderer.clear();
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(null);
        this.renderer.setPixelRatio(savedRatio);
        this.renderer.clear();
        this.beforeUpscaleRender(scene);

        let debugRenderPosition = this.debugRenderPosition;
        const xbr2xMin = 100;
        const xbr4xMin = 100;
        if(debugRendering)
        {
            let xbr2xRenderStatus = this.rendererOptions.upscaleOptions.upscaleMethod === UpscaleMethod.XBR && this.xbrRenderTarget && currentLowResRatio < xbr2xMin;
            let xbr4xRenderStatus = xbr2xRenderStatus && this.xbr4xRenderTarget && currentLowResRatio * 4 < xbr4xMin;
            if(debugRenderPosition == DebugRenderPosition.AfterXBR2x && !xbr2xRenderStatus)
                debugRenderPosition = DebugRenderPosition.AfterLowResRender;
            else if(debugRenderPosition == DebugRenderPosition.AfterXBR4x && !xbr4xRenderStatus)
                debugRenderPosition = xbr2xRenderStatus ? DebugRenderPosition.AfterXBR2x : DebugRenderPosition.AfterLowResRender;
        }

        if(debugRendering && debugRenderPosition === DebugRenderPosition.AfterLowResRender)
        {
            this.debugScene.background = this.renderTarget.textures[this.debugRenderTargetIndex];
            this.renderer.render(this.debugScene, camera);
            return;
        }
        /** @type {THREE.WebGLRenderTarget} */
        let selectedLowResTarget = this.renderTarget;
        if(this.rendererOptions.upscaleOptions.upscaleMethod === UpscaleMethod.XBR && this.xbrRenderTarget && currentLowResRatio * 2 < xbr2xMin)
        {
            this.quadMaterial.uniforms.lowResTextureSize.value = [this.lowResRenderSize.x * additionalUpscaleResolution, this.lowResRenderSize.y * additionalUpscaleResolution];
            this.quadMaterial.uniforms.targetTextureSize.value = [Math.min(this.originalRenderSize.x, this.xbrUpscaleSize.x * additionalUpscaleResolution), Math.min(this.originalRenderSize.y, this.xbrUpscaleSize.y * additionalUpscaleResolution)];
            for(let i = 0; i < this.xbrRenderTarget.textures.length; i++)
            {
                this.quadMaterial.uniforms[`lowResTexture${i + 1}`] = { value: this.renderTarget.textures[i] };
            }
            this.quadMaterial.uniformsNeedUpdate = true;
            this.renderer.setRenderTarget(this.xbrRenderTarget);
            this.renderer.setPixelRatio(Math.min(savedRatio, this.xbrUpscaleSize.x / this.originalRenderSize.x * additionalUpscaleResolution));
            this.renderer.clear();
            this.renderer.render(this.quadScene, this.quadCamera);
            this.upscaleMaterial.uniforms.lowResScreenSize.value = this.xbrUpscaleSize.clone().multiplyScalar(additionalUpscaleResolution).min(this.originalRenderSize);
            selectedLowResTarget = this.xbrRenderTarget;
            if(debugRendering && debugRenderPosition === DebugRenderPosition.AfterXBR2x)
            {
                this.renderer.setRenderTarget(null);
                this.renderer.setPixelRatio(savedRatio);
                this.renderer.clear();
                this.debugScene.background = selectedLowResTarget.textures[Math.min(this.debugRenderTargetIndex, this.xbrRenderTarget.textures.length - 1)];
                this.renderer.render(this.debugScene, camera);
                return;
            }
            if(this.xbr4xRenderTarget  && currentLowResRatio * 4 < xbr4xMin)
            {
                this.quadMaterial.uniforms.lowResTextureSize.value = this.quadMaterial.uniforms.targetTextureSize.value;
                this.quadMaterial.uniforms.targetTextureSize.value = [Math.min(this.originalRenderSize.x, this.xbr4xUpscaleSize.x * additionalUpscaleResolution), Math.min(this.originalRenderSize.y, this.xbr4xUpscaleSize.y * additionalUpscaleResolution)];
                this.quadMaterial.uniformsNeedUpdate = true;
                for(let i = 0; i < this.xbr4xRenderTarget.textures.length; i++)
                {
                    this.quadMaterial.uniforms[`lowResTexture${i + 1}`] = { value: this.xbrRenderTarget.textures[i] };
                }
                this.renderer.setRenderTarget(this.xbr4xRenderTarget);
                this.renderer.setPixelRatio(Math.min(savedRatio, this.xbr4xUpscaleSize.x / this.originalRenderSize.x * additionalUpscaleResolution));
                this.renderer.clear();
                this.renderer.render(this.quadScene, this.quadCamera);
                this.upscaleMaterial.uniforms.lowResScreenSize.value = this.xbr4xUpscaleSize.clone().multiplyScalar(additionalUpscaleResolution).min(this.originalRenderSize);
                selectedLowResTarget = this.xbr4xRenderTarget;
                
                if(debugRendering && debugRenderPosition === DebugRenderPosition.AfterXBR4x)
                {
                    this.renderer.setRenderTarget(null);
                    this.renderer.setPixelRatio(savedRatio);
                    this.renderer.clear();
                    this.debugScene.background = selectedLowResTarget.textures[Math.min(this.debugRenderTargetIndex, this.xbr4xRenderTarget.textures.length - 1)];
                    this.renderer.render(this.debugScene, camera);
                    return;
                }
            }
        }
        if(this.lastLowResTarget !== selectedLowResTarget)
        {
            let targetTextures = selectedLowResTarget.textures ?? [selectedLowResTarget.texture];
            for(let i = 0; i < targetTextures.length; i++)
                this.upscaleMaterial.uniforms[`tex${i+1}`].value = targetTextures[i];
            this.upscaleMaterial.uniformsNeedUpdate = true;
            this.lastLowResTarget = selectedLowResTarget;
        }
        this.upscaleMaterial.uniformsNeedUpdate = true;
        
        this.renderer.setRenderTarget(null);
        this.renderer.setPixelRatio(savedRatio);
        this.renderer.clear();
        this.renderer.render(scene, camera);
    }

    /**
     * @param {THREE.Scene} scene
     */
    beforeRefractionRender(scene, camera)
    {
        this.savedEnvMap = scene.background;
        scene.background = null;
        this.visibilities = {};
        for(const obj of scene.children)
        {
            this.visibilities[obj] = obj.visible;
            if(this.refractiveObjects.has(obj))
            {
                obj.traverse((child) => {
                    if(child.isMesh)
                    {
                        const materialOrArray = child.material;
                        if(!materialOrArray)
                            return;
                        if(Array.isArray(materialOrArray))
                        {
                            for(const material of materialOrArray)
                            {
                                if(material.isRefractiveMaterial)
                                    continue;
                                this.visibilities[material] = material.visible;
                                material.visible = false;
                            }
                        }
                        else if(!materialOrArray.isRefractiveMaterial && !materialOrArray.isUpscaleMaterial)
                        {
                            this.visibilities[child] = child.visible;
                            child.visible = false;
                        }
                    }
                });
            }
            obj.visible = false;
        }
        let minDistance = null;
        for(const obj of this.refractiveObjects)
        {
            if(minDistance === null)
                minDistance = obj.position.distanceTo(camera.position);
            else
                minDistance = Math.min(minDistance, obj.position.distanceTo(camera.position));

            if(this.objectMaterialMaps[obj])
                applyMaterialMap(obj, this.objectMaterialMaps[obj], new THREE.MeshBasicMaterial({ color: 0x000000 }));
            const visibility = this.visibilities[obj];
            if(visibility !== undefined)
                obj.visible = this.visibilities[obj];
        }
        this.minDistance = minDistance ?? 0;
    }

    /**
     * @param {THREE.Scene} scene
     */
    beforeUpscaleRender(scene)
    {
        scene.background = this.savedEnvMap;
        this.objectMaterialMaps = {};
        for(const obj of scene.children)
        {
            obj.visible = this.visibilities[obj];
            if(this.refractiveObjects.has(obj))
            {
                obj.traverse((child) => {
                    if(child.isMesh)
                    {
                        const materialOrArray = child.material;
                        if(Array.isArray(materialOrArray))
                        {
                            for(const material of materialOrArray)
                            {
                                if(material.isRefractiveMaterial)
                                    continue;
                                material.visible = this.visibilities[material];
                            }
                        }
                        else if(!materialOrArray.isRefractiveMaterial)
                        {
                            child.visible = this.visibilities[child];
                        }
                    }
                });
            }
        }
        for(const obj of this.refractiveObjects)
        {
            this.objectMaterialMaps[obj] = getMaterialMap(obj);
            applyMaterial(obj, this.upscaleMaterial);
        }
    }
}