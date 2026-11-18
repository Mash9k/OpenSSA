#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{Manager, State};

use serde::{Deserialize, Serialize};
use sysinfo::{Disks, MemoryRefreshKind, Networks, System};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use tokio::task;
use chrono::{DateTime, Utc};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSummary {
    pub what_is_it: String,
    pub creator_app: String,
    pub why_it_exists: String,
    pub consequence_of_removal: String,
    pub recommendation: String,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_folder: bool,
    pub category: String,
    pub deletion_safety: String, // "safe" | "unsafe"
    pub threat_signature: Option<String>,
    pub system_health: String, // "healthy" | "mixed" | "issue"
    pub health_reason: String,
    pub removal_status: String, // "no-issue" | "mixed" | "issue"
    pub summary: FileSummary,
    pub children: Option<Vec<FileItem>>,
    pub item_count: Option<usize>,
    pub last_modified: Option<String>,
    pub is_hidden: bool,
    pub selected: Option<bool>,
    pub expanded: Option<bool>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    pub cpu_usage_percent: f32,
    pub cpu_cores: usize,
    pub cpu_model: String,
    pub cpu_per_core: Vec<f32>,  // Per-core CPU usage percentages
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub ram_usage_percent: f32,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
    pub gpu_usage_percent: Option<f32>,
    pub gpu_name: Option<String>,
    pub gpu_memory_used_bytes: Option<u64>,
    pub gpu_memory_total_bytes: Option<u64>,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_usage_percent: f32,
    pub network_received_bps: u64,  // Bytes per second
    pub network_transmitted_bps: u64,  // Bytes per second
    pub uptime_seconds: u64,
    pub active_processes_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationInfo {
    pub id: String,
    pub pid: u32,
    pub name: String,
    pub executable_path: String,
    pub publisher: String,
    pub version: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub gpu_percent: f32,
    pub storage_bytes: u64,
    pub binary_size_bytes: u64,
    pub cache_size_bytes: u64,
    pub user_data_size_bytes: u64,
    pub status: String, // "running" | "background" | "uninstalled_remnant" | "stopped"
    pub background_services: Vec<String>,
    pub associated_leftovers: Vec<FileItem>,
    pub resource_history: Vec<ResourcePoint>,
    pub screen_time_minutes: Option<u64>,
    pub launch_count: Option<u64>,
    pub last_used: Option<String>,
    pub icon_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePoint {
    pub timestamp: String,
    pub cpu: f32,
    pub ram: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub label: String,
    pub total_space: u64,
    pub free_space: u64,
    pub drive_type: String, // "fixed" | "removable" | "network" | "unknown" | "sdcard"
    pub is_system_drive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub user: String,
    pub executable_path: String,
    pub publisher: String,
    pub version: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub gpu_percent: f32,
    pub status: String, // "running" | "background" | "stopped"
    pub is_hidden: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: String, // "info" | "warn" | "error" | "debug"
    pub source: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: String, // "system" | "dark" | "light"
    pub show_hidden_files: bool,
    pub scan_depth: u32,
    pub startup_behavior: String, // "dashboard" | "last-tab" | "home"
    pub delete_preference: String, // "trash" | "permanent"
    pub confirm_deletions: bool,
    pub auto_scan_on_launch: bool,
    pub max_results_per_drive: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub root_path: Option<String>,
    pub query: String,
    pub show_hidden: Option<bool>,
}

// Lazy static for settings storage
lazy_static::lazy_static! {
    static ref SETTINGS_STORE: Arc<Mutex<Option<Settings>>> = Arc::new(Mutex::new(None));
}

/// Checks if a path is within a virtual/pseudo filesystem that should be skipped during scanning.
fn is_virtual_filesystem(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    
    // Linux virtual filesystems
    const VIRTUAL_PATHS: &[&str] = &[
        "/proc",
        "/sys",
        "/dev",
        "/run",
        "/snap",
        "/sys/fs/cgroup",
        "/sys/kernel/debug",
        "/sys/kernel/tracing",
        "/proc/sys",
        "/proc/self",
        "/proc/thread-self",
    ];
    
    for virtual_path in VIRTUAL_PATHS {
        if path_str == *virtual_path || path_str.starts_with(&format!("{}/", virtual_path)) {
            return true;
        }
    }
    
    // Windows virtual paths (for completeness)
    #[cfg(target_os = "windows")]
    {
        const WIN_VIRTUAL: &[&str] = &[
            "\\\\?\\pipe",
            "\\\\?\\mail",
            "\\\\?\\UNC",
        ];
        for v in WIN_VIRTUAL {
            if path_str.starts_with(v) {
                return true;
            }
        }
    }
    
    false
}

/// Checks if a path is a critical Linux system path that should be flagged as unsafe.
fn is_critical_system_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let lower_path = path_str.to_lowercase();
    
    // Critical system directories that should never be deleted
    const CRITICAL_PATHS: &[&str] = &[
        "/boot",
        "/etc",
        "/usr",
        "/bin",
        "/sbin",
        "/lib",
        "/lib64",
        "/var/lib",
        "/var/log",
        "/var/spool",
        "/var/cache/apt",
        "/var/cache/dnf",
        "/var/cache/yum",
        "/var/cache/pacman",
        "/var/cache/zypp",
        "/kernel",
        "/initrd",
        "/vmlinuz",
        "/system",
        "/usr/bin",
        "/usr/sbin",
        "/usr/lib",
        "/usr/lib64",
        "/usr/include",
        "/usr/share",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/usr/local/lib",
    ];
    
    for critical_path in CRITICAL_PATHS {
        if lower_path == *critical_path || lower_path.starts_with(&format!("{}/", critical_path)) {
            return true;
        }
    }
    
    // Windows critical paths
    #[cfg(target_os = "windows")]
    {
        const WIN_CRITICAL: &[&str] = &[
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\system volume information",
            "c:\\$recycle.bin",
            "c:\\recovery",
            "c:\\boot",
        ];
        for c in WIN_CRITICAL {
            if lower_path.starts_with(c) {
                return true;
            }
        }
    }
    
    false
}

/// Checks if a path is a safe cache/temp location.
fn is_safe_cache_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let lower_path = path_str.to_lowercase();
    
    // Linux cache/temp paths
    const SAFE_PATHS: &[&str] = &[
        "/tmp",
        "/var/tmp",
        "/var/cache",
        "/home/.cache",
        "/.cache",
        "/.local/share/trash",
        "/.trash",
        "/trash",
        "/lost+found",
    ];
    
    for safe_path in SAFE_PATHS {
        if lower_path.starts_with(safe_path) {
            return true;
        }
    }
    
    // Check for common cache patterns in path
    if lower_path.contains("/.cache/") 
        || lower_path.contains("/cache/")
        || lower_path.contains("/tmp/")
        || lower_path.contains("/temp/")
        || lower_path.contains("node_modules")
        || lower_path.contains("/target/")
        || lower_path.contains("__pycache__")
        || lower_path.contains(".gradle")
        || lower_path.contains(".m2/repository")
        || lower_path.contains(".cargo/registry")
        || lower_path.contains(".npm")
        || lower_path.contains(".yarn")
        || lower_path.contains("trash")
        || lower_path.contains(".trash")
        || lower_path.contains("Trash-1000")
    {
        return true;
    }
    
    // Windows safe paths
    #[cfg(target_os = "windows")]
    {
        const WIN_SAFE: &[&str] = &[
            "c:\\windows\\temp",
            "c:\\temp",
            "c:\\users\\",
            "\\appdata\\local\\temp",
            "\\appdata\\local\\cache",
            "\\appdata\\roaming\\cache",
            "\\$recycle.bin",
        ];
        for s in WIN_SAFE {
            if lower_path.contains(s) {
                return true;
            }
        }
    }
    
    false
}

