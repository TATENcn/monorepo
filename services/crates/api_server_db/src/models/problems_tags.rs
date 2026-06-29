use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "problems_tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub problem_id: uuid::Uuid,
    #[sea_orm(primary_key, auto_increment = false)]
    pub tag_id: uuid::Uuid,
    #[sea_orm(belongs_to, from = "problem_id", to = "id")]
    pub problem: HasOne<super::problems::Entity>,
    #[sea_orm(belongs_to, from = "tag_id", to = "id")]
    pub tag: HasOne<super::tags::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
