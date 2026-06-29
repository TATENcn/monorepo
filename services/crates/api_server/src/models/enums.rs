use sea_orm::{DeriveActiveEnum, EnumIter};
use serde::{Deserialize, Serialize};

/// REVIEW: Should we use this translation?
#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "u64", db_type = "Integer")]
pub enum Difficulty {
    /// 入门
    #[serde(rename = "入门")]
    A = 0,
    /// 普及-
    #[serde(rename = "普及-")]
    B = 1,
    /// 普及/提高-
    #[serde(rename = "普及/提高-")]
    C = 2,
    /// 普及+/提高
    #[serde(rename = "普及+/提高")]
    D = 3,
    /// 提高+/省选-
    #[serde(rename = "提高+/省选-")]
    E = 4,
    /// 省选/NOI-
    #[serde(rename = "省选/NOI-")]
    F = 5,
    /// NOI/NOI+/CTSC
    #[serde(rename = "NOI/NOI+/CTSC")]
    G = 6,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "u64", db_type = "Integer")]
pub enum CaseType {
    #[serde(rename = "hidden")]
    Hidden = 0,
    #[serde(rename = "example")]
    Example = 1,
}