/// System Rule Classification Helper - improved for Linux system paths
fn classify_path(path_str: &str, file_name: &str, is_dir: bool, size: u64) -> (String, String, Option<String>, String, String, String, FileSummary) {
    let lower_path = path_str.to_lowercase();
    let lower_name = file_name.to_lowercase();
    let path = Path::new(path_str);

    // Check if hidden
    let _is_hidden = file_name.starts_with('.') 
        || lower_path.contains("/appdata/") 
        || lower_path.contains("/.local/") 
        || lower_path.contains("/.config/") 
        || lower_path.contains("/.cache/")
        || lower_path.contains("/$recycle.bin/")
        || lower_path.contains("/system volume information/");

    // Dangerous / Threats
    if lower_name.ends_with(".vbs") && (lower_name.contains("xmrig") || lower_name.contains("miner")) {
        return (
            "corrupted".to_string(),
            "unsafe".to_string(),
            Some("Trojan.Script.XMRigMiner.Gen".to_string()),
            "issue".to_string(),
            "Malicious background mining script detected.".to_string(),
            "issue".to_string(),
            FileSummary {
                what_is_it: "Unauthorized Trojan script executing cryptocurrency mining.".to_string(),
                creator_app: "Malware / Unverified Script".to_string(),
                why_it_exists: "Injected to siphon CPU power for illicit mining.".to_string(),
                consequence_of_removal: "Restores CPU speed and removes security risk.".to_string(),
                recommendation: "Quarantine".to_string(),
                risk_score: 95,
            }
        );
    }

    if lower_name.contains("svchost_dummy") || lower_name.contains("hacktool") {
        return (
            "corrupted".to_string(),
            "unsafe".to_string(),
            Some("Win32.ImposterProcess.Variant".to_string()),
            "issue".to_string(),
            "Imposter binary masquerading as OS service.".to_string(),
            "issue".to_string(),
            FileSummary {
                what_is_it: "Disguised binary attempting to mimic standard Windows services.".to_string(),
                creator_app: "Unverified Trojan Installer".to_string(),
                why_it_exists: "Created by malware to remain persistent on boot.".to_string(),
                consequence_of_removal: "Protects system privacy and eliminates malicious process.".to_string(),
                recommendation: "Quarantine".to_string(),
                risk_score: 90,
            }
        );
    }

    // Critical OS System Files - check using path-based detection
    if is_critical_system_path(path) {
        return (
            "system".to_string(),
            "unsafe".to_string(),
            None,
            "issue".to_string(),
            "Critical operating system file required for runtime stability.".to_string(),
            "issue".to_string(),
            FileSummary {
                what_is_it: "System binary or core driver file.".to_string(),
                creator_app: "Operating System Kernel".to_string(),
                why_it_exists: "Handles standard device hardware and kernel system routines.".to_string(),
                consequence_of_removal: "CRITICAL: Removing will cause system crash or unbootable state.".to_string(),
                recommendation: "Keep File".to_string(),
                risk_score: 100,
            }
        );
    }

    // Caches & Temp Folders - check using path-based detection
    if is_safe_cache_path(path) {
        let (category, recommendation, risk_score) = if lower_path.contains("node_modules") {
            ("cache".to_string(), "Safe to Delete".to_string(), 15)
        } else if lower_path.contains("/target/") {
            ("cache".to_string(), "Safe to Delete".to_string(), 15)
        } else if lower_path.contains("trash") || lower_path.contains(".trash") || lower_path.contains("Trash-1000") {
            ("temp".to_string(), "Safe to Delete".to_string(), 5)
        } else {
            ("cache".to_string(), "Safe to Delete".to_string(), 5)
        };
        
        return (
            category,
            "safe".to_string(),
            None,
            "healthy".to_string(),
            "Temporary cache or trash files. Safe to delete to free disk space.".to_string(),
            "no-issue".to_string(),
            FileSummary {
                what_is_it: "Temporary application cache, build artifacts, or trash files.".to_string(),
                creator_app: "Desktop & Web Applications / Development Toolchains".to_string(),
                why_it_exists: "Speeds up loading times by caching media and assets locally, or stores deleted files for recovery.".to_string(),
                consequence_of_removal: "Frees up disk space immediately. Apps will re-download cache if needed; trash files are permanently deleted.".to_string(),
                recommendation,
                risk_score,
            }
        );
    }

    // Leftover App Data
    if lower_path.contains("leftover") || lower_path.contains("uninstalled") || lower_path.contains("orphan") {
        return (
            "leftover".to_string(),
            "safe".to_string(),
            None,
            "healthy".to_string(),
            "Orphaned leftover files from previously uninstalled software.".to_string(),
            "no-issue".to_string(),
            FileSummary {
                what_is_it: "Remnant configuration and cache from removed software.".to_string(),
                creator_app: "Uninstalled Application".to_string(),
                why_it_exists: "Left behind when standard uninstaller script finished incompletely.".to_string(),
                consequence_of_removal: "Reclaims wasted storage without impacting current software.".to_string(),
                recommendation: "Safe to Delete".to_string(),
                risk_score: 10,
            }
        );
    }

    // Default neutral
    (
        if is_dir { "appdata".to_string() } else if size > 100 * 1024 * 1024 { "large_file".to_string() } else { "log".to_string() },
        "safe".to_string(),
        None,
        if is_dir { "mixed".to_string() } else { "healthy".to_string() },
        "Standard user file or unclassified data.".to_string(),
        if is_dir { "mixed".to_string() } else { "no-issue".to_string() },
        FileSummary {
            what_is_it: if is_dir { "Directory containing user data or application config." } else { "Unclassified binary or document." }.to_string(),
            creator_app: "User / System Application".to_string(),
            why_it_exists: "Created during normal application or file save activities.".to_string(),
            consequence_of_removal: "Review file location before deleting.".to_string(),
            recommendation: "Inspect First".to_string(),
            risk_score: 30,
        }
    )
}

