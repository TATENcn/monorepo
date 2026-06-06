use std::path::{Path, PathBuf};
use std::time::Instant;

use containerd_client::tonic::Request;
use containerd_client::{
    services::v1::{
        Container, CreateContainerRequest, CreateTaskRequest, DeleteContainerRequest, DeleteTaskRequest, GetImageRequest, KillRequest, ListContainersRequest,
        StartRequest,
        container::Runtime,
        containers_client::ContainersClient,
        images_client::ImagesClient,
        snapshots::{PrepareSnapshotRequest, RemoveSnapshotRequest, snapshots_client::SnapshotsClient},
        tasks_client::TasksClient,
    },
    tonic::transport::Channel,
    with_namespace,
};
use prost_types::Any;
use tokio::time::{Duration, sleep};
use tokio::{fs, io};
use tracing::{debug, info, warn};
use uuid::Uuid;

const NAMESPACE: &str = "judge-core";
const AGENT_LABEL_KEY: &str = "judge-core.agent";
const AGENT_LABEL_VALUE: &str = "true";
const SOCKET_WAIT_TIMEOUT_SECS: u64 = 30;
const SOCKET_WAIT_INTERVAL_MS: u64 = 100;

const RUNTIME: &str = "io.containerd.runc.v2";

pub struct ContainerdProvisioner {
    channel: Channel,
    image: String,
    socket_base: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum ProvisionError {
    #[error("containerd rpc error: {0}")]
    Rpc(#[from] containerd_client::tonic::Status),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("socket not ready after {0}s")]
    SocketTimeout(u64),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("oci spec error: {0}")]
    OciSpec(#[from] oci_spec::OciSpecError),
}

impl ContainerdProvisioner {
    pub fn new(channel: Channel, image: impl Into<String>) -> Self {
        Self {
            channel,
            image: image.into(),
            socket_base: PathBuf::from("/run/judge-core/agents"),
        }
    }

    /// Create a new agent container
    #[tracing::instrument(skip(self))]
    pub async fn create(&self) -> Result<(String, PathBuf), ProvisionError> {
        let id = Uuid::new_v4().to_string();
        let socket_dir = self.socket_base.join(&id);
        let socket_path = socket_dir.join("agent.sock");

        fs::create_dir_all(&socket_dir).await?;
        debug!(agent_id = %id, socket_dir = %socket_dir.display(), "created socket directory");

        let mut images_client = ImagesClient::new(self.channel.clone());
        let get_image_req = with_namespace!(GetImageRequest { name: self.image.clone() }, NAMESPACE);
        let image_resp = images_client.get(get_image_req).await?;
        let image = image_resp
            .into_inner()
            .image
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "image not found"))?;
        let parent_digest = image.target.map(|t| t.digest).unwrap_or_default();
        debug!(agent_id = %id, image = %self.image, parent = %parent_digest, "got image digest");

        let snapshotter = "overlayfs";
        let mut snapshots_client = SnapshotsClient::new(self.channel.clone());
        let prepare_req = with_namespace!(
            PrepareSnapshotRequest {
                snapshotter: snapshotter.to_string(),
                key: id.clone(),
                parent: parent_digest,
                labels: Default::default(),
            },
            NAMESPACE
        );
        snapshots_client.prepare(prepare_req).await?;
        info!(agent_id = %id, snapshotter = %snapshotter, "snapshot prepared");

        let mounts_req = with_namespace!(
            containerd_client::services::v1::snapshots::MountsRequest {
                snapshotter: snapshotter.to_string(),
                key: id.clone(),
            },
            NAMESPACE
        );
        let mounts_resp = snapshots_client.mounts(mounts_req).await?;
        let rootfs_mounts = mounts_resp.into_inner().mounts;
        debug!(agent_id = %id, mounts_count = rootfs_mounts.len(), "got rootfs mounts");

        let mut containers_client = ContainersClient::new(self.channel.clone());

        let spec = self.build_agent_spec(&socket_path)?;
        let container = Container {
            id: id.clone(),
            image: self.image.clone(),
            runtime: Some(Runtime {
                name: RUNTIME.to_owned(),
                options: None,
            }),
            spec: Some(spec),
            snapshotter: snapshotter.to_string(),
            snapshot_key: id.clone(),
            labels: [(AGENT_LABEL_KEY.to_string(), AGENT_LABEL_VALUE.to_string())].into_iter().collect(),
            ..Default::default()
        };

        let req = CreateContainerRequest { container: Some(container) };
        let req = with_namespace!(req, NAMESPACE);

        containers_client.create(req).await?;
        info!(agent_id = %id, "container created");

        let mut tasks_client = TasksClient::new(self.channel.clone());

        let req = CreateTaskRequest {
            container_id: id.clone(),
            rootfs: rootfs_mounts,
            ..Default::default()
        };
        let req = with_namespace!(req, NAMESPACE);

        tasks_client.create(req).await?;
        info!(agent_id = %id, "task created");

        let req = StartRequest {
            container_id: id.clone(),
            ..Default::default()
        };
        let req = with_namespace!(req, NAMESPACE);

        tasks_client.start(req).await?;
        info!(agent_id = %id, "task started");

        self.wait_for_socket(&socket_path).await?;
        info!(agent_id = %id, socket = %socket_path.display(), "agent ready");

        Ok((id, socket_path))
    }

