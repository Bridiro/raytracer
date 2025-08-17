use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self::new(0.0, 0.0, 0.0)
    }

    pub fn one() -> Self {
        Self::new(1.0, 1.0, 1.0)
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn length_squared(&self) -> f32 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 0.0 {
            Self::new(self.x / len, self.y / len, self.z / len)
        } else {
            *self
        }
    }

    pub fn dot(&self, other: &Vec3) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn cross(&self, other: &Vec3) -> Vec3 {
        Vec3::new(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )
    }

    pub fn reflect(&self, normal: &Vec3) -> Vec3 {
        *self - *normal * 2.0 * self.dot(normal)
    }

    pub fn refract(&self, normal: &Vec3, ni_over_nt: f32) -> Option<Vec3> {
        let uv = self.normalize();
        let dt = uv.dot(normal);
        let discriminant = 1.0 - ni_over_nt * ni_over_nt * (1.0 - dt * dt);

        if discriminant > 0.0 {
            Some((uv - *normal * dt) * ni_over_nt - *normal * discriminant.sqrt())
        } else {
            None
        }
    }
}

impl std::ops::Add for Vec3 {
    type Output = Vec3;

    fn add(self, other: Vec3) -> Vec3 {
        Vec3::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }
}

impl std::ops::Sub for Vec3 {
    type Output = Vec3;

    fn sub(self, other: Vec3) -> Vec3 {
        Vec3::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }
}

impl std::ops::Mul<f32> for Vec3 {
    type Output = Vec3;

    fn mul(self, scalar: f32) -> Vec3 {
        Vec3::new(self.x * scalar, self.y * scalar, self.z * scalar)
    }
}

impl std::ops::Mul<Vec3> for Vec3 {
    type Output = Vec3;

    fn mul(self, other: Vec3) -> Vec3 {
        Vec3::new(self.x * other.x, self.y * other.y, self.z * other.z)
    }
}

impl std::ops::Div<f32> for Vec3 {
    type Output = Vec3;

    fn div(self, scalar: f32) -> Vec3 {
        Vec3::new(self.x / scalar, self.y / scalar, self.z / scalar)
    }
}

impl std::ops::Neg for Vec3 {
    type Output = Vec3;

    fn neg(self) -> Vec3 {
        Vec3::new(-self.x, -self.y, -self.z)
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Mat4 {
    data: [f32; 16],
}

impl Mat4 {
    pub fn identity() -> Self {
        Self {
            data: [
                1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
            ],
        }
    }

    pub fn perspective(fov: f32, aspect: f32, near: f32, far: f32) -> Self {
        let f = 1.0 / (fov / 2.0).tan();
        let mut data = [0.0; 16];

        data[0] = f / aspect;
        data[5] = f;
        data[10] = (far + near) / (near - far);
        data[11] = -1.0;
        data[14] = (2.0 * far * near) / (near - far);

        Self { data }
    }

    pub fn look_at(eye: Vec3, center: Vec3, up: Vec3) -> Self {
        let f = (center - eye).normalize();
        let u = up.normalize();
        let s = f.cross(&u).normalize();
        let v = s.cross(&f);

        let mut data = [0.0; 16];

        data[0] = s.x;
        data[1] = v.x;
        data[2] = -f.x;
        data[3] = 0.0;

        data[4] = s.y;
        data[5] = v.y;
        data[6] = -f.y;
        data[7] = 0.0;

        data[8] = s.z;
        data[9] = v.z;
        data[10] = -f.z;
        data[11] = 0.0;

        data[12] = -s.dot(&eye);
        data[13] = -v.dot(&eye);
        data[14] = f.dot(&eye);
        data[15] = 1.0;

        Self { data }
    }

    pub fn translation(x: f32, y: f32, z: f32) -> Self {
        let mut mat = Self::identity();
        mat.data[12] = x;
        mat.data[13] = y;
        mat.data[14] = z;
        mat
    }

    pub fn rotation_y(angle: f32) -> Self {
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        let mut mat = Self::identity();
        mat.data[0] = cos_a;
        mat.data[2] = sin_a;
        mat.data[8] = -sin_a;
        mat.data[10] = cos_a;
        mat
    }

    pub fn rotation_x(angle: f32) -> Self {
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        let mut mat = Self::identity();
        mat.data[5] = cos_a;
        mat.data[6] = -sin_a;
        mat.data[9] = sin_a;
        mat.data[10] = cos_a;
        mat
    }

    pub fn as_array(&self) -> [f32; 16] {
        self.data
    }
}

impl std::ops::Mul for Mat4 {
    type Output = Mat4;

    fn mul(self, other: Mat4) -> Mat4 {
        let mut result = [0.0; 16];

        for i in 0..4 {
            for j in 0..4 {
                for k in 0..4 {
                    result[i * 4 + j] += self.data[i * 4 + k] * other.data[k * 4 + j];
                }
            }
        }

        Mat4 { data: result }
    }
}

pub fn random_in_unit_sphere() -> Vec3 {
    loop {
        let p = Vec3::new(
            js_sys::Math::random() as f32 * 2.0 - 1.0,
            js_sys::Math::random() as f32 * 2.0 - 1.0,
            js_sys::Math::random() as f32 * 2.0 - 1.0,
        );

        if p.length_squared() < 1.0 {
            return p;
        }
    }
}

pub fn schlick(cosine: f32, ref_idx: f32) -> f32 {
    let r0 = (1.0 - ref_idx) / (1.0 + ref_idx);
    let r0 = r0 * r0;
    r0 + (1.0 - r0) * (1.0 - cosine).powi(5)
}