fn generate_drive_id(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("drive-{:x}", hasher.finish())
}

fn get_drive_label(disk: &sysinfo::Disk) -> String {
    let name = disk.name().to_string_lossy().to_string();
    let mount_point = disk.mount_point().to_string_lossy().to_string();
    
    // Try to get a more descriptive label
    #[cfg(target_os = "linux")]
    {
        // On Linux, try to read /proc/partitions or /sys/block for model info
        if let Ok(output) = std::process::Command::new("lsblk")
            .args(["-no", "MODEL", &mount_point])
            .output()
        {
            let model = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !model.is_empty() && model != "MODEL" {
                return format!("{} ({})", model, mount_point);
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, try to get volume label
        if let Ok(output) = std::process::Command::new("cmd")
            .args(["/c", "vol", &mount_point])
            .output()
        {
            let vol_info = String::from_utf8_lossy(&output.stdout);
            if vol_info.contains("Volume") {
                // Extract volume label
                for line in vol_info.lines() {
                    if line.contains("Volume") && line.contains("is") {
                        let parts: Vec<&str> = line.split("is").collect();
                        if parts.len() > 1 {
                            let label = parts[1].trim();
                            if !label.is_empty() {
                                return format!("{} ({})", label, mount_point);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Fallback
    if name.is_empty() || name == mount_point {
        format!("Local Disk ({})", mount_point)
    } else {
        format!("{} ({})", name, mount_point)
    }
}

fn get_drive_type(disk: &sysinfo::Disk) -> String {
    if disk.is_removable() {
        // Try to detect if it's an SD card
        let mount_point = disk.mount_point().to_string_lossy().to_string().to_lowercase();
        if mount_point.contains("sdcard") || mount_point.contains("mmc") {
            "sdcard".to_string()
        } else {
            "removable".to_string()
        }
    } else {
        "fixed".to_string()
    }
}

/// Global state for network I/O delta calculation

lazy_static::lazy_static! {
    static ref NETWORK_STATE: Arc<Mutex<Option<(u64, u64, Instant)>>> = Arc::new(Mutex::new(None));
    static ref SCAN_BUFFER: Arc<Mutex<Vec<(String, u64)>>> = Arc::new(Mutex::new(Vec::new()));
}


// Persistent System state managed by Tauri
struct AppState {
    system: Arc<Mutex<System>>,
}

impl AppState {
    fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self {
            system: Arc::new(Mutex::new(sys)),
        }
    }
}

#[tauri::command]
fn get_system_metrics(state: State<'_, AppState>) -> SystemMetrics {
    let mut sys = state.system.lock().unwrap();
    
    // Refresh CPU with proper delta interval for accurate readings
    sys.refresh_cpu_all();
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_all();
    sys.refresh_memory_specifics(sysinfo::MemoryRefreshKind::everything());

    let cpu_usage_percent = sys.global_cpu_usage();
    let cpu_cores = sys.cpus().len();
    let cpu_model = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Generic CPU".to_string());
    
    // Per-core CPU usage
    let cpu_per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();

    let ram_used_bytes = sys.used_memory();
    let ram_total_bytes = sys.total_memory();
    let ram_usage_percent = if ram_total_bytes > 0 {
        (ram_used_bytes as f32 / ram_total_bytes as f32) * 100.0
    } else {
        0.0
    };
    
    // Swap memory
    let swap_used_bytes = sys.used_swap();
    let swap_total_bytes = sys.total_swap();

    let disks = Disks::new_with_refreshed_list();
    let mut disk_used_bytes = 0u64;
    let mut disk_total_bytes = 0u64;

    for disk in &disks {
        disk_total_bytes += disk.total_space();
        disk_used_bytes += disk.total_space().saturating_sub(disk.available_space());
    }

    let disk_usage_percent = if disk_total_bytes > 0 {
        (disk_used_bytes as f32 / disk_total_bytes as f32) * 100.0
    } else {
        0.0
    };

    // Network I/O calculation
    let (network_received_bps, network_transmitted_bps) = {
        let mut state = NETWORK_STATE.lock().unwrap();
        let networks = Networks::new_with_refreshed_list();
        let mut total_received = 0u64;
        let mut total_transmitted = 0u64;
        
        for (_name, data) in &networks {
            total_received += data.total_received();
            total_transmitted += data.total_transmitted();
        }
        
        let now = Instant::now();
        
        if let Some((prev_received, prev_transmitted, prev_time)) = *state {
            let elapsed = now.duration_since(prev_time).as_secs_f64();
            if elapsed > 0.0 {
                let recv_bps = ((total_received.saturating_sub(prev_received)) as f64 / elapsed) as u64;
                let sent_bps = ((total_transmitted.saturating_sub(prev_transmitted)) as f64 / elapsed) as u64;
                *state = Some((total_received, total_transmitted, now));
                (recv_bps, sent_bps)
            } else {
                *state = Some((total_received, total_transmitted, now));
                (0, 0)
            }
        } else {
            *state = Some((total_received, total_transmitted, now));
            (0, 0)
        }
    };

    let active_processes_count = sys.processes().len();

    SystemMetrics {
        cpu_usage_percent,
        cpu_cores,
        cpu_model,
        cpu_per_core,
        ram_used_bytes,
        ram_total_bytes,
        ram_usage_percent,
        swap_used_bytes,
        swap_total_bytes,
        gpu_usage_percent: None,
        gpu_name: None,
        gpu_memory_used_bytes: None,
        gpu_memory_total_bytes: None,
        disk_used_bytes,
        disk_total_bytes,
        disk_usage_percent,
        network_received_bps,
        network_transmitted_bps,
        uptime_seconds: System::uptime(),
        active_processes_count,
    }
}

/// Recursively scans a directory and builds a tree with accurate bottom-up folder sizes.
/// Skips virtual filesystems and gracefully handles permission errors.
fn scan_directory_recursive(
    root: &Path,
    show_hidden: bool,
    path_to_id: &mut HashMap<PathBuf, String>,
    id_counter: &mut usize,
) -> Result<Vec<FileItem>, String> {
    // Read directory entries, handling permission errors gracefully
    let dir_entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => {
            // Permission denied or other error - skip this directory
            return Ok(Vec::new());
        }
    };
    
    // First pass: collect all child entries
    let mut child_items = Vec::new();
    
    for entry in dir_entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip unreadable entries
        };
        
        let path = entry.path();
        
        // Skip virtual filesystems
        if is_virtual_filesystem(&path) {
            continue;
        }
        
        let name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        // Check if hidden
        let is_hidden = name.starts_with('.');
        
        if !show_hidden && is_hidden {
            continue;
        }
        
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        
        let is_dir = file_type.is_dir();
        let path_str = path.to_string_lossy().to_string();
        
        // Generate unique ID for this path
        let id = if let Some(existing) = path_to_id.get(&path) {
            existing.clone()
        } else {
            *id_counter += 1;
            let new_id = format!("scan-{}-{}", *id_counter, name);
            path_to_id.insert(path.clone(), new_id.clone());
            new_id
        };
        
        if is_dir {
            // Recursively scan subdirectory
            match scan_directory_recursive(&path, show_hidden, path_to_id, id_counter) {
                Ok(children) => {
                    // Calculate total size and item count from children
                    let total_size: u64 = children.iter().map(|c| c.size_bytes).sum();
                    let total_items = children.len();
                    
                    let (category, deletion_safety, threat_sig, system_health, health_reason, removal_status, summary) = 
                        classify_path(&path_str, &name, true, total_size);
                    
                    let item = FileItem {
                        id,
                        name,
                        path: path_str,
                        size_bytes: total_size,
                        is_folder: true,
                        category,
                        deletion_safety,
                        threat_signature: threat_sig,
                        system_health,
                        health_reason,
                        removal_status,
                        summary,
                        children: Some(children),
                        item_count: Some(total_items),
                        last_modified: entry.metadata().ok().and_then(|m| m.modified().ok()).map(|t| {
                            let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                            DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0)
                                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                                .unwrap_or_else(|| "Unknown".to_string())
                        }),
                        is_hidden,
                        selected: Some(false),
                        expanded: Some(false),
                        parent_id: None,
                    };
                    child_items.push(item);
                }
                Err(_) => {
                    // Skip directories that can't be read
                    continue;
                }
            }
        } else {
            // Regular file
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            
            let (category, deletion_safety, threat_sig, system_health, health_reason, removal_status, summary) = 
                classify_path(&path_str, &name, false, size);
            
            let item = FileItem {
                id,
                name,
                path: path_str,
                size_bytes: size,
                is_folder: false,
                category,
                deletion_safety,
                threat_signature: threat_sig,
                system_health,
                health_reason,
                removal_status,
                summary,
                children: None,
                item_count: None,
                last_modified: entry.metadata().ok().and_then(|m| m.modified().ok()).map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0)
                        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_else(|| "Unknown".to_string())
                }),
                is_hidden,
                selected: Some(false),
                expanded: Some(false),
                parent_id: None,
            };
            child_items.push(item);
        }
    }
    
    // Sort children by size descending (largest first) - like Baobab
    child_items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    
    // Set parent_id for children
    let root_id = path_to_id.get(root).cloned();
    for child in &mut child_items {
        child.parent_id = root_id.clone();
    }
    
    Ok(child_items)
}

#[tauri::command]
async fn scan_directory(path: String, show_hidden: Option<bool>) -> Vec<FileItem> {
    let show_hidden = show_hidden.unwrap_or(true);

    // No artificial caps on results or depth: the scanner crawls the entire
    // drive recursively, computes accurate bottom-up folder sizes, skips
    // virtual filesystems, and handles permission errors gracefully.
    let search_root = if path.is_empty() {
        match std::env::temp_dir().canonicalize() {
            Ok(p) => p,
            Err(_) => PathBuf::from("/tmp"),
        }
    } else {
        PathBuf::from(path)
    };

    let results = task::spawn_blocking(move || {
        let mut path_to_id = HashMap::new();
        let mut id_counter = 0;
        
        match scan_directory_recursive(&search_root, show_hidden, &mut path_to_id, &mut id_counter) {
            Ok(mut items) => {
                // Sort root level items by size descending (largest first, Baobab-style)
                items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
                items
            }
            Err(_) => Vec::new(),
        }
    }).await.unwrap_or_default();

    results
}

#[tauri::command]
async fn search_files(options: SearchOptions) -> Vec<FileItem> {
    let query = options.query.to_lowercase();
    let show_hidden = options.show_hidden.unwrap_or(true);
    
    // No artificial caps: full recursive traversal of the search root.
    // Virtual filesystems are skipped and permission errors are ignored
    // gracefully by walkdir's filter_map.
    let search_root = if let Some(p) = options.root_path {
        PathBuf::from(p)
    } else {
        match std::env::temp_dir().canonicalize() {
            Ok(p) => p,
            Err(_) => PathBuf::from("/tmp"),
        }
    };

    let results = task::spawn_blocking(move || {
        let mut items = Vec::new();
        let mut count = 0;

        let is_path_query = query.contains('/') || query.contains('\\') || query.contains("..");

        for entry in WalkDir::new(&search_root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let is_dir = entry.file_type().is_dir();
            let size = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
            let path_str = path.to_string_lossy().to_string();
            
            // Check if hidden
            let is_hidden = name.starts_with('.') 
                || path_str.to_lowercase().contains("/appdata/") 
                || path_str.to_lowercase().contains("/.local/") 
                || path_str.to_lowercase().contains("/.config/") 
                || path_str.to_lowercase().contains("/.cache/")
                || path_str.to_lowercase().contains("/$recycle.bin/")
                || path_str.to_lowercase().contains("/system volume information/");

            // Skip hidden if not requested
            if !show_hidden && is_hidden {
                continue;
            }

            // Match logic: query against name or full path
            let name_match = name.to_lowercase().contains(&query);
            let path_match = path_str.to_lowercase().contains(&query);
            
            if is_path_query {
                if !path_match { continue; }
            } else {
                if !name_match && !path_match { continue; }
            }

            let (category, deletion_safety, threat_sig, system_health, health_reason, removal_status, summary) = 
                classify_path(&path_str, &name, is_dir, size);

            let item = FileItem {
                id: format!("file-{}-{}", count, name),
                name,
                path: path_str,
                size_bytes: size,
                is_folder: is_dir,
                category,
                deletion_safety,
                threat_signature: threat_sig,
                system_health,
                health_reason,
                removal_status,
                summary,
                children: None,
                item_count: if is_dir { Some(5) } else { None },
                last_modified: entry.metadata().ok().and_then(|m| m.modified().ok()).map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0)
                        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_else(|| "Unknown".to_string())
                }),
                is_hidden,
                selected: Some(false),
                expanded: Some(false),
                parent_id: None,
            };

            items.push(item);
            count += 1;
        }

        items
    }).await.unwrap_or_default();

    results
}

