export const upscaleFragmentGLSL = {name:"upscaleFragment", code:`
precision highp float;
#include <screenSize>
#ifdef BILINEAR_FILTERING
#include <bilinearSampling>
#endif
#ifdef NN_FILTERING
#include <nnSampling>
#endif
#ifdef BICUBIC_FILTERING
#include <bicubicSampling>
#endif

#ifdef PRESERVE_NORMALS
in vec3 localNormal;
#endif

out vec4 fragColor;
uniform sampler2D lowResTexture;
uniform sampler2D normalOrMask;

void main()
{
    vec2 fragCoord = gl_FragCoord.xy / screenSize;
    #ifdef HW_FILTERING
        vec4 col = texture(lowResTexture, fragCoord);
    #else
        #ifdef PRESERVE_NORMALS
            vec4 col = samplePixelNormal(lowResTexture, normalOrMask, fragCoord, localNormal, NORMAL_THRESHOLD);
        #else
            vec4 col = samplePixelMask(lowResTexture, normalOrMask, fragCoord);
        #endif
    #endif
    col.rgb = pow(col.rgb, vec3(1.0 / 2.2));
    fragColor = col;
}
`};