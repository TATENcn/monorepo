use lapin::{
    Connection, ConnectionProperties, ExchangeKind,
    options::{ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions},
    types::FieldTable,
};
use tracing::info;

use crate::error::Error;

pub const EXCHANGE_NAME: &str = "online-judge.exchange";
pub const SUBMIT_QUEUE: &str = "submit.queue";
pub const SUBMIT_ROUTE: &str = "submit";
pub const RESULT_QUEUE: &str = "result.queue";
pub const RESULT_ROUTE: &str = "result";

/// Initialize RabbitMQ topology
pub async fn init(url: &str) -> Result<Connection, Error> {
    let conn = Connection::connect(url, ConnectionProperties::default()).await?;
    info!("connected to RabbitMQ");

    let channel = conn.create_channel().await?;

    channel
        .exchange_declare(
            EXCHANGE_NAME.into(),
            ExchangeKind::Direct,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;

    channel
        .queue_declare(
            SUBMIT_QUEUE.into(),
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            SUBMIT_QUEUE.into(),
            EXCHANGE_NAME.into(),
            SUBMIT_ROUTE.into(),
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    channel
        .queue_declare(
            RESULT_QUEUE.into(),
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            RESULT_QUEUE.into(),
            EXCHANGE_NAME.into(),
            RESULT_ROUTE.into(),
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

    channel.basic_qos(1, Default::default()).await?;
    info!("RabbitMQ topology configured");
    Ok(conn)
}