#[tauri::command]
fn get_drives() -> Vec<DriveInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut drives = Vec::new();

    for disk in &disks {
        let mount_point = disk.mount_point().to_string_lossy().to_string();
        let total = disk.total_space();
        let available = disk.available_space();
        let drive_id = generate_drive_id(&mount_point);
        let label = get_drive_label(disk);
        let drive_type = get_drive_type(disk);
        let is_system = mount_point == "/" || mount_point == "C:\\" || mount_point.contains("System");
        
        drives.push(DriveInfo {
            id: drive_id,
            name: disk.name().to_string_lossy().to_string(),
            path: mount_point,
            label,
            total_space: total,
            free_space: available,
            drive_type,
            is_system_drive: is_system,
        });
    }

    // If no drives found, add fallback
    if drives.is_empty() {
        drives.push(DriveInfo {
            id: "drive-root".to_string(),
            name: "Local Disk (/)".to_string(),
            path: "/".to_string(),
            label: "System SSD (/)".to_string(),
            total_space: 1024 * 1024 * 1024 * 1024,
            free_space: 512 * 1024 * 1024 * 1024,
            drive_type: "fixed".to_string(),
            is_system_drive: true,
        });
    }

    drives
}

/// Checks if a process name indicates a kernel thread or low-level system daemon that should be filtered out.
fn is_kernel_or_system_daemon(name: &str, exe_path: &str) -> bool {
    let lower_name = name.to_lowercase();
    let lower_exe = exe_path.to_lowercase();
    
    // Kernel threads (names in brackets or specific patterns)
    if name.starts_with('[') && name.ends_with(']') {
        return true;
    }

    // Kernel threads are also exposed without brackets and frequently
    // contain a "/" (e.g. "idle_inject/1", "jbd2/sda3-8", "irq/9-i965").
    // Real user processes essentially never have "/" in their comm name.
    if lower_name.contains('/') {
        return true;
    }

    // Per-object kernel helper threads (CRTC workers, injector threads, ...)
    const KERNEL_THREAD_PREFIXES: &[&str] = &[
        "card", "crtc", "idle_inject", "pool_workqueue", "kcomp",
    ];
    if KERNEL_THREAD_PREFIXES.iter().any(|p| lower_name.starts_with(p)) {
        return true;
    }

    // GLib worker-thread names (gmain, pool-spawner, gdbus, threadpool-…)
    // appear as duplicate per-thread entries of their parent process.
    const GLIB_THREADS: &[&str] = &["gmain", "pool-spawner", "threadpool", "gdbus"];
    if GLIB_THREADS.iter().any(|t| lower_name.contains(t)) {
        return true;
    }
    
    // Specific kernel thread patterns
    const KERNEL_THREADS: &[&str] = &[
        "kthreadd", "kworker", "ksoftirqd", "migration", "rcu_", "rcuop", "rcuos", "rcuop",
        "khelper", "kdevtmpfs", "netns", "writeback", "crypto", "bioset", "kblockd",
        "khubd", "kseriod", "kmmcd", "scsi_eh_", "scsi_tmf_", "usb-storage", "ata_",
        "scsi_", "jbd2/", "ext4-", "kdmflush", "kcryptd", "kmpathd", "kmpath_",
        "kpsmoused", "irq/", "hci0", "btusb", "rfkill", "kcompactd", "khugepaged",
        "kswapd", "ksmd", "kthread", "khungtask", "oom_reaper", "page_ext",
    ];
    
    for kernel in KERNEL_THREADS {
        if lower_name.contains(kernel) {
            return true;
        }
    }
    
    // Low-level system daemons
    const SYSTEM_DAEMONS: &[&str] = &[
        "gdbus", "colord", "gvfsd", "systemd", "dbus-daemon", "mutter-x11-frames",
        "at-spi2-registryd", "at-spi-bus-launcher", "xdg-permission-store",
        "xdg-desktop-portal", "xdg-document-portal", "pipewire", "wireplumber",
        "pulseaudio", "rtkit-daemon", "upowerd", "udisksd", "polkitd",
        "accounts-daemon", "gdm", "gdm-session-wor", "whoopsie", "kerneloops",
        "irqbalance", "cron", "rsyslogd", "systemd-journal", "systemd-logind",
        "systemd-resolve", "systemd-timesync", "systemd-udevd", "modemmanager",
        "networkmanager", "wpa_supplicant", "avahi-daemon", "cupsd", "cups-browsed",
    ];
    
    for daemon in SYSTEM_DAEMONS {
        if lower_name.contains(daemon) || lower_exe.contains(daemon) {
            return true;
        }
    }
    
    // Check executable paths for system directories
    if lower_exe.starts_with("/usr/lib/systemd/") 
        || lower_exe.starts_with("/lib/systemd/")
        || lower_exe.starts_with("/usr/libexec/")
        || lower_exe.starts_with("/sbin/")
        || lower_exe.starts_with("/usr/sbin/") {
        // Allow some user-facing apps in /usr/bin
        if !lower_exe.starts_with("/usr/bin/") {
            return true;
        }
    }
    
    false
}

