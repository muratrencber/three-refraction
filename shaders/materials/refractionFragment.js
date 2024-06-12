export const refractionFragmentGLSL = {name: "refractionFragment", code: `
precision highp float;
precision highp int;

#include <fresnel>
#include <envMapUtils>

#ifdef ACCELERATE_BVH
#include <bvhUtils>
#elif defined(ACCELERATE_VOXEL_GRID)
#include <voxelGridUtils>
#elif defined(ACCELERATE_SVO)
#include <svoUtils>
#else
#include <primitiveIntersections>
intersectionResult rayCast(vec3 ro, vec3 rd, float tmin, float tmax) {
    intersectionResult res;
    res.hit = 0;
    return res;
}
#endif

layout(location=0) out vec4 out1;
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 0 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || defined(TARGET_FINAL_RENDER) || defined(TARGET_REFRACTED_DIRECTIONS)
layout(location=1) out vec4 out2;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 1 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
layout(location=2) out vec4 out3;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 2 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=3) out vec4 out4;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 3 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=4) out vec4 out5;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 4 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=5) out vec4 out6;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 5 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=6) out vec4 out7;
#endif
#if (defined(BOUNCE_COUNT) && BOUNCE_COUNT > 6 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=7) out vec4 out8;
#endif

uniform vec3 color;
uniform float roughness;
uniform mat4 invMWorldMatrix;
uniform vec3 cameraPosition;
uniform float ior;
uniform float critical_cos;
uniform int bounceCount;

in vec2 texUV;
in vec3 vNormal;
in vec3 localPosition;
in mat4 mWorldMatrix;

void main() {
#ifdef UPSCALE_RENDER
    #ifdef PRESERVE_NORMALS
    out1 = vec4((vNormal + 1.) / 2.0, 1.0);
    #else
    out1 = vec4(0.0);
    #endif
#endif

    int targetBounceCount = bounceCount;
    #ifdef TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA
    targetBounceCount = BOUNCE_COUNT;
    #endif

    vec4 colorVec = vec4(color, 1.0);

    vec3 localCamPos = (invMWorldMatrix * vec4(cameraPosition, 1.0)).xyz;
    vec3 camDir = normalize(localPosition - localCamPos);
    if(dot(camDir, -vNormal) < 0.) {
        targetBounceCount = 0;
    }
    vec3 refractDir = normalize(refract(camDir, normalize(vNormal), 1. / ior));
    float r0 = pow((1. - ior) / (1. + ior), 2.);
    float incident_cos = max(dot(-camDir, vNormal), dot(camDir, vNormal));
    float currentStrength = refractDir == vec3(0.) ? 0. : 1. - fresnel_schlick_tir(r0, incident_cos, 0.);
    float savedStrength = currentStrength;
    if(refractDir == vec3(0.)) 
        currentStrength = 0.;
    float initialStrength = currentStrength;

    highp vec3 newOrigin = localPosition + refractDir * 0.001;
    highp vec3 newDir = refractDir;
    int exitBounce = 0;
#if defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || defined(TARGET_FINAL_RENDER) || !defined(UPSCALE_RENDER)
    vec3 worldReflectedDirection = (mWorldMatrix * vec4(reflect(camDir, vNormal), 1.0)).xyz;
    float currentFresnelStrength = 1. - currentStrength;
    vec4 fresnelColor = sampleEnvMap(worldReflectedDirection) * currentFresnelStrength;
#endif

    int earlyout = 0;
#if defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)
    int bounceCount = 0;
    vec4 bounces[BOUNCE_COUNT];
#endif

    float reflectStrength = 0.;

    for(int i = 0; i < targetBounceCount; i++) {
#if defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
        if(currentStrength < 0.5) {
            break;
        }
#endif
        if(currentStrength < 0.1) {
            break;
        }

        intersectionResult res = rayCast(newOrigin, newDir, -0.0, 500000.0);
        if(res.hit == 0 || res.t < 0.0001) {
            earlyout = 1;
            break;
        }
        exitBounce = i + 1;

        vec3 newReflectDir = reflect(newDir, -res.normal);
        incident_cos = max(dot(-newDir, res.normal), dot(newDir, res.normal));
        float fresnelStrength = fresnel_schlick_tir(r0, incident_cos, critical_cos);
#if defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || defined(TARGET_FINAL_RENDER) || !defined(UPSCALE_RENDER)
        vec3 targetNormal = dot(newDir, res.normal) < 0. ? res.normal : -res.normal;
        vec3 fresnelRefractDir = refract(newDir, targetNormal, ior / 1.);
        float bounceFresnelStrength = fresnelRefractDir == vec3(0.) ? 0. : (1.0 - fresnelStrength) * currentStrength;
        reflectStrength = bounceFresnelStrength;
        worldReflectedDirection = (mWorldMatrix * vec4(fresnelRefractDir, 1.0)).xyz;
        vec4 contenderFresnel = sampleEnvMap(worldReflectedDirection);
        fresnelColor += contenderFresnel * bounceFresnelStrength;
#endif
        currentStrength *= fresnelStrength;
        newOrigin += newDir * (res.t - 0.001);
        newDir = newReflectDir;
        #if defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)
            bounces[bounceCount] = vec4(newDir, 1.);
            bounceCount++;
        #endif
    }

#ifdef UPSCALE_RENDER
#if defined(TARGET_FINAL_RENDER)
    worldReflectedDirection = (mWorldMatrix * vec4(newDir, 1.0)).xyz;
    vec4 finalColor = sampleEnvMap(newDir);
    out2 = out1;
    out1 = mix(finalColor, fresnelColor, 1. - currentStrength);
#elif defined(TARGET_REFRACTED_DIRECTIONS)
    vec3 worldReflectedDirection = normalize((mWorldMatrix * vec4(newDir, 1.0)).xyz);
    out2 = out1;
    out1 = vec4((worldReflectedDirection + vec3(1.)) * 0.5, 1.);
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
    worldReflectedDirection = normalize((mWorldMatrix * vec4(newDir, 1.0)).xyz);
    out3 = out1;
    out1 = vec4((worldReflectedDirection + vec3(1.)) * 0.5, 1.);
    out2 = vec4(fresnelColor.rgb, 1. - currentStrength);
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)
    for(int i = bounceCount; i < targetBounceCount; i++) {
        bounces[i] = vec4(0.);
    }
    for(int i = 0; i < bounceCount; i++) {
        vec3 bounceDir = bounces[i].xyz;
        vec4 newBounce = bounces[i];
        newBounce.rgb = (normalize((mWorldMatrix * vec4(bounceDir, 1.)).xyz) + 1.) * 0.5;
        newBounce.a = 1.;
        bounces[i] = newBounce;
    }
    vec4 maskData = out1;
    out2 = maskData;
    out1 = bounces[0];
#if BOUNCE_COUNT > 1
    out3 = maskData;
    out2 = bounces[1];
#endif
#if BOUNCE_COUNT > 2
    out4 = maskData;
    out3 = bounces[2];
#endif
#if BOUNCE_COUNT > 3
    out5 = maskData;
    out4 = bounces[3];
#endif
#if BOUNCE_COUNT > 4
    out6 = maskData;
    out5 = bounces[4];
#endif
#if BOUNCE_COUNT > 5
    out7 = maskData;
    out6 = bounces[5];
#endif
#if BOUNCE_COUNT > 6
    out8 = maskData;
    out7 = bounces[6];
#endif
#endif
#else
    worldReflectedDirection = (mWorldMatrix * vec4(newDir, 1.0)).xyz;
    vec4 finalColor = sampleEnvMap(newDir);
    out1 = mix(finalColor, fresnelColor, 1. - currentStrength);
#endif
}
`};;