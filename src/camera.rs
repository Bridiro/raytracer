use crate::math::{Mat4, Vec3};

pub struct Camera {
    position: Vec3,
    target: Vec3,
    up: Vec3,
    right: Vec3,
    forward: Vec3,
    yaw: f32,
    pitch: f32,
    fov: f32,
    aspect_ratio: f32,
    near: f32,
    far: f32,
}

impl Camera {
    pub fn new(position: Vec3, target: Vec3, aspect_ratio: f32) -> Self {
        let mut camera = Camera {
            position,
            target,
            up: Vec3::new(0.0, 1.0, 0.0),
            right: Vec3::new(1.0, 0.0, 0.0),
            forward: Vec3::new(0.0, 0.0, -1.0),
            yaw: 0.0,
            pitch: 0.0,
            fov: 45.0_f32.to_radians(),
            aspect_ratio,
            near: 0.1,
            far: 100.0,
        };

        camera.update_vectors();
        camera
    }

    pub fn position(&self) -> Vec3 {
        self.position
    }

    pub fn view_matrix(&self) -> Mat4 {
        Mat4::look_at(self.position, self.position + self.forward, self.up)
    }

    pub fn projection_matrix(&self) -> Mat4 {
        Mat4::perspective(self.fov, self.aspect_ratio, self.near, self.far)
    }

    pub fn move_relative(&mut self, forward: f32, right: f32, up: f32) {
        // Debug: let's use a simple coordinate system
        // X = right, Y = up, Z = into screen (so -Z = forward)
        // Yaw = rotation around Y axis

        // For horizontal movement, ignore pitch completely
        let cos_yaw = self.yaw.cos();
        let sin_yaw = self.yaw.sin();

        // Forward vector in XZ plane (Y=0, horizontal movement only)
        // In a right-handed system with Z pointing into screen:
        // - Yaw 0 should point in -Z direction (forward into screen)
        // - Yaw 90° should point in -X direction (left)
        let forward_vec = Vec3::new(sin_yaw, 0.0, cos_yaw);

        // Right vector perpendicular to forward in XZ plane
        let right_vec = Vec3::new(cos_yaw, 0.0, -sin_yaw);

        // Up is always world up
        let up_vec = Vec3::new(0.0, 1.0, 0.0);

        // Apply movement
        self.position = self.position + forward_vec * forward;
        self.position = self.position + right_vec * right;
        self.position = self.position + up_vec * up;
    }

    pub fn move_absolute(&mut self, x: f32, y: f32, z: f32) {
        self.position = Vec3::new(x, y, z);
    }

    pub fn rotate(&mut self, yaw_delta: f32, pitch_delta: f32) {
        self.yaw += yaw_delta;
        self.pitch += pitch_delta;

        // Constrain pitch to avoid gimbal lock
        self.pitch = self
            .pitch
            .clamp(-89.0_f32.to_radians(), 89.0_f32.to_radians());

        self.update_vectors();
    }

    pub fn set_aspect_ratio(&mut self, aspect_ratio: f32) {
        self.aspect_ratio = aspect_ratio;
    }

    pub fn set_fov(&mut self, fov: f32) {
        self.fov = fov.to_radians();
    }

    fn update_vectors(&mut self) {
        // Calculate forward vector for LOOKING (not movement)
        // Use the same coordinate system: X=right, Y=up, Z=into screen
        // Yaw 0 = looking forward (-Z), Pitch 0 = looking horizontally

        let cos_yaw = self.yaw.cos();
        let sin_yaw = self.yaw.sin();
        let cos_pitch = self.pitch.cos();
        let sin_pitch = self.pitch.sin();

        // Forward vector for looking direction
        self.forward = Vec3::new(sin_yaw * cos_pitch, sin_pitch, -cos_yaw * cos_pitch).normalize();

        // ALWAYS use world up - no roll ever
        self.up = Vec3::new(0.0, 1.0, 0.0);

        // Right vector should be horizontal and perpendicular to the HORIZONTAL component of forward
        // This ensures no roll when looking up/down
        self.right = Vec3::new(cos_yaw, 0.0, sin_yaw).normalize();

        // Update target for consistency
        self.target = self.position + self.forward;
    }

    pub fn look_at(&mut self, target: Vec3) {
        self.target = target;
        let direction = (target - self.position).normalize();

        // Calculate yaw and pitch from direction
        self.yaw = direction.z.atan2(direction.x);
        self.pitch = direction.y.asin();

        self.update_vectors();
    }

    pub fn get_ray_direction(&self, x: f32, y: f32, width: f32, height: f32) -> Vec3 {
        // Convert screen coordinates to normalized device coordinates
        let ndc_x = (2.0 * x / width) - 1.0;
        let ndc_y = 1.0 - (2.0 * y / height);

        // Convert to camera space
        let tan_half_fov = (self.fov / 2.0).tan();
        let camera_x = ndc_x * tan_half_fov * self.aspect_ratio;
        let camera_y = ndc_y * tan_half_fov;

        // Calculate ray direction in world space
        let ray_dir = self.forward + self.right * camera_x + self.up * camera_y;
        ray_dir.normalize()
    }

    pub fn set_position(&mut self, position: Vec3) {
        self.position = position;
        self.update_vectors();
    }

    pub fn get_position(&self) -> Vec3 {
        self.position
    }

    pub fn set_target(&mut self, target: Vec3) {
        self.target = target;
        let direction = (target - self.position).normalize();

        // Calculate yaw and pitch from direction
        self.yaw = direction.z.atan2(direction.x);
        self.pitch = direction.y.asin();

        self.update_vectors();
    }

    pub fn get_target(&self) -> Vec3 {
        self.target
    }
}
