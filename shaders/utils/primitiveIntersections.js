export const primitiveIntersectionsGLSL = {name:"primitiveIntersections", code: `
#ifdef USE_PRIM_INTERSECTION
#else
#define USE_PRIM_INTERSECTION
#include <struct_intersection>
intersectionResult intersectPlane(ray r, plane p)
{
    intersectionResult result;
    vec3 planeToRay = r.origin - p.point;
    float denom = dot(p.normal, r.direction);
    if(denom < 0.0001 && denom > -0.0001)
    {
        result.hit = 0;
        return result;
    }
    float t = dot(-planeToRay, p.normal) / denom;
    result.t = t;
    result.point = r.origin + t * r.direction;
    result.normal = p.normal;
    result.hit = t >= 0.0 ? 1 : 0;
}

intersectionResult intersectTriangle(ray r, triangle t)
{
    intersectionResult result;
    result.hit = 0;
    vec3 edge1 = t.v1 - t.v0;
    vec3 edge2 = t.v2 - t.v0;

    vec3 pvec = cross(r.direction, edge2);
    float det = dot(edge1, pvec);
    if(det > -0.0001 && det < 0.0001)
    {
        return result;
    }
    float invDet = 1.0 / det;

    vec3 tvec = r.origin - t.v0;
    float u = dot(tvec, pvec) * invDet;
    if(u < 0.0 || u > 1.0)
    {
        return result;
    }
    vec3 qvec = cross(tvec, edge1);
    float v = dot(r.direction, qvec) * invDet;
    if(v < 0.0 || u + v > 1.0)
    {
        return result;
    }
    float resT = dot(edge2, qvec) * invDet;
    result.t = resT;
    result.point = r.origin + resT * r.direction;
    result.normal = normalize(cross(edge1, edge2));
    result.hit = resT >= 0.0 ? 1 : 0;
    return result;
}
#endif
`};