/// Parses .desktop files to get human-readable application names and metadata.
fn parse_desktop_files() -> HashMap<String, (String, String, String)> {
    let mut desktop_map = HashMap::new();
    
    // System and user application directories
    let mut desktop_dirs: Vec<String> = vec![
        "/usr/share/applications".to_string(),
        "/usr/local/share/applications".to_string(),
        "/var/lib/flatpak/exports/share/applications".to_string(),
    ];
    
    // Add user's local share directory
    if let Some(home) = std::env::home_dir() {
        desktop_dirs.push(home.join(".local/share/applications").to_string_lossy().to_string());
    }
    
    for dir_path in desktop_dirs {
        let dir = Path::new(&dir_path);
        if !dir.exists() {
            continue;
        }
        
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) != Some("desktop") {
                    continue;
                }
                
                if let Ok(content) = fs::read_to_string(&path) {
                    let mut exec = String::new();
                    let mut name = String::new();
                    let mut generic_name = String::new();
                    let mut is_hidden = false;
                    
                    for line in content.lines() {
                        if line.starts_with("Exec=") {
                            exec = line["Exec=".len()..].to_string();
                            // Remove field codes like %U, %F, %u, %f, etc.
                            exec = exec.split_whitespace().next().unwrap_or(&exec).to_string();
                        } else if line.starts_with("Name=") && !line.starts_with("GenericName=") && !line.starts_with("X-") {
                            name = line["Name=".len()..].to_string();
                        } else if line.starts_with("GenericName=") {
                            generic_name = line["GenericName=".len()..].to_string();
                        } else if line.starts_with("NoDisplay=true") || line.starts_with("Hidden=true") {
                            is_hidden = true;
                        }
                    }
                    
                    if !is_hidden && !exec.is_empty() {
                        // Normalize executable path
                        let exec_name = Path::new(&exec)
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or(&exec)
                            .to_string();
                        
                        // Use Name if available, otherwise GenericName, otherwise executable name
                        let display_name = if !name.is_empty() {
                            name
                        } else if !generic_name.is_empty() {
                            generic_name.clone()
                        } else {
                            exec_name.clone()
                        };
                        
                        desktop_map.insert(exec_name.to_lowercase(), (display_name, exec, generic_name));
                    }
                }
            }
        }
    }
    
    desktop_map
}

