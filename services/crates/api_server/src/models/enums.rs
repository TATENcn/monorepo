use sea_orm::{DeriveActiveEnum, EnumIter};

#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "u64", db_type = "Integer")]
pub enum Difficulty {
    IdkHowToTranslate = 0,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "u64", db_type = "Integer")]
pub enum CaseType {
    Hidden = 0,
    Example = 1,
}
