export const upscaleFragmentGLSL = {name:"upscaleFragment", code:`
precision highp float;
#include <screenSize>
#include <envMapUtils>
#include <fresnel>
#ifdef BILINEAR_FILTERING
#include <bilinearSampling>
#endif
#ifdef NN_FILTERING
#include <nnSampling>
#endif
#ifdef BICUBIC_FILTERING
#include <bicubicSampling>
#endif

in vec3 localNormal;
in vec3 localPosition;
in mat4 worldMatrix;

out vec4 fragColor;
uniform sampler2D tex1;
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 0 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || defined(TARGET_FINAL_RENDER) || defined(TARGET_REFRACTED_DIRECTIONS)
    uniform sampler2D tex2;
    #endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 1 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
    uniform sampler2D tex3;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 2 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
    uniform sampler2D tex4;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 3 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
    uniform sampler2D tex5;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 4 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
    uniform sampler2D tex6;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 5 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
    uniform sampler2D tex7;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 6 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
    uniform sampler2D tex8;
#endif

#if (defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 1) || defined(TARGET_FINAL_RENDER) || defined(TARGET_REFRACTED_DIRECTIONS)
    #define MASK_TEX tex2
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || (defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 2)
    #define MASK_TEX tex3
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 3
    #define MASK_TEX tex4
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 4
    #define MASK_TEX tex5
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 5
    #define MASK_TEX tex6
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 6
    #define MASK_TEX tex7
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA) && BOUNCE_COUNT == 7
    #define MASK_TEX tex8
#endif

#ifdef HW_FILTERING
    #define SAMPLE_TEX(targetTex, coord) texture(targetTex, coord)
#else
    #ifdef PRESERVE_NORMALS
        #define SAMPLE_TEX(targetTex, coord) samplePixelNormal(targetTex, MASK_TEX, coord, localNormal, NORMAL_THRESHOLD)
    #else
        #define SAMPLE_TEX(targetTex, coord) samplePixelMask(targetTex, MASK_TEX, coord)
    #endif
#endif

uniform float ior;
uniform vec3 cameraPosition;
uniform float critical_cos;

void main()
{
    vec2 fragCoord = gl_FragCoord.xy / screenSize;
    fragCoord *= lowResScreenSize / screenSize;
#ifdef TARGET_FINAL_RENDER
    vec4 col = SAMPLE_TEX(tex1, fragCoord);
#elif defined(TARGET_REFRACTED_DIRECTIONS)
    vec4 col = vec4(0.,1.,0.,1.);
    vec3 worldNormal = normalize((worldMatrix * vec4(localNormal, 1.)).xyz);
    vec3 worldPosition = (worldMatrix * vec4(localPosition, 1.)).xyz;
    vec3 camDir = normalize(worldPosition - cameraPosition);
    float F0 = pow((1. - ior) / (1. + ior), 2.);
    float reflectStrength = fresnel_schlick_tir(F0, dot(camDir, -worldNormal), 0.);
    vec3 reflected = reflect(camDir, worldNormal);
    vec3 refracted = SAMPLE_TEX(tex1, fragCoord).xyz * 2. - 1.;
    vec4 reflectSampled = sampleEnvMap(reflected);
    vec4 refractSampled = sampleEnvMap(refracted);
    col.rgb = mix(reflectSampled.rgb, refractSampled.rgb, 1. - reflectStrength);
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
    vec4 col = vec4(0.,1.,0.,1.);
    vec3 refracted = SAMPLE_TEX(tex1, fragCoord).xyz * 2. - 1.;
    vec4 fresnelData = SAMPLE_TEX(tex2, fragCoord);
    float reflectStrength = fresnelData.a;
    fresnelData.a = 1.;
    vec4 refractSampled = sampleEnvMap(refracted);
    col = mix(refractSampled, fresnelData, reflectStrength);
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)
    vec4 bounces[BOUNCE_COUNT];
    bounces[0] = SAMPLE_TEX(tex1, fragCoord);
    #if BOUNCE_COUNT > 1
        bounces[1] = SAMPLE_TEX(tex2, fragCoord);
    #endif
    #if BOUNCE_COUNT > 2
        bounces[2] = SAMPLE_TEX(tex3, fragCoord);
    #endif
    #if BOUNCE_COUNT > 3
        bounces[3] = SAMPLE_TEX(tex4, fragCoord);
    #endif
    #if BOUNCE_COUNT > 4
        bounces[4] = SAMPLE_TEX(tex5, fragCoord);
    #endif
    #if BOUNCE_COUNT > 5
        bounces[5] = SAMPLE_TEX(tex6, fragCoord);
    #endif
    #if BOUNCE_COUNT > 6
        bounces[6] = SAMPLE_TEX(tex7, fragCoord);
    #endif
    vec4 col = vec4(0.,1.,0.,1.);
    vec3 worldNormal = normalize((worldMatrix * vec4(localNormal, 1.)).xyz);
    vec3 worldPosition = (worldMatrix * vec4(localPosition, 1.)).xyz;
    vec3 camDir = normalize(worldPosition - cameraPosition);
    float F0 = pow((1. - ior) / (1. + ior), 2.);
    float reflectStrength = fresnel_schlick_tir(F0, dot(camDir, -worldNormal), 0.);
    float refractStrength = 1. - reflectStrength;
    vec3 reflected = reflect(camDir, worldNormal);
    vec4 fresnelColor = sampleEnvMap(reflected) * (reflectStrength);
    vec3 rayDir = refract(camDir, -worldNormal, 1. / ior);
    for(int i = 0; i < BOUNCE_COUNT; i++)
    {
        if(bounces[i].a < 0.01)
            break;
        vec3 newRayDir = bounces[i].xyz * 2. - 1.;
        vec3 hitNormal = normalize((rayDir - newRayDir) * 0.5);
        float incident_cos = dot(-rayDir, hitNormal);
        float fresnelStrength = fresnel_schlick_tir(F0, incident_cos, critical_cos);
        vec3 refractDir = refract(rayDir, hitNormal, ior / 1.);
        float exitStrength = refractDir == vec3(0.) ? 0. : (1.0 - fresnelStrength) * refractStrength;
        fresnelColor += sampleEnvMap(rayDir) * exitStrength;
        rayDir = newRayDir;
        refractStrength *= fresnelStrength;
    }
    col.rgb = mix(fresnelColor, sampleEnvMap(rayDir), refractStrength).rgb;
#endif
    col.rgb = pow(col.rgb, vec3(1.0 / 2.2));
    fragColor = col;
}
`};