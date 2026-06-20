mod error;
mod message;
mod rabbitmq;

use error::Error;
use futures_util::StreamExt;
use judge_core_sdk::JudgeCoreClient;
use judge_core_shared::models::http::VerdictResponse;
use lapin::{
    BasicProperties, Channel,
    options::{BasicAckOptions, BasicConsumeOptions, BasicPublishOptions},
    types::FieldTable,
};
use message::{ResultMessage, SubmitMessage};
use rabbitmq::{RESULT_ROUTE, SUBMIT_QUEUE};
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt::init();

    let rabbitmq_url = std::env::var("RABBIT_MQ_URL").map_err(|_| Error::MissingRabbitMqUrl)?;
    let judge_core_url = std::env::var("JUDGE_CORE_URL").map_err(|_| Error::MissingJudgeCoreUrl)?;
    let using_standalone = std::env::var("JUDGE_CORE_STANDALONE")
        .map(|v| v.to_ascii_lowercase() == "true")
        .unwrap_or(false);

    let conn = rabbitmq::init(&rabbitmq_url).await?;
    let channel = conn.create_channel().await?;
    let client = JudgeCoreClient::new(judge_core_url, using_standalone);

    if !using_standalone {
        client.acceptable().await?;
    }
    info!("judge-core available");

    let publish_channel = conn.create_channel().await?;

    let mut consumer = channel
        .basic_consume(
            SUBMIT_QUEUE.into(),
            "submission-processor".into(),
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    info!("consuming from {}", SUBMIT_QUEUE);

    loop {
        tokio::select! {
            delivery = consumer.next() => {
                match delivery {
                    Some(Ok(delivery)) => {
                        let submission_id = process_message(
                            &client,
                            &publish_channel,
                            &delivery.data,
                            &delivery.acker,
                        )
                        .await;

                        if let Some(id) = submission_id {
                            info!(submission_id = %id, "finished task");
                        }
                    }
                    Some(Err(e)) => {
                        error!(error = %e, "consumer error");
                    }
                    None => {
                        info!("consumer stream ended, channel or connection closed");
                        break;
                    }
                }
            }
            _ = tokio::signal::ctrl_c() => {
                info!("shutdown signal received");
                break;
            }
        }
    }

    info!("shutting down");
    conn.close(200, "bye".into()).await?;
    Ok(())
}

/// Process a single message
///
/// # Returns
/// Some(submission_id) on success
/// None on failure (message not acked, it will be redelivered)
async fn process_message(client: &JudgeCoreClient, publish_channel: &Channel, body: &[u8], acker: &lapin::Acker) -> Option<String> {
    let submit_msg: SubmitMessage = match serde_json::from_slice(body) {
        Ok(m) => m,
        Err(e) => {
            error!(error = %e, "failed to deserialize message, discarding");
            acker.ack(BasicAckOptions::default()).await.ok();
            return None;
        }
    };

    let submission_id = submit_msg.submission_id;

    match client.task_submit(&submit_msg.task).await {
        Ok(task_result) => {
            let result_msg = ResultMessage {
                submission_id: submission_id.clone(),
                result: VerdictResponse::from(task_result),
            };
            let payload = serde_json::to_vec(&result_msg).unwrap_or_default();

            if let Err(e) = publish_channel
                .basic_publish(
                    rabbitmq::EXCHANGE_NAME.into(),
                    RESULT_ROUTE.into(),
                    BasicPublishOptions::default(),
                    &payload,
                    BasicProperties::default(),
                )
                .await
            {
                error!(submission_id = %submission_id, error = %e, "failed to publish result");
                return None;
            }

            acker.ack(BasicAckOptions::default()).await.ok();
            Some(submission_id)
        }
        Err(e) => {
            error!(submission_id = %submission_id, error = %e, "failed to process task");
            None
        }
    }
}
