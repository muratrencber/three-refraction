export const fresnelGLSL = {name:"fresnel", code:`
#ifdef USE_FRESNEL
#else
#define USE_FRESNEL
float fresnel_schlick_tir(float F0, float cos_theta_incident, float cos_critical) {
    if (cos_theta_incident <= cos_critical)
        return 1.;
    return (F0 + (1. - F0) * pow(1. - cos_theta_incident, 5.));
}
#endif
`};