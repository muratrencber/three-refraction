export const bilinearSamplingGLSL = {name:"bilinearSampling", code:`
#ifdef USE_BILINEAR_SAMPLING
#else
#define USE_BILINEAR_SAMPLING
#include <screenSize>

#ifdef PRESERVE_NORMALS
vec4 samplePixelNormal(in sampler2D lowResTexture, in sampler2D normal, vec2 screenCoord, vec3 fragNormal, float threshold)
#else
vec4 samplePixelMask(in sampler2D lowResTexture, in sampler2D mask, vec2 screenCoord)
#endif
{
    vec2 texelSize = 1.0 / lowResScreenSize / 2.;
    vec2 bottomLeft = screenCoord - texelSize;
    vec2 topRight = screenCoord + texelSize;
    vec2 topLeft = vec2(bottomLeft.x, topRight.y);
    vec2 bottomRight = vec2(topRight.x, bottomLeft.y);

    vec4 bottomLeftColor = texture(lowResTexture, bottomLeft);
    vec4 topRightColor = texture(lowResTexture, topRight);
    vec4 topLeftColor = texture(lowResTexture, topLeft);
    vec4 bottomRightColor = texture(lowResTexture, bottomRight);
#ifdef PRESERVE_NORMALS
    vec4 bottomLeftNormalMaskData = texture(normal, bottomLeft);
    vec4 topRightNormalMaskData = texture(normal, topRight);
    vec4 topLeftNormalMaskData = texture(normal, topLeft);
    vec4 bottomRightNormalMaskData = texture(normal, bottomRight);

    vec3 bottomLeftNormal = normalize(bottomLeftNormalMaskData.xyz * 2.0 - 1.0);
    vec3 topRightNormal = normalize(topRightNormalMaskData.xyz * 2.0 - 1.0);
    vec3 topLeftNormal = normalize(topLeftNormalMaskData.xyz * 2.0 - 1.0);
    vec3 bottomRightNormal = normalize(bottomRightNormalMaskData.xyz * 2.0 - 1.0);

    float bottomLeftMask = (dot(bottomLeftNormal, fragNormal) > threshold ? 1. : 0.);
    float topRightMask = (dot(topRightNormal, fragNormal) > threshold ? 1. : 0.);
    float topLeftMask = (dot(topLeftNormal, fragNormal) > threshold ? 1. : 0.);
    float bottomRightMask = (dot(bottomRightNormal, fragNormal) > threshold ? 1. : 0.);
#else
    float bottomLeftMask = 1.0 - texture(mask, bottomLeft).a;
    float topRightMask = 1.0 - texture(mask, topRight).a;
    float topLeftMask = 1.0 - texture(mask, topLeft).a;
    float bottomRightMask = 1.0 - texture(mask, bottomRight).a;
#endif

    vec2 scaledScreenCord = screenCoord * lowResScreenSize;
    vec2 bottomLeftScreenCoord = floor(bottomLeft * lowResScreenSize) + 0.5;
    vec2 topRightScreenCoord = floor(topRight * lowResScreenSize) + 0.5;

    float xDistBottomLeft = max(0., scaledScreenCord.x - bottomLeftScreenCoord.x);
    float xDistBottomRight = max(0., topRightScreenCoord.x - scaledScreenCord.x);
    float xDistTopLeft = max(0., scaledScreenCord.x - bottomLeftScreenCoord.x);
    float xDistTopRight = max(0., topRightScreenCoord.x - scaledScreenCord.x);

    vec4 topColor = topLeftMask == 0. ? topRightColor : topRightMask == 0. ? topLeftColor : mix(topLeftColor, topRightColor, xDistTopLeft / (xDistTopLeft + xDistBottomRight));
    vec4 bottomColor = bottomLeftMask == 0. ? bottomRightColor : bottomRightMask == 0. ? bottomLeftColor : mix(bottomLeftColor, bottomRightColor, xDistBottomLeft / (xDistBottomLeft + xDistTopRight));

    float topMask = topLeftMask + topRightMask;
    float bottomMask = bottomLeftMask + bottomRightMask;
    vec4 finalColor = topMask == 0. ? bottomColor : bottomMask == 0. ? topColor : mix(bottomColor, topColor, bottomMask / (topMask + bottomMask));
    return finalColor;
}
#endif
`};