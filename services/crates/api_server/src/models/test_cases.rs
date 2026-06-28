use sea_orm::entity::prelude::*;

use crate::models::enums::CaseType;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "test_cases")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: uuid::Uuid,
    pub problem_id: uuid::Uuid,

    pub input: String,
    pub output: String,
    pub case_type: CaseType,

    #[sea_orm(belongs_to, from = "problem_id", to = "id")]
    pub problem: HasOne<super::problems::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
