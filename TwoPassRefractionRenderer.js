import * as THREE from 'three';
import { applyMaterial, applyMaterialMap, getMaterialMap } from './MaterialUtils';
import { MeshRefractiveMaterial } from './MeshRefractiveMaterial';
import { MeshUpscaleMaterial } from './MeshUpscaleMaterial';
import { setupShaders } from './ShaderSetup';

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
    [UpscaleMethod.XBR]: "XBR_FILTERING",
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
 * @typedef {Object} UpscaleOptions
 * @property {UpscaleMethod} upscaleMethod
 * @property {UpscaleTarget} upscaleTarget
 * @property {boolean} normalFiltering
 * @property {number} normalThreshold
 * @property {THREE.TextureFilter} hwFiltering
 */

const DefaultUpscaleOptions = {
    upscaleMethod: UpscaleMethod.Bilinear,
    upscaleTarget: UpscaleTarget.FinalRender,
    hwFiltering: THREE.NearestFilter,
    normalFiltering: true,
    normalThreshold: 0.85
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
        /** @type {MeshUpscaleMaterial} */
        this.upscaleMaterial = null;
        this.updateOptions(rendererOptions);
        renderer.autoClear = false;
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
        this.createRenderTarget();
        this.updateMaterials();
        this.updateUpscaleMaterial();
    }

    updateUpscaleMaterial()
    {
        if(this.upscaleMaterial)
            this.upscaleMaterial.dispose();
        /** @type {MeshUpscaleMaterial} */
        this.upscaleMaterial = new MeshUpscaleMaterial(this.defineArray);
        this.upscaleMaterial.uniforms.lowResTexture = { value: this.renderTarget.textures[0] };
        this.upscaleMaterial.uniforms.normalOrMask = { value: this.renderTarget.textures[1] };
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
        const methodDef = UpscaleMethodDefs[this.rendererOptions.upscaleOptions.upscaleMethod];
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
        if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.RefractedDirectionsWithBounceData)
            count = this.rendererOptions.bounceCount + 1;
        else if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.RefractedDirectionsWithFresnelRender)
            count = 3;
        else if(this.rendererOptions.upscaleOptions.upscaleTarget === UpscaleTarget.FinalRender)
            count = 2;
        if(this.rendererOptions.upscaleOptions.upscaleMethod === UpscaleMethod.Hardware)
        {
            count -= 1;
            textureFilter = this.rendererOptions.upscaleOptions.hwFiltering;
        }
        if(this.renderTarget)
            this.renderTarget.dispose();
        this.originalRenderSize = this.renderer.getSize(new THREE.Vector2());
        this.originalRenderSize.multiplyScalar(this.renderer.getPixelRatio());
        this.lowResRenderSize = new THREE.Vector2(Math.floor(this.renderer.domElement.width * this.rendererOptions.lowResFactor), Math.floor(this.renderer.domElement.height * this.rendererOptions.lowResFactor));
        this.renderTarget = new THREE.WebGLRenderTarget(this.lowResRenderSize.x, this.lowResRenderSize.y, {
            minFilter: textureFilter,
            magFilter: textureFilter,
            format: THREE.RGBAFormat,
            count: count
        });
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
            for(const material of materialArray)
            {
                if(!material.isRefractiveMaterial)
                    continue;
                if(this.refractiveMaterials.has(material))
                    continue;
                this.refractiveMaterials.add(material);
                material.saveDefines();
                material.addToDefines(this.defineArray);
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
        let savedRatio = this.renderer.getPixelRatio();
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.setPixelRatio(this.rendererOptions.lowResFactor);
        this.renderer.clear();
        this.beforeRefractionRender(scene);
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(null);
        this.renderer.setPixelRatio(savedRatio);
        this.renderer.clear();
        this.upscaleMaterial.uniforms.lowResTexture.value = this.renderTarget.textures[0];
        this.upscaleMaterial.uniforms.normalOrMask.value = this.renderTarget.textures[1];
        this.upscaleMaterial.uniformsNeedUpdate = true;
        this.beforeUpscaleRender(scene);
        this.renderer.render(scene, camera);
    }

    /**
     * @param {THREE.Scene} scene
     */
    beforeRefractionRender(scene)
    {
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
                        else if(!materialOrArray.isRefractiveMaterial)
                        {
                            this.visibilities[child] = child.visible;
                            child.visible = false;
                        }
                    }
                });
            }
            obj.visible = false;
        }
        for(const obj of this.refractiveObjects)
        {
            if(this.objectMaterialMaps)
                applyMaterialMap(obj, this.objectMaterialMaps[obj], new THREE.MeshBasicMaterial({ color: 0x000000 }));
            const visibility = this.visibilities[obj];
            if(visibility !== undefined)
                obj.visible = this.visibilities[obj];
        }
    }

    /**
     * @param {THREE.Scene} scene
     */
    beforeUpscaleRender(scene)
    {
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