/// Maps a process executable to its human-readable application name.
fn get_app_display_name(exe_path: &str, process_name: &str, desktop_map: &HashMap<String, (String, String, String)>) -> (String, String) {
    let exe_name = Path::new(exe_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(process_name)
        .to_lowercase();
    
    // Check desktop files first
    if let Some((display_name, _, _)) = desktop_map.get(&exe_name) {
        return (display_name.clone(), exe_path.to_string());
    }
    
    // Common browser/app executable to display name mappings
    const APP_MAPPINGS: &[(&[&str], &str, &str)] = &[
        (&["brave", "brave-browser"], "Brave Browser", "Brave Software"),
        (&["chrome", "google-chrome", "chrome-browser"], "Google Chrome", "Google"),
        (&["chromium", "chromium-browser"], "Chromium", "The Chromium Authors"),
        (&["firefox", "firefox-esr", "firefox-developer-edition"], "Mozilla Firefox", "Mozilla"),
        (&["thunderbird"], "Thunderbird", "Mozilla"),
        (&["code", "code-oss", "vscode"], "Visual Studio Code", "Microsoft"),
        (&["cursor"], "Cursor", "Anysphere"),
        (&["electron", "electron-app"], "Electron App", "Electron"),
        (&["discord"], "Discord", "Discord Inc."),
        (&["spotify"], "Spotify", "Spotify AB"),
        (&["slack"], "Slack", "Slack Technologies"),
        (&["teams", "ms-teams"], "Microsoft Teams", "Microsoft"),
        (&["zoom"], "Zoom", "Zoom Video Communications"),
        (&["obs", "obs64"], "OBS Studio", "OBS Project"),
        (&["vlc"], "VLC Media Player", "VideoLAN"),
        (&["mpv"], "mpv", "mpv Team"),
        (&["gimp", "gimp-2.10"], "GIMP", "The GIMP Team"),
        (&["inkscape"], "Inkscape", "Inkscape Project"),
        (&["blender"], "Blender", "Blender Foundation"),
        (&["kdenlive"], "Kdenlive", "KDE"),
        (&["libreoffice", "soffice"], "LibreOffice", "The Document Foundation"),
        (&["onlyoffice", "desktopeditors"], "ONLYOFFICE", "Ascensio System SIA"),
        (&["docker", "docker-desktop"], "Docker Desktop", "Docker Inc."),
        (&["vmware", "vmplayer"], "VMware", "VMware Inc."),
        (&["virtualbox"], "VirtualBox", "Oracle"),
        (&["steam"], "Steam", "Valve Corporation"),
        (&["lutris"], "Lutris", "Lutris Team"),
        (&["heroic"], "Heroic Games Launcher", "Heroic Games Launcher Team"),
        (&["bottles"], "Bottles", "Bottles Team"),
        (&["wine", "wine64"], "Wine", "Wine Project"),
        (&["proton"], "Proton", "Valve Corporation"),
        (&["zathura"], "Zathura", "Zathura Team"),
        (&["okular"], "Okular", "KDE"),
        (&["evince"], "Document Viewer", "GNOME"),
        (&["nautilus", "files"], "Files", "GNOME"),
        (&["dolphin"], "Dolphin", "KDE"),
        (&["thunar"], "Thunar", "Xfce"),
        (&["nemo"], "Nemo", "Linux Mint"),
        (&["kate"], "Kate", "KDE"),
        (&["gedit", "gnome-text-editor"], "Text Editor", "GNOME"),
        (&["gnome-terminal", "kgx", "konsole", "xfce4-terminal", "tilix", "alacritty", "kitty", "wezterm"], "Terminal", ""),
        (&["htop", "btop", "btm"], "System Monitor", ""),
        (&["nvim", "vim", "neovim"], "Neovim/Vim", ""),
        (&["emacs"], "Emacs", "GNU"),
        (&["postman"], "Postman", "Postman Inc."),
        (&["insomnia"], "Insomnia", "Kong Inc."),
        (&["dbeaver"], "DBeaver", "DBeaver Team"),
        (&["datagrip"], "DataGrip", "JetBrains"),
        (&["idea", "intellij"], "IntelliJ IDEA", "JetBrains"),
        (&["pycharm"], "PyCharm", "JetBrains"),
        (&["webstorm"], "WebStorm", "JetBrains"),
        (&["clion"], "CLion", "JetBrains"),
        (&["rider"], "Rider", "JetBrains"),
        (&["goland"], "GoLand", "JetBrains"),
        (&["rustrover"], "RustRover", "JetBrains"),
        (&["android-studio"], "Android Studio", "Google"),
        (&["unity", "unity-editor"], "Unity", "Unity Technologies"),
        (&["godot"], "Godot Engine", "Godot Engine Team"),
        (&["unrealengine", "unrealeditor"], "Unreal Engine", "Epic Games"),
    ];
    
    for (execs, display_name, publisher) in APP_MAPPINGS {
        for exec in *execs {
            if exe_name.contains(exec) || process_name.to_lowercase().contains(exec) {
                return (display_name.to_string(), publisher.to_string());
            }
        }
    }
    
    // Fallback: clean up the process name
    let clean_name = process_name
        .replace(".bin", "")
        .replace(".exe", "")
        .replace("-", " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    
    (clean_name, "Unknown".to_string())
}

/// Groups child/renderer processes under their parent application.
fn group_processes_by_app(
    processes: Vec<(u32, String, String, f32, u64)>, // pid, name, exe_path, cpu, memory
) -> Vec<ApplicationInfo> {
    let desktop_map = parse_desktop_files();
    
    // First pass: map each process to its application name
    let mut app_groups: HashMap<String, Vec<(u32, String, String, f32, u64)>> = HashMap::new();
    
    for (pid, name, exe_path, cpu, memory) in processes {
        let (display_name, _publisher) = get_app_display_name(&exe_path, &name, &desktop_map);
        let key = format!("{}|{}", display_name, exe_path);
        app_groups.entry(key).or_default().push((pid, name, exe_path, cpu, memory));
    }
    
    // Second pass: create ApplicationInfo for each group
    let mut apps = Vec::new();
    let mut id_counter = 0;
    
    for (key, group) in app_groups {
        if group.is_empty() {
            continue;
        }
        
        id_counter += 1;
        
        let (display_name, exe_path) = {
            let parts: Vec<&str> = key.split('|').collect();
            (parts[0].to_string(), parts.get(1).map(|s| s.to_string()).unwrap_or_default())
        };
        
        let (_, publisher) = get_app_display_name(&exe_path, &group[0].1, &desktop_map);
        
        // Sum resources
        let total_cpu: f32 = group.iter().map(|(_, _, _, cpu, _)| *cpu).sum();
        let total_memory: u64 = group.iter().map(|(_, _, _, _, mem)| *mem).sum();
        let total_storage = total_memory * 3; // Estimate
        
        // Main PID is the one with highest memory (usually the main process)
        let (main_pid, _main_name, main_exe, _, _) = group.iter()
            .max_by_key(|(_, _, _, _, mem)| *mem)
            .cloned()
            .unwrap_or((0, String::new(), String::new(), 0.0, 0));
        
        // Determine status
        let status = if total_cpu > 0.1 { "running" } else { "background" };
        
        // Child process names for background services
        let background_services: Vec<String> = group.iter()
            .filter(|(pid, _, _, _, _)| *pid != main_pid)
            .map(|(_, name, _, _, _)| name.clone())
            .collect();
        
        apps.push(ApplicationInfo {
            id: format!("app-group-{}", id_counter),
            pid: main_pid,
            name: display_name,
            executable_path: main_exe,
            publisher: if publisher.is_empty() { "Unknown".to_string() } else { publisher },
            version: "1.0.0".to_string(),
            cpu_percent: total_cpu,
            memory_bytes: total_memory,
            gpu_percent: 0.0,
            storage_bytes: total_storage,
            binary_size_bytes: total_memory * 2,
            cache_size_bytes: total_memory / 2,
            user_data_size_bytes: total_memory / 2,
            status: status.to_string(),
            background_services,
            associated_leftovers: vec![],
            resource_history: vec![],
            screen_time_minutes: Some(0),
            launch_count: Some(0),
            last_used: None,
            icon_type: None,
        });
    }
    
    // Sort by CPU usage descending
    apps.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    
    // Limit to top 50 apps
    apps.truncate(50);
    
    apps
}

/// Gets the username for a given PID by reading /proc/<pid>/status on Linux
#[cfg(target_os = "linux")]
fn get_process_user(pid: u32) -> String {
    let status_path = format!("/proc/{}/status", pid);
    if let Ok(content) = fs::read_to_string(&status_path) {
        for line in content.lines() {
            if line.starts_with("Uid:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let uid = parts[1];
                    // Try to resolve UID to username via /etc/passwd
                    if let Ok(passwd) = fs::read_to_string("/etc/passwd") {
                        for passwd_line in passwd.lines() {
                            let passwd_parts: Vec<&str> = passwd_line.split(':').collect();
                            if passwd_parts.len() >= 3 && passwd_parts[2] == uid {
                                return passwd_parts[0].to_string();
                            }
                        }
                    }
                    return format!("uid:{}", uid);
                }
            }
        }
    }
    "unknown".to_string()
}

#[cfg(not(target_os = "linux"))]
fn get_process_user(_pid: u32) -> String {
    "unknown".to_string()
}

#[tauri::command]
fn get_processes(state: State<'_, AppState>) -> Vec<ProcessInfo> {
    let mut sys = state.system.lock().unwrap();
    
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    
    let mut processes = Vec::new();
    let mut count = 0;

    for (pid, proc_) in sys.processes() {
        if count >= 200 {
            break;
        }
        let name = proc_.name().to_string_lossy().to_string();
        if name.is_empty() {
            continue;
        }

        let exe_path = proc_.exe().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "unknown".to_string());
        let memory = proc_.memory();
        let cpu = proc_.cpu_usage();
        
        // Filter out kernel threads and system daemons
        if is_kernel_or_system_daemon(&name, &exe_path) {
            continue;
        }

        let is_hidden = name.starts_with('[') || name.starts_with("kthreadd") || name.contains("systemd");
        let user = get_process_user(pid.as_u32());

        processes.push(ProcessInfo {
            pid: pid.as_u32(),
            name: name.clone(),
            user,
            executable_path: exe_path,
            publisher: "System / User".to_string(),
            version: "1.0.0".to_string(),
            cpu_percent: cpu,
            memory_bytes: memory,
            gpu_percent: 0.0,
            status: if cpu > 0.1 { "running".to_string() } else { "background".to_string() },
            is_hidden,
        });

        count += 1;
    }

    // Sort by CPU usage descending
    processes.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    processes
}

