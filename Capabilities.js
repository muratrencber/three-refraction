import * as THREE from 'three';
export class Capabilities
{
    static maxTextureSize = null;
    static max3DTextureSize = null;
    static capabilitiesSet = false;

    /** 
     * @param {THREE.WebGLRenderer} renderer
    */
    static setCapabilitiesFromRenderer(renderer)
    {
        if (!Capabilities.capabilitiesSet)
        {
            Capabilities.maxTextureSize = renderer.capabilities.maxTextureSize;
            Capabilities.max3DTextureSize = Capabilities.maxTextureSize / 2;
            Capabilities.capabilitiesSet = true;
        }
    }

    static setCapabilities()
    {
        const renderer = new THREE.WebGLRenderer();
        Capabilities.setCapabilitiesFromRenderer(renderer);
        renderer.dispose();
    }

}
