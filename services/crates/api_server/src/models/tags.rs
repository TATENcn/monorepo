use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "tags")]
pub struct Model {
    /// Tag id
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: uuid::Uuid,
    /// Tag name
    pub name: String,
}

impl ActiveModelBehavior for ActiveModel {}
