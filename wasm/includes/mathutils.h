#define EPSILON 0.0001
#include <cmath>

struct Vec3
{
    float x, y, z;

    Vec3(): x(0), y(0), z(0) {}
    Vec3(float x, float y, float z): x(x), y(y), z(z) {}
    
    float operator[](int i) const
    {
        return i == 0 ? x : (i == 1 ? y : z);
    }

    float& operator[](int i)
    {
        return i == 0 ? x : (i == 1 ? y : z);
    }

    Vec3 operator+(const Vec3& other) const
    {
        Vec3 v;
        v.x = x + other.x;
        v.y = y + other.y;
        v.z = z + other.z;
        return v;
    }

    Vec3 operator-(const Vec3& other) const
    {
        Vec3 v;
        v.x = x - other.x;
        v.y = y - other.y;
        v.z = z - other.z;
        return v;
    }

    Vec3 operator*(float scalar) const
    {
        Vec3 v;
        v.x = x * scalar;
        v.y = y * scalar;
        v.z = z * scalar;
        return v;
    }

    Vec3 operator/(float scalar) const
    {
        Vec3 v;
        v.x = x / scalar;
        v.y = y / scalar;
        v.z = z / scalar;
        return v;
    }

    Vec3 invApproximate() const
    {
        Vec3 v = *this;
        if(v.x <= EPSILON && v.x >= -EPSILON) v.x = EPSILON * (v.x < 0 ? -1 : 1);
        if(v.y <= EPSILON && v.y >= -EPSILON) v.y = EPSILON * (v.y < 0 ? -1 : 1);
        if(v.z <= EPSILON && v.z >= -EPSILON) v.z = EPSILON * (v.z < 0 ? -1 : 1);
        return {1.0f / v.x, 1.0f / v.y, 1.0f / v.z};
    }

    Vec3 cross(const Vec3& other) const
    {
        Vec3 v;
        v.x = y * other.z - z * other.y;
        v.y = z * other.x - x * other.z;
        v.z = x * other.y - y * other.x;
        return v;
    }

    void add(const Vec3 other)
    {
        x += other.x;
        y += other.y;
        z += other.z;
    }

    void sub(const Vec3 other)
    {
        x -= other.x;
        y -= other.y;
        z -= other.z;
    }

    void add(float x, float y, float z)
    {
        this->x += x;
        this->y += y;
        this->z += z;
    }

    void add(float value)
    {
        this->x += value;
        this->y += value;
        this->z += value;
    }

    void sub(float x, float y, float z)
    {
        this->x -= x;
        this->y -= y;
        this->z -= z;
    }

    void sub(float value)
    {
        this->x -= value;
        this->y -= value;
        this->z -= value;
    }

    void zero()
    {
        x = 0;
        y = 0;
        z = 0;
    }

    float dot(const Vec3& other) const
    {
        return x * other.x + y * other.y + z * other.z;
    }

    float length() const
    {
        return sqrt(x * x + y * y + z * z);
    }

    Vec3 normalized() const
    {
        float l = length();
        return (*this) / l;
    }

    void min(float x, float y, float z)
    {
        this->x = this->x < x ? this->x : x;
        this->y = this->y < y ? this->y : y;
        this->z = this->z < z ? this->z : z;
    }

    void max(float x, float y, float z)
    {
        this->x = this->x > x ? this->x : x;
        this->y = this->y > y ? this->y : y;
        this->z = this->z > z ? this->z : z;
    }

    float maxComponent() const
    {
        return x > y ? (x > z ? x : z) : (y > z ? y : z);
    }
};

Vec3 cross(const Vec3& a, const Vec3& b)
{
    return a.cross(b);
}

float dot(const Vec3& a, const Vec3& b)
{
    return a.dot(b);
}

Vec3 normalize(const Vec3& a)
{
    return a.normalized();
}

struct Intersection
{
    bool hit;
    float t;
    Vec3 normal;
};

struct Bounds
{
    Vec3 min, max;