    /// Destroy an agent container and clean up its resources
    #[tracing::instrument(skip(self))]
    pub async fn destroy(&self, id: &str) -> Result<(), ProvisionError> {
        let mut tasks_client = TasksClient::new(self.channel.clone());

        let req = KillRequest {
            container_id: id.to_string(),
            signal: libc::SIGKILL as u32,
            ..Default::default()
        };
        let req = with_namespace!(req, NAMESPACE);

        if let Err(e) = tasks_client.kill(req).await {
            warn!(agent_id = id, error = %e, "failed to kill task (may already be stopped)");
        }

        let req = DeleteTaskRequest { container_id: id.to_string() };
        let req = with_namespace!(req, NAMESPACE);

        if let Err(e) = tasks_client.delete(req).await {
            warn!(agent_id = id, error = %e, "failed to delete task (may already be deleted)");
        }

        let mut containers_client = ContainersClient::new(self.channel.clone());

        let req = DeleteContainerRequest { id: id.to_string() };
        let req = with_namespace!(req, NAMESPACE);

        containers_client.delete(req).await?;

        let mut snapshots_client = SnapshotsClient::new(self.channel.clone());
        let snapshotter = "overlayfs";
        let remove_req = with_namespace!(
            RemoveSnapshotRequest {
                snapshotter: snapshotter.to_string(),
                key: id.to_string(),
            },
            NAMESPACE
        );
        if let Err(e) = snapshots_client.remove(remove_req).await {
            warn!(agent_id = id, error = %e, "failed to remove snapshot (may already be removed)");
        }

        let socket_dir = self.socket_base.join(id);
        if let Err(e) = fs::remove_dir_all(&socket_dir).await {
            warn!(agent_id = id, dir = %socket_dir.display(), error = %e, "failed to remove socket directory");
        }

        info!(agent_id = id, "agent destroyed");
        Ok(())
    }

    /// List all agent container id
    #[tracing::instrument(skip(self))]
    pub async fn list(&self) -> Result<Vec<String>, ProvisionError> {
        let mut containers_client = ContainersClient::new(self.channel.clone());

        let req = ListContainersRequest {
            filters: vec![format!("labels.\"{}\"=={}", AGENT_LABEL_KEY, AGENT_LABEL_VALUE)],
        };
        let req = with_namespace!(req, NAMESPACE);

        let resp = containers_client.list(req).await?;
        let ids = resp.into_inner().containers.into_iter().map(|c| c.id).collect();

        Ok(ids)
    }

