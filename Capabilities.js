import * as THREE from 'three';
export class Capabilities
{
    static maxTextureSize = null;
    static max3DTextureSize = null;

    /** 
     * @param {THREE.WebGLRenderer} renderer
    */
    static setCapabilitiesFromRenderer(renderer)
    {
        if (!capabilitiesSet)
        {
            Capabilities.maxTextureSize = renderer.capabilities.maxTextureSize;
            Capabilities.max3DTextureSize = maxTextureSize / 2;
            capabilitiesSet = true;
        }
    }

    static setCapabilities()
    {
        const renderer = new THREE.WebGLRenderer();
        Capabilities.setCapabilitiesFromRenderer(renderer);
        renderer.dispose();
    }

}
