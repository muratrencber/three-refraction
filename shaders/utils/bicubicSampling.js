export const bicubicSamplingGLSL = {name:"bicubicSampling", code:`
#ifdef USE_BICUBIC_SAMPLING
#else
#define USE_BICUBIC_SAMPLING
#include <screenSize>
vec4 cubic(float v){
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    float w = 6.0 - x - y - z;
    return vec4(x, y, z, w) * (1.0/6.0);
}
#ifdef PRESERVE_NORMALS
vec4 samplePixelNormal(in sampler2D lowResTexture, in sampler2D normal, vec2 screenCoord, vec3 fragNormal, float threshold)
#else
vec4 samplePixelMask(in sampler2D lowResTexture, in sampler2D mask, vec2 screenCoord)
#endif
{
    vec2 invTexSize = 1.0 / lowResScreenSize;
    
    vec2 texCoords = screenCoord * lowResScreenSize - 0.5;
    
    vec2 fxy = fract(texCoords);
    texCoords -= fxy;

    vec4 xcubic = cubic(fxy.x);
    vec4 ycubic = cubic(fxy.y);

    vec4 c = texCoords.xxyy + vec2 (-0.5, +1.5).xyxy;
    
    vec4 s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);
    vec4 offset = c + vec4 (xcubic.yw, ycubic.yw) / s;
    
    offset *= invTexSize.xxyy;
    
    vec4 sample0 = texture(lowResTexture, offset.xz);
    vec4 sample1 = texture(lowResTexture, offset.yz);
    vec4 sample2 = texture(lowResTexture, offset.xw);
    vec4 sample3 = texture(lowResTexture, offset.yw);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
#ifdef PRESERVE_NORMALS
    vec4 normalData0 = texture(normal, offset.xz);
    vec4 normalData1 = texture(normal, offset.yz);
    vec4 normalData2 = texture(normal, offset.xw);
    vec4 normalData3 = texture(normal, offset.yw);

    vec3 normal0 = normalize(normalData0.xyz * 2.0 - 1.0);
    vec3 normal1 = normalize(normalData1.xyz * 2.0 - 1.0);
    vec3 normal2 = normalize(normalData2.xyz * 2.0 - 1.0);
    vec3 normal3 = normalize(normalData3.xyz * 2.0 - 1.0);

    float maskData3 = (1.0 - normalData3.a) * (dot(normal3, fragNormal) > threshold ? 1. : 0.);
    float maskData2 = (1.0 - normalData2.a) * (dot(normal2, fragNormal) > threshold ? 1. : 0.);
    float maskData1 = (1.0 - normalData1.a) * (dot(normal1, fragNormal) > threshold ? 1. : 0.);
    float maskData0 = (1.0 - normalData0.a) * (dot(normal0, fragNormal) > threshold ? 1. : 0.);

    float sx1 = maskData3 == 0. ? 1. : maskData2 == 0. ? 0. : sx;
    float sx2 = maskData1 == 0. ? 1. : maskData0 == 0. ? 0. : sx;

    float maskSum32 = maskData3 + maskData2;
    float maskSum10 = maskData1 + maskData0;

    sy = maskSum32 == 0. ? 1. : maskSum10 == 0. ? 0. : sy;
#else
    float maskData0 = 1.0 - texture(mask, offset.xz).a;
    float maskData1 = 1.0 - texture(mask, offset.yz).a;
    float maskData2 = 1.0 - texture(mask, offset.xw).a;
    float maskData3 = 1.0 - texture(mask, offset.yw).a;

    float sx1 = maskData3 == 0. ? 1. : maskData2 == 0. ? 0. : sx;
    float sx2 = maskData1 == 0. ? 1. : maskData0 == 0. ? 0. : sx;

    float maskSum32 = maskData3 + maskData2;
    float maskSum10 = maskData1 + maskData0;

    sy = maskSum32 == 0. ? 1. : maskSum10 == 0. ? 0. : sy;
#endif
    return mix(
       mix(sample3, sample2, sx), mix(sample1, sample0, sx)
    , sy);
}
#endif
`};