use wasm_bindgen::prelude::*;
use web_sys::{WebGlProgram, WebGlRenderingContext};

use crate::webgl::create_shader;

const VERTEX_SHADER_SOURCE: &str = include_str!("../shaders/vertex.glsl");
const FRAGMENT_SHADER_SOURCE: &str = include_str!("../shaders/fragment.glsl");

pub fn create_raytracing_program(gl: &WebGlRenderingContext) -> Result<WebGlProgram, JsValue> {
    let vertex_shader = create_shader(
        gl,
        WebGlRenderingContext::VERTEX_SHADER,
        VERTEX_SHADER_SOURCE,
    )?;
    let fragment_shader = create_shader(
        gl,
        WebGlRenderingContext::FRAGMENT_SHADER,
        FRAGMENT_SHADER_SOURCE,
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
