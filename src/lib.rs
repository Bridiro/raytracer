use js_sys::Date;
use wasm_bindgen::prelude::*;
use web_sys::{WebGlBuffer, WebGlProgram, WebGlRenderingContext, WebGlUniformLocation};

mod camera;
mod material;
mod math;
mod scene;
mod shaders;
mod webgl;

use camera::Camera;
use material::{Material, MaterialType};
use math::Vec3;
use scene::{Light, Plane, Scene, Sphere};

#[wasm_bindgen]
pub struct Raytracer {
    gl: WebGlRenderingContext,
    program: WebGlProgram,
    quad_buffer: WebGlBuffer,
    camera: Camera,
    scene: Scene,

    // Uniforms
    u_resolution: Option<WebGlUniformLocation>,
    u_camera_pos: Option<WebGlUniformLocation>,
    u_time: Option<WebGlUniformLocation>,
    u_camera_forward: Option<WebGlUniformLocation>,
    u_camera_right: Option<WebGlUniformLocation>,
    u_camera_up: Option<WebGlUniformLocation>,

    // Performance tracking
    last_frame_time: f64,
    frame_times: Vec<f64>,
    fps: f64,

    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl Raytracer {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, width: u32, height: u32) -> Result<Raytracer, JsValue> {
        let gl = webgl::init_webgl_context(canvas_id)?;

        let quad_buffer = webgl::create_quad_buffer(&gl)?;
        let program = shaders::create_raytracing_program(&gl)?;

        // Get uniform locations
        let u_resolution = gl.get_uniform_location(&program, "u_resolution");
        let u_camera_pos = gl.get_uniform_location(&program, "u_camera_pos");
        let u_time = gl.get_uniform_location(&program, "u_time");
        let u_camera_forward = gl.get_uniform_location(&program, "u_camera_forward");
        let u_camera_right = gl.get_uniform_location(&program, "u_camera_right");
        let u_camera_up = gl.get_uniform_location(&program, "u_camera_up");

        let camera = Camera::new(
            Vec3::new(0.0, 2.0, 5.0),
            Vec3::new(0.0, 0.0, 0.0),
            width as f32 / height as f32,
        );

        let mut scene = Scene::new();

        // Create a default scene
        scene.add_sphere(Sphere::new(
            Vec3::new(0.0, 0.0, 0.0),
            1.0,
            Material::new(MaterialType::Lambertian, Vec3::new(0.7, 0.3, 0.3), 0.0, 0.0),
        ));

        scene.add_sphere(Sphere::new(
            Vec3::new(-2.0, 0.0, -1.0),
            0.5,
            Material::new(MaterialType::Metal, Vec3::new(0.8, 0.8, 0.9), 0.1, 0.0),
        ));

        scene.add_sphere(Sphere::new(
            Vec3::new(2.0, 0.0, -1.0),
            0.5,
            Material::new(MaterialType::Dielectric, Vec3::new(0.9, 1.0, 0.9), 0.0, 1.5),
        ));

        // Add another glass sphere with different IOR
        scene.add_sphere(Sphere::new(
            Vec3::new(0.0, 1.0, -2.0),
            0.3,
            Material::new(MaterialType::Dielectric, Vec3::new(1.0, 0.9, 0.9), 0.0, 1.3),
        ));

        // Add ground plane
        scene.add_plane(Plane::new(
            Vec3::new(0.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
            Material::new(MaterialType::Lambertian, Vec3::new(0.5, 0.5, 0.5), 0.0, 0.0),
        ));

        // Add some lights for better visibility
        scene.add_light(Light::new(
            Vec3::new(10.0, 10.0, 10.0),
            Vec3::new(1.0, 1.0, 0.9),
            200.0,
        )); // Main sun light
        scene.add_light(Light::new(
            Vec3::new(-5.0, 8.0, 5.0),
            Vec3::new(0.7, 0.8, 1.0),
            80.0,
        )); // Sky light
        scene.add_light(Light::new(
            Vec3::new(0.0, 15.0, 0.0),
            Vec3::new(0.9, 0.9, 0.8),
            150.0,
        )); // Overhead light

        let raytracer = Raytracer {
            gl,
            program,
            quad_buffer,
            camera,
            scene,
            u_resolution,
            u_camera_pos,
            u_time,
            u_camera_forward,
            u_camera_right,
            u_camera_up,
            last_frame_time: Date::now(),
            frame_times: Vec::with_capacity(60),
            fps: 0.0,
            width,
            height,
        };

        Ok(raytracer)
    }

    #[wasm_bindgen]
    pub fn render(&mut self) -> Result<(), JsValue> {
        let current_time = Date::now();
        let delta_time = current_time - self.last_frame_time;

        // Update FPS
        self.frame_times.push(delta_time);
        if self.frame_times.len() > 60 {
            self.frame_times.remove(0);
        }

        if !self.frame_times.is_empty() {
            let avg_frame_time =
                self.frame_times.iter().sum::<f64>() / self.frame_times.len() as f64;
            self.fps = 1000.0 / avg_frame_time;
        }

        self.last_frame_time = current_time;

        // Clear the canvas
        self.gl
            .viewport(0, 0, self.width as i32, self.height as i32);
        self.gl.clear_color(0.0, 0.0, 0.0, 1.0);
        self.gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);

        // Use our raytracing program
        self.gl.use_program(Some(&self.program));

        // Set uniforms
        self.gl.uniform2f(
            self.u_resolution.as_ref(),
            self.width as f32,
            self.height as f32,
        );

        let camera_pos = self.camera.position();
        self.gl.uniform3f(
            self.u_camera_pos.as_ref(),
            camera_pos.x,
            camera_pos.y,
            camera_pos.z,
        );

        // Replace the matrix with basis vectors
        let forward = self.camera.get_forward();
        let right = self.camera.get_right();
        let up = self.camera.get_up();

        self.gl.uniform3f(
            self.u_camera_forward.as_ref(),
            forward.x,
            forward.y,
            forward.z,
        );
        self.gl
            .uniform3f(self.u_camera_right.as_ref(), right.x, right.y, right.z);
        self.gl
            .uniform3f(self.u_camera_up.as_ref(), up.x, up.y, up.z);

        self.gl
            .uniform1f(self.u_time.as_ref(), (current_time / 1000.0) as f32);

        // Set scene uniforms (we'll pass scene data through uniforms for now)
        self.scene.set_uniforms(&self.gl, &self.program)?;

        // Bind quad buffer and draw
        self.gl
            .bind_buffer(WebGlRenderingContext::ARRAY_BUFFER, Some(&self.quad_buffer));
        let position_location = self.gl.get_attrib_location(&self.program, "a_position");
        self.gl.enable_vertex_attrib_array(position_location as u32);
        self.gl.vertex_attrib_pointer_with_i32(
            position_location as u32,
            2,
            WebGlRenderingContext::FLOAT,
            false,
            0,
            0,
        );

        self.gl.draw_arrays(WebGlRenderingContext::TRIANGLES, 0, 6);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_fps(&self) -> f64 {
        self.fps
    }

    #[wasm_bindgen]
    pub fn move_camera(&mut self, forward: f32, right: f32, up: f32) {
        self.camera.move_relative(forward, right, up);
    }

    #[wasm_bindgen]
    pub fn rotate_camera(&mut self, yaw: f32, pitch: f32) {
        self.camera.rotate(yaw, pitch);
    }

    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.width = width;
        self.height = height;
        self.camera.set_aspect_ratio(width as f32 / height as f32);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_sphere(
        &mut self,
        x: f32,
        y: f32,
        z: f32,
        radius: f32,
        r: f32,
        g: f32,
        b: f32,
        material_type: u32,
    ) {
        let material_type = match material_type {
            1 => MaterialType::Metal,
            2 => MaterialType::Dielectric,
            _ => MaterialType::Lambertian,
        };

        let sphere = Sphere::new(
            Vec3::new(x, y, z),
            radius,
            Material::new(material_type, Vec3::new(r, g, b), 0.1, 1.5),
        );

        self.scene.add_sphere(sphere);
    }

    #[wasm_bindgen]
    pub fn clear_scene(&mut self) {
        self.scene = Scene::new();
        // Re-add ground plane
        self.scene.add_plane(Plane::new(
            Vec3::new(0.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
            Material::new(MaterialType::Lambertian, Vec3::new(0.5, 0.5, 0.5), 0.0, 0.0),
        ));
    }

    #[wasm_bindgen]
    pub fn load_scene_json(&mut self, json_data: &str) -> Result<(), JsValue> {
        self.scene = Scene::from_json(json_data)?;
        Ok(())
    }

    #[wasm_bindgen]
    pub fn export_scene_json(&self) -> String {
        self.scene.to_json()
    }

    #[wasm_bindgen]
    pub fn get_sphere_count(&self) -> usize {
        self.scene.spheres.len()
    }

    #[wasm_bindgen]
    pub fn get_sphere_position(&self, index: usize) -> Vec<f32> {
        if index < self.scene.spheres.len() {
            let pos = &self.scene.spheres[index].center;
            vec![pos.x, pos.y, pos.z]
        } else {
            vec![0.0, 0.0, 0.0]
        }
    }

    #[wasm_bindgen]
    pub fn set_sphere_position(&mut self, index: usize, x: f32, y: f32, z: f32) {
        if index < self.scene.spheres.len() {
            self.scene.spheres[index].center = Vec3::new(x, y, z);
        }
    }

    #[wasm_bindgen]
    pub fn set_sphere_radius(&mut self, index: usize, radius: f32) {
        if index < self.scene.spheres.len() {
            self.scene.spheres[index].radius = radius;
        }
    }

    #[wasm_bindgen]
    pub fn get_sphere_radius(&self, index: usize) -> f32 {
        if index < self.scene.spheres.len() {
            self.scene.spheres[index].radius
        } else {
            1.0
        }
    }

    #[wasm_bindgen]
    pub fn set_sphere_material(
        &mut self,
        index: usize,
        r: f32,
        g: f32,
        b: f32,
        material_type: u32,
    ) {
        if index < self.scene.spheres.len() {
            let material_type = match material_type {
                1 => MaterialType::Metal,
                2 => MaterialType::Dielectric,
                _ => MaterialType::Lambertian,
            };
            self.scene.spheres[index].material =
                Material::new(material_type, Vec3::new(r, g, b), 0.1, 1.5);
        }
    }

    #[wasm_bindgen]
    pub fn remove_sphere(&mut self, index: usize) {
        if index < self.scene.spheres.len() {
            self.scene.spheres.remove(index);
        }
    }

    #[wasm_bindgen]
    pub fn set_camera_position(&mut self, x: f32, y: f32, z: f32) {
        self.camera.set_position(Vec3::new(x, y, z));
    }

    #[wasm_bindgen]
    pub fn get_camera_position(&self) -> Vec<f32> {
        let pos = self.camera.get_position();
        vec![pos.x, pos.y, pos.z]
    }

    #[wasm_bindgen]
    pub fn set_camera_target(&mut self, x: f32, y: f32, z: f32) {
        self.camera.set_target(Vec3::new(x, y, z));
    }

    #[wasm_bindgen]
    pub fn random_scene(&mut self) {
        self.clear_scene();

        // Add some random spheres
        for i in 0..8 {
            let x = (i as f32 - 4.0) * 2.0 + (js_sys::Math::random() as f32 - 0.5) * 1.5;
            let z = -2.0 + (js_sys::Math::random() as f32) * -4.0;
            let y = 0.0;
            let radius = 0.3 + (js_sys::Math::random() as f32) * 0.5;

            let material_type = (js_sys::Math::random() * 3.0) as u32;
            let r = js_sys::Math::random() as f32;
            let g = js_sys::Math::random() as f32;
            let b = js_sys::Math::random() as f32;

            self.add_sphere(x, y, z, radius, r, g, b, material_type);
        }

        // Re-add better lighting
        self.scene.add_light(Light::new(
            Vec3::new(10.0, 10.0, 10.0),
            Vec3::new(1.0, 1.0, 0.9),
            200.0,
        ));
        self.scene.add_light(Light::new(
            Vec3::new(-5.0, 8.0, 5.0),
            Vec3::new(0.7, 0.8, 1.0),
            80.0,
        ));
        self.scene.add_light(Light::new(
            Vec3::new(0.0, 15.0, 0.0),
            Vec3::new(0.9, 0.9, 0.8),
            150.0,
        ));
    }
}