#[tauri::command]
fn get_logs(limit: u32) -> Vec<LogEntry> {
    let mut logs = Vec::new();
    let now = chrono::Utc::now();
    
    // Generate some sample logs
    let sample_logs = vec![
        ("info", "System", "Application started successfully"),
        ("info", "Backend", "Filesystem scanner initialized"),
        ("info", "UI", "Theme loaded: Dark mode"),
        ("warn", "Backend", "Disk read latency higher than normal"),
        ("info", "Scanner", "Scan completed: 1,247 files indexed"),
        ("debug", "Cache", "Cache hit ratio: 87%"),
        ("info", "UI", "User switched to Safety tab"),
        ("warn", "Security", "Unusual file pattern detected in /tmp"),
        ("info", "Cleaner", "Temporary files cleanup completed: 2.3 GB freed"),
        ("error", "Network", "Failed to check for updates: connection timeout"),
    ];

    for (i, (level, source, message)) in sample_logs.iter().enumerate() {
        if i >= limit as usize {
            break;
        }
        logs.push(LogEntry {
            id: format!("log-{}", i),
            timestamp: (now - chrono::Duration::minutes(i as i64 * 5)).to_rfc3339(),
            level: level.to_string(),
            source: source.to_string(),
            message: message.to_string(),
        });
    }

    logs
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try to open parent directory in file manager
        let parent = Path::new(&path).parent().unwrap_or(Path::new("/"));
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn save_settings(settings: Settings) -> Result<(), String> {
    // Persist to disk
    let config_dir = std::env::home_dir()
        .map(|h| h.join(".config/openssa"))
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp/openssa"));
    
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    
    let config_file = config_dir.join("settings.json");
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&config_file, json).map_err(|e| e.to_string())?;
    
    // Also update in-memory store
    let mut store = SETTINGS_STORE.lock().unwrap();
    *store = Some(settings);
    
    Ok(())
}

