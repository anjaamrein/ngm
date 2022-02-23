use std::collections::HashMap;

use aws_sdk_s3::error::CopyObjectError;
use aws_sdk_s3::output::CopyObjectOutput;
use aws_sdk_s3::types::SdkError;
use aws_sdk_s3::Client;
use axum::extract::Path;
use axum::{
    extract::{Extension, Json},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

// Derive Serialize to return as Json
#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Project {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub owner: String,
    pub viewers: Option<Vec<String>>,
    pub moderators: Option<Vec<String>>,
    pub title: String,
    pub description: String,
    pub created: String,
    pub modified: String,
    pub image: String,
    pub color: String,
    pub views: Vec<ProjectView>,
    pub assets: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct ProjectView {
    pub id: String,
    pub title: String,
    pub permalink: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetRequest {
    pub email: String,
}

// Health check endpoint
pub async fn health_check(Extension(pool): Extension<PgPool>) -> (StatusCode, String) {
    let version = format!("CARGO_PKG_VERSION: {}", env!("CARGO_PKG_VERSION"));
    let status = if sqlx::query!("SELECT 2 AS test")
        .fetch_one(&pool)
        .await
        .is_ok()
    {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, version)
}

#[axum_macros::debug_handler]
pub async fn insert_project(
    Extension(pool): Extension<PgPool>,
    Json(mut project): Json<Project>,
) -> Result<axum::Json<Uuid>, StatusCode> {
    project.id = Uuid::new_v4();
    let result =
        sqlx::query_scalar("insert into projects (id, project) values ($1, $2) returning id")
            .bind(project.id.to_owned())
            .bind(sqlx::types::Json(project))
            .fetch_one(&pool)
            .await
            .map_err(internal_error);

    match result {
        Ok(result) => Ok(axum::Json(result)), // wrap struct with Json & adapt function response signature as well
        Err((status, _msg)) => Err(status),
    }
}

#[axum_macros::debug_handler]
pub async fn duplicate_project(
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    Json(mut project): Json<Project>,
) -> Result<axum::Json<Uuid>, StatusCode> {
    project.id = Uuid::new_v4();
    project.viewers = None;
    project.moderators = None;
    if let Some(ref assets) = project.assets {
        for href in assets {
            let bucket_name = "ngmpub-download-bgdi-ch";
            let path_opt = href.split("https://download.swissgeol.ch/").nth(1);
            let name_opt = href.split('/').last();
            if path_opt.is_some() && name_opt.is_some() {
                let path: &str = path_opt.unwrap();
                let new_path: String = format!("assets/{}/{}", project.id, name_opt.unwrap());
                copy_aws_object(&client, bucket_name, path, &new_path)
                    .await
                    .map_err(|e| {
                        tracing::error!("{}", e);
                        StatusCode::INTERNAL_SERVER_ERROR
                    })?;
            }
        }
    }

    match sqlx::query_scalar("insert into projects (id, project) values ($1, $2) returning id")
        .bind(project.id)
        .bind(sqlx::types::Json(project))
        .fetch_one(&pool)
        .await
    {
        Ok(result) => Ok(axum::Json(result)), // wrap struct with Json & adapt function response signature as well
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[axum_macros::debug_handler]
pub async fn get_projects_by_email(
    Extension(pool): Extension<PgPool>,
    Json(req): Json<GetRequest>,
) -> Result<axum::Json<Vec<Project>>, StatusCode> {
    match sqlx::query_scalar(
        r#"
          SELECT project as "project: sqlx::types::Json<Project>"
          FROM projects
          WHERE project->>'owner' = $1 OR
          project->'viewers' ? $1 OR
          project->'moderators' ? $1
    "#,
    )
    .bind(req.email)
    .fetch_all(&pool)
    .await
    {
        Ok(result) => Ok(axum::Json(
            result
                .iter()
                .map(|v: &sqlx::types::Json<Project>| v.to_owned().0)
                .collect(),
        )),
        Err(_e) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[axum_macros::debug_handler]
pub async fn get_project(
    Extension(pool): Extension<PgPool>,
    Path(params): Path<HashMap<String, String>>,
) -> Result<axum::Json<Project>, StatusCode> {
    let result: Result<sqlx::types::Json<Project>, (StatusCode, String)> = sqlx::query_scalar(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
    )
    .bind::<Uuid>(
        Uuid::parse_str(
            params
                .get("id")
                .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
                .unwrap(),
        )
        .unwrap(),
    )
    .fetch_one(&pool)
    .await
    .map_err(internal_error);

    match result {
        Ok(result) => Ok(axum::Json(result.0)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Utility function for mapping any error into a `500 Internal Server Error`
/// response.
fn internal_error<E>(err: E) -> (StatusCode, String)
where
    E: std::error::Error,
{
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

pub async fn copy_aws_object(
    client: &Client,
    bucket_name: &str,
    object_key: &str,
    target_key: &str,
) -> Result<CopyObjectOutput, SdkError<CopyObjectError>> {
    client
        .copy_object()
        .copy_source(format!("{bucket_name}/{object_key}"))
        .bucket(bucket_name)
        .key(target_key)
        .send()
        .await
}
