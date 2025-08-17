use wasm_bindgen::prelude::*;
use web_sys::{WebGlProgram, WebGlRenderingContext};

use crate::webgl::create_shader;

pub fn create_raytracing_program(gl: &WebGlRenderingContext) -> Result<WebGlProgram, JsValue> {
    let vertex_shader_source = r#"
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_position * 0.5 + 0.5;
        }
    "#;

    let fragment_shader_source = r#"
        precision highp float;
        
        uniform vec2 u_resolution;
        uniform vec3 u_camera_pos;
        uniform mat4 u_camera_matrix;
        uniform float u_time;
        
        // Scene data structures
        struct Material {
            vec3 albedo;
            int material_type; // 0: Lambertian, 1: Metal, 2: Dielectric
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
            
            return hit_anything;
        }
        
        vec3 rayColor(Ray ray, vec2 seed) {
            vec3 color = vec3(1.0);
            vec3 attenuation;
            
            for (int depth = 0; depth < 8; depth++) {
                HitRecord rec;
                if (hitWorld(ray, 0.001, 100.0, rec)) {
                    // Improved lighting calculation
                    vec3 ambient = vec3(0.25); // Increased ambient light
                    vec3 diffuse = vec3(0.0);
                    
                    // Calculate lighting from all lights
                    for (int i = 0; i < 4; i++) {
                        if (i >= u_light_count) break;
                        
                        vec3 light_dir = normalize(u_lights[i].position - rec.point);
                        float light_distance = length(u_lights[i].position - rec.point);
                        
                        // Simple shadow test
                        Ray shadow_ray;
                        shadow_ray.origin = rec.point + rec.normal * 0.001;
                        shadow_ray.direction = light_dir;
                        
                        HitRecord shadow_rec;
                        bool in_shadow = hitWorld(shadow_ray, 0.001, light_distance - 0.001, shadow_rec);
                        
                        if (!in_shadow) {
                            float n_dot_l = max(dot(rec.normal, light_dir), 0.0);
                            float attenuation_factor = u_lights[i].intensity / (light_distance * light_distance + 1.0);
                            diffuse += u_lights[i].color * n_dot_l * attenuation_factor;
                        }
                    }
                    
                    vec3 lighting = ambient + diffuse;
                    color *= rec.material.albedo * lighting;
                    
                    // Material-based ray scattering
                    if (rec.material.material_type == 0) { // Lambertian
                        vec3 target = rec.point + rec.normal + randomInUnitSphere(seed + float(depth));
                        ray.origin = rec.point;
                        ray.direction = normalize(target - rec.point);
                        attenuation = rec.material.albedo;
                    } else if (rec.material.material_type == 1) { // Metal
                        vec3 reflected = reflectRay(normalize(ray.direction), rec.normal);
                        ray.origin = rec.point;
                        ray.direction = normalize(reflected + rec.material.roughness * randomInUnitSphere(seed + float(depth)));
                        attenuation = rec.material.albedo;
                        if (dot(ray.direction, rec.normal) <= 0.0) {
                            color = vec3(0.0);
                            break;
                        }
                    } else if (rec.material.material_type == 2) { // Dielectric
                        // Glass/dielectric materials
                        float ni_over_nt = rec.front_face ? (1.0 / rec.material.ior) : rec.material.ior;
                        
                        vec3 unit_direction = normalize(ray.direction);
                        float cos_theta = min(dot(-unit_direction, rec.normal), 1.0);
                        float sin_theta = sqrt(1.0 - cos_theta * cos_theta);
                        
                        if (ni_over_nt * sin_theta > 1.0) {
                            // Total internal reflection
                            vec3 reflected = reflectRay(unit_direction, rec.normal);
                            ray.origin = rec.point + rec.normal * 0.001;
                            ray.direction = reflected;
                        } else {
                            // Refraction vs reflection based on Fresnel equations
                            float reflect_prob = schlick(cos_theta, rec.material.ior);
                            if (random(seed + float(depth) * 10.0) < reflect_prob) {
                                // Reflection
                                vec3 reflected = reflectRay(unit_direction, rec.normal);
                                ray.origin = rec.point + rec.normal * 0.001;
                                ray.direction = reflected;
                            } else {
                                // Refraction
                                vec3 refracted;
                                if (refract(unit_direction, rec.normal, ni_over_nt, refracted)) {
                                    ray.origin = rec.point - rec.normal * 0.001;
                                    ray.direction = refracted;
                                } else {
                                    // Fallback to reflection if refraction fails
                                    vec3 reflected = reflectRay(unit_direction, rec.normal);
                                    ray.origin = rec.point + rec.normal * 0.001;
                                    ray.direction = reflected;
                                }
                            }
                        }
                        
                        // Glass absorbs very little light but can tint
                        attenuation = rec.material.albedo * 0.95 + vec3(0.05);
                    }
                    
                    color *= attenuation;
                } else {
                    // Sky gradient - simple blue to white gradient
                    float t = 0.5 * (normalize(ray.direction).y + 1.0);
                    vec3 sky_color = mix(vec3(1.0, 1.0, 1.0), vec3(0.5, 0.7, 1.0), t);
                    color *= sky_color;
                    break;
                }
            }
            
            return color;
        }
        
        void main() {
            vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
            uv.x *= u_resolution.x / u_resolution.y;
            
            // Create camera ray
            vec3 ray_dir = normalize(vec3(uv, -2.0)); // Simple perspective projection
            
            // Transform ray direction by camera matrix
            ray_dir = (u_camera_matrix * vec4(ray_dir, 0.0)).xyz;
            
            Ray ray;
            ray.origin = u_camera_pos;
            ray.direction = normalize(ray_dir);
            
            // Multi-sampling for anti-aliasing
            vec3 color = vec3(0.0);
            
            for (int i = 0; i < 4; i++) {
                vec2 offset = vec2(float(i) * 0.25, fract(float(i) * 0.618)) / u_resolution;
                vec2 sample_uv = uv + offset;
                
                vec3 sample_ray_dir = normalize(vec3(sample_uv, -2.0));
                sample_ray_dir = (u_camera_matrix * vec4(sample_ray_dir, 0.0)).xyz;
                
                Ray sample_ray;
                sample_ray.origin = u_camera_pos;
                sample_ray.direction = normalize(sample_ray_dir);
                
                vec2 seed = gl_FragCoord.xy + u_time + float(i);
                color += rayColor(sample_ray, seed);
            }
            
            color /= 4.0;
            
            // Tone mapping and gamma correction
            color = color / (color + vec3(1.0));
            color = pow(color, vec3(1.0/2.2));
            
            gl_FragColor = vec4(color, 1.0);
        }
    "#;

    let vertex_shader = create_shader(
        gl,
        WebGlRenderingContext::VERTEX_SHADER,
        vertex_shader_source,
    )?;
    let fragment_shader = create_shader(
        gl,
        WebGlRenderingContext::FRAGMENT_SHADER,
        fragment_shader_source,
    )?;

    let program = gl
        .create_program()
        .ok_or_else(|| JsValue::from_str("Failed to create program"))?;

    gl.attach_shader(&program, &vertex_shader);
    gl.attach_shader(&program, &fragment_shader);
    gl.link_program(&program);

    if gl
        .get_program_parameter(&program, WebGlRenderingContext::LINK_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        Ok(program)
    } else {
        Err(JsValue::from_str(
            &gl.get_program_info_log(&program)
                .unwrap_or_else(|| "Unknown error linking program".into()),
        ))
    }
}
