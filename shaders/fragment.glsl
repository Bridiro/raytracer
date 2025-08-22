precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_camera_pos;
uniform float u_time;
uniform vec3 u_camera_forward;
uniform vec3 u_camera_right;
uniform vec3 u_camera_up;

// Scene data structures
struct Material {
    vec3 albedo;
    // 0: Lambertian, 1: Metal, 2: Dielectric
    int material_type;
    float roughness;
    float ior;
};

struct Sphere {
    vec3 center;
    float radius;
    vec3 albedo;
    int material_type;
    float roughness;
    float ior;
};

struct Plane {
    vec3 point;
    vec3 normal;
    vec3 albedo;
    int material_type;
};

struct Box {
    vec3 center;
    vec3 size;
    vec3 albedo;
    int material_type;
    float roughness;
    float ior;
};

struct Cylinder {
    vec3 base;
    vec3 axis;
    float radius;
    vec3 albedo;
    int material_type;
    float roughness;
    float ior;
};

struct Triangle {
    vec3 v0;
    vec3 v1;
    vec3 v2;
    vec3 albedo;
    int material_type;
    float roughness;
    float ior;
};

struct Light {
    vec3 position;
    vec3 color;
    float intensity;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct HitRecord {
    vec3 point;
    vec3 normal;
    float t;
    bool front_face;
    Material material;
};

// Scene uniforms
uniform int u_sphere_count;
uniform Sphere u_spheres[10];

uniform int u_plane_count;
uniform Plane u_planes[5];

uniform int u_box_count;
uniform Box u_boxes[5];

uniform int u_cylinder_count;
uniform Cylinder u_cylinders[5];

uniform int u_triangle_count;
uniform Triangle u_triangles[10];

uniform int u_light_count;
uniform Light u_lights[4];

varying vec2 v_texCoord;

// Pseudo-random number generator
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec3 randomInUnitSphere(vec2 seed) {
    vec3 p = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float fi = float(i);
        p = 2.0 * vec3(random(seed + fi), random(seed + fi + 1.0), random(seed + fi + 2.0)) - 1.0;
        if (dot(p, p) < 1.0) break;
    }
    return p;
}

vec3 reflectRay(vec3 v, vec3 n) {
    return v - 2.0 * dot(v, n) * n;
}

bool refract(vec3 uv, vec3 n, float ni_over_nt, out vec3 refracted) {
    float dt = dot(uv, n);
    float discriminant = 1.0 - ni_over_nt * ni_over_nt * (1.0 - dt * dt);
    if (discriminant > 0.0) {
        refracted = ni_over_nt * (uv - n * dt) - n * sqrt(discriminant);
        return true;
    }
    return false;
}

