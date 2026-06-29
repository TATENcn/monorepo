use chrono::{DateTime, Utc};
use sea_orm::{ActiveValue::Set, entity::prelude::*};

use crate::models::enums::Difficulty;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "problems")]
pub struct Model {
    /// Problem id
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: uuid::Uuid,
    /// Problem title
    pub title: String,
    /// Problem description
    pub description: String,
    /// Problem difficulty
    pub difficulty: Difficulty,
    /// Author id
    pub author_id: uuid::Uuid,

    /// Problem created at
    pub created_at: DateTime<Utc>,
    /// Problem updated at
    pub updated_at: DateTime<Utc>,
    /// Problem deleted at (default to [`Option::None`])
    pub deleted_at: Option<DateTime<Utc>>,

    /// Cpu time limits in ms
    pub limit_cpu_time_ms: u64,
    /// Wall time limits in ms
    pub limit_wall_time_ms: u64,
    /// Memory limits in bytes
    pub limit_memory_bytes: u64,
    /// Output limits in bytes
    pub limit_output_bytes: u64,

    #[sea_orm(belongs_to, from = "author_id", to = "id")]
    pub author: HasOne<auth::models::users::Entity>,
    #[sea_orm(has_many, via = "problems_tags")]
    pub tags: HasMany<super::tags::Entity>,
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    async fn before_save<C>(mut self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert {
            self.updated_at = Set(Utc::now())
        }

        Ok(self)
    }
}
