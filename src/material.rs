use crate::math::Vec3;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum MaterialType {
    Lambertian,
    Metal,
    Dielectric,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Material {
    pub material_type: MaterialType,
    pub albedo: Vec3,
    pub roughness: f32,
    pub ior: f32,
}

impl Material {
    pub fn new(material_type: MaterialType, albedo: Vec3, roughness: f32, ior: f32) -> Self {
        Self {
            material_type,
            albedo,
            roughness,
            ior,
        }
    }

    pub fn lambertian(albedo: Vec3) -> Self {
        Self::new(MaterialType::Lambertian, albedo, 0.0, 1.0)
    }

    pub fn metal(albedo: Vec3, roughness: f32) -> Self {
        Self::new(MaterialType::Metal, albedo, roughness.clamp(0.0, 1.0), 1.0)
    }

    pub fn dielectric(ior: f32) -> Self {
        Self::new(MaterialType::Dielectric, Vec3::new(1.0, 1.0, 1.0), 0.0, ior)
    }

    pub fn emissive(color: Vec3) -> Self {
        Self::new(MaterialType::Lambertian, color, 0.0, 1.0)
    }
}