float schlick(float cosine, float ref_idx) {
    float r0 = (1.0 - ref_idx) / (1.0 + ref_idx);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

bool hitSphere(Sphere sphere, Ray ray, float t_min, float t_max, out HitRecord rec) {
    vec3 oc = ray.origin - sphere.center;
    float a = dot(ray.direction, ray.direction);
    float b = dot(oc, ray.direction);
    float c = dot(oc, oc) - sphere.radius * sphere.radius;
    float discriminant = b * b - a * c;
    
    if (discriminant > 0.0) {
        float temp = (-b - sqrt(discriminant)) / a;
        if (temp < t_max && temp > t_min) {
            rec.t = temp;
            rec.point = ray.origin + temp * ray.direction;
            vec3 outward_normal = (rec.point - sphere.center) / sphere.radius;
            rec.front_face = dot(ray.direction, outward_normal) < 0.0;
            rec.normal = rec.front_face ? outward_normal : -outward_normal;
            rec.material.albedo = sphere.albedo;
            rec.material.material_type = sphere.material_type;
            rec.material.roughness = sphere.roughness;
            rec.material.ior = sphere.ior;
            return true;
        }
        temp = (-b + sqrt(discriminant)) / a;
        if (temp < t_max && temp > t_min) {
            rec.t = temp;
            rec.point = ray.origin + temp * ray.direction;
            vec3 outward_normal = (rec.point - sphere.center) / sphere.radius;
            rec.front_face = dot(ray.direction, outward_normal) < 0.0;
            rec.normal = rec.front_face ? outward_normal : -outward_normal;
            rec.material.albedo = sphere.albedo;
            rec.material.material_type = sphere.material_type;
            rec.material.roughness = sphere.roughness;
            rec.material.ior = sphere.ior;
            return true;
        }
    }
    return false;
}

bool hitPlane(Plane plane, Ray ray, float t_min, float t_max, out HitRecord rec) {
    float denom = dot(plane.normal, ray.direction);
    if (abs(denom) > 0.0001) {
        float t = dot(plane.point - ray.origin, plane.normal) / denom;
        if (t >= t_min && t <= t_max) {
            rec.t = t;
            rec.point = ray.origin + t * ray.direction;
            rec.front_face = denom < 0.0;
            rec.normal = rec.front_face ? plane.normal : -plane.normal;
            rec.material.albedo = plane.albedo;
            rec.material.material_type = plane.material_type;
            rec.material.roughness = 0.0;
            rec.material.ior = 1.0;
            return true;
        }
    }
    return false;
}

bool hitBox(Box box_obj, Ray ray, float t_min, float t_max, out HitRecord rec) {
    vec3 m = 1.0 / ray.direction;
    vec3 n = m * (ray.origin - box_obj.center);
    vec3 k = abs(m) * box_obj.size * 0.5;
    
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    
    float t_near = max(max(t1.x, t1.y), t1.z);
    float t_far = min(min(t2.x, t2.y), t2.z);
    
    if (t_near > t_far || t_far < t_min || t_near > t_max) return false;
    
    float t = (t_near > t_min) ? t_near : t_far;
    if (t < t_min || t > t_max) return false;
    
    rec.t = t;
    rec.point = ray.origin + t * ray.direction;
    
    // Calculate normal
    vec3 d = (rec.point - box_obj.center) / (box_obj.size * 0.5);
    vec3 abs_d = abs(d);
    float max_component = max(max(abs_d.x, abs_d.y), abs_d.z);
    
    if (abs_d.x == max_component) {
        rec.normal = vec3(sign(d.x), 0.0, 0.0);
    } else if (abs_d.y == max_component) {
        rec.normal = vec3(0.0, sign(d.y), 0.0);
    } else {
        rec.normal = vec3(0.0, 0.0, sign(d.z));
    }
    
    rec.front_face = dot(ray.direction, rec.normal) < 0.0;
    rec.normal = rec.front_face ? rec.normal : -rec.normal;
    rec.material.albedo = box_obj.albedo;
    rec.material.material_type = box_obj.material_type;
    rec.material.roughness = box_obj.roughness;
    rec.material.ior = box_obj.ior;
    
    return true;
}

bool hitCylinder(Cylinder cylinder, Ray ray, float t_min, float t_max, out HitRecord rec) {
    vec3 oc = ray.origin - cylinder.base;
    vec3 axis = normalize(cylinder.axis);
    
    float a = dot(ray.direction, ray.direction) - dot(ray.direction, axis) * dot(ray.direction, axis);
    float b = 2.0 * (dot(oc, ray.direction) - dot(ray.direction, axis) * dot(oc, axis));
    float c = dot(oc, oc) - dot(oc, axis) * dot(oc, axis) - cylinder.radius * cylinder.radius;
    
    float discriminant = b * b - 4.0 * a * c;
    if (discriminant < 0.0) return false;
    
    float sqrt_discriminant = sqrt(discriminant);
    float t1 = (-b - sqrt_discriminant) / (2.0 * a);
    float t2 = (-b + sqrt_discriminant) / (2.0 * a);
    
    float t = (t1 >= t_min && t1 <= t_max) ? t1 : t2;
    if (t < t_min || t > t_max) return false;
    
    vec3 hit_point = ray.origin + t * ray.direction;
    float projection = dot(hit_point - cylinder.base, axis);
    float cylinder_length = length(cylinder.axis);
    
    if (projection < 0.0 || projection > cylinder_length) return false;
    
    rec.t = t;
    rec.point = hit_point;
    
    vec3 center_line_point = cylinder.base + projection * axis;
    rec.normal = normalize(hit_point - center_line_point);
    rec.front_face = dot(ray.direction, rec.normal) < 0.0;
    rec.normal = rec.front_face ? rec.normal : -rec.normal;
    rec.material.albedo = cylinder.albedo;
    rec.material.material_type = cylinder.material_type;
    rec.material.roughness = cylinder.roughness;
    rec.material.ior = cylinder.ior;
    
    return true;
}

bool hitTriangle(Triangle triangle, Ray ray, float t_min, float t_max, out HitRecord rec) {
    // Möller-Trumbore intersection algorithm (double-sided)
    vec3 edge1 = triangle.v1 - triangle.v0;
    vec3 edge2 = triangle.v2 - triangle.v0;
    vec3 h = cross(ray.direction, edge2);
    float a = dot(edge1, h);
    
    if (abs(a) < 0.00001) return false; // Ray is parallel to triangle
    
    float f = 1.0 / a;
    vec3 s = ray.origin - triangle.v0;
    float u = f * dot(s, h);
    
    if (u < 0.0 || u > 1.0) return false;
    
    vec3 q = cross(s, edge1);
    float v = f * dot(ray.direction, q);
    
    if (v < 0.0 || u + v > 1.0) return false;
    
    float t = f * dot(edge2, q);
    
    if (t < t_min || t > t_max) return false;
    
    rec.t = t;
    rec.point = ray.origin + t * ray.direction;
    
    // Calculate normal (ensure consistent orientation)
    vec3 normal = normalize(cross(edge1, edge2));
    rec.front_face = dot(ray.direction, normal) < 0.0;
    rec.normal = rec.front_face ? normal : -normal;
    
    rec.material.albedo = triangle.albedo;
    rec.material.material_type = triangle.material_type;
    rec.material.roughness = triangle.roughness;
    rec.material.ior = triangle.ior;
    
    return true;
}

bool hitWorld(Ray ray, float t_min, float t_max, out HitRecord rec) {
    HitRecord temp_rec;
    bool hit_anything = false;
    float closest_so_far = t_max;
    
    // Check spheres
    for (int i = 0; i < 10; i++) {
        if (i >= u_sphere_count) break;
        if (hitSphere(u_spheres[i], ray, t_min, closest_so_far, temp_rec)) {
            hit_anything = true;
            closest_so_far = temp_rec.t;
            rec = temp_rec;
        }
    }
    
    // Check planes
    for (int i = 0; i < 5; i++) {
        if (i >= u_plane_count) break;
        if (hitPlane(u_planes[i], ray, t_min, closest_so_far, temp_rec)) {
            hit_anything = true;
            closest_so_far = temp_rec.t;
            rec = temp_rec;
        }
    }
    
    // Check boxes
    for (int i = 0; i < 5; i++) {
        if (i >= u_box_count) break;
        if (hitBox(u_boxes[i], ray, t_min, closest_so_far, temp_rec)) {
            hit_anything = true;
            closest_so_far = temp_rec.t;
            rec = temp_rec;
        }
    }
    
    // Check cylinders
    for (int i = 0; i < 5; i++) {
        if (i >= u_cylinder_count) break;
        if (hitCylinder(u_cylinders[i], ray, t_min, closest_so_far, temp_rec)) {
            hit_anything = true;
            closest_so_far = temp_rec.t;
            rec = temp_rec;
        }
    }
    
    // Check triangles
    for (int i = 0; i < 10; i++) {
        if (i >= u_triangle_count) break;
        if (hitTriangle(u_triangles[i], ray, t_min, closest_so_far, temp_rec)) {
            hit_anything = true;
            closest_so_far = temp_rec.t;
            rec = temp_rec;
        }
    }
    
    return hit_anything;
}

vec3 rayColor(Ray ray, vec2 seed) {
    vec3 color = vec3(1.0);
    vec3 accumulated_color = vec3(0.0);
    
    for (int depth = 0; depth < 10; depth++) { // Increased depth for better quality
        HitRecord rec;
        if (hitWorld(ray, 0.001, 100.0, rec)) {
            
            if (rec.material.material_type == 0) { // Lambertian - Proper diffuse
                vec3 target = rec.point + rec.normal + randomInUnitSphere(seed + float(depth));
                ray.origin = rec.point;
                ray.direction = normalize(target - rec.point);
                
                // Proper lambertian shading with light integration
                vec3 light_contribution = vec3(0.0);
                for (int i = 0; i < 4; i++) {
                    if (i >= u_light_count) break;
                    vec3 light_dir = normalize(u_lights[i].position - rec.point);
                    float light_distance = length(u_lights[i].position - rec.point);
                    
                    // Shadow ray
                    Ray shadow_ray;
                    shadow_ray.origin = rec.point + rec.normal * 0.001;
                    shadow_ray.direction = light_dir;
                    HitRecord shadow_rec;
                    
                    if (!hitWorld(shadow_ray, 0.001, light_distance - 0.001, shadow_rec)) {
                        float cos_theta = max(dot(rec.normal, light_dir), 0.0);
                        float attenuation = 1.0 / (1.0 + 0.1 * light_distance + 0.01 * light_distance * light_distance);
                        light_contribution += u_lights[i].color * u_lights[i].intensity * cos_theta * attenuation;
                    }
                }
                
                // Combine direct lighting with indirect
                color *= rec.material.albedo * (0.1 + light_contribution); // 0.1 is ambient
                
            } else if (rec.material.material_type == 1) { // Metal - Proper reflection
                vec3 reflected = reflectRay(normalize(ray.direction), rec.normal);
                ray.origin = rec.point;
                ray.direction = normalize(reflected + rec.material.roughness * randomInUnitSphere(seed + float(depth)));
                
                if (dot(ray.direction, rec.normal) <= 0.0) {
                    return accumulated_color; // Ray absorbed
                }
                
                // Fresnel for metals
                float cos_theta = abs(dot(normalize(ray.direction), rec.normal));
                float fresnel = 0.04 + (1.0 - 0.04) * pow(1.0 - cos_theta, 5.0);
                color *= rec.material.albedo * fresnel;
                
            } else if (rec.material.material_type == 2) { // Glass - Proper refraction
                vec3 unit_direction = normalize(ray.direction);
                float cos_theta = min(dot(-unit_direction, rec.normal), 1.0);
                float sin_theta = sqrt(1.0 - cos_theta * cos_theta);
                
                float ni_over_nt = rec.front_face ? (1.0 / rec.material.ior) : rec.material.ior;
                bool cannot_refract = ni_over_nt * sin_theta > 1.0;
                
                // Schlick approximation for fresnel
                float r0 = (1.0 - rec.material.ior) / (1.0 + rec.material.ior);
                r0 = r0 * r0;
                float fresnel = r0 + (1.0 - r0) * pow(1.0 - cos_theta, 5.0);
                
                if (cannot_refract || fresnel > random(seed + float(depth))) {
                    // Reflect
                    vec3 reflected = reflectRay(unit_direction, rec.normal);
                    ray.origin = rec.point + rec.normal * 0.001;
                    ray.direction = reflected;
                } else {
                    // Refract
                    vec3 refracted;
                    if (refract(unit_direction, rec.normal, ni_over_nt, refracted)) {
                        ray.origin = rec.point - rec.normal * 0.001;
                        ray.direction = refracted;
                    } else {
                        vec3 reflected = reflectRay(unit_direction, rec.normal);
                        ray.origin = rec.point + rec.normal * 0.001;
                        ray.direction = reflected;
                    }
                }
                
                // Glass absorption (Beer's law approximation)
                if (!rec.front_face) {
                    float absorption = exp(-0.01 * rec.t);
                    color *= absorption * mix(vec3(1.0), rec.material.albedo, 0.05);
                } else {
                    color *= vec3(0.98); // Slight reflection loss
                }
            }
            
        } else {
            // Improved sky with sun
            vec3 unit_direction = normalize(ray.direction);
            float t = 0.5 * (unit_direction.y + 1.0);
            
            // Sky gradient
            vec3 sky_color = mix(vec3(1.0, 1.0, 1.0), vec3(0.5, 0.7, 1.0), t);
            
            // Add sun
            vec3 sun_dir = normalize(vec3(0.7, 0.7, 0.0));
            float sun_dot = max(dot(unit_direction, sun_dir), 0.0);
            if (sun_dot > 0.995) {
                sky_color += vec3(2.0, 1.8, 1.0) * pow(sun_dot, 100.0);
            }
            
            accumulated_color += color * sky_color;
            break;
        }
        
        // Russian roulette for path termination
        if (depth > 3) {
            float max_component = max(max(color.r, color.g), color.b);
            if (random(seed + float(depth + 100)) > max_component) {
                break;
            }
            color /= max_component;
        }
    }
    
    return accumulated_color;
}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    
    // Create ray direction using camera basis vectors
    vec3 ray_dir = normalize(u_camera_forward + uv.x * u_camera_right + uv.y * u_camera_up);

    Ray ray;
    ray.origin = u_camera_pos;
    ray.direction = ray_dir;

    // Reduced sampling for better performance
    vec3 color = vec3(0.0);

    for (int i = 0; i < 2; i++) {
        vec2 offset = vec2(float(i) * 0.5, fract(float(i) * 0.618)) / u_resolution;
        vec2 sample_uv = uv + offset;
        
        // Create ray direction using camera basis vectors
        vec3 sample_ray_dir = normalize(u_camera_forward + sample_uv.x * u_camera_right + sample_uv.y * u_camera_up);
        
        Ray sample_ray;
        sample_ray.origin = u_camera_pos;
        sample_ray.direction = sample_ray_dir;
        
        vec2 seed = gl_FragCoord.xy + u_time + float(i);
        color += rayColor(sample_ray, seed);
    }

    color /= 2.0;
    
    // Better tone mapping (ACES approximation)
    color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
    
    // Gamma correction
    color = pow(color, vec3(1.0/2.2));
    
    gl_FragColor = vec4(color, 1.0);
}
