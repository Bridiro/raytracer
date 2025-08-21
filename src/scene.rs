use crate::material::Material;
use crate::math::Vec3;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::{WebGlProgram, WebGlRenderingContext};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Sphere {
    pub center: Vec3,
    pub radius: f32,
    pub material: Material,
}

impl Sphere {
    pub fn new(center: Vec3, radius: f32, material: Material) -> Self {
        Self {
            center,
            radius,
            material,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Plane {
    pub point: Vec3,
    pub normal: Vec3,
    pub material: Material,
}

impl Plane {
    pub fn new(point: Vec3, normal: Vec3, material: Material) -> Self {
        Self {
            point,
            normal: normal.normalize(),
            material,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Box {
    pub center: Vec3,
    pub size: Vec3, // width, height, depth
    pub material: Material,
}

impl Box {
    pub fn new(center: Vec3, size: Vec3, material: Material) -> Self {
        Self {
            center,
            size,
            material,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cylinder {
    pub base: Vec3,
    pub axis: Vec3, // direction and length
    pub radius: f32,
    pub material: Material,
}

impl Cylinder {
    pub fn new(base: Vec3, axis: Vec3, radius: f32, material: Material) -> Self {
        Self {
            base,
            axis,
            radius,
            material,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Triangle {
    pub v0: Vec3,
    pub v1: Vec3,
    pub v2: Vec3,
    pub material: Material,
}

impl Triangle {
    pub fn new(v0: Vec3, v1: Vec3, v2: Vec3, material: Material) -> Self {
        Self {
            v0,
            v1,
            v2,
            material,
        }
    }
    
    pub fn normal(&self) -> Vec3 {
        let edge1 = self.v1 - self.v0;
        let edge2 = self.v2 - self.v0;
        edge1.cross(&edge2).normalize()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Light {
    pub position: Vec3,
    pub color: Vec3,
    pub intensity: f32,
}

impl Light {
    pub fn new(position: Vec3, color: Vec3, intensity: f32) -> Self {
        Self {
            position,
            color,
            intensity,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Scene {
    pub spheres: Vec<Sphere>,
    pub planes: Vec<Plane>,
    pub boxes: Vec<Box>,
    pub cylinders: Vec<Cylinder>,
    pub triangles: Vec<Triangle>,
    pub lights: Vec<Light>,
    pub background_color: Vec3,
}

impl Scene {
    pub fn new() -> Self {
        Self {
            spheres: Vec::new(),
            planes: Vec::new(),
            boxes: Vec::new(),
            cylinders: Vec::new(),
            triangles: Vec::new(),
            lights: Vec::new(),
            background_color: Vec3::new(0.5, 0.7, 1.0), // Sky blue
        }
    }

    pub fn add_sphere(&mut self, sphere: Sphere) {
        self.spheres.push(sphere);
    }

    pub fn add_plane(&mut self, plane: Plane) {
        self.planes.push(plane);
    }
    
    pub fn add_box(&mut self, box_obj: Box) {
        self.boxes.push(box_obj);
    }
    
    pub fn add_cylinder(&mut self, cylinder: Cylinder) {
        self.cylinders.push(cylinder);
    }
    
    pub fn add_triangle(&mut self, triangle: Triangle) {
        self.triangles.push(triangle);
    }

    pub fn add_light(&mut self, light: Light) {
        self.lights.push(light);
    }

    pub fn set_background(&mut self, color: Vec3) {
        self.background_color = color;
    }

    pub fn set_uniforms(
        &self,
        gl: &WebGlRenderingContext,
        program: &WebGlProgram,
    ) -> Result<(), JsValue> {
        // Set sphere data
        let sphere_count = self.spheres.len().min(10); // Limit to 10 spheres for WebGL uniforms

        let sphere_count_location = gl.get_uniform_location(program, "u_sphere_count");
        gl.uniform1i(sphere_count_location.as_ref(), sphere_count as i32);

        for (i, sphere) in self.spheres.iter().take(10).enumerate() {
            let center_location =
                gl.get_uniform_location(program, &format!("u_spheres[{}].center", i));
            gl.uniform3f(
                center_location.as_ref(),
                sphere.center.x,
                sphere.center.y,
                sphere.center.z,
            );

            let radius_location =
                gl.get_uniform_location(program, &format!("u_spheres[{}].radius", i));
            gl.uniform1f(radius_location.as_ref(), sphere.radius);

            let albedo_location =
                gl.get_uniform_location(program, &format!("u_spheres[{}].albedo", i));
            gl.uniform3f(
                albedo_location.as_ref(),
                sphere.material.albedo.x,
                sphere.material.albedo.y,
                sphere.material.albedo.z,
            );

            let material_type_location =
                gl.get_uniform_location(program, &format!("u_spheres[{}].material_type", i));
            let material_type = match sphere.material.material_type {
                crate::material::MaterialType::Lambertian => 0,
                crate::material::MaterialType::Metal => 1,
                crate::material::MaterialType::Dielectric => 2,
            };
            gl.uniform1i(material_type_location.as_ref(), material_type);

            let roughness_location =
                gl.get_uniform_location(program, &format!("u_spheres[{}].roughness", i));
            gl.uniform1f(roughness_location.as_ref(), sphere.material.roughness);

            let ior_location = gl.get_uniform_location(program, &format!("u_spheres[{}].ior", i));
            gl.uniform1f(ior_location.as_ref(), sphere.material.ior);
        }

        // Set plane data
        let plane_count = self.planes.len().min(5); // Limit to 5 planes

        let plane_count_location = gl.get_uniform_location(program, "u_plane_count");
        gl.uniform1i(plane_count_location.as_ref(), plane_count as i32);

        for (i, plane) in self.planes.iter().take(5).enumerate() {
            let point_location =
                gl.get_uniform_location(program, &format!("u_planes[{}].point", i));
            gl.uniform3f(
                point_location.as_ref(),
                plane.point.x,
                plane.point.y,
                plane.point.z,
            );

            let normal_location =
                gl.get_uniform_location(program, &format!("u_planes[{}].normal", i));
            gl.uniform3f(
                normal_location.as_ref(),
                plane.normal.x,
                plane.normal.y,
                plane.normal.z,
            );

            let albedo_location =
                gl.get_uniform_location(program, &format!("u_planes[{}].albedo", i));
            gl.uniform3f(
                albedo_location.as_ref(),
                plane.material.albedo.x,
                plane.material.albedo.y,
                plane.material.albedo.z,
            );

            let material_type_location =
                gl.get_uniform_location(program, &format!("u_planes[{}].material_type", i));
            let material_type = match plane.material.material_type {
                crate::material::MaterialType::Lambertian => 0,
                crate::material::MaterialType::Metal => 1,
                crate::material::MaterialType::Dielectric => 2,
            };
            gl.uniform1i(material_type_location.as_ref(), material_type);
        }

        // Set box data
        let box_count = self.boxes.len().min(5); // Limit to 5 boxes
        let box_count_location = gl.get_uniform_location(program, "u_box_count");
        gl.uniform1i(box_count_location.as_ref(), box_count as i32);

        for (i, box_obj) in self.boxes.iter().take(5).enumerate() {
            let center_location = gl.get_uniform_location(program, &format!("u_boxes[{}].center", i));
            gl.uniform3f(
                center_location.as_ref(),
                box_obj.center.x,
                box_obj.center.y,
                box_obj.center.z,
            );

            let size_location = gl.get_uniform_location(program, &format!("u_boxes[{}].size", i));
            gl.uniform3f(
                size_location.as_ref(),
                box_obj.size.x,
                box_obj.size.y,
                box_obj.size.z,
            );

            let albedo_location = gl.get_uniform_location(program, &format!("u_boxes[{}].albedo", i));
            gl.uniform3f(
                albedo_location.as_ref(),
                box_obj.material.albedo.x,
                box_obj.material.albedo.y,
                box_obj.material.albedo.z,
            );

            let material_type_location = gl.get_uniform_location(program, &format!("u_boxes[{}].material_type", i));
            let material_type = match box_obj.material.material_type {
                crate::material::MaterialType::Lambertian => 0,
                crate::material::MaterialType::Metal => 1,
                crate::material::MaterialType::Dielectric => 2,
            };
            gl.uniform1i(material_type_location.as_ref(), material_type);

            let roughness_location = gl.get_uniform_location(program, &format!("u_boxes[{}].roughness", i));
            gl.uniform1f(roughness_location.as_ref(), box_obj.material.roughness);

            let ior_location = gl.get_uniform_location(program, &format!("u_boxes[{}].ior", i));
            gl.uniform1f(ior_location.as_ref(), box_obj.material.ior);
        }

        // Set cylinder data
        let cylinder_count = self.cylinders.len().min(5); // Limit to 5 cylinders
        let cylinder_count_location = gl.get_uniform_location(program, "u_cylinder_count");
        gl.uniform1i(cylinder_count_location.as_ref(), cylinder_count as i32);

        for (i, cylinder) in self.cylinders.iter().take(5).enumerate() {
            let base_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].base", i));
            gl.uniform3f(
                base_location.as_ref(),
                cylinder.base.x,
                cylinder.base.y,
                cylinder.base.z,
            );

            let axis_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].axis", i));
            gl.uniform3f(
                axis_location.as_ref(),
                cylinder.axis.x,
                cylinder.axis.y,
                cylinder.axis.z,
            );

            let radius_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].radius", i));
            gl.uniform1f(radius_location.as_ref(), cylinder.radius);

            let albedo_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].albedo", i));
            gl.uniform3f(
                albedo_location.as_ref(),
                cylinder.material.albedo.x,
                cylinder.material.albedo.y,
                cylinder.material.albedo.z,
            );

            let material_type_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].material_type", i));
            let material_type = match cylinder.material.material_type {
                crate::material::MaterialType::Lambertian => 0,
                crate::material::MaterialType::Metal => 1,
                crate::material::MaterialType::Dielectric => 2,
            };
            gl.uniform1i(material_type_location.as_ref(), material_type);

            let roughness_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].roughness", i));
            gl.uniform1f(roughness_location.as_ref(), cylinder.material.roughness);

            let ior_location = gl.get_uniform_location(program, &format!("u_cylinders[{}].ior", i));
            gl.uniform1f(ior_location.as_ref(), cylinder.material.ior);
        }

        // Set triangle data
        let triangle_count = self.triangles.len().min(10); // Limit to 10 triangles
        let triangle_count_location = gl.get_uniform_location(program, "u_triangle_count");
        gl.uniform1i(triangle_count_location.as_ref(), triangle_count as i32);

        for (i, triangle) in self.triangles.iter().take(10).enumerate() {
            let v0_location = gl.get_uniform_location(program, &format!("u_triangles[{}].v0", i));
            gl.uniform3f(
                v0_location.as_ref(),
                triangle.v0.x,
                triangle.v0.y,
                triangle.v0.z,
            );

            let v1_location = gl.get_uniform_location(program, &format!("u_triangles[{}].v1", i));
            gl.uniform3f(
                v1_location.as_ref(),
                triangle.v1.x,
                triangle.v1.y,
                triangle.v1.z,
            );

            let v2_location = gl.get_uniform_location(program, &format!("u_triangles[{}].v2", i));
            gl.uniform3f(
                v2_location.as_ref(),
                triangle.v2.x,
                triangle.v2.y,
                triangle.v2.z,
            );

            let albedo_location = gl.get_uniform_location(program, &format!("u_triangles[{}].albedo", i));
            gl.uniform3f(
                albedo_location.as_ref(),
                triangle.material.albedo.x,
                triangle.material.albedo.y,
                triangle.material.albedo.z,
            );

            let material_type_location = gl.get_uniform_location(program, &format!("u_triangles[{}].material_type", i));
            let material_type = match triangle.material.material_type {
                crate::material::MaterialType::Lambertian => 0,
                crate::material::MaterialType::Metal => 1,
                crate::material::MaterialType::Dielectric => 2,
            };
            gl.uniform1i(material_type_location.as_ref(), material_type);

            let roughness_location = gl.get_uniform_location(program, &format!("u_triangles[{}].roughness", i));
            gl.uniform1f(roughness_location.as_ref(), triangle.material.roughness);

            let ior_location = gl.get_uniform_location(program, &format!("u_triangles[{}].ior", i));
            gl.uniform1f(ior_location.as_ref(), triangle.material.ior);
        }

        // Set light data
        let light_count = self.lights.len().min(4); // Limit to 4 lights

        let light_count_location = gl.get_uniform_location(program, "u_light_count");
        gl.uniform1i(light_count_location.as_ref(), light_count as i32);

        for (i, light) in self.lights.iter().take(4).enumerate() {
            let position_location =
                gl.get_uniform_location(program, &format!("u_lights[{}].position", i));
            gl.uniform3f(
                position_location.as_ref(),
                light.position.x,
                light.position.y,
                light.position.z,
            );

            let color_location =
                gl.get_uniform_location(program, &format!("u_lights[{}].color", i));
            gl.uniform3f(
                color_location.as_ref(),
                light.color.x,
                light.color.y,
                light.color.z,
            );

            let intensity_location =
                gl.get_uniform_location(program, &format!("u_lights[{}].intensity", i));
            gl.uniform1f(intensity_location.as_ref(), light.intensity);
        }

        // Set background color
        let bg_color_location = gl.get_uniform_location(program, "u_background_color");
        gl.uniform3f(
            bg_color_location.as_ref(),
            self.background_color.x,
            self.background_color.y,
            self.background_color.z,
        );

        Ok(())
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn from_json(json_data: &str) -> Result<Self, JsValue> {
        serde_json::from_str(json_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))
    }

    // Blender integration helpers
    pub fn from_blender_json(json_data: &str) -> Result<Self, JsValue> {
        // This is a simplified version - in practice you'd parse Blender's export format
        // For now, let's assume a simplified format
        let blender_data: serde_json::Value = serde_json::from_str(json_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse Blender JSON: {}", e)))?;

        let mut scene = Scene::new();

        // Parse objects
        if let Some(objects) = blender_data.get("objects").and_then(|o| o.as_array()) {
            for obj in objects {
                if let Some(obj_type) = obj.get("type").and_then(|t| t.as_str()) {
                    match obj_type {
                        "MESH" => {
                            // For simplicity, treat all meshes as spheres
                            if let (Some(location), Some(scale)) = (
                                obj.get("location").and_then(|l| l.as_array()),
                                obj.get("scale").and_then(|s| s.as_array()),
                            ) {
                                if location.len() >= 3 && scale.len() >= 3 {
                                    let center = Vec3::new(
                                        location[0].as_f64().unwrap_or(0.0) as f32,
                                        location[1].as_f64().unwrap_or(0.0) as f32,
                                        location[2].as_f64().unwrap_or(0.0) as f32,
                                    );
                                    let radius = scale[0].as_f64().unwrap_or(1.0) as f32;

                                    // Use default material for now
                                    let material = Material::lambertian(Vec3::new(0.7, 0.7, 0.7));
                                    scene.add_sphere(Sphere::new(center, radius, material));
                                }
                            }
                        }
                        "LIGHT" => {
                            if let Some(location) = obj.get("location").and_then(|l| l.as_array()) {
                                if location.len() >= 3 {
                                    let position = Vec3::new(
                                        location[0].as_f64().unwrap_or(0.0) as f32,
                                        location[1].as_f64().unwrap_or(0.0) as f32,
                                        location[2].as_f64().unwrap_or(0.0) as f32,
                                    );

                                    let color = Vec3::new(1.0, 1.0, 1.0);
                                    let intensity =
                                        obj.get("energy").and_then(|e| e.as_f64()).unwrap_or(10.0)
                                            as f32;

                                    scene.add_light(Light::new(position, color, intensity));
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        Ok(scene)
    }
}
