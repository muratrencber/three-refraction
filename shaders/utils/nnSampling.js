export const nnSamplingGLSL = {name:"nnSampling", code:`
#ifdef USE_NN_SAMPLING
#else
#define USE_NN_SAMPLING
#include <screenSize>

vec4 samplePixelMask(in sampler2D lowResTexture, in sampler2D mask, vec2 screenCoord)
{
    vec2 texelSize = 1.0 / lowResScreenSize / 2.;
    vec2 bottomLeft = screenCoord - texelSize;
    vec2 topRight = screenCoord + texelSize;
    vec2 topLeft = vec2(bottomLeft.x, topRight.y);
    vec2 bottomRight = vec2(topRight.x, bottomLeft.y);
    vec2 coords[5] = vec2[](screenCoord, bottomLeft, topRight, topLeft, bottomRight);
    for(int i = 0; i < 5; ++i)
    {
        vec4 colorSample = texture(lowResTexture, coords[i]);
        float maskSample = texture(mask, coords[i]).a;
        if(maskSample < 0.9)
        {
            return colorSample;
        }
    }
    return vec4(1., 0., 0., 1.);
}

vec4 samplePixelNormal(in sampler2D lowResTexture, in sampler2D normal, vec2 screenCoord, vec3 fragNormal, float threshold)
{
    vec2 texelSize = 1.0 / lowResScreenSize / 2.;
    vec2 bottomLeft = screenCoord - texelSize;
    vec2 topRight = screenCoord + texelSize;
    vec2 topLeft = vec2(bottomLeft.x, topRight.y);
    vec2 bottomRight = vec2(topRight.x, bottomLeft.y);
    vec2 coords[5] = vec2[](screenCoord, bottomLeft, topRight, topLeft, bottomRight);
    vec4 bestWithoutNormal = texture(lowResTexture, screenCoord);
    int foundWithoutNormal = 0;
    for(int i = 0; i < 5; ++i)
    {
        vec4 colorSample = texture(lowResTexture, coords[i]);
        vec4 normalSample = texture(normal, coords[i]);
        float normalSize = length(normalSample.xyz);
        if(normalSize < 0.001)
        {
            continue;
        }
        if(foundWithoutNormal == 0) {
            foundWithoutNormal = 1;
            bestWithoutNormal = colorSample;
        }
        vec3 texNormal = normalize(normalSample.xyz * 2.0 - 1.0);
        float dotProd = dot(fragNormal, texNormal);
        if(dotProd > threshold)
        {
            return colorSample;
        }
    }
    return bestWithoutNormal;
}
#endif
`};