    void unionWithOther(const Bounds& other)
    {
        min.x = min.x < other.min.x ? min.x : other.min.x;
        min.y = min.y < other.min.y ? min.y : other.min.y;
        min.z = min.z < other.min.z ? min.z : other.min.z;
        max.x = max.x > other.max.x ? max.x : other.max.x;
        max.y = max.y > other.max.y ? max.y : other.max.y;
        max.z = max.z > other.max.z ? max.z : other.max.z;
    }

    void unionWithPoint(const Vec3& point)
    {
        min.x = min.x < point.x ? min.x : point.x;
        min.y = min.y < point.y ? min.y : point.y;
        min.z = min.z < point.z ? min.z : point.z;
        max.x = max.x > point.x ? max.x : point.x;
        max.y = max.y > point.y ? max.y : point.y;
        max.z = max.z > point.z ? max.z : point.z;
    }

    Bounds clone() const
    {
        Bounds b;
        b.min = min;
        b.max = max;
        return b;
    }

    float surfaceArea() const
    {
        Vec3 d = {max.x - min.x, max.y - min.y, max.z - min.z};
        return 2.0f * (d.x * d.y + d.y * d.z + d.z * d.x);
    }

    int maxDimension() const
    {
        Vec3 d = {max.x - min.x, max.y - min.y, max.z - min.z};
        if(d.x > d.y && d.x > d.z) return 0;
        if(d.y > d.z) return 1;
        return 2;
    }

    Vec3 offset(Vec3 point) const
    {
        Vec3 o = point - min;
        Vec3 d = max - min;
        o.x /= d.x;
        o.y /= d.y;
        o.z /= d.z;
        return o;
    }

    Vec3 centroid() const
    {
        Vec3 c;
        c.x = (min.x + max.x) / 2.0f;
        c.y = (min.y + max.y) / 2.0f;
        c.z = (min.z + max.z) / 2.0f;
        return c;
    }

    Intersection intersectRay(Vec3 rayOrigin, Vec3 rayDirection, float tmin, float tmax) const
    {
        Vec3 invDir = rayDirection.invApproximate();
        return intersectRayInvDir(rayOrigin, invDir, tmin, tmax);
    }

    Intersection intersectRayInvDir(Vec3 rayOrigin, Vec3 invDir, float tmin, float tmax) const
    {
        Vec3 corners[2] = {min, max};
        Intersection result;
        result.hit = false;

        for (int d = 0; d < 3; ++d) {
            int sign = invDir[d] < 0. ? 1 : 0;
            float bmin = corners[sign][d];
            float bmax = corners[1 - sign][d];

            float dmin = (bmin - rayOrigin[d]) * invDir[d];
            float dmax = (bmax - rayOrigin[d]) * invDir[d];

            tmin = dmin > tmin ? dmin : tmin;
            tmax = dmax < tmax ? dmax : tmax;
        }

        result.hit = tmin <= tmax;
        result.t = tmin;
        return result;
    }
};

struct Triangle
{
    Vec3 p1, p2, p3;

    Bounds boundingBox() const
    {
        Bounds b;
        b.min = p1;
        b.max = p1;
        b.unionWithPoint(p2);
        b.unionWithPoint(p3);
        return b;
    }

    Vec3 centroid() const
    {
        return boundingBox().centroid();
    }

    Intersection intersectRay(Vec3 rayOrigin, Vec3 rayDir, float tMin, float tMax) {
        Vec3 edge1 = p3 - p1;
        Vec3 edge2 = p2 - p1;
        Intersection result;
        result.hit = false;

        Vec3 pvec = cross(rayDir, edge2);
        float det = dot(edge1, pvec);
        if(det > -0.0001 && det < 0.0001)
        {
            return result;
        }
        float invDet = 1.0 / det;

        Vec3 tvec = rayOrigin - p1;
        float u = dot(tvec, pvec) * invDet;
        if(u < 0.0 || u > 1.0)
        {
            return result;
        }
        Vec3 qvec = cross(tvec, edge1);
        float v = dot(rayDir, qvec) * invDet;
        if(v < 0.0 || u + v > 1.0)
        {
            return result;
        }
        float t = dot(edge2, qvec) * invDet;
        result.t = t;
        result.normal = normalize(cross(edge1, edge2));
        result.hit = t >= tMin && t <= tMax;
        return result;
    }
};