    fn build_agent_spec(&self, socket_path: &Path) -> Result<Any, ProvisionError> {
        use oci_spec::runtime::{
            LinuxBuilder, LinuxDeviceBuilder, LinuxDeviceCgroupBuilder, LinuxDeviceType, LinuxNamespaceBuilder, LinuxNamespaceType, LinuxResourcesBuilder,
            MountBuilder, ProcessBuilder, RootBuilder, SpecBuilder,
        };

        let socket_dir = socket_path.parent().unwrap().to_str().expect("socket path is not valid utf-8");

        let spec = SpecBuilder::default()
            .root(RootBuilder::default().path("rootfs").build()?)
            .process(ProcessBuilder::default().args(vec!["/usr/local/bin/agent".to_string()]).cwd("/").build()?)
            .mounts(vec![
                MountBuilder::default().destination("/proc").source("proc").typ("proc").build()?,
                MountBuilder::default()
                    .destination("/dev")
                    .source("tmpfs")
                    .typ("tmpfs")
                    .options(vec![
                        "nosuid".to_string(),
                        "strictatime".to_string(),
                        "mode=755".to_string(),
                        "size=65536k".to_string(),
                    ])
                    .build()?,
                MountBuilder::default()
                    .destination("/dev/pts")
                    .source("devpts")
                    .typ("devpts")
                    .options(vec![
                        "nosuid".to_string(),
                        "noexec".to_string(),
                        "newinstance".to_string(),
                        "ptmxmode=0666".to_string(),
                        "mode=0620".to_string(),
                    ])
                    .build()?,
                MountBuilder::default()
                    .destination("/run/judge-core")
                    .source(socket_dir)
                    .typ("bind")
                    .options(vec!["rbind".to_string(), "rw".to_string()])
                    .build()?,
            ])
            .linux(
                LinuxBuilder::default()
                    .namespaces(vec![
                        LinuxNamespaceBuilder::default().typ(LinuxNamespaceType::Pid).build()?,
                        LinuxNamespaceBuilder::default().typ(LinuxNamespaceType::Ipc).build()?,
                        LinuxNamespaceBuilder::default().typ(LinuxNamespaceType::Uts).build()?,
                        LinuxNamespaceBuilder::default().typ(LinuxNamespaceType::Mount).build()?,
                        LinuxNamespaceBuilder::default().typ(LinuxNamespaceType::Network).build()?,
                    ])
                    .devices(vec![
                        LinuxDeviceBuilder::default()
                            .path("/dev/null")
                            .typ(LinuxDeviceType::C)
                            .major(1)
                            .minor(3)
                            .file_mode(0o666_u32)
                            .build()?,
                        LinuxDeviceBuilder::default()
                            .path("/dev/zero")
                            .typ(LinuxDeviceType::C)
                            .major(1)
                            .minor(5)
                            .file_mode(0o666_u32)
                            .build()?,
                        LinuxDeviceBuilder::default()
                            .path("/dev/random")
                            .typ(LinuxDeviceType::C)
                            .major(1)
                            .minor(8)
                            .file_mode(0o666_u32)
                            .build()?,
                        LinuxDeviceBuilder::default()
                            .path("/dev/urandom")
                            .typ(LinuxDeviceType::C)
                            .major(1)
                            .minor(9)
                            .file_mode(0o666_u32)
                            .build()?,
                        LinuxDeviceBuilder::default()
                            .path("/dev/tty")
                            .typ(LinuxDeviceType::C)
                            .major(5)
                            .minor(0)
                            .file_mode(0o666_u32)
                            .build()?,
                    ])
                    .resources(
                        LinuxResourcesBuilder::default()
                            .devices(vec![
                                // deny all by default
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(false)
                                    .typ(LinuxDeviceType::A)
                                    .access("rwm".to_string())
                                    .build()?,
                                // allow null
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(true)
                                    .typ(LinuxDeviceType::C)
                                    .major(1)
                                    .minor(3)
                                    .access("rwm".to_string())
                                    .build()?,
                                // allow zero
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(true)
                                    .typ(LinuxDeviceType::C)
                                    .major(1)
                                    .minor(5)
                                    .access("rwm".to_string())
                                    .build()?,
                                // allow random
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(true)
                                    .typ(LinuxDeviceType::C)
                                    .major(1)
                                    .minor(8)
                                    .access("rwm".to_string())
                                    .build()?,
                                // allow urandom
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(true)
                                    .typ(LinuxDeviceType::C)
                                    .major(1)
                                    .minor(9)
                                    .access("rwm".to_string())
                                    .build()?,
                                // allow tty
                                LinuxDeviceCgroupBuilder::default()
                                    .allow(true)
                                    .typ(LinuxDeviceType::C)
                                    .major(5)
                                    .minor(0)
                                    .access("rwm".to_string())
                                    .build()?,
                            ])
                            .build()?,
                    )
                    .build()?,
            )
            .build()?;

        let json = serde_json::to_vec(&spec)?;
        Ok(Any {
            type_url: "types.containerd.io/opencontainers/runtime-spec/1/Spec".to_string(),
            value: json,
        })
    }

    /// Wait for mounted agent socket
    async fn wait_for_socket(&self, socket_path: &Path) -> Result<(), ProvisionError> {
        let start = Instant::now();
        let timeout = Duration::from_secs(SOCKET_WAIT_TIMEOUT_SECS);

        while start.elapsed() < timeout {
            if fs::try_exists(socket_path).await? {
                return Ok(());
            }
            sleep(Duration::from_millis(SOCKET_WAIT_INTERVAL_MS)).await;
        }

        Err(ProvisionError::SocketTimeout(SOCKET_WAIT_TIMEOUT_SECS))
    }
}
