export const refractionFragmentGLSL = {name: "refractionFragment", code: `
#ifdef ACCELERATE_BVH
#include <bvhUtils>
#else defined(ACCELERATE_VOXEL_GRID)
#include <voxelGridUtils>
#else defined(ACCELERATE_SVO)
#include <svoUtils>
#endif

layout(location=0) out vec4 out1;
#if (BOUNCE_COUNT > 0 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER) || defined(TARGET_FINAL_RENDER) || defined(TARGET_REFRACTED_DIRECTIONS)
layout(location=1) out vec4 out2;
#endif
#if (BOUNCE_COUNT > 1 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)) || defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
layout(location=2) out vec4 out3;
#endif
#if (BOUNCE_COUNT > 2 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=3) out vec4 out4;
#endif
#if (BOUNCE_COUNT > 3 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=4) out vec4 out5;
#endif
#if (BOUNCE_COUNT > 4 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=5) out vec4 out6;
#endif
#if (BOUNCE_COUNT > 5 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=6) out vec4 out7;
#endif
#if (BOUNCE_COUNT > 6 && defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA))
layout(location=7) out vec4 out8;
#endif

uniform vec4 color;
uniform float roughness;
uniform samplerCube envMap;
uniform mat4 invMWorldMatrix;
uniform vec3 cameraPosition;
uniform float ior;
uniform float critical_cos;
uniform int bounceCount;

in vec2 texUV;
in vec3 vNormal;
in vec3 localPosition;
in mat4 mWorldMatrix;

float fresnel_schlick_tir(float F0, float cos_theta_incident, float cos_critical) {
    if (cos_theta_incident <= cos_critical)
        return 1.;
    return 1. - (F0 + (1. - F0) * pow(1. - cos_theta_incident, 5.));
}

void main() {
#ifdef UPSCALE_RENDER
    #ifdef PRESERVE_NORMALS
    out1 = vec4((vNormal + vec3(1.)) * 0.5, 0.0);
    #else
    out1 = vec4(0.0);
    #endif
#endif

    int targetBounceCount = bounceCount;
    #ifdef TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA
    targetBounceCount = bounceCount;
    #endif

    vec3 localCamPos = (invMWorldMatrix * vec4(cameraPosition, 1.0)).xyz;
    vec3 camDir = normalize(localPosition - localCamPos);
    vec3 refractDir = normalize(refract(camDir, normalize(vNormal), 1. / ior));
    float r0 = pow((1. - ior) / (1. + ior), 2.);
    float incident_cos = max(dot(camDir, vNormal), dot(-camDir, vNormal))
    float currentStrength = 1.0 - fresnel_schlick_tir(r0, incident_cos, critical_cos);

    vec3 newOrigin = localPosition + refDir * 0.01;
    vec3 newDir = refractDir;
#ifdef TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER || TARGET_FINAL_RENDER
    vec3 worldReflectedDirection = (mWorldMatrix * vec4(reflect(camDir, vNormal), 0.0)).xyz;
    vec4 fresnelColor = mix(texture(envMap, worldReflectedDirection), color, roughness);
    float currentFresnelStrength = 1. - currentStrength;
#endif

    for(int i = 0; i < targetBounceCount; i++) {
        if(currentStrength < 0.01) {
            break;
        }

        intersectionResult res = rayCast(newOrigin, newDir, -0.0, 5000.0);
        if(res.hit == 0) {
            break;
        }

        vec3 newReflectDir = reflect(newDir, res.normal);

        float fresnelStrength = fresnel_schlick_tir(r0, dot(newDir, res.normal), critical_cos);
#ifdef TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER | TARGET_FINAL_RENDER
        vec3 fresnelRefractDir = refract(newDir, res.normal, 1. / ior);
        float bounceFresnelStrength = (1.0 - fresnelStrength) * currentStrength;
        worldReflectedDirection = (mWorldMatrix * vec4(dir2, 0.0)).xyz;
        fresnelColor = (fresnelColor * currentFresnelStrength + texture(envMap, worldReflectedDirection) * bounceFresnelStrength);
        currentFresnelStrength += bounceFresnelStrength;
        fresnelColor /= currentFresnelStrength;
#endif
        currentStrength *= fresnelStrength;
        newOrigin += newDir * (res.t - 0.01);
        newDir = newReflectDir;
    }

#ifdef UPSCALE_RENDER
#ifdef TARGET_FINAL_RENDER
    worldReflectedDirection = (mWorldMatrix * vec4(newDir, 1.0)).xyz;
    vec4 finalColor = texture(envMap, worldReflectedDirection);
    out2 = out1;
    out1 = mix(finalColor, fresnelColor, currentStrength);
#elif defined(TARGET_REFRACTED_DIRECTIONS)
    worldReflectedDirection = normalize((mWorldMatrix * vec4(newDir, 1.0)).xyz);
    out2 = out1;
    out1 = vec4((worldReflectedDirection + vec3(1.)) * 0.5, 1.)
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_FRESNEL_RENDER)
    worldReflectedDirection = normalize((mWorldMatrix * vec4(newDir, 1.0)).xyz);
    out3 = out1;
    out1 = vec4((worldReflectedDirection + vec3(1.)) * 0.5, 1.);
    out2 = fresnelColor;
#elif defined(TARGET_REFRACTED_DIRECTIONS_WITH_BOUNCE_DATA)
#else
    worldReflectedDirection = (mWorldMatrix * vec4(newDir, 1.0)).xyz;
    vec4 finalColor = texture(envMap, worldReflectedDirection);
    out1 = mix(finalColor, fresnelColor, currentStrength);
#endif
`};;