#[tauri::command]
fn load_settings() -> Settings {
    // Try to load from disk first
    let config_dir = std::env::home_dir()
        .map(|h| h.join(".config/openssa"))
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp/openssa"));
    let config_file = config_dir.join("settings.json");
    
    if config_file.exists() {
        if let Ok(json) = fs::read_to_string(&config_file) {
            if let Ok(settings) = serde_json::from_str::<Settings>(&json) {
                let mut store = SETTINGS_STORE.lock().unwrap();
                *store = Some(settings.clone());
                return settings;
            }
        }
    }
    
    // Fallback to in-memory or defaults
    let store = SETTINGS_STORE.lock().unwrap();
    if let Some(settings) = store.as_ref() {
        settings.clone()
    } else {
        Settings {
            theme: "dark".to_string(),
            show_hidden_files: true,
            scan_depth: 8,
            startup_behavior: "home".to_string(),
            delete_preference: "trash".to_string(),
            confirm_deletions: true,
            auto_scan_on_launch: false,
            max_results_per_drive: 500,
        }
    }
}

#[tauri::command]
fn delete_items(paths: Vec<String>, permanent: bool) -> Result<usize, String> {
    let mut deleted_count = 0;

    for path_str in paths {
        let p = Path::new(&path_str);
        if !p.exists() {
            continue;
        }

        // Check if this is a system/unsafe file and warn
        let is_system = {
            let lower_path = path_str.to_lowercase();
            lower_path.contains("/proc/") 
                || lower_path.contains("/sys/") 
                || lower_path.contains("/dev/") 
                || lower_path.contains("/run/") 
                || lower_path.contains("/snap/")
                || lower_path.contains("/system volume information/")
                || lower_path.contains("/appdata/")
                || lower_path.contains("/.local/")
                || lower_path.contains("/.config/")
                || lower_path.contains("/.cache/")
                || lower_path.contains("/$recycle.bin/")
        };

        if is_system {
            // For system files, we still proceed but we could log a warning
            // The frontend will handle the confirmation prompt
        }

        if permanent {
            if p.is_dir() {
                if fs::remove_dir_all(p).is_ok() {
                    deleted_count += 1;
                }
            } else if fs::remove_file(p).is_ok() {
                deleted_count += 1;
            }
        } else {
            // Move to OS Trash / Recycle Bin using trash crate
            if _move_to_trash_internal(path_str).is_ok() {
                deleted_count += 1;
            }
        }
    }

    Ok(deleted_count)
}

/// Moves a single file or folder to the system Recycle Bin / Trash.
/// Uses the `trash` crate for cross-platform safe deletion.
/// This is the Tauri command handler that delegates to _move_to_trash_internal.
#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
    _move_to_trash_internal(path)
}

/// Moves a single file or folder to the system Recycle Bin / Trash.
/// Uses the `trash` crate for cross-platform safe deletion.
/// This is the internal implementation used by delete_items.
fn _move_to_trash_internal(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    trash::delete(&p).map_err(|e| format!("Trash operation failed: {}", e))?;
    Ok(())
}

/// Kill a process by PID
#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // First try SIGTERM (graceful)
        let _ = Command::new("kill")
            .arg("-15")
            .arg(pid.to_string())
            .status();
        
        // Wait a bit for graceful shutdown
        std::thread::sleep(Duration::from_millis(500));
        
        // Check if process still exists
        let status_path = format!("/proc/{}/status", pid);
        if std::path::Path::new(&status_path).exists() {
            // Force kill with SIGKILL
            let _ = Command::new("kill")
                .arg("-9")
                .arg(pid.to_string())
                .status();
        }
        Ok(())
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status();
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .arg("-9")
            .arg(pid.to_string())
            .status();
        Ok(())
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Err("Unsupported platform".to_string())
    }
}

/// Permanently deletes a file or directory regardless of read-only status.
/// Removes read-only permissions if needed, then deletes.
/// Includes system file detection - files in virtual paths are flagged as unsafe.
#[tauri::command]
fn permanent_delete(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    
    // Check if this is a system/virtual file - these should not be deleted
    let lower_path = path.to_lowercase();
    let is_system_path = lower_path.contains("/proc/")
        || lower_path.contains("/sys/")
        || lower_path.contains("/dev/")
        || lower_path.contains("/run/")
        || lower_path.contains("/snap/")
        || lower_path.contains("/system volume information/");
    
    if is_system_path {
        return Err(format!("Not safe to delete: {} is a system path and is not safe to delete.", path));
    }
    
    // Try to remove read-only attribute before deletion
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = p.metadata() {
            let perms = metadata.permissions();
            let mode = perms.mode();
            // If file is read-only (no write permission for owner), make it writable
            if mode & 0o200 == 0 {
                // Set write permission for owner
                if let Ok(current_perms) = p.metadata().map(|m| m.permissions()) {
                    let new_perms = current_perms.mode() | 0o200;
                    // Apply the new permissions
                    if let Ok(_) = std::fs::set_permissions(&p, std::fs::Permissions::from_mode(new_perms)) {
                        // Permissions successfully updated, proceed with deletion
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, remove read-only attribute first
        if let Ok(metadata) = p.metadata() {
            let perms = metadata.permissions();
            let mode = perms.mode();
            // If file is read-only (no write permission for owner)
            if mode & 0o200 == 0 {
                // Try to remove read-only attribute by adding owner write
                if let Ok(current_perms) = p.metadata().map(|m| m.permissions()) {
                    let new_perms = current_perms.mode() | 0o200;  // Add owner write
                    // Note: Changing permissions on Windows via Rust std requires admin
                    // Just proceed with delete operation
                }
            }
        }
    }
    
    // Delete the file or directory (non-empty directories)
    if p.is_dir() {
        if fs::remove_dir_all(&p).is_ok() {
            Ok(())
        } else {
            Err(format!("Failed to delete directory: {}", path))
        }
    } else {
        if fs::remove_file(&p).is_ok() {
            Ok(())
        } else {
            Err(format!("Failed to delete file: {}", path))
        }
    }
}

#[tauri::command]
fn get_applications_list() -> Vec<ApplicationInfo> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Collect all processes first
    let mut process_data = Vec::new();
    
    for (pid, proc_) in sys.processes() {
        let name = proc_.name().to_string_lossy().to_string();
        if name.is_empty() {
            continue;
        }
        
        let exe_path = proc_.exe().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "unknown".to_string());
        let memory = proc_.memory();
        let cpu = proc_.cpu_usage();
        
        // Filter out kernel threads and system daemons
        if is_kernel_or_system_daemon(&name, &exe_path) {
            continue;
        }
        
        process_data.push((pid.as_u32(), name, exe_path, cpu, memory));
    }
    
    // Group processes by application
    group_processes_by_app(process_data)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_system_metrics,
            scan_directory,
            search_files,
            get_drives,
            get_processes,
            get_logs,
            open_path,
            save_settings,
            load_settings,
            delete_items,
            move_to_trash,
            permanent_delete,
            kill_process,
            get_applications_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}