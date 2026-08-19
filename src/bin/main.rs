/*                _                  
                 (_)                 
  _ __ ___   __ _ _ _ __    _ __ ___ 
 | '_ ` _ \ / _` | | '_ \  | '__/ __|
 | | | | | | (_| | | | | |_| |  \__ \
 |_| |_| |_|\__,_|_|_| |_(_)_|  |___/         


Backend
    - main()
    - handle_connection(req: Request, database: Database) -> Option
    - process_buffer(buffer: mut [u8]) -> String
    - find_enclosed(s: String, delimiters: (char,char), include_delim: bool) -> String

JackNet
    - execute_ping(body: Vec<u8>) -> String

ChkrBrd
    - construct_headers(call_type: &str, database: &mut Database) -> HeaderMap
    - check_schedule(room: Room) -> String
    - check_period_to_delta(period: i16) -> TimeDelta
    - check_lsm(room: Room) -> String

CamCode
-- Helpers ------------------------------
    - dir_exists(path: &str) -> bool
    - is_this_file(path: &str) -> bool
    - is_this_dir(path: &str) -> bool
    - get_dir_contents(path: &str) -> Vec<String>
    - get_origin(req: Request) -> String
-- Handlers -----------------------------
    - get_file_path(body: Vec<u8>, root: &str) -> String
    - get_file_path(body: Vec<u8>, root: &str) -> String

Tickex
    - fetch_tdx_token(database: &mut Database, req: &Client) -> Result<(), String>
    - run_tickex(database: &mut Database, req: &Client) -> Result<(), String>

Wiki
    - w_build_articles() -> Vec<u8>
    - w_tree() -> Vec<u8> 
*/

// dependencies
// ----------------------------------------------------------------------------
use server_lib::{
    APIResponse,
    BUFF_SIZE, 
    ThreadPool, ThreadSchedule, TaskSchedule, PingRequest, 
    Building, 
    RequestFile, TreeNode,
    jp::{ ping_this, },
    API, APIClient::{ MultiThread, SingleThread, },
    CFM_DIR, WIKI_DIR, /* LOG, */ TEMP_DIR, TICKT_JSON, 
    Request, Response, STATUS_200, /* STATUS_303, */ STATUS_400, STATUS_404, STATUS_500, 
    SCHD_ERR, DASH_ERR, LDRB_ERR, SPRS_ERR, 
    Database, Terminal, 
    models::{
        DB_Room, DB_Building, DB_User, DB_DataElement, DB_Project, 
        DB_IpAddress, DB_Key, DB_Ticket, DB_Reservation
    },
    LoginSuccess, Reservations, 
};
use futures_util::future::FutureExt;
use getopts::Options;
use std::{
    str, env,
    io::{ Read, stdout, Write },
    net::{ TcpListener, IpAddr, Ipv4Addr, },
    fs::{
        read_dir, metadata, write, remove_file, remove_dir, create_dir,
        File, 
    },
    path::Path,
    path::PathBuf,
    time::{ Duration, /* SystemTime */},
    string::{ String, },
    sync::{Arc, /*Mutex,*/ RwLock,
        atomic::{AtomicBool, Ordering}},
    clone::{ Clone, },
    option::{ Option, },
    process::Command,
    collections::{ HashMap, HashSet },

};
use reqwest::{
    header::{ HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, ACCEPT, }
};
use log::{ debug, info, warn, error, }; // trace, };
use cookie::{ /* Cookie, */ CookieJar, /* Key, */ };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use serde::Deserialize;
use regex::Regex;
use chrono::{ offset::Local, DateTime, TimeDelta, Utc, Days };
use urlencoding::decode;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use diesel::{PgConnection, Connection};
use dotenvy::dotenv;
use tera::{Tera, Context, Delimiters};
use base64::{Engine as _, engine::general_purpose};

extern crate serde;
extern crate serde_xml_rs;
// ----------------------------------------------------------------------------
static JN_THREAD: AtomicBool = AtomicBool::new(false);
pub const MIGRATIONS : EmbeddedMigrations = embed_migrations!();
/*
$$$$$$$\                      $$\                                 $$\ 
$$  __$$\                     $$ |                                $$ |
$$ |  $$ | $$$$$$\   $$$$$$$\ $$ |  $$\  $$$$$$\  $$$$$$$\   $$$$$$$ |
$$$$$$$\ | \____$$\ $$  _____|$$ | $$  |$$  __$$\ $$  __$$\ $$  __$$ |
$$  __$$\  $$$$$$$ |$$ /      $$$$$$  / $$$$$$$$ |$$ |  $$ |$$ /  $$ |
$$ |  $$ |$$  __$$ |$$ |      $$  _$$<  $$   ____|$$ |  $$ |$$ |  $$ |
$$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$ | \$$\ \$$$$$$$\ $$ |  $$ |\$$$$$$$ |
\_______/  \_______| \_______|\__|  \__| \_______|\__|  \__| \_______|
*/

//rustdoc 
/// Entry Function for the server. 
/// ### Returns 
/// Upon Success - ()
/// Upon Failure - dynamic error. 
/// ### Example 
/// ALEX ADD AN EXAMPLE
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // debug setting
    env::set_var("RUST_BACKTRACE", "1");

    let args: Vec<String> = env::args().collect();
    let mut opts = Options::new();
    opts.optflag("l", "local", "Run the server using localhost.");
    opts.optflag("p", "public", "Run the server using the public IP.");
    opts.optflag("d", "debug", "Enable debug functions.");
    opts.optflag("j", "jnthread", "Provides the data sync function with an extra thread explicitly for jacknet instead of all tasks sharing one thread.");
    let matches = match opts.parse(&args[1..]) {
        Ok(m) => { m }
        Err(f) => { panic!("{}", f.to_string()) }
    };
    
    if matches.opt_present("d") {
        match init_logger("debug") {
            Ok(_) => (),
            Err(e) => error!("Unable to init logger: {}", e)
        };
    } else {
        match init_logger("info") {
            Ok(_) => (),
            Err(e) => error!("Unable to init logger: {}", e)
        };
    }
    
    // set TcpListener and initialize
    // ------------------------------------------------------------------------
    let host_ip: &str;
    let mut host_port = 7878;
    let local_ip_addr = &(match local_ip() {
        Ok(ip) => ip,
        Err(e) => {
            warn!("Unable to get public ip: {}\nDefaulting to localhost", e);
            IpAddr::V4(Ipv4Addr::new(127,0,0,1))
        }
    }.to_string());
    if matches.opt_present("p") {
        info!("[#] -- You are running using public IP --");
        host_ip = local_ip_addr;
    } else {
        info!("[#] -- You are running using localhost --");
        host_ip = "127.0.0.1";
    }

    while let Err(_) = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())) {
        warn!("Port {} busy. Incrementing.", host_port);
        host_port += 1;
    }
    let listener = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())).unwrap();

    info!("[!] ... {}:{} ...", host_ip, host_port.to_string());
    debug!("Server mounted!");

    let pool = ThreadPool::new(6); // Thread pool for handling requests
    let data_pool = ThreadPool::new(1); // Thread pool for database operations
    let mut buffer = [0; BUFF_SIZE];

    // ----------------------------------------------------------------------
    match stdout().flush() {
        Ok(_) => (),
        Err(e) => error!("STDOUT flush failed: {}", e)
    };

    // embed_migrations (iffy on this)
    dotenv().ok(); // Load .env file
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let mut connection = PgConnection::establish(&database_url)
        .expect("Error Connecting to Database");
    connection.run_pending_migrations(MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;

    
    // Data Thread Pool Loop (data transfer)
    if matches.opt_present("j") {
        set_jn_thread_true();
    }

    let tdx_client = Arc::new(API::new(
        MultiThread(
            reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(match construct_headers("tdx") {
                    Ok(h) => h,
                    Err(m) => { error!("Unable to set tdx_client headers: {}", m); HeaderMap::new() }
                })
                .build()
                .ok()
                .expect("Unable to build TDX Request Client")
        )
    ));

    let lsm_client = Arc::new(API::new(
        SingleThread(
            Arc::new(RwLock::new(reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(match construct_headers("lsm") {
                    Ok(h) => h,
                    Err(m) => { error!("Unable to set lsm_client headers: {}", m); HeaderMap::new() }
                })
                .build()
                .ok()
                .expect("Unable to build LSM Request Client")
            ))
        )
    ));

    let cn_client = Arc::new(API::new(
        MultiThread(
            reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(match construct_headers("25l") {
                    Ok(h) => h,
                    Err(m) => { error!("Unable to set cn_client headers: {}", m); HeaderMap::new() }
                })
                .build()
                .ok()
                .expect("Unable to build 25Live Request Client")
        )
    ));

    let mut request_database = Database::new();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _ = match runtime.block_on(request_database.init(Arc::clone(&tdx_client), Arc::clone(&lsm_client))) {
        Some(()) => (),
        None     => {
            return Err("Unable to initialize database!".into());
        }
    };

    let thread_schedule = Arc::new(RwLock::new(ThreadSchedule::new()));
    let data_ts = Arc::clone(&thread_schedule);
    let tc_clone = Arc::clone(&tdx_client);
    let lc_clone = Arc::clone(&lsm_client);
    let cn_clone = Arc::clone(&cn_client);
    data_pool.execute(move || {
        data_sync(data_ts, tc_clone, lc_clone, cn_clone);
    });

    for stream in listener.incoming() {
        let mut stream = match stream {
            Ok(s) => s,
            Err(e) => {
                error!("Incoming stream corrupted: {}\nDropping packet.", e);
                continue;
            }
        };

        match stream.read(&mut buffer) {
            Ok(_) => (),
            Err(e) => error!("Error reading to buffer: {}", e)
        };
        let req = Request::from(buffer.clone());
        let clone_db = request_database.clone();
        let req_ts = Arc::clone(&thread_schedule);
        let tc_clone = Arc::clone(&tdx_client);
        let lc_clone = Arc::clone(&lsm_client);
        pool.execute(move || {
            let res = match handle_connection(req, clone_db, req_ts, tc_clone, lc_clone) {
                Some(r) => r,
                None    => {
                    Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("An internal error occurred. Please contact a system administrator.\n").into())
                            .build()
                            .expect("Build failed")
                }
            };
            stream.write(&res).unwrap();
            stream.flush().unwrap();
            stdout().flush().unwrap();
        });

        buffer = [0; BUFF_SIZE];
    }

    return Ok(());
}
// rustdoc 
/// Function creates verbose server log to standard out and writes a log file.  
/// ### Parameter 
/// * `level` - String Reference containing the sensitivity level for the logger. 
/// ### Returns 
/// * The logger. 
/// ### Example 
/// ``` no_run
/// if matches.opt_present("d") {
///     match init_logger("debug") {
///         Ok(_) => (),
///         Err(e) => error!("Unable to init logger: {}", e)
///       };
/// } else {
///     match init_logger("info") {
///         Ok(_) => (),
///         Err(e) => error!("Unable to init logger: {}", e)
///     };
/// }
/// ```
fn init_logger(level: &str) -> Result<(), fern::InitError> {
    let log_filter: log::LevelFilter;
    match level {
        "debug" => log_filter = log::LevelFilter::Debug,
        "info"  => log_filter = log::LevelFilter::Info,
        &_      => log_filter = log::LevelFilter::Error
    };
    // Build a dispatch for colored terminal output
    let stdout_dispatch = fern::Dispatch::new()
        .format(|out, message, record| {
            let level_color = match record.level() {
                log::Level::Trace => "\x1B[90m", // Bright Black
                log::Level::Debug => "\x1B[34m", // Blue
                log::Level::Info  => "\x1B[32m", // Green
                log::Level::Warn  => "\x1B[33m", // Yellow
                log::Level::Error => "\x1B[31m", // Red
            };
            out.finish(format_args!(
                "{} \x1B[3m{}\x1B[0m {}[{}]\x1B[0m {}\x1b[0m",
                Local::now().format("[\x1B[90m%Y-%m-%d\x1B[0m][\x1B[90m%H:%M:%S\x1B[0m]"),
                record.target(),
                level_color, record.level(),
                message
            ))
        })
        .chain(stdout());

    // Build a separate dispatch for file output without ANSI color codes
    let file_dispatch = fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} {} [{}] {}",
                Local::now().format("[%Y-%m-%d][%H:%M:%S]"),
                record.target(),
                record.level(),
                message
            ))
        })
        .chain(fern::log_file("output.log")?);

    // Combine and apply
    fern::Dispatch::new()
        .level(log_filter)
        .chain(stdout_dispatch)
        .chain(file_dispatch)
        .apply()?;

    Ok(())
}
//rustdoc 
/// Function creates a space to run API calls separate from users threadpool.
/// ### Parameters 
///  * `thread_schedule` - cloned with Arc to control singlethread constraint. Type [`ThreadSchedule`]
///  * `tdx_api` - cloned with Arc to because the type [`API`] may be multithread. `tdx_api` Is multi thread. 
///  * `lsm_api` - cloned with Arc to because the type [`API`] may be multithread. `lsm_client ` Is single thread.
///
/// NOTE: `lsm_api` passed here and `lsm_client` passed in [`handle_connection`] serve the same purpose.
/// Naming conventions need updated for further clarification. The same can be said for `tdx_client` and `tdx_api`.
///  ### Returns 
/// * Void 
/// ### Example 
/// ALEX MAKE AN EXAMPLE FOR THIS 
#[tokio::main]
#[allow(unused_assignments)]
#[allow(unreachable_code)]
async fn data_sync(thread_schedule: Arc<RwLock<ThreadSchedule>>, tdx_api: Arc<API>, lsm_api: Arc<API>, cn_api: Arc<API>) {
    // Init Everyting
    // ThreadSchedule Init
    //let mut thread_schedule = ThreadSchedule::new();
    // TODO: Only add print1/2 if Debug is enabled.
    {
        let mut ts = thread_schedule.write().unwrap();
        ts.tasks.insert("print1".to_string(), TaskSchedule {
            duration: 60,
            timestamp: Utc::now(),
        });
        ts.tasks.insert("print2".to_string(), TaskSchedule {
            duration: 120,
            timestamp: Utc::now(),
        });
        ts.tasks.insert("leaderboard".to_string(), TaskSchedule {
            duration: 3600,
            timestamp: Utc::now() - Duration::from_secs(3599),
        });
        ts.tasks.insert("spares".to_string(), TaskSchedule {
            duration: 3600,
            timestamp: Utc::now() - Duration::from_secs(3599),
        });
        ts.tasks.insert("checkerboard".to_string(), TaskSchedule {
            duration: 1800,
            timestamp: Utc::now() - Duration::from_secs(1799),
        });
        ts.tasks.insert("jacknet".to_string(), TaskSchedule {
            duration: 3600,
            timestamp: Utc::now() - Duration::from_secs(3580),
        });
        ts.tasks.insert("cfmTree".to_string(), TaskSchedule {
            duration: 86400,
            timestamp: Utc::now() - Duration::from_secs(86370),
        });
        ts.tasks.insert("tdxToken".to_string(), TaskSchedule {
            duration: 82800,
            timestamp: Utc::now() - Duration::from_secs(82799),
        });
        ts.tasks.insert("tickex".to_string(), TaskSchedule {
            duration: 60,
            timestamp: Utc::now() - Duration::from_secs(50),
        });
        ts.tasks.insert("reservations".to_string(), TaskSchedule {
            duration: 86400,
            timestamp: Utc::now() - Duration::from_secs(86450)
        });
    }

    // Database Init
    let mut database = Database::new();

    match collegenet_login(&cn_api).await {
        Ok(v)  => { debug!("{:?}", v); },
        Err(m) => { error!("25L_ERR: {}", m); }
    };

    // Init Datapool
    // TODO: Once there is sufficient need, multithreading this will be done with 'data_threads', in addition, the following loop block will need refactored.
    //let _data_threads = ThreadPool::new(3);
    // Note: Arc<RwLock<Reqwest>>
    //       ^ The above line will prevent concurent access with LSM.
    //       Normal Reqwests, Other API's that can handle concurent requests
    //       will not need to be locked.

    // TODO: jn_st
    //    WSL has problems... I need to add a flag that sets an atomicboolean to jn_st. If true, execute_ping will be single threaded.
    // Not sure if this is even giving performance improvements.
    let jn_st = check_jn_thread();
    let jn_thread = ThreadPool::new(1);


    // Loop
    //let l_ts = Arc::clone(&thread_schedule);
    loop {
        //debug!("[ThreadSchedule] Checking Tasks");
        let now = Utc::now();

        // Collect due task names while holding a read lock, then drop it
        // so we don't attempt to acquire a write lock while a read lock is held.
        let due_tasks: Vec<String> = {
            let guard = thread_schedule.read().unwrap();
            guard.tasks.iter()
                .filter(|(_, task)| (now - task.timestamp).num_seconds() as u64 >= task.duration)
                .map(|(name, _)| name.clone())
                .collect()
        };

        for task_name in due_tasks {
            // Execute task based on task_name
            match task_name.as_str() {
                "print1"          => { // Not-LSM
                    debug!("[ThreadSchedule Debug] - One Minute Message");
                },
                "print2"          => { // Not-LSM
                    debug!("[ThreadSchedule Debug] - Two Minute Message");
                },
                "leaderboard"     => {
                    info!("[Data] - Pulling New LSM Leaderboard");
                    update_room_check_leaderboard(&mut database, &lsm_api).await;
                    info!("[Data] - New LSM Leaderboard Pulled")
                },
                "spares"          => {
                    info!("[Data] - Pulling New LSM Spare Information");
                    update_lsm_spares(&mut database, &lsm_api).await;
                    info!("[Data] - New LSM Spare Information Pulled")
                },
                "lsmData"         => {
                    info!("[Data] - Pulling LSM Inventory Information");
                    info!("MAYBE TODO: Get Diagnostic Information from LSM");
                    //update_lsm_data(&mut database, Arc::clone(&lsm_request)).await;
                    info!("[Data] - Completed LSM Inventory Data Retrieval");
                },
                "checkerboard"    => {
                    info!("[Data] - Running Checkerboard");
                    let _ = match run_checkerboard(&mut database, &lsm_api).await {
                        Ok(_)  =>  info!("[Data] - Checkerboard Run Complete"),
                        Err(m) => error!("[Data] - Checkerboard Run FAILED: {}", m)
                    };
                },
                "jacknet"         => { // Not-LSM
                    info!("[Data] - Running JackNet");
                    if jn_st {
                        let mut db_jn_clone = database.clone();
                        jn_thread.execute( move || async {
                            execute_ping(&mut db_jn_clone).await;
                        }.now_or_never().unwrap());
                    } else {
                        execute_ping(&mut database).await;
                    }
                    info!("[Data] - JackNet Complete");
                },
                "cfmTree"         => {
                    info!("[Data] - Building CFM Tree");
                    let mut cfm_blacklist = HashSet::new(); 
                    cfm_blacklist.insert("txt");
                    cfm_blacklist.insert("xlsx");

                    let json_return = match build_tree(CFM_DIR, cfm_blacklist) {
                        Ok(j)     =>  j,
                        Err(m)    => {error!("[Data] - Tree Build FAILED: {}", m); json!([]).to_string() }
                    };

                    match database.update_data(&DB_DataElement {
                        key: String::from("cfm_tree"),
                        val: json_return,
                    }) {
                        Ok(_) => {}
                        Err(e) => error!("Failed to update database: {}", e),
                    }
                    
                },
                "tdxToken"        => {
                    info!("[Data] - Pulling New TDX Token");
                    let _ = match fetch_tdx_token(&mut database, &tdx_api).await {
                        Ok(_)     =>  info!("[Data] - New TDX Token Pulled"),
                        Err(s)    => error!("[Data] - FAILED to fetch new TDX Token: {}", s)
                    };
                },
                "tickex"          => {
                    info!("[Data] - Running Tickex");
                    let _ = match run_tickex(&mut database, &tdx_api).await {
                        Ok(_)     =>  info!("[Data] - Tickex Run Complete"),
                        Err(m)    => error!("[Data] - Tickex Run FAILED: {}", m)
                    };
                },
                "reservations"    => {
                    let _ = match store_collegenet_reservations(&mut database, &cn_api).await {
                        Ok(_)     => info!("[Data] - Reservations Stored"),
                        Err(m)    => error!("[Data] - Unable to store reservations: {}", m)
                    };
                },
                _                 => {
                    warn!("Unknown task: {}", task_name)
                },
            }

            // Update timestamp (acquire write lock only here)
            if let Some(task) = thread_schedule.write().unwrap().tasks.get_mut(&task_name) {
                task.timestamp = task.timestamp + Duration::from_secs(task.duration);
            }
        }

        // Sleep for a short duration to prevent busy-waiting
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}
// rustdoc 
/// Function is the entry point to the servers on-request services. 
/// 
/// Note: function may be in use by any number of threads in the initialized threadpool. 
/// ### Parameters
///  * `req` - 
///  * `database` - function requires [`Database`] (struct) to provide context of the Bronson database. 
///  * `thread_schedule` - cloned with Arc to control singlethread constraint. Type [`ThreadSchedule`]
///  * `tdx_client` - cloned with Arc to because the type [`API`] may be multithread. `tdx_client` Is multi thread. 
///  * `lsm_client` - cloned with Arc to because the type [`API`] may be multithread. `lsm_client ` Is single thread. 
/// ### Returns 
/// * A [`Response`] object compiled into a byte vector. 
/// Note: a compiled byte vector is easier to clone, so it is done before return instead of after. 
/// ### Examples 
/// call in [`main`]
/// ALEX ADD AN EXAMPLE 
#[tokio::main]
#[allow(unused_assignments)]
async fn handle_connection(
    mut req: Request,
    mut database: Database,
    thread_schedule: Arc<RwLock<ThreadSchedule>>,
    tdx_client: Arc<API>,
    lsm_client: Arc<API>
) -> Option<Vec<u8>> {
    let mut user_homepage: &str = "html-css-js/login.html";
    if req.headers.contains_key("Cookie") {
        let username = req.get_current_username();
        let user = match database.get_user(&username) {
            Ok(u)  => u,
            Err(diesel::result::Error::NotFound) => {
                DB_User{ username: String::new(), permissions: 5 }
            },
            Err(m) => {
                error!("DB_ERR: {}", m);
                DB_User{ username: String::new(), permissions: 0}
            }
        };
        if req.has_valid_cookie(&mut database) {
            match user.permissions {
                7 => user_homepage = "html-css-js/index_admin.html",
                6 => user_homepage = "html-css-js/index_admin.html",
                0 => user_homepage = "html-css-js/login.html",
                _ => user_homepage = "html-css-js/index.html",
            }
        }
    }
    
    // Global cookie validation with explicit exemptions
    // This list of endpoints will NOT be cookie validated, and will be accessible to all users.
    let exemptions = vec![
        "GET / HTTP/1.1",
        "GET /page.css HTTP/1.1",
        "GET /login.html HTTP/1.1",
        "GET /favicon.ico HTTP/1.1",
        "GET /logo.png HTTP/1.1",
        "GET /logo-2-line.png HTTP/1.1",
        "POST / HTTP/1.1",
    ];
    if !exemptions.contains(&req.start_line.as_str()) && !req.has_valid_cookie(&mut database) {
        return Response::new()
            .status(STATUS_200)
            .send_file("html-css-js/login.html")
            .build();
    }

    // Handle requests
    // ------------------------------------------------------------------------
    let res: Response = match req.start_line.as_str() {
        // Page Content
        // --------------------------------------------------------------------
        "GET / HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
        },
        "GET /page.css HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/page.css")
        },
        "GET /index.html HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/index.html")
        },
        "GET /login.html HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/login.html")
        },
        // Javascript Files
        "GET /bronson-manager.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/bronson-manager.js")
        },
        "GET /camcode.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/camcode.js")
        },
        "GET /cc-altmode.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/cc-altmode.js")
        },
        "GET /checkerboard.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/checkerboard.js")
        },
        "GET /tickex.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/tickex.js")
        },
        "GET /analytics.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/analytics.js")
        },
        "GET /jacknet.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/jacknet.js")
        },
        "GET /wiki.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/wiki.js")
        },
        "GET /admin_tools.js HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("html-css-js/admin_tools.js")
        },
        // Tool Homepage Stuff
        "GET /cc-altmode HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setCrestronFile()")
        },
        "GET /camcode HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setCamCode()")
        },
        "GET /dashboard HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setDashboard()")
        },
        "GET /checkerboard HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setChecker()")
        },
        "GET /tickex HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setTickex()")
        },
        "GET /analytics HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setAnalytics()")
        },
        "GET /jacknet HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setJackNet()")
        },
        "GET /wiki HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setWiki()")
        },
        "GET /admintools HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
                    .insert_onload("setAdminTools()")
        }
        // Assets
        "GET /favicon.ico HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("assets/logo_main.png")
        },
        "GET /logo.png HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("assets/logo.png")
        },
        "GET /logo-2-line.png HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("assets/logo-2-line.png")
        },
        "GET /button2.png HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .send_file("assets/button2.png")
        },
        "GET /tdx_logo.png HTTP/1.1" => {
            Response::new()
                    .status(STATUS_200)
                    .insert_header("Content-Type", "image/png")
                    .send_file("assets/tdx_logo.png")
        },
        // Data Requests
        "GET /techSchedule HTTP/1.1" => {
            let contents = match database.get_data("schedule") {
                Ok(s)  => s.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(SCHD_ERR)
                }
            }.into();

            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /campusData HTTP/1.1" => {
            let campus = database.get_campus();
            let contents = match campus {
                Ok(c)  => json!(&c).to_string(),
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from("{}")
                }
            }.into();

            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /zoneData HTTP/1.1" => { // NEW: returns data in lib.rs as json
            let bldgs = database.get_buildings();
            let contents = match bldgs {
                Ok(b)  => get_zone_data(b),
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from("{}").into()
                }
            };

            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /dashContents HTTP/1.1" => { // Dashboard Message
            let contents = json!({
                "contents": match database.get_data("dashboard") {
                    Ok(e)  => e.val,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        String::from(DASH_ERR)
                    }
                }
            }).to_string().into();
            
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /leaderboard HTTP/1.1" => { // OUTGOING, Dashboard Leaderboard
            let contents = match database.get_data("lsm_leaderboard") {
                Ok(l)  => l.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(LDRB_ERR)
                }
            }.into();
            
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        // Spares LSM API Call.
        "GET /spares HTTP/1.1" => { // OUTGOING, Dashboard Spares
            // Get Spares from Database
            let contents: Vec<u8> = match database.get_data("lsm_spares") {
                Ok(s)  => s.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(SPRS_ERR)
                }
            }.into();
            
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /currentUser HTTP/1.1" => { // OUTGOING, Current user info
            // Fetch user from DB, default to standard user if not found
            let username = req.get_current_username();
            let user = match database.get_user(&username) {
                Ok(u) => u,
                Err(e) => {
                    error!("DB_ERR: {}", e);
                    DB_User {
                        username: username.clone(),
                        permissions: 0, // standard user
                    }
                }
            };

            // Return user info
            Response::new()
                .status(STATUS_200)
                .send_contents(json!({
                    "username": user.username,
                    "permissions": user.permissions
                }).to_string().into())
        },
        "GET /currentUser/existsInDB HTTP/1.1" => {
            // Fetch user from DB, default to standard user if not found
            let username = req.get_current_username();
            let user_exists = match database.get_user(&username) {
                Ok(_) => {
                    json!({
                        "response": true
                    })
                },
                Err(e) => {
                    error!("DB_ERR: {}", e);
                    json!({
                        "response": false
                    })
                }
            };

            // Return user info
            Response::new()
                .status(STATUS_200)
                .send_contents(
                    user_exists.to_string().into()
                )
        },
        "GET /currentUser/fetchTDXUser HTTP/1.1" => {
            // Query TDX for User ID using the username provided in the cookie
            let username = req.get_current_username();
            let user = match get_tdx_user(&mut database, &tdx_client, &username.to_string()).await {
                Ok(u) => u,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents(json!({
                            "response": "Failed to Fetch User ID from TDX"
                        }).to_string().into())
                        .build();
                }
            };

            // Return user info
            Response::new()
                .status(STATUS_200)
                .send_contents(
                    user.to_string().into()
                )
        },
        "GET /data/cbSelection HTTP/1.1" => { // Fetch a user's Checkerboard building selections
            let selection: Value = match database.get_data(&format!("{}_cbSelections", req.get_current_username())) {
                Ok(d) => {
                    match serde_json::from_str(&d.val) {
                        Ok(v) => v,
                        Err(m) => {
                            error!("Unable to parse json: {}", m);
                            json!({
                                "selections": []
                            })
                        }
                    }
                } Err(_) => {
                    json!({
                        "selections": []
                    })
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents(
                    selection.to_string().into()
                )
        }
        "GET /tickets HTTP/1.1" => { // OUTGOING, Tickets for Tickex
            let db_tickets = match database.get_all_tickets() {
                Ok(t) => t,
                Err(e) => {
                    error!("Failed to get tickets: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("[]".into())
                        .build();
                }
            };
            let tickets: Vec<Value> = db_tickets.into_iter().map(|t| {
                json!({
                    "ID": t.ticket_id,
                    "ParentID": t.parent_id,
                    "has_been_viewed": t.has_been_viewed,
                    "Title": t.title,
                    "StatusName": t.status_name,
                    "RequestorName": t.requestor_name,
                    "RequestorFirstName": t.requestor_first_name,
                    "RequestorEmail": t.requestor_email,
                    "RequestorPhone": t.requestor_phone,
                    "CreatedFullName": t.created_full_name,
                    "ResponsibleFullName": t.responsible_full_name,
                    "ResponsibleGroupName": t.responsible_group_name,
                    "ServiceName": t.service_name,
                    "AccountName": t.account_name,
                    "TypeName": t.type_name,
                    "TypeCategoryName": t.type_category_name,
                    "PriorityName": t.priority_name, 
                    "DaysOld": t.days_old,
                    "CreatedDate": t.created_date,
                    "CreatedFullName": t.created_full_name,
                    "ModifiedDate": t.modified_date,
                    "ModifiedFullName": t.modified_full_name,
                    "comment_count": t.comment_count,
                    "old_comment_count": t.old_comment_count,
                })
            }).collect();

            let contents = serde_json::to_string(&tickets).unwrap().into();
            Response::new()
                .status(STATUS_200)
                .send_contents(contents)
        },
        "POST /update/ticket HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            let operation_type = body_json["_OperationType"].as_str().unwrap_or("");

            let _ = match operation_type {
                "CREATE" => create_tdx_ticket(&mut database, &tdx_client, body_json, req.get_current_username()).await,
                "EDIT" => edit_tdx_ticket(&mut database, &tdx_client, body_json).await,
                _ => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Malformed '_OperationType' Field".into())
                        .build();
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents("".into())
        },
        "POST /update/ticket/postComment HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            let _ = match post_comment(&mut database, &tdx_client, body_json).await {
                Ok(v) => v,
                Err(e) => {
                    error!("Failed to post comment: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("[]".into())
                        .build();
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents("".into())
        },
        "POST /update/ticket/viewed HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            let id = body_json["id"].as_i64().unwrap_or(-1) as i32;
            let viewed = body_json["viewed"].as_bool().unwrap_or(false);

            // Update DB
            match database.update_ticket_mark_as_viewed(id, viewed) {
                Ok(_) => Response::new()
                    .status(STATUS_200)
                    .send_contents("Updated".into()),

                Err(e) => {
                    error!("Failed to update ticket viewed: {}", e);
                    Response::new()
                        .status(STATUS_500)
                        .send_contents("Error".into())
                }
            }
        },
        "POST /update/ticket/markFalse HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            // If ParentID is not one of these three, return error
            let parent_id = body_json["ParentID"].as_i64().unwrap_or(-1) as i32;
            if parent_id != 22873142 && parent_id != 22873186 && parent_id != 0 {
                return Response::new()
                    .status(STATUS_500)
                    .send_contents("Invalid ParentID Passed as Argument".into())
                    .build();
            }

            // Mark the ticket as false
            let _ = match toggle_mark_ticket_false(&mut database, &tdx_client, body_json).await {
                Ok(v) => v,
                Err(e) => {
                    error!("Failed to mark Ticket as false: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("[]".into())
                        .build();
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents("".into())
        },
        "POST /update/ticket/dismissAll HTTP/1.1" => {
            let _ = match dismiss_all_tickets(&mut database).await {
                Ok(v) => v,
                Err(e) => {
                    error!("Failed to dismiss all tickets: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("[]".into())
                        .build();
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents("".into())
        },
        "GET /projects HTTP/1.1" => {
            if database.check_if_projects_empty() {
                match fetch_projects(&mut database, &tdx_client).await {
                    Ok(()) => (),
                    Err(e) => error!("Failed to populate projects: {}", e),
                }
            }

            let db_projects = match database.get_all_projects() {
                Ok(p) => p,
                Err(e) => {
                    error!("Failed to get projects: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("[]".into())
                        .build();
                }
            };
            let projects: Vec<Value> = db_projects.into_iter().map(|t| {
                json!({
                    "ID": t.project_id,
                    "CreatedDate": t.created_date,
                    "ModifiedDate": t.modified_date,
                    "Name": t.name,
                    "Description": t.description,
                    "IsActive": t.is_active,
                    "TypeID": t.type_id,
                    "PercentComplete": t.percent_complete,
                    "StatusName": t.status_name,
                    "StatusComments": t.status_comments,
                    "StartDate": t.start_date,
                    "EndDate": t.end_date,
                    "HealthDescription": t.health,

                    "is_hidden": t.is_hidden,
                })
            }).collect();

            let contents = serde_json::to_string(&projects).unwrap().into();
            Response::new()
                .status(STATUS_200)
                .send_contents(contents)
        },
        "POST /analytics/export HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            let time_period = body_json["timePeriod"].as_i64().unwrap_or(0) as i16;
            let optional_data = body_json["optionalData"].clone();

            let file_name = match export_to_pdf(&mut database, time_period, optional_data).await {
                Ok(f) => f,
                Err(e) => {
                    error!("Failed to export PDF: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Failed to generate PDF".into())
                        .build();
                }
            };

            let report_path = format!("{}/{}.pdf", TEMP_DIR, &file_name);
            if !dir_exists(report_path.as_str()) {
                return Response::new()
                    .status(STATUS_500)
                    .send_contents("Report PDF file not found".into())
                    .build();
            }

            let resp_ret = Response::new()
                .status(STATUS_200)
                .send_file(report_path.as_str());

            let _ = cleanup_temp_files(file_name).await;

            resp_ret
        },
        "POST /update/projects/hidden HTTP/1.1" => {
            // Parse JSON body
            let body_json: Value = match serde_json::from_slice(&req.body) {
                Ok(v) => v,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid JSON".into())
                        .build();
                }
            };

            let id = body_json["id"].as_i64().unwrap_or(-1) as i32;
            let is_hidden = body_json["is_hidden"].as_bool().unwrap_or(false);

            // Update DB
            match database.update_project_hidden(id, is_hidden) {
                Ok(_) => Response::new()
                    .status(STATUS_200)
                    .send_contents("Updated".into()),

                Err(e) => {
                    error!("Failed to update project hidden: {}", e);
                    Response::new()
                        .status(STATUS_500)
                        .send_contents("Error".into())
                }
            }
        },
        "POST /lsmData HTTP/1.1" => { // OUTGOING
            let body_str = String::from_utf8(req.body).expect("AT: LSM Data Err, invalid UTF-8");
            let body_parts: Vec<&str> = body_str.split(',').collect();
            if body_parts.len() != 2 {
                return Response::new()
                                .status(STATUS_500)
                                .send_contents("Invalid request body.".into())
                                .build();
            }
            let building_sel:String = body_parts[0].to_string();
            let device_type = body_parts[1];
            let lsm_building = match database.get_building_by_abbrev(&building_sel) {
                Ok(b)  => b,
                Err(m) => {
                    return Response::new()
                                    .status(STATUS_500)
                                    .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                    .build();
                }
            };
            debug!("[Admin Tools] - Grabbing LSM Data for Diagnostics:\n{:?}", &lsm_building.lsm_name.as_str());
            let api_endpoint = match device_type {
                "PROC" => "BuildingProcs",
                "DISP" => "BuildingDisplays",
                "PJ" => "BuildingProjectors",
                "TP"   => "BuildingTouchPanels",
                _    => {
                    return Response::new()
                                    .status(STATUS_500)
                                    .send_contents("Invalid device type".into())
                                    .build();
                }
            };
            debug!("[Admin Tools] - Diagnostic API Endpoint: {}", api_endpoint);
            let url_devs = format!(
                r"https://uwyo.talem3.com/lsm/api/{}?offset=0&p=%7BParentName%3A%22{}%22%7D", 
                &api_endpoint,
                &lsm_building.lsm_name.as_str()
            );
            // Build and Send Request
            let devs = lsm_client
                .build()
                .method("GET")
                .endpoint(&url_devs)
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .unwrap()
                .body;

            let v_devs: Value = serde_json::from_str(&devs).expect("Empty");
            let data_devs: Vec<Value> = match v_devs["data"].as_array() {
                Some(data) => data.clone(),
                None => Vec::<Value>::new()
            };
            // Pack into JSON response to front-end
            let contents = json!({
                 "data": data_devs
            }).to_string().into();
            
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "POST /updateSchedule HTTP/1.1" => {
            let new_data = DB_DataElement {
                key: String::from("schedule"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents")
            };
            let _ = database.update_data(&new_data);

            Response::new()
                    .status(STATUS_200)
                    .send_contents("".into())
        },
        "POST /update/dash HTTP/1.1" => {
            let _ = database.update_data(&DB_DataElement {
                key: String::from("dashboard"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents"),
            });
            
            Response::new()
                    .status(STATUS_200)
                    .send_contents("".into())
        },
        "POST /update/database_room HTTP/1.1" => { // destination, newValue
            // Parse Request Body
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            let target_room: String = body_json["destination"]
                .as_str()
                .unwrap()
                .to_string();
            let new_values: Vec<u8> = body_json["newValue"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .map(|v| v.as_str().unwrap_or("0").parse().unwrap_or(0))
                        .collect()
                })
                .unwrap();
            // Extract the date separately as a string (last element)
            let new_date: String = body_json["newValue"]
                .as_array()
                .and_then(|arr| arr.last())
                .and_then(|v| v.as_str())
                .unwrap_or("0")
                .to_string();
            debug!("[Admin Tools] - Updating Target Room:{}\n New Values: {:?}", target_room, new_values);
            // Get Existing Room Record from database
            let mut new_db_room : DB_Room = match database.get_room_by_name(&target_room) {
                Ok(tr) => tr,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    return Response::new()
                                    .status(STATUS_500)
                                    .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                    .build();
                }
            };
            // Update General Pool Status
            new_db_room.gp = match new_values[6] { 
                1 => true,
                0 => false,
                _ => false,
            };
            new_db_room.check_period = new_values[7] as i16;
            new_db_room.offln = match new_values[8] { 
                1 => true,
                0 => false,
                _ => false,
            };
            new_db_room.onln = match new_date.parse::<DateTime<Local>>() {
                Ok(t) => t,
                Err(m) => {
                    error!("Unable to parse new onln field from JSON: {}", m);
                    return Response::new()
                                    .status(STATUS_500)
                                    .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                    .build();
                }
            };
            // Build Updated Ping Data Vector
            let hn_vec = Database::gen_hn(String::from(target_room), &new_values[0..6].to_vec()); // Only device fields
            let ping_vec = Database::gen_ip(&hn_vec);
            // Update Ping Data in room
            new_db_room.ping_data = ping_vec;
            // Update Database
            let _ = database.update_room(&new_db_room);

            Response::new()
                .status(STATUS_200)
                .send_contents("".into())
        },
        "POST /update/database_roomSchedule HTTP/1.1" => { // [Changes to make]
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            // Parse Request Body
            let rooms = body_json["rooms"]
                .as_array()
                .unwrap();
            // Iterate through rooms and update each one.
            for room in rooms {
                let target_room: String = room["name"]
                    .as_str()
                    .unwrap()
                    .to_string();
                let new_schedule: Vec<Option<String>> = room["schedule"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap();
                // Get Existing Room Record from database
                let mut new_db_room: DB_Room =  match database.get_room_by_name(&target_room) {
                    Ok(r)  => r,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        return Response::new()
                                .status(STATUS_500)
                                .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                .build();
                    }
                };
                // Update Schedule
                new_db_room.schedule = new_schedule.clone();
                // Update Database
                let _ = database.update_room(&new_db_room);
                debug!("[Admin Tools] - Updating Room: {} with Schedule:\n {:?}", target_room, new_schedule);
            }

            Response::new()
                .status(STATUS_200)
                .send_contents("Room Schedules in Database Updated".into())
        },
        "POST /update/roomSchd/timestamps HTTP/1.1" => { // Updates the timestamps stored in DB_DataElement
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            let timestamps: Vec<String> = body_json["timestamps"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap();
            debug!("[Admin Tools] - Updating Timestamps:\n {:?}", timestamps);
            // Create DB_DataElement and update database.
            let new_timestamps = DB_DataElement {
                key: String::from("report_timestamps"),
                val: serde_json::to_string(&timestamps).unwrap()
            };
            // Uncomment when ready...
            let _ = database.update_data(&new_timestamps);
            Response::new()
                .status(STATUS_200)
                .send_contents("Successful Room Schedule Timestamps Update".into())
        },
        "POST /update/data/cbSelection HTTP/1.1" => { // Updates a users Checkerboard building selection
            let body_json: Value = serde_json::from_str(str::from_utf8(&req.body).unwrap()).expect("Failed parsing JSON");
            let username: String = req.get_current_username();
            let cb_key: String = username + "_cbSelections";
            let cb_val: String = body_json.to_string();

            match database.update_data(
                &DB_DataElement {
                    key: cb_key,
                    val: cb_val.clone()
                }
            ) {
                Ok(_) => {},
                Err(m) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents(m.to_string().into())
                        .build();
                }
            };

            Response::new()
                .status(STATUS_200)
                .send_contents(cb_val.to_string().into())
        },
        "GET /roomSchd/timestamps HTTP/1.1" => { // Returns 25Live Report Dates
            let timestamps = database.get_data("report_timestamps").unwrap_or( DB_DataElement {key:"report_timestamps".to_string(),val:"[\"Timestamp Not Found\"]".to_string()}).val;
            debug!("Fetched Timestamps:\n {:?}", &timestamps);
            let contents = json!({
                "timestamps": timestamps
            }).to_string().into();
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /aliasTable HTTP/1.1" => {
            let alias_table = database.get_data("alias_table")
                .unwrap_or(DB_DataElement {
                    key: "alias_table".to_string(),
                    val: "Alias Table has not been updated".to_string()
                })
                .val;
            let contents = json!({
                "response": alias_table
            }).to_string().into();
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "GET /threadSchedule HTTP/1.1" => {
            let ts = thread_schedule.read().unwrap();
            let contents = json!({
                "response": ts.tasks
            }).to_string().into();
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        "POST /resetThreadInterval HTTP/1.1" => {
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            let task_name: String = body_json["task_name"]
                .as_str()
                .unwrap()
                .to_string();
            debug!("[Admin Tools] - Updating ThreadSchedule Task: \"{}\" to run now", task_name);
            if let Some(task) = thread_schedule.write().unwrap().tasks.get_mut(&task_name) {
                task.timestamp = task.timestamp - Duration::from_secs(task.duration);
                Response::new()
                        .status(STATUS_200)
                        .send_contents("ThreadSchedule Updated".into())
            } else {
                Response::new()
                        .status(STATUS_500)
                        .send_contents("Task Not Found".into())
            }
        },
        "POST /setThreadDuration HTTP/1.1" => {
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            let task_name: String = body_json["task"]
                .as_str()
                .unwrap()
                .to_string();
            let new_duration: String = body_json["new_duration"]
                .as_str()
                .unwrap()
                .to_string();
            debug!("[Admin Tools] - Updating ThreadSchedule Task Duration: \"{}\" to {}", task_name, new_duration);
            //
            if let Some(task) = thread_schedule.write().unwrap().tasks.get_mut(&task_name) {
                task.duration = new_duration.parse().unwrap();
                Response::new()
                        .status(STATUS_200)
                        .send_contents("ThreadSchedule Duration Updated".into())
            } else {
                Response::new()
                        .status(STATUS_500)
                        .send_contents("Task Not Found".into())
            }
        },
        "POST /setAliasTable HTTP/1.1" => {
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            // Parse Request Body
            let alias_rooms = body_json["rooms"]
                .as_array()
                .unwrap();
            //  Iterate through the rooms and find hostname exceptions,
            for alias_record in alias_rooms.iter() {
                debug!("[Alias] - Record \n {}", alias_record);
                let hostname_exception = alias_record.get("hostnameException")
                    .unwrap()
                    .to_string()
                    .replace("\"","");
                let room_name = alias_record.get("name")
                    .unwrap()
                    .to_string()
                    .replace("\"","");
                if hostname_exception != "" {
                    debug!("[Alias] - Hostname Exception: \n {} at {}", hostname_exception, room_name);
                    let mut room : DB_Room = match database.get_room_by_name(&room_name) {
                        Ok(r)  => r,
                        Err(m) => {
                            error!("DB_ERR: {}", m);
                            return Response::new()
                                    .status(STATUS_500)
                                    .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                    .build();
                        }
                    };
                    let mut pd = room.ping_data.clone();
                    for ping_record in &mut pd {
                        ping_record
                            .as_mut()
                            .unwrap()
                            .hostname.room = room_name.clone();
                    }
                    room.ping_data = pd;
                    let _ = database.update_room(&room);
                }
            }
            // Save Alias Table to database as dataElement
            let alias_table = DB_DataElement {
                key: "alias_table".to_string(),
                val: String::from_utf8(req.body).expect("Unable to parse body contents")
            };
            let _ = database.update_data(&alias_table);

            Response::new()
                    .status(STATUS_200)
                    .send_contents("Database Alias Table Updated".into())
        },
        "POST /resetAlias HTTP/1.1" => {
            let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
            // Get List of Rooms from body_json
            let target_rooms = body_json["rooms"]
                .as_array()
                .unwrap();
            // Change ping_data.hostname.room to original name
            for room in target_rooms.iter() {
                let mut room = match database.get_room_by_name(&room.to_string().replace("\"","")) {
                    Ok(r)  => r,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        return Response::new()
                                .status(STATUS_500)
                                .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                                .build();
                    }
                };
                let room_name = room.name.clone();
                let mut pd = room.ping_data.clone();
                for ping_record in &mut pd {
                    ping_record
                        .as_mut()
                        .unwrap()
                        .hostname.room = room_name.clone();
                }
                room.ping_data = pd;
                let _ = database.update_room(&room);
            }
            debug!("[Alias] - Reverting Alias Change for target_rooms, {:?}", &target_rooms);

            Response::new()
                    .status(STATUS_200)
                    .send_contents("Reset Requested Rooms".into())
        },
        // Terminal
        // --------------------------------------------------------------------
        "POST /terminal HTTP/1.1" => {
            match Terminal::execute(&req) {
                Ok(resp) => {
                    resp
                },
                Err(e) => {
                    Response::new()
                            .status(STATUS_500)
                            .send_contents(
                                json!(
                                    {"response": format!("Internal error: {:?}", e)}
                                ).to_string().into()
                            )
                }
            }
        },
        // --------------------------------------------------------------------
        // make calls to backend functionality
        // --------------------------------------------------------------------
        // login
        "POST / HTTP/1.1" => {
            let credential_search = Regex::new(r"uname=(?<user>.*)&remember=[on|off]").unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return None };
            let user = String::from(credentials["user"].to_string().into_boxed_str());

            user_homepage = match database.get_user(&user.as_str()) {
                Ok(u)  => {
                    match u.permissions {
                        7 => "html-css-js/index_admin.html",  // admin
                        6 => "html-css-js/index_admin.html", // manager / lead tech
                        0 => "html-css-js/login.html",      // revoked
                        _ => "html-css-js/index.html",     // tech default
                    }
                },
                Err(diesel::result::Error::NotFound) => {
                    "html-css-js/index.html"
                },
                Err(m) => {
                    error!("1603: DB_ERR: {}", m);
                    "html-css-js/login.html"
                }
            };

            let mut jar = CookieJar::new();
            jar.signed_mut(&database.get_cookie_key()).add((user.clone(), user.clone()));
            let signed_val = jar.get(&user).cloned().unwrap();

            Response::new()
                    .insert_header("Set-Cookie", &signed_val.to_string())
                    .insert_header("Access-Control-Expose-Headers", "Set-Cookie")
                    .status(STATUS_200)
                    .send_file(user_homepage)
        },
        "POST /bugreport HTTP/1.1" => {
            let credential_search = Regex::new(r#"title=(?<title>.*)&desc=(?<desc>.*)"#).unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return None };
            let encoded_title = String::from(credentials["title"].to_string().into_boxed_str());
            let encoded_desc = String::from(credentials["desc"].to_string().into_boxed_str());

            let mut decoded_title = decode(&encoded_title).expect("UTF-8");
            let mut decoded_desc;
            if encoded_desc == String::from("") {
                decoded_desc = decode(&encoded_title).expect("UTF-8");
            } else {
                decoded_desc = decode(&encoded_desc).expect("UTF-8");
            }
            decoded_title = decoded_title.replace("+", " ").into();
            decoded_desc = decoded_desc.replace("+", " ").into();
            decoded_desc = decoded_desc.replace("\0", "").into();

            let url = "https://api.github.com/repos/UWIT-CTS-Software/bronson_online/issues";
            let req = reqwest::Client::builder()
                .cookie_store(true)
                .default_headers(match construct_headers("gh") {
                    Ok(h) => h,
                    Err(m) => {
                        error!("Unable to set gh_api headers: {}", m);
                        HeaderMap::new()
                    }
                })
                .user_agent("server_lib/1.10.1")
                .build()
                .ok()?
            ;

            let _ = match API::new(MultiThread(req))
                .build()
                .method("POST")
                .endpoint(url)
                .json(
                    json!({
                        "title": decoded_title,
                        "body": decoded_desc
                    })
                )
                .timeout(Duration::from_secs(15))
                .send()
                .await {
                    Ok(_) => {},
                    Err(m) => { error!("{}", m); }
                };

            Response::new()
                    .status(STATUS_200)
                    .send_file(user_homepage)
        },
        // Jacknet
        "POST /ping HTTP/1.1" => { // OUTGOING
            let contents = ping_response(String::from_utf8(req.body).expect("Err, invalid UTF-8"), database);

            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },
        // Checkerboard
        "POST /run_cb HTTP/1.1" => { // OUTGOING
            // get zone selection from request and store
            // ----------------------------------------------------------------
            let building_sel = String::from_utf8(req.body).expect("CheckerBoard Err, invalid UTF-8");
            // ----------------------------------------------------------------
            // parse rooms map to load statuses for return
            // ----------------------------------------------------------------
            let mut return_body: Vec<Building> = Vec::new();
            let new_building = match database.get_building_by_abbrev(&building_sel) {
                Ok(b)  => b,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    return Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                            .build();
                }
            };
            let ret_rooms = match database.get_rooms_by_abbrev(&building_sel) {
                Ok(rs) => rs,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    return Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("An internal error occurred. Please contact a system administrator.\n{}", m).into())
                            .build();
                }
            };

            return_body.push(
                Building {
                    abbrev: new_building.abbrev,
                    name: new_building.name,
                    lsm_name: new_building.lsm_name,
                    rooms: ret_rooms,
                    zone: new_building.zone,
                    checked_rooms: new_building.checked_rooms,
                    total_rooms: new_building.total_rooms,
                }
            );

            let json_return = json!({
                "cb_body": return_body,
            });
            
            let contents = json_return.to_string().into();

            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
            // ----------------------------------------------------------------
        },
        // CamCode
        //  - CamCode - CFM Requests
        "POST /cfm_get_tree HTTP/1.1" => {
            let contents = match database.get_data("cfm_tree") {
                Ok(s)  => s.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    return Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("Failed to fetch CFM tree: \n{}", m).into())
                            .build();
                }
            }.into();

            Response::new()
                .status(STATUS_200)
                .send_contents(contents)
        },
        "POST /cfm_file HTTP/1.1" => {
            let contents = get_file_path(req.body, CFM_DIR);
            let mut f = match File::open(&contents) {
                Ok(file) => file,
                Err(e) => {
                    error!("Unable to open file {}: {}", &contents, e);
                    return Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("File not found: {}", &contents).into())
                            .build();
                }
            };
            
            let mut file_buffer = Vec::new();
            match f.read_to_end(&mut file_buffer) {
                Ok(_) => (),
                Err(e) => error!("Unable to read to end of file: {}", e)
            };

            // Extract just the filename from the full path
            let filename_only = contents.split('/').last().unwrap_or("file");
            let filename = format!("attachment; filename={}", filename_only);

            Response::new()
                    .status(STATUS_200)
                    .insert_header("Content-Type", "application/zip")
                    .insert_header("Content-Disposition", &filename)
                    .send_contents(file_buffer)
        },
        // Wiki
        "POST /w_build HTTP/1.1" => {
            let contents = w_build_articles();
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },

        "POST /w_build_tree HTTP/1.1" => {
            let contents = w_tree();
            Response::new()
                    .status(STATUS_200)
                    .send_contents(contents)
        },

        "POST /w_file HTTP/1.1" => {
            let contents = get_file_path(req.body, WIKI_DIR);
            let mut f = match File::open(&contents) {
                Ok(file) => file,
                Err(e) => {
                    error!("Unable to open file {}: {}", &contents, e);
                    return Response::new()
                            .status(STATUS_500)
                            .send_contents(format!("File not found: {}", &contents).into())
                            .build();
                }
            };
            
            let mut file_buffer = Vec::new();
            match f.read_to_end(&mut file_buffer) {
                Ok(_) => (),
                Err(e) => error!("Unable to read to end of file: {}", e)
            };

            // Extract just the filename from the full path
            let filename_only = contents.split('/').last().unwrap_or("file");
            let filename = format!("attachment; filename={}", filename_only);

            Response::new()
                    .status(STATUS_200)
                    .insert_header("Content-Type", "application/zip")
                    .insert_header("Content-Disposition", &filename)
                    .send_contents(file_buffer)
            
        },
        "POST /w_upload-json HTTP/1.1" => {
            #[derive(Deserialize)]
            struct UploadFile{
                filename: String, 
                parent_path: String, 
                fileblob: String, //base64
            }
            //req.body was coming in as &Vec<u8>

            let body_to_string = match String::from_utf8(req.body.clone()) {
                 Ok(s) => s,
                Err(e) => {
                     error!("Invalid UTF-8 received: {}", e);
                    return Response::new()
                         .status(STATUS_400)
                         .send_contents(format!("Invalid UTF-8: {}", e).into())
                         .build();

                }
            };

            let file_obj: UploadFile = match serde_json::from_str(&body_to_string){
                Ok(obj) => obj,
                Err(e) => {
                    error!("Invalid JSON received: {}", e);
                    return Response::new()
                    .status(STATUS_400)
                    .insert_header("Content-Type", "application/json")
                    .send_contents(json!({  
                            "response": "Unauthorized"
                        }).to_string().into())
                    .build();

                }
            };

            let decode_bytes = general_purpose::STANDARD
                .decode(&file_obj.fileblob);
    
            let bytes  = match decode_bytes {
                Ok(bytes) => bytes, 
                Err(e) => {
                    error!("Invalid base64: {}", e); 
                     return Response::new()
                         .status(STATUS_400)
                         .insert_header("Content-Type", "application/json")
                          .send_contents(json!({ 
                            "response": "Unauthorized"
                        }).to_string().into())
                        .build();
                }
            };

            let wiki_dirs = WIKI_DIR;
            let relative_path = file_obj.parent_path.to_string() + &file_obj.filename;
            let full_path = wiki_dirs.to_string() + (&relative_path);
            let full_path_buf = PathBuf::from(full_path.clone());

            let write_file = write::<&PathBuf, &Vec<u8>>(&full_path_buf, bytes.as_ref());
            if write_file.is_err() {
                let e = write_file.unwrap_err();
                error!("Failed to write file: {}", e);
                return Response::new()
                    .status(STATUS_500)
                    .send_contents(format!("Write error: {}", e).into())
                    .build();
            }

            let response_json = serde_json::json!({
                "status": "ok",
                "saved_to": full_path_buf.to_string_lossy()
            });

            Response::new()
                .status(STATUS_200)
                .insert_header("Content-Type", "application/json")
                .send_contents(response_json.to_string().into())
        },
        "POST /w_upload_folder HTTP/1.1" => {
              #[derive(Deserialize)]
            struct UploadDir {
                filename: String, 
                parent_path: String, 
            }
            //req.body was coming in as &Vec<u8>

            let body_to_string = match String::from_utf8(req.body.clone()) {
                 Ok(s) => s,
                Err(e) => {
                     error!("Invalid UTF-8 received: {}", e);
                    return Response::new()
                         .status(STATUS_400)
                         .send_contents(format!("Invalid UTF-8: {}", e).into())
                         .build();

                }
            };

            let folder_obj: UploadDir = match serde_json::from_str(&body_to_string){
                Ok(obj) => obj,
                Err(e) => {
                    error!("Invalid JSON received: {}", e);
                    return Response::new()
                    .status(STATUS_400)
                    .insert_header("Content-Type", "application/json")
                    .send_contents(json!({  
                            "response": "Unauthorized"
                        }).to_string().into())
                    .build();
                }
            };

            let wiki_dirs = WIKI_DIR;
            let relative_path = folder_obj.parent_path.to_string() + &folder_obj.filename;
            let full_path = wiki_dirs.to_string() + (&relative_path);
            let full_path_buf = PathBuf::from(full_path.clone());

            let create_dir = create_dir(&full_path_buf);
            if create_dir.is_err() {
                let e = create_dir.unwrap_err();
                error!("Failed to create dir: {}", e);
                return Response::new()
                    .status(STATUS_500)
                    .send_contents(format!("Error: {}", e).into())
                    .build();
            }

            let response_json = serde_json::json!({
                "status": "ok",
                "saved_to": full_path_buf.to_string_lossy()
            });

            Response::new()
                .status(STATUS_200)
                .insert_header("Content-Type", "application/json")
                .send_contents(response_json.to_string().into())
        },
        "DELETE /w_delete HTTP/1.1" => {
            #[derive(Deserialize)]
            struct FilePath {
                filepath: String
            }
              let body_to_string = match String::from_utf8(req.body.clone()) {
                 Ok(s) => s,
                Err(e) => {
                     error!("Invalid UTF-8 received: {}", e);
                    return Response::new()
                         .status(STATUS_400)
                         .send_contents(format!("Invalid UTF-8: {}", e).into())
                         .build();

                }
            };

            let received_path: FilePath = match serde_json::from_str(&body_to_string.clone()){
                Ok(obj) => obj,
                Err(e) => {
                    error!("Invalid JSON received: {}", e);
                    return Response::new()
                    .status(STATUS_400)
                    .insert_header("Content-Type", "application/json")
                    .send_contents(json!({  
                            "response": "Unauthorized"
                        }).to_string().into())
                    .build();

                }
            };

            let wiki_dirs = WIKI_DIR;
            let relative_path = received_path.filepath.to_string();
            let full_path = wiki_dirs.to_string() + (&relative_path);
            let full_path_buf = PathBuf::from(full_path.clone());
            if full_path_buf.is_dir(){
                let delete_dir = remove_dir(&full_path_buf);
                if delete_dir.is_err() {
                    let e = delete_dir.unwrap_err();
                    error!("Failed to delete directory: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents(format!("Delete error: {}", e).into())
                        .build();
                }
            } else {
                let delete_file = remove_file(&full_path_buf);
                if delete_file.is_err() {
                    let e = delete_file.unwrap_err();
                    error!("Failed to delete file: {}", e);
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents(format!("Delete error: {}", e).into())
                        .build();
                    }
                 }

             let response_json = serde_json::json!({
                "status": "ok",
             });

            Response::new()
                .status(STATUS_200)
                .insert_header("Content-Type", "application/json")
                .send_contents(response_json.to_string().into())

        }, 
        // Ticket Description
        start_line if start_line.starts_with("GET /ticket/description/") && start_line.ends_with(" HTTP/1.1") => {
            let ticket_id_str = start_line
                .strip_prefix("GET /ticket/description/")
                .and_then(|s| s.strip_suffix(" HTTP/1.1"))
                .unwrap_or("");

            let ticket_id = match ticket_id_str.parse::<i32>() {
                Ok(id) => id,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid ticket ID".into())
                        .build();
                }
            };

            let result = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(
                    fetch_tdx_ticket_description(&mut database, &tdx_client, ticket_id)
                )
            });

            match result {
                Ok(description) => Response::new()
                    .status(STATUS_200)
                    .send_contents(description.into()),
                Err(e) => {
                    error!("Failed to fetch ticket description: {}", e);
                    Response::new()
                        .status(STATUS_500)
                        .send_contents(format!("Error: {}", e).into())
                }
            }
        },
        // Ticket Feed
        start_line if start_line.starts_with("GET /ticket/feed/") && start_line.ends_with(" HTTP/1.1") => {
            let ticket_id_str = start_line
                .strip_prefix("GET /ticket/feed/")
                .and_then(|s| s.strip_suffix(" HTTP/1.1"))
                .unwrap_or("");

            let ticket_id = match ticket_id_str.parse::<i32>() {
                Ok(id) => id,
                Err(_) => {
                    return Response::new()
                        .status(STATUS_500)
                        .send_contents("Invalid ticket ID".into())
                        .build();
                }
            };

            let result = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(
                    fetch_tdx_ticket_feed(&mut database, &tdx_client, ticket_id)
                )
            });

            match result {
                Ok(feed) => Response::new()
                    .status(STATUS_200)
                    .send_contents(feed.into()),
                Err(e) => {
                    error!("Failed to fetch ticket feed: {}", e);
                    Response::new()
                        .status(STATUS_500)
                        .send_contents(format!("Error: {}", e).into())
                }
            }
        },
        &_                                 => {
            Response::new()
                    .status(STATUS_404)
                    .send_file("html-css-js/404.html")
        }
    };
    
    return res.build();
}
//rustdoc 
/// Function pulls leaderboard information from LSM APIs and updates the Bronson database. 
/// ### Parameters 
/// * database - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * req - [`API`] provides information to the function of the request that was made 
/// ### Returns 
/// * Void 
/// ### Example 
/// ``` no_run 
/// for task_name in due_tasks {
/// // Execute task based on task_name
///         match task_name.as_str() {
///         // other tasks names to match on
///         // ... => {}
///         "leaderboard"     => {
///             info!("[Data] - Pulling New LSM Leaderboard");
///             update_room_check_leaderboard(&mut database, &lsm_api).await;
///             info!("[Data] - New LSM Leaderboard Pulled")
///       },
///     }
///   }
/// ```
async fn update_room_check_leaderboard(database: &mut Database, req: &API) {
    let url_7_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D";
    let url_30_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last30days%22%7D";
    let url_90_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last90days%22%7D";
    let url_365_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last365days%22%7D";

    let v_7_days: Value = match serde_json::from_str(req
        .build()
        .method("GET")
        .endpoint(url_7_days)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .expect("Unable to make lsm_7_days API call")
        .body
        .as_str()) {
            Ok(v)  => v,
            Err(_) => json!({"data": []})
        };

    let v_30_days: Value = match serde_json::from_str(req
        .build()
        .method("GET")
        .endpoint(url_30_days)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .expect("Unable to make lsm_30_days API call")
        .body
        .as_str()) {
            Ok(v)  => v,
            Err(_) => json!({"data": []})
        };

    let v_90_days: Value = match serde_json::from_str(req
        .build()
        .method("GET")
        .endpoint(url_90_days)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .expect("Unable to make lsm_90_days API call")
        .body
        .as_str()) {
                Ok(v)  => v,
                Err(_) => json!({"data": []})
        };

    let v_365_days: Value = match serde_json::from_str(req
        .build()
        .method("GET")
        .endpoint(url_365_days)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .expect("Unable to make lsm_365_days API call")
        .body
        .as_str()) {
                Ok(v)  => v,
                Err(_) => json!({"data": []})
        };

    let data_7_days: Vec<Value> = match v_7_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };
    let data_30_days: Vec<Value> = match v_30_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };
    let data_90_days: Vec<Value> = match v_90_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };
    let data_365_days: Vec<Value> = match v_365_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };

    let contents = json!({
        "7days": data_7_days,
        "30days": data_30_days,
        "90days": data_90_days,
        "365days": data_365_days
    }).to_string().into();

    let _ = database.update_data(&DB_DataElement {
        key: String::from("lsm_leaderboard"),
        val: String::from_utf8(contents).expect("Unable to parse LSM Return"),
    });
}

// rustdoc 
/// Function fetches an LSM endpoint that fetches the location of our spare PCs and updates the database 
/// ### Parameters 
/// * database - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * req - [`API`] provides information to the function of the request that was made 
/// ### Returns 
/// * Void 
/// ### Example 
///  call in [`data_sync`]
/// ``` no_run 
///  for task_name in due_tasks {
/// // Execute task based on task_name
///         match task_name.as_str() {
///         // other tasks names to match on
///         // ... => {}
///         "spares"          => {
///             info!("[Data] - Pulling New LSM Spare Information");
///             update_lsm_spares(&mut database, &lsm_api).await; 
///             info!("[Data] - New LSM Spare Information Pulled")
///         },
///
///     }
/// }
/// ```
async fn update_lsm_spares(database: &mut Database, req: &API) {
    let url_spares = "https://uwyo.talem3.com/lsm/api/Spares?offset=0&p=%7B%7D";

    let body_spares = match req
        .build()
        .method("GET")
        .endpoint(url_spares)
        .send()
        .await {
            Ok(b) => b.body,
            Err(m) => { error!("Unable to make update_lsm_spares API call: {}", m); String::new() }
        };

    let v_spares: Value = serde_json::from_str(&body_spares).expect("Empty");
    let data_spares: Vec<Value> = match v_spares["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };
    // Pack into JSON response to front-end
    let contents = json!({
        "spares": data_spares
    }).to_string().into();

    let _ = database.update_data(&DB_DataElement {
        key: String::from("lsm_spares"),
        val: String::from_utf8(contents).expect("Unable to parse LSM Return"),
    });
}

// Unsure if this is worth implementing...
#[allow(dead_code)]
async fn update_lsm_data(_database: &mut Database, _req: &API) {
    // let buildings = database.get_buildings();
    // let api_endpoints = ["BuildingProcs","BuildingDisplays","BuildingProjectors","BuildingTouchPanels"];
    // for api_endpoint in api_endpoints {
    //     for building in &buildings {
    //         debug!("LSM_DATA: Processing {:?}", building.1.abbrev);
    //         let url = format!(
    //                 r"https://uwyo.talem3.com/lsm/api/{}?offset=0&p=%7BParentName%3A%22{}%22%7D", 
    //                 &api_endpoint,
    //                 building.1.lsm_name.as_str()
    //             );
    //         let devs: String;
    //         {
    //         devs = req.write().unwrap().get(url)
    //             .timeout(Duration::from_secs(15))
    //             .send()
    //             .await
    //             .expect("[-] RESPONSE ERROR")
    //             .text()
    //             .await
    //             .expect("[-] PAYLOAD ERROR");
    //         }
    //         let v_devs: Value = serde_json::from_str(&devs).expect("Empty");
    //         let data_devs: Vec<Value> = match v_devs["data"].as_array() {
    //             Some(data) => data.clone(),
    //             None => Vec::<Value>::new()
    //         };
    //     }
    // }
}

async fn run_checkerboard(database: &mut Database, req: &API) -> Result<(), String> {
    // Get an array of all buildings.
    let buildings = match database.get_buildings() {
        Ok(bs) => bs,
        Err(m) => {
            error!("DB_ERR: {}", m);
            HashMap::new()
        }
    };

    // Iterate over each.
    for building in buildings {
        debug!("[Checkerboard] - Processing Building: {:?}", building.1.abbrev);
        let url = format!(r"https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last90days%22%2CParentLocation%3A%22{}%22%7D", building.1.lsm_name.as_str());
        // Get Alias Table, to swap incoming room_names from LSM with
        //   Bronson friendly naming. We filter Alias Table to only contain
        //   rooms that are relevant to current LSM request.
        let alias_table : DB_DataElement = match database.get_data("alias_table") {
            Ok(at) => at,
            Err(m)     => {
                error!("DB_ERR: {}", m);
                DB_DataElement { 
                    key: String::from("alias_table"),
                    val: String::from("{\"buildings\": [], \"rooms\": []}") 
                }
            }
        };
        
        let alias_obj: Value = serde_json::from_str(&alias_table.val)
            .expect("Unable to Parse Alias Table Contents.");
        let alias_rooms = alias_obj.get("rooms").unwrap();
        //
        let mut alias_vec: Vec<(String, String)> = Vec::new();
        if let Some(arr) = alias_rooms.as_array() {
            for item in arr {
                let alias_name = item.get("name").unwrap().as_str().unwrap().to_string();
                if alias_name.contains(&building.1.abbrev.as_str()) {
                    debug!("[Checkerboard] Relevant Alias Found");
                    let alias_lsm = item.get("lsmName").unwrap().as_str().unwrap().to_string();
                    alias_vec.push((alias_name, alias_lsm));
                }
            }
        }
        // Alias Building
        let alias_buildings = alias_obj.get("buildings").unwrap();
        let mut alias_abbrev : (String, String) = ("NOTSET".to_string(),"NOTSET".to_string());
        if let Some(arr) = alias_buildings.as_array() {
            for item in arr {
                let alias_name = item.get("name").unwrap().as_str().unwrap().to_string();
                if alias_name == building.1.abbrev.as_str() {
                    alias_abbrev.0 = item.get("lsmName").unwrap().as_str().unwrap().to_string();
                    alias_abbrev.1 = item.get("name").unwrap().as_str().unwrap().to_string();
                }
            }
        }
        // Process Request to LSM
        let body = match req
            .build()
            .method("GET")
            .endpoint(&url)
            .timeout(Duration::from_secs(15))
            .send()
            .await {
                Ok(b) => b,
                Err(m) => { return Err(format!("Unable to make run_checkerboard API call: {}", m)); }
            }
            .body;
        
        let v: Value = match serde_json::from_str(&body) {
            Ok(val) => val,
            Err(_)      => {
                warn!("LSM_ERR: API call returned error.");
                json!({
                    "count": -1,
                    "data": "LSM Busy: Please try again"
                })
            }
        };

        let mut check_map: HashMap<String, DateTime<Local>> = HashMap::new();
        if v["count"].as_i64() > Some(0) {
            let num_entries = match v["count"].as_i64() {
                Some(num) => num,
                None => 0
            };
            let checks: Vec<Value> = match &mut v["data"].as_array() {
                Some(data) => data.clone(),
                None => {
                    error!("Unable to get API data as vec.");
                    Vec::<Value>::new()
                }
            };
            
            for i in 0..num_entries {
                let mut check: serde_json::Map<std::string::String, Value> = checks[i as usize].as_object().unwrap().clone();
                // Look to see if check["LocationName"] is in the alias_obj, replace it if so.
                for tuple in &alias_vec {
                    if tuple.1 == check["LocationName"].as_str().unwrap() {
                        debug!("[Checkerboard Alias] Room - {:?} to be replaced with {:?}", check["LocationName"].as_str().unwrap(), tuple.0);
                        check["LocationName"] = serde_json::Value::String(tuple.0.clone());
                    }
                }
                
                // Replace Abbreviation if exists
                if alias_abbrev.0 != "NOTSET" {
                    // check["LocationName"]
                    debug!("[Checkerboard Alias] Building - {:?} to be replaced with {:?}", alias_abbrev.0, alias_abbrev.1);
                    check["LocationName"] = serde_json::Value::String(
                        check["LocationName"]
                            .as_str()
                            .unwrap()
                            .replace(&alias_abbrev.0, &alias_abbrev.1)
                    );
                }
              
                // Only insert if this is the first entry or if the new timestamp is more recent
                let location_name = String::from(check["LocationName"].as_str().unwrap());
                let completed_on = match check["CompletedOn"].as_str().unwrap_or("2000-01-01T00:00:00Z").parse::<DateTime<Local>>() {
                    Ok(dt) => dt,
                    Err(m) => {
                        error!("Unable to parse CompletedOn for {}: {}", check["LocationName"].as_str().unwrap(), m);
                        match "2000-01-01T00:00:00Z".parse::<DateTime<Local>>() {
                            Ok(t) => t,
                            Err(m) => { return Err(m.to_string()); }
                        }
                    }
                };
                match check_map.get(&location_name) {
                    Some(et) => {
                        if completed_on > *et {
                            check_map.insert(location_name, completed_on);
                        }
                    },
                    None    => {
                        check_map.insert(location_name, completed_on);
                    }
                }
            }
        }
        // Get checked_rooms
        let mut checked_rooms: i16 = 0;
        let rooms = match database.get_rooms_by_parent_id(building.1.building_id) {
            Ok(rs) => rs,
            Err(m) => {
                error!("DB_ERR: {}", m);
                Vec::new()
            }
        };
        for mut room in rooms {
            if let Some(r) = check_map.get(&room.name) {
                room.checked = r.clone();
            }

            let elapsed = Local::now() - room.checked;
            let required_delta = check_period_to_delta(room.check_period);
            room.needs_checked = elapsed >= required_delta;
            
            match room.collegenet_id {
                Some(cn_id) => {
                    match database.get_reservation_by_cn_id(cn_id) {
                        Ok(res_result) => {
                            match res_result {
                                Some(res) => {
                                    if res.start_dt <= Local::now() {
                                        room.available = false;
                                        room.until = res.end_dt;
                                    } else {
                                        room.available = true;
                                        room.until = res.start_dt;
                                    }
                                },
                                None => {
                                    room.available = true;
                                    room.until = Local::now() + Days::new(1);
                                }
                            }
                        },
                        Err(m) => {
                            error!("Unable to get reservation by collegenet_id: {}", m);
                            room.available = true;
                            room.until = Local::now() + Days::new(1);
                        }
                    }
                },
                None        => {
                    room.available = true;
                    room.until = Local::now() + Days::new(1);
                }
            }

            // Check for room check
            if !room.needs_checked {
                checked_rooms += 1;
            }
            debug!("Checkerboard Room - Inserting {} into database", &room.name);
            match database.update_room(&room) {
                Ok(_) => {},
                Err(m) => {
                    error!("Unable to insert room to database: {}", m.to_string());
                }
            };
        }
        let ret_building = match database.get_building_by_id(building.1.building_id) {
            Ok(b)  => b,
            Err(m) => { return Err(m.to_string()); }
        };
        let ret_rooms = match database.get_rooms_by_parent_id(ret_building.building_id) {
            Ok(rs) => rs,
            Err(m) => {
                error!("DB_ERR: {}", m);
                Vec::new()
            }
        };
        let number_rooms: i16 = ret_rooms.len().try_into().unwrap();
        // Note, number_rooms and checked_rooms rely on the rooms inside LSM.
        //
        let new_building: DB_Building = DB_Building {
            abbrev: ret_building.abbrev,
            name: ret_building.name,
            building_id: ret_building.building_id,
            lsm_name: ret_building.lsm_name,
            zone: ret_building.zone,
            checked_rooms: checked_rooms,
            total_rooms: number_rooms,
        };
        let _ = database.update_building(&new_building);
    }
    return Ok(())
}

fn set_jn_thread_true() {
    JN_THREAD.store(true, Ordering::Release);
}
fn check_jn_thread() -> bool {
    JN_THREAD.load(Ordering::Acquire)
}

#[allow(dead_code)]
fn pad(raw_in: String, length: usize) -> String {
    if raw_in.len() < length {
        let mut out_string: String = String::new();
        for _ in 0..(length-raw_in.len()) {
            out_string.push(' ');
        }
        out_string.push_str(&raw_in);
        return out_string;
    } else {
        return String::from(raw_in);
    }
}

fn _pad_zero(raw_in: String, length: usize) -> String {
    if raw_in.len() < length {
        let mut out_string: String = String::new();
        for _ in 0..(length-raw_in.len()) {
            out_string.push('0');
        }
        out_string.push_str(&raw_in);
        return out_string;
    } else {
        return String::from(raw_in);
    }
}

fn get_zone_data(buildings: HashMap<String, DB_Building>) -> Vec<u8> {
    let mut zone_1: Vec<String> = Vec::new();
    let mut zone_2: Vec<String> = Vec::new();
    let mut zone_3: Vec<String> = Vec::new();
    let mut zone_4: Vec<String> = Vec::new();
    for (_, building) in buildings.iter() {
        match building.zone {
            1               => zone_1.push(building.abbrev.clone()),
            2               => zone_2.push(building.abbrev.clone()),
            3               => zone_3.push(building.abbrev.clone()),
            4               => zone_4.push(building.abbrev.clone()),
            _               => (),
        }
    }
    let json_return = json!({
        "1": {
            "name": 1,
            "building_list": zone_1, 
        },
        "2": {
            "name": 2,
            "building_list": zone_2,
        },
        "3": {
            "name": 3,
            "building_list": zone_3,
        },
        "4": {
            "name": 4,
            "building_list": zone_4,
        }
    });
    return json_return.to_string().into();
}

/*
   $$$$$\                     $$\       $$\   $$\            $$\     
   \__$$ |                    $$ |      $$$\  $$ |           $$ |    
      $$ | $$$$$$\   $$$$$$$\ $$ |  $$\ $$$$\ $$ | $$$$$$\ $$$$$$\   
      $$ | \____$$\ $$  _____|$$ | $$  |$$ $$\$$ |$$  __$$\\_$$  _|  
$$\   $$ | $$$$$$$ |$$ /      $$$$$$  / $$ \$$$$ |$$$$$$$$ | $$ |    
$$ |  $$ |$$  __$$ |$$ |      $$  _$$<  $$ |\$$$ |$$   ____| $$ |$$\ 
\$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$ | \$$\ $$ | \$$ |\$$$$$$$\  \$$$$  |
 \______/  \_______| \_______|\__|  \__|\__|  \__| \_______|  \____/ 

 - ping_response()
 - execute_ping()
 - ping_room()
 - execute_ping_st()
 - ping_room_st()

*/

//rustdoc 
/// Function fetches all of the rooms in a building requested.  
/// ### Parameters 
/// * `tmp` - String containing the request body. 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// ### Returns 
/// * A byte vector of stringified json containing the rooms in the building. 
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_run
/// let contents = ping_response(String::from_utf8(req.body).expect("Err, invalid UTF-8"), database);
/// ```
fn ping_response(tmp: String, mut database: Database) -> Vec<u8> {
    let pr: PingRequest = serde_json::from_str(&tmp)
        .expect("Fatal Error: Unable to parse ping request");

    let json_return: Value;
    let rooms: Vec<DB_Room> = match database.get_rooms_by_abbrev(&pr.building) {
        Ok(rs) => rs,
        Err(m) => {
            error!("DB_ERR: {}", m);
            Vec::new()
        }
    };
    json_return = json!({
        "jn_body": rooms,
    });
    
    // Return JSON with ping results
    return json_return.to_string().into();
}

/*
execute_ping()
--
NOTE: CAMPUS_CSV -> "html-css-js/campus.csv"
      CAMPUS_STR -> "html-css-js/campus.json"
*/

// call ping_this executable here

//rustdoc 
/// Function grabs and iterates through rooms calling [`ping_room`] 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// ### Returns 
/// * Void
/// ### Example 
/// 
/// ``` no_run
///  if jn_st {
///         let mut db_jn_clone = database.clone();
///         jn_thread.execute( move || async {
///             execute_ping(&mut db_jn_clone).await;
///         }.now_or_never().unwrap());
///         } else {
///             execute_ping(&mut database).await;
///        }
/// ```
async fn execute_ping(database: &mut Database) {
    let buildings: HashMap<String, DB_Building> = match database.get_buildings() {
        Ok(bs) => bs,
        Err(m) => {
            error!("DB_ERR: {}", m);
            HashMap::new()
        }
    };

    for building in buildings {
        let rooms_to_ping: Vec<DB_Room> = match database.get_rooms_by_parent_id(building.1.building_id) {
            Ok(rs) => rs,
            Err(m) => {
                error!("DB_ERR: {}", m);
                Vec::new()
            }
        };

        for rm in rooms_to_ping {
            std::thread::scope(|s| {
                s.spawn(|| {
                    let mut room = rm.clone();
                    room.ping_data = ping_room(room.ping_data);
                    let _ = database.update_room(&room);
                    debug!("[JackNet] - Updated {:?}", &room.name);
                });
            });
        }
    }
}

// rustdoc 
/// Function sends ICMP pings room devices and returns their IP addresses if found. 
/// 
/// ### Parameters 
/// * `net_elements` - vector of [`DB_IpAddress`] information needed for pings grabbed from the database. 
/// ### Returns 
/// * `pinged_hns` - vector of [`DB_IpAddress`] containing the hostnames of devices that ponged back. 
/// call in [`execute_ping`]
/// 
fn ping_room(net_elements: Vec<Option<DB_IpAddress>>) -> Vec<Option<DB_IpAddress>> {
    let mut pinged_hns: Vec<Option<DB_IpAddress>> = Vec::new();

    for net in net_elements {
        let hn_string: String = net.as_ref().unwrap().hostname.to_string();
        pinged_hns.push(Some(
            match ping_this(&hn_string) {
                Ok(ip) => {
                DB_IpAddress {
                    hostname: net.clone().unwrap().hostname,
                    ip: ip,
                    last_ping: String::from(format!("{}", chrono::Utc::now())),
                    alert: 0,
                    error_message: String::new()
                }}, // Upon first instance of error ping again
                _ => { 
                   
                    match ping_this(&hn_string) {
                        Ok(ip) => {
                            DB_IpAddress {
                                hostname: net.clone().unwrap().hostname,
                                ip: ip,
                                last_ping: String::from(format!("{}", chrono::Utc::now())),
                                alert: 0,
                                error_message: String::new()
                            }
                        },
                        Err(m)      => {
                            debug!("PIN_ERR: {} failed: {}", net.clone().unwrap().hostname.to_string(), m);
                            
                            DB_IpAddress {
                                hostname: net.clone().unwrap().hostname,
                                ip: String::from("x"),
                                last_ping: String::from(format!("{}", chrono::Utc::now())),
                                alert: net.clone().unwrap().alert + 1,
                                error_message: String::from(m)
                            }
                        }
                    } 

                },
            }
        ))
    };
    return pinged_hns;
}

/*
 $$$$$$\  $$\       $$\                 $$$$$$$\                  $$\ 
$$  __$$\ $$ |      $$ |                $$  __$$\                 $$ |
$$ /  \__|$$$$$$$\  $$ |  $$\  $$$$$$\  $$ |  $$ | $$$$$$\   $$$$$$$ |
$$ |      $$  __$$\ $$ | $$  |$$  __$$\ $$$$$$$\ |$$  __$$\ $$  __$$ |
$$ |      $$ |  $$ |$$$$$$  / $$ |  \__|$$  __$$\ $$ |  \__|$$ /  $$ |
$$ |  $$\ $$ |  $$ |$$  _$$<  $$ |      $$ |  $$ |$$ |      $$ |  $$ |
\$$$$$$  |$$ |  $$ |$$ | \$$\ $$ |      $$$$$$$  |$$ |      \$$$$$$$ |
 \______/ \__|  \__|\__|  \__|\__|      \_______/ \__|       \_______|
*/


fn construct_headers(call_type: &str) -> Result<HeaderMap, String> {
    let k_json = match env::var("KEYS_JSON") {
        Ok(k)  => String::from(k),
        Err(m) => {
            return Err(format!("Unable to parse keys from environment file: {}", m));
        }
    };
    let json_keys: HashMap<String, Value> = match serde_json::from_str(&k_json) {
        Ok(jk) => jk,
        Err(m) => {
            return Err(format!("Unable to parse key json into hashmap: {}", m));
        }
    };
    let mut header_map = HeaderMap::new();
    if call_type == "lsm" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(json_keys.get("lsm_api").unwrap().as_str().expect("Parse error")).expect("[-] KEY_ERR: Not found."));
    } else if call_type == "gh" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(json_keys.get("gh_api").unwrap().as_str().expect("Parse error")).expect("[-] KEY_ERR: Not found."));
        header_map.insert(HeaderName::from_static("x-github-api-version"), HeaderValue::from_static("2022-11-28"));
    } else if call_type == "25l" {
        header_map.insert(ACCEPT, HeaderValue::from_static("text/xml"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(json_keys.get("25live_api").unwrap().as_str().expect("Parse error")).expect("[-] KEY_ERR: Not found."));
        header_map.insert(HeaderName::from_static("www-authenticate"), HeaderValue::from_static("Basic realm=\"R25 WebServices\", charset=\"UTF-8\""));
    }

    return Ok(header_map);
}


fn check_period_to_delta(period: i16) -> TimeDelta {
    match period {
        0 => TimeDelta::weeks(1),   // 1 Week
        1 => TimeDelta::weeks(2),   // 2 Weeks
        2 => TimeDelta::days(30),   // 1 Month (approx)
        3 => TimeDelta::days(90),   // 3 Months (approx)
        _ => TimeDelta::weeks(1),   // default
    }
}

/*
 $$$$$$\                           $$$$$$\                  $$\           
$$  __$$\                         $$  __$$\                 $$ |          
$$ /  \__| $$$$$$\  $$$$$$\$$$$\  $$ /  \__| $$$$$$\   $$$$$$$ | $$$$$$\  
$$ |       \____$$\ $$  _$$  _$$\ $$ |      $$  __$$\ $$  __$$ |$$  __$$\ 
$$ |       $$$$$$$ |$$ / $$ / $$ |$$ |      $$ /  $$ |$$ /  $$ |$$$$$$$$ |
$$ |  $$\ $$  __$$ |$$ | $$ | $$ |$$ |  $$\ $$ |  $$ |$$ |  $$ |$$   ____|
\$$$$$$  |\$$$$$$$ |$$ | $$ | $$ |\$$$$$$  |\$$$$$$  |\$$$$$$$ |\$$$$$$$\ 
 \______/  \_______|\__| \__| \__| \______/  \______/  \_______| \_______|

  _|_|_|  _|_|_|_|  _|      _|  
_|        _|        _|_|  _|_|  
_|        _|_|_|    _|  _|  _|  
_|        _|        _|      _|  
  _|_|_|  _|        _|      _|  
                                       
,,          ,,                         
||          ||                         
||/\\  _-_  || -_-_   _-_  ,._-_  _-_, 
|| || || \\ || || \\ || \\  ||   ||_.  
|| || ||/   || || || ||/    ||    ~ || 
\\ |/ \\,/  \\ ||-'  \\,/   \\,  ,-_-  
  _/           |/                      
               '                       
*/

// rustdoc
/// Function queries the file system to check if the directory exists
/// * Returns a boolean   
/// 
/// Example call in [`w_build_articles`]

fn dir_exists(path: &str) -> bool {
    return metadata(path).is_ok();
}

// rustdoc
/// Function queries the file system to check if the path leads to a directory.  
/// * Returns a boolean
/// 
/// Example call in [`build_subtree`]

fn is_this_dir(path: &str) -> bool {
    return metadata(path).unwrap().is_dir();
}

// rustdoc 
/// Function iterates over the entries in a directory and returns the paths 
/// ### Returns 
/// * A vector containing the string representation of the paths contained in the given directory. 
/// * Note: function is non-recursive so providing a directory of directories will only retrieve the first layer. 
/// ### Example
/// call in [`build_tree`]
/// ``` no_run
///  let dirs = get_dir_contents(ex_path);
/// ```

fn get_dir_contents(path: &str) -> Vec<String> {
    let mut strings = Vec::new();
    let paths = match read_dir(&path) {
        Ok(p) => p,
        Err(e) => {
            error!("Malformed directory path(s): {}", e);
            let empty_dir_path = Path::new("empty_dir");
            let _ = std::fs::create_dir_all(&empty_dir_path);
            read_dir(&empty_dir_path).unwrap()
        }
    };
    for p in paths {
        strings.push(p.unwrap().path().display().to_string());
    }

    return strings;
}

/*                             
,,                 |\   ,,                   
||      _           \\  ||                   
||/\\  < \, \\/\\  / \\ ||  _-_  ,._-_  _-_, 
|| ||  /-|| || || || || || || \\  ||   ||_.  
|| || (( || || || || || || ||/    ||    ~ || 
\\ |/  \/\\ \\ \\  \\/  \\ \\,/   \\,  ,-_-  
  _/                
*/

// rustdoc
///  Entry function for the building (via DFS) of a virtual tree of files and directories as JSON.
/// ## Parameters 
/// * `root` -  The path to the root directory.
/// * `blacklist` - collection of excluded file types. 
/// ## Returns 
/// * Result<String, String> 
///    - The Ok variant field is the json string 
///    - The Err variant field is an error message.
/// ## Example 
/// call in [`w_tree`]
/// ```no_run
///
///  let json_return = match build_tree(WIKI_DIR, _wiki_blacklist) {
///     Ok(j)     =>  j,
///     Err(m)    => {error!("[Data] - Tree Build FAILED: {}", m); json!([]).to_string() }
/// };
/// 
/// ```
/// * Where `EXAMPLE_DIR` is a directory path stored in a macro
/// * And `ex_blacklist` is a hashset containing excluded file extensions.
fn build_tree(root: &str, blacklist: HashSet<&str>) -> Result<String, String> {
    let mut tree_root: TreeNode = TreeNode::with_name_path("Root", "./");

    let dirs = get_dir_contents(root);
    for item in dirs.iter() {
        // Ignore files with '_' and '.' prefix & other specific files
        // Skip hidden/system files
        if let Some(file_name) = Path::new(item).file_name().and_then(|s| s.to_str()) {
             let extension = file_name.rsplit('.').next().unwrap_or("");
            if file_name.starts_with('_') || file_name.starts_with('.') || blacklist.contains(extension) {
                continue;
            }
            
        }
        let relative_path = item.replace(root, "./");
        tree_root.push(build_subtree(&relative_path, root, blacklist.clone()));
         
    }
    
    let json_return = json!({
        "tree": tree_root
    });

    info!("[Data] - CFM Tree Build Complete");

    Ok(json_return.to_string())
}

// rustdoc
/// Function to recursively build a json subtree from the node passed to it by [`build_tree`].
/// ### Parameters
/// * `path` - The relative path passed
/// * `root` -  The path to the root directory.
/// * `blacklist` - Collection of excluded file types.
/// ### Return 
/// * A [`TreeNode`] (struct) containing filename, filepath, and children. 
/// Called by [`build_tree`]


fn build_subtree(path: &str, root: &str, blacklist: HashSet<&str>) -> TreeNode {
    use std::path::Path;

    let name = Path::new(&(root.to_string() + path))
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
        
    let mut node = if is_this_dir(&(root.to_string() + path)) {
        // Folder: children starts as empty vec
        TreeNode::with_name_path(name, path.to_string())
    } else {
        // File / leaf: children = None
        TreeNode {
            name,
            file_path: path.to_string(),
            children: None,
        }

   };

    if is_this_dir(&(root.to_string() + path)) {
        let path_contents = get_dir_contents(&(root.to_string() + path));
        for entry in path_contents.iter() {
            // Skip hidden/system files
            if let Some(file_name) = Path::new(entry).file_name().and_then(|s| s.to_str()) {

                let extension = file_name.rsplit('.').next().unwrap_or("");
                if file_name.starts_with('_') || file_name.starts_with('.') || blacklist.contains(extension) {
                    continue;
                }
               
            }

            let relative_path = entry.replace(root, "./");
            node.push(build_subtree(&relative_path, root, blacklist.clone()));
        }
    }

    node
}


// get_file_path() - sends the selected file to the client
// TODO:
//    [ ] - store selected file as bytes ?
//    [ ] - send in json as usual ?


// rustdoc 
/// Function retrieves the absolute file path. 
/// ### Parameters 
/// * `body` - The request body
/// * `root` - The directory to extract the path from. 
/// ### Returns 
/// A string containing the raw file path.
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_run
/// let contents = get_file_path_path(req.body, EX_DIR);
/// ```
fn get_file_path(body: Vec<u8>, root: &str) -> String {
    let tmp = String::from_utf8(body).expect("Err, invalid UTF-8");
    //
    let r_f: RequestFile = serde_json::from_str(&tmp)
        .expect("Err, Failed to grab file");
    let filename = r_f
        .filename
        .strip_prefix("Root/")
        .unwrap_or(&r_f.filename);

    let mut path_raw = String::from(root);
    path_raw.push('/');
    path_raw.push_str(filename);

    return path_raw;
}


/*
$$$$$$$$\ $$\           $$\                           
\__$$  __|\__|          $$ |                          
   $$ |   $$\  $$$$$$$\ $$ |  $$\  $$$$$$\  $$\   $$\ 
   $$ |   $$ |$$  _____|$$ | $$  |$$  __$$\ \$$\ $$  |
   $$ |   $$ |$$ /      $$$$$$  / $$$$$$$$ | \$$$$  / 
   $$ |   $$ |$$ |      $$  _$$<  $$   ____| $$  $$<  
   $$ |   $$ |\$$$$$$$\ $$ | \$$\ \$$$$$$$\ $$  /\$$\ 
   \__|   \__| \_______|\__|  \__| \_______|\__/  \__|
*/

//rustdoc 

/// Functions fetches authentication token (Bearer token) for use in TeamDynamix API endpoints. 
/// The retrieved token is stored in the Bronson Database. 
/// ### Parameters 
/// * database - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * req - [`API`] provides information to the function of the request that was made 
/// ### Returns 
/// - Result Ok - Token was successfully stored in the database.
/// - String  - An error occurred.
/// ### Example 
/// call in [`data_sync`]
/// ``` no_run
///  let _ = fetch_tdx_token(database, req).await;
/// ```
/// Note: Token has a lifespan of 24hrs 

async fn fetch_tdx_token(database: &mut Database, req: &API) -> Result<(), String> {
    let url = "https://uwyo.teamdynamix.com/TDWebApi/api/auth/login";

    // Get TDX login credentials from database
    let tdx_api_raw = match database.get_key("tdx_api_raw") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get tdx_api_raw key: {}", e)),
    };

    // Parse username and password
    let raw = tdx_api_raw.val.as_str();
    let parsed: serde_json::Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(e) => return Err(format!("JSON parse error: {}", e)),
    };

    let username: &str = parsed["username"].as_str().unwrap_or("");
    let password: &str = parsed["password"].as_str().unwrap_or("");
    
    // Send the request
    let resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Accept", "application/json")
        .json(
            json!({
                "username": username,
                "password": password
            })
        )
        .send()
        .await {
            Ok(r)  => r,
            Err(e) => return Err(e.to_string())
        };

    if !resp.status.is_success() {
        return Err(resp.status.to_string());
    }

    // Store token in database
    let token = resp.body;
    let token = "Bearer ".to_owned() + &token;
    let _ = database.update_key(&DB_Key {
        key_id: String::from("tdx_api"),
        val: token,
    });

    debug!("[Tickex] Stored new TDX token successfully into Database");

    Ok(())
}

// rustdoc
/// Function fetches new authentication token (Bearer token) when TeamDynamix responds with "Unauthorized".
/// ### Parameters
/// * database - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * req - [`API`] provides information to the function of the request that was made 
/// * method - String Reference containing the API method. 
/// * url - String Reference containing the TDX API url. 
/// * request_body - the response body as JSON if required. 
/// ### Returns 
/// * [`APIResponse`] (struct)
///
///  Called in most tdx functions if response received "Unauthorized".
/// one example call in [`get_tdx_user`]

async fn retry_tdx_token(database: &mut Database, req: &API, method: &str, url: &str, request_body: Option<serde_json::Value>) -> Result<APIResponse, String> {
    warn!("Unauthorized Response from TDX while performing action, trying again with new Token...");

    // Grab new TDX Token
    fetch_tdx_token(database, req).await?;

    // Get the TDX API token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API token while retrying new Token pull: {}", e)),
    };

    // Build the request
    let mut endpoint = req
        .build()
        .method(method)
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(120));
    // Add the body if there is one provided
    if let Some(body) = request_body {
        endpoint = endpoint.body(body);
    }

    // Make the request to TDX API
    let retry_resp = match endpoint.send().await {
        Ok(r) => r,
        Err(e) => return Err(format!("Failed to fetch response from TDX: {}", e)),
    };

    if !retry_resp.status.is_success() {
        return Err(format!("TDX API error: {} - {}", retry_resp.status, retry_resp.status.canonical_reason().unwrap_or("Unknown")));
    }
        
    warn!("Successfully recovered new TDX Token & fetched new description data");
    Ok(retry_resp)
}


//rustdoc
/// Function first checks the database, if database comes back empty all tickets will be grabbed. Otherwise function call sinks ticket data up to the past six-months. 
///  ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * `req` - [`API`] (struct) provides information to the function of the request that was made 
/// ### Returns 
/// * Result Ok - Tickex run was successful.
/// * String  - An error occurred.
/// ### Example 
///  call in [`data_sync`]
/// ``` no_run
///  let _ = match run_tickex(&mut database, &tdx_api).await {
///         Ok(_)     =>  info!("[Data] - Tickex Run Complete"),
///         Err(m)    => error!("[Data] - Tickex Run FAILED: {}", m)
///        };
/// ```
/// Note: Function is called every minute to keep database up to date with TDX. 

async fn run_tickex(database: &mut Database, req: &API) -> Result<(), String> {
    let url = "https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/search";

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // If no tickets exist, perform a tickets fetch from Jan 1st, 2020 to now
    if database.check_if_tickets_empty() {
        warn!("[Data] - No tickets exist in Database. Pulling all tickets from Jan 1st, 2020...");

        // Define search
        let search_body = serde_json::json!({
            "ModifiedDateFrom": "2020-01-01T00:00:00Z",
            "ResponsibilityGroupIDs": [2742], // CTS Group ID
            "MaxResults": 100000  // TDX times out at around 200,000, CTS tickets don't reach this high anyway
        });
        // Make the request
        let mut resp = match req
            .build()
            .method("POST")
            .endpoint(url)
            .header("Authorization", &tdx_token.val)
            .header("Content-Type", "application/json")
            .body(search_body.clone())
            .timeout(Duration::from_secs(120))
            .send()
            .await {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to fetch ticket from TDX: {}", e))
            };

        // Try fetching a new tdx token and try again if Unauthorized
        if resp.status == reqwest::StatusCode::UNAUTHORIZED {
            resp = retry_tdx_token(database, req, "POST", &url, Some(search_body)).await?;
        }

        if !resp.status.is_success() {
            return Err(format!("TDX API error: {}", resp.status));
        }

        // Parse the response as JSON
        let tickets_json: Vec<serde_json::Value> = 
            serde_json::from_str(&resp.body).map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, resp.body))?;

        // Map to DB_Ticket and insert
        for ticket_val in &tickets_json {
            match serialize_ticket(database, ticket_val.clone()) {
                Ok(ticket) => {
                    if let Err(e) = database.update_ticket(&ticket) {
                        error!("Failed to insert/update ticket {}: {}", ticket.ticket_id, e);
                    }
                }
                Err(e) => error!("Failed to process ticket: {}", e)
            }
        }

        // Double check tickets exist in database, but this should not be necessary
        if database.check_if_tickets_empty() {
            return Err("Failed to insert tickets into database".to_string());
        }
    } else { // Tickets table not empty, only update more recent tickets
        // Look in database for most recent Ticket and look at its date
        let latest_ticket = match database.get_latest_ticket() {
            Ok(t) => t,
            Err(e) => return Err(format!("Failed to get latest ticket: {}", e)),
        };
        
        let latest_ticket_date = latest_ticket.created_date[..10].to_string(); // Truncate to YYYY-MM-DD

        // Calculate date 6 months back
        let latest_date = chrono::NaiveDate::parse_from_str(&latest_ticket_date, "%Y-%m-%d").unwrap();
        let from_date = latest_date.checked_sub_months(chrono::Months::new(6)).unwrap().format("%Y-%m-%dT00:00:00Z").to_string();

        // Define search
        let search_body = serde_json::json!({
            "ModifiedDateFrom": from_date,
            "MaxResults": 10000,
            "ResponsibilityGroupIDs": [2742]
        });

        // Make the request to TDX API
        let mut resp = match req
            .build()
            .method("POST")
            .endpoint(url)
            .header("Authorization", &tdx_token.val)
            .header("Content-Type", "application/json")
            .body(search_body.clone())
            .timeout(Duration::from_secs(120))
            .send()
            .await {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to fetch ticket from TDX: {}", e))
            };

        // Try fetching a new tdx token and try again if Unauthorized
        if resp.status == reqwest::StatusCode::UNAUTHORIZED {
            resp = retry_tdx_token(database, req, "POST", &url, Some(search_body)).await?;
        }

        // Get the response body as text and convert to JSON
        let tickets_json: Vec<serde_json::Value> = serde_json::from_str(&resp.body)
            .map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, resp.body))?;

        // Serialize to DB_Ticket and insert/update ticket in database
        for ticket_val in &tickets_json {
            match serialize_ticket(database, ticket_val.clone()) {
                Ok(ticket) => {
                    if let Err(e) = database.update_ticket(&ticket) {
                        error!("Failed to insert/update ticket {}: {}", ticket.ticket_id, e);
                    }
                }
                Err(e) => error!("Failed to process ticket: {}", e)
            }
        }
    }

    Ok(())
}

// rustdoc 
/// Function formats ticket information from TDX to be stored in the Bronson database. 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database. 
/// * `ticket_json` - JSON representation of the ticket to be serialized 
/// ### Returns 
/// * [`DB_Ticket`] - Upon success the function returns a new [`DB_Ticket`] object
/// * String - Upon error a string error message is provided. 
/// 
/// Note: Function is called when tickets are edited or added to the Bronson database. 
/// ### Example 
///call in [`run_tickex`]
/// ``` no_run
/// for ticket_val in &tickets_json {
///     match serialize_ticket(database, ticket_val.clone()) {
///         Ok(ticket) => {
///             if let Err(e) = database.update_ticket(&ticket) {
///                  error!("Failed to insert/update ticket {}: {}", ticket.ticket_id, e);
///                 }
///             }
///             Err(e) => error!("Failed to process ticket: {}", e)
///         }
///     }
/// ```

fn serialize_ticket(database: &mut Database, ticket_json: serde_json::Value) -> Result<DB_Ticket, String> {
    let id = ticket_json["ID"].as_i64().unwrap_or(0) as i32;

    // Try to fetch ticket from DB if it exists
    let orig_viewed = match database.get_ticket(id) {
        Ok(Some(ticket)) => ticket.has_been_viewed,
        Ok(None) => false,
        Err(e) => {
            error!("DB error fetching ticket {}: {}", id, e);
            false
        }
    };

    // Get old ticket if it exists (new tickets won't have one and defaults to empty string)
    let old_ticket = database.get_ticket(ticket_json["ID"].as_i64().unwrap_or(0) as i32).unwrap_or(None);
    let (comment_count, old_comment_count) = match old_ticket {
        Some(t) => (t.comment_count, t.old_comment_count),
        None => (0_i16, 0_i16),
    };

    // Serialize Ticket data into DB_Ticket struct. If this is a new ticket, fields will populated with default values
    Ok(DB_Ticket {
        ticket_id: ticket_json["ID"].as_i64().unwrap_or(0) as i32,
        parent_id: ticket_json["ParentID"].as_i64().unwrap_or(0) as i32,
        has_been_viewed: orig_viewed,
        type_name: ticket_json["TypeName"].as_str().unwrap_or("").to_string(),
        type_category_name: ticket_json["TypeCategoryName"].as_str().unwrap_or("").to_string(),
        title: ticket_json["Title"].as_str().unwrap_or("").to_string(),
        account_name: ticket_json["AccountName"].as_str().unwrap_or("").to_string(),
        status_name: ticket_json["StatusName"].as_str().unwrap_or("").to_string(),
        service_name: ticket_json["ServiceName"].as_str().unwrap_or("").to_string(),
        priority_name: ticket_json["PriorityName"].as_str().unwrap_or("").to_string(),
        created_date: ticket_json["CreatedDate"].as_str().unwrap_or("").to_string(),
        created_full_name: ticket_json["CreatedFullName"].as_str().unwrap_or("").to_string(),
        modified_date: ticket_json["ModifiedDate"].as_str().unwrap_or("").to_string(),
        modified_full_name: ticket_json["ModifiedFullName"].as_str().unwrap_or("").to_string(),
        requestor_name: ticket_json["RequestorName"].as_str().unwrap_or("").to_string(),
        requestor_first_name: ticket_json["RequestorFirstName"].as_str().unwrap_or("").to_string(),
        requestor_email: ticket_json["RequestorEmail"].as_str().unwrap_or("").to_string(),
        requestor_phone: ticket_json["RequestorPhone"].as_str().unwrap_or("").to_string(),
        days_old: ticket_json["DaysOld"].as_i64().unwrap_or(0) as i16,
        responsible_full_name: ticket_json["ResponsibleFullName"].as_str().unwrap_or("").to_string(),
        responsible_group_name: ticket_json["ResponsibleGroupName"].as_str().unwrap_or("").to_string(),
        comment_count, 
        old_comment_count,
    })
}


// rustdoc 
/// Function returns the description of tickets from TDX 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `ticket_id` - the identifier for the ticket requiring it's description grabbed. 
/// ### Returns 
/// * String - Upon success a String containing the ticket `description` is returned. 
/// * String - Upon error a string error message is provided. 
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_run
/// let result = tokio::task::block_in_place(|| {
///     tokio::runtime::Handle::current().block_on(
///         fetch_tdx_ticket_description(&mut database, &tdx_client, ticket_id)
///     )
///    });
/// ```
async fn fetch_tdx_ticket_description(database: &mut Database, req: &API, ticket_id: i32) -> Result<String, String> {
    // Construct the API URL to fetch ticket details
    let url = format!(
        "https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/{}",
        ticket_id
    );

    // Get the TDX API token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API token while fetching ticket description: {}", e)),
    };

    // Make the request to TDX API
    let mut resp = match req
        .build()
        .method("GET")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Accept", "application/json")
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch ticket from TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "GET", &url, None).await?;
    }

    // Parse the response body
    let ticket_json: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Failed to parse ticket JSON: {}", e))?;

    // Extract the description field
    let description = ticket_json["Description"]
        .as_str()
        .unwrap_or("No description available")
        .to_string();

    Ok(description)
}

// rustdoc 
/// Function fetches and formats ticket feed (comments) from TDX to display in Tickex
/// ### Parameters  
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `ticket_id` - the identifier for the ticket requiring it's description grabbed. 
/// ### Returns
/// * String - Upon success a String containing the formatted `output_json` is returned 
/// * String - Upon error a string error message is provided. 
/// ### Example
/// call in [`handle_connection`]
/// ``` no_run
/// let result = tokio::task::block_in_place(|| {
///     tokio::runtime::Handle::current().block_on(
///         fetch_tdx_ticket_feed(&mut database, &tdx_client, ticket_id)
///     )
/// });

/// ```


async fn fetch_tdx_ticket_feed(database: &mut Database, req: &API, ticket_id: i32) -> Result<String, String> {
    // Construct the API URL to fetch ticket details
    let url = format!(
        "https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/{}/feed",
        ticket_id
    );

    // Get the TDX API token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API token while fetching ticket feed: {}", e)),
    };

    // Make the request to TDX API
    let mut resp = match req
        .build()
        .method("GET")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Accept", "application/json")
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch ticket feed from TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "GET", &url, None).await?;
    }

    // Parse the response body
    let ticket_json: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Failed to parse ticket JSON: {}", e))?;
    let entries = ticket_json.as_array().ok_or("Expected JSON array for ticket feed")?;

    // Build json for frontend
    let mut items: Vec<Value> = Vec::new();

    let mut comment_count = 0;
    for entry in entries {
        let commenter = entry.get("CreatedFullName")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let date = entry.get("CreatedDate")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let body_html = entry.get("Body")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let replies_count = entry.get("RepliesCount")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let replies: (Vec<String>, Vec<String>, Vec<String>) = if replies_count > 0 {
            fetch_tdx_feed_replies(
                database, req, entry.get("ID").and_then(|v| v.as_i64()).unwrap_or(0)
            ).await.map_err(|e| format!("Failed to read response: {}", e))?
        } else {
            (Vec::new(), Vec::new(), Vec::new())
        };

        // Push a JSON object into the array
        items.push(json!({
            "commenter": commenter,
            "date": date,
            "comment": body_html,
            "replies_count": replies_count,
            "created_by": &replies.0,
            "replies": &replies.1,
            "created_date": &replies.2
        }));

        comment_count += 1; // Comment itself
        comment_count += replies_count; // Replies to the comment
    }
    let _ = database.update_ticket_comment_count(ticket_id, comment_count as i16);

    // Convert Vec<Value> -> JSON string
    let output_json = serde_json::to_string(&items)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    Ok(output_json)
}

// rustdoc 
/// Function fetches and formats ticket replies to comments from TDX to display in Tickex
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `feed_id` - the ID to an individual comment
/// ### Returns 
/// * Three vectors (where each index contains the following)
///     - `created_by` person who posted the reply.
///     - `replies_body`  the contents of the reply.
///     - `created_date` the date the reply was made.
/// ### Example 
/// called by [`fetch_tdx_ticket_feed`]
/// ``` no_run
///   let replies: (Vec<String>, Vec<String>, Vec<String>) = if replies_count > 0 {
///     fetch_tdx_feed_replies(
///         database, req, entry.get("ID").and_then(|v| v.as_i64()).unwrap_or(0)
///     ).await.map_err(|e| format!("Failed to read response: {}", e))?
///    } else {
///      (Vec::new(), Vec::new(), Vec::new())
///    };
/// 
/// ```

async fn fetch_tdx_feed_replies(database: &mut Database, req: &API, feed_id: i64) -> Result<(Vec<String>, Vec<String>, Vec<String>), String> {
    // Construct the API URL to fetch feed replies
    let url = format!(
        "https://uwyo.teamdynamix.com/TDWebApi/api/feed/{}",
        feed_id
    );

    // Get the TDX API token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API token while fetching ticket feed: {}", e)),
    };

    // Make the request to TDX API
    let mut resp = match req
        .build()
        .method("GET")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Accept", "application/json")
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch ticket feed from TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "GET", &url, None).await?;
    }

    // Parse the response body
    let replies_json: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Failed to parse ticket replies JSON: {}", e))?;
    let replies_array = replies_json.get("Replies")
        .and_then(|v| v.as_array())
        .map_or(&[][..], |v| v);

    let created_by: Vec<String> = replies_array.iter()
        .map(|reply| {
            reply.get("CreatedFullName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        }).collect();
    let replies_body: Vec<String> = replies_array.iter()
        .map(|reply| {
            reply.get("Body")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        }).collect();
    let created_date: Vec<String> = replies_array.iter()
        .map(|reply| {
            reply.get("CreatedDate")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        }).collect();

    Ok((created_by, replies_body, created_date))
}

// rustdoc
/// Function marks ticket as false by assigning parent id to the global false id.
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `body_json` - provides ticket information stored as JSON. 
/// ### Returns 
/// * Upon success - ()
/// * Upon error - String containing error message.
/// ### Example 
///call in [`handle_connection`]
/// ``` no_run 
///  let _ = match toggle_mark_ticket_false(&mut database, &tdx_client, body_json).await {
///     Ok(v) => v,
///     Err(e) => {
///           error!("Failed to mark Ticket as false: {}", e);   
///           return Response::new()
///                 .status(STATUS_500)
///                 .send_contents("[]".into())
///                 .build();
///                 }
///             };
/// ```
async fn toggle_mark_ticket_false(database: &mut Database, req: &API, mut body_json: Value) -> Result<(), String> {
    let id = body_json["ID"].as_i64().unwrap_or(-1) as i32;
    info!("[Data] - Marking Ticket as False/True (Ticket ID: {})", id);

    let parent_id = body_json["ParentID"].as_i64().unwrap_or(-1) as i32;
    let new_parent_id = match parent_id {
        0 => 22873142,
        22873142 => 22873186,
        22873186 => 22873142,
        invalid => return Err(format!("Invalid ParentID passed into toggle_mark_ticket_false: {}", invalid)),
    };
    body_json["ParentID"] = json!(new_parent_id);

    let url = format!("https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/{}/children", new_parent_id);

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // Make the request
    let mut resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .body([id].into())
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to update Ticket in TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "POST", &url, Some(body_json)).await?;
    }

    if !resp.status.is_success() {
        return Err(format!("TDX API error: {}", resp.status));
    }

    // Update DB with new ParentID
    let _ = match database.update_ticket_parent_id(id, new_parent_id) {
        Ok(v) => v,
        Err(e) => {
            return Err(format!("Failed to update DB Records for updated Ticket ParentID: {}", e));
        }
    };

    info!("[Data] - Successfully updated ticket parent state (Ticket ID: {}, ParentID: {})", id, new_parent_id);

    Ok(())
}


// rustdoc 
/// Function marks all ticket notifications as viewed. 
/// ### Parameters 
///  * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// ### Returns
/// * Upon success - The log provides the number of dismissed tickets. 
/// * Upon failure - Result Err is returned as a String and the log provides an error message.
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_run
///  let _ = match dismiss_all_tickets(&mut database).await {
///        Ok(v) => v,
///        Err(e) => {
///           error!("Failed to dismiss all tickets: {}", e);
///        }
///     };
/// ```
async fn dismiss_all_tickets(database: &mut Database) -> Result<(), String> {
    info!("[Data] - Dismissing all tickets notifications");

    match database.mark_all_tickets_as_viewed() {
        Ok(count) => {
            info!("[Data] - Successfully dismissed {} ticket notifications", count);
            Ok(())
        }
        Err(e) => {
            error!("[Data] - Failed to mark all tickets as viewed: {}", e);
            Err(format!("Failed to mark all tickets as viewed: {}", e))
        }
    }
}

//rustdoc 
/// Function to create a new TDX ticket. 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `body_json` - provides ticket operation type information stored as JSON. 
/// * `username`- current user as a String.
/// ### Returns 
/// * Upon success - ()
/// * Upon failure - Returns Error with String description of the associating error. 
/// ### Example 
///call in [`handle_connection`]
/// ``` no_run
/// let _ = create_tdx_ticket(&mut database, &tdx_client, body_json, req.get_current_username()).await,
/// 
/// ```

async fn create_tdx_ticket(database: &mut Database, req: &API, mut body_json: Value, username: String) -> Result<(), String> {
    info!("[Data] - Sending Create Ticket Request to TDX");
    
    let url = "https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/";

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // Load ticket template from backend
    let template_contents = match std::fs::read_to_string(TICKT_JSON) {
        Ok(contents) => contents,
        Err(e) => return Err(format!("Failed to read ticket template: {}", e)),
    };

    let mut ticket_json: Value = match serde_json::from_str(&template_contents) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to parse ticket template JSON: {}", e)),
    };

    // Remove "_OperationType" field, it's purpose is for Bronson only, not for TDX
    if let Value::Object(body) = &mut body_json {
        body.remove("_OperationType");
    }

    // Aggregate incoming ticket data from front end into template
    if let (Value::Object(template), Value::Object(body)) = (&mut ticket_json, &body_json) {
        for (key, value) in body {
            template.insert(key.to_string(), value.clone());
        }
    }

    // Make RequestorUid the current signed in user & add it to json
    let tdx_uid = get_tdx_user(database, req, &username).await?;
    ticket_json["RequestorUid"] = tdx_uid["UID"].clone();
    
    // Send ticket content and receive the new ticket JSON as a verification response
    let mut new_ticket_resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .body(ticket_json.clone())
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to create Ticket in TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if !new_ticket_resp.status.is_success() && new_ticket_resp.status == reqwest::StatusCode::UNAUTHORIZED {
        new_ticket_resp = retry_tdx_token(database, req, "POST", &url, Some(ticket_json.clone())).await?;
    }

    if !new_ticket_resp.status.is_success() {
        return Err(format!("TDX API error: {}", new_ticket_resp.status));
    }

    // Convert New Ticket Response into JSON
    let ticket_json: serde_json::Value = serde_json::from_str(&new_ticket_resp.body)
        .map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, new_ticket_resp.body))?;
    
    info!("[Data] - Create Ticket Request was Successful (New Ticket ID: {})", ticket_json["ID"]);

    // TODO:
    // - Post the comment with new function call saying who performed what ticket actions (requires shibboleth to know who made the changes)

    Ok(())
}

//rustdoc 
/// Function to edit an existing TDX ticket. 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `body_json` - provides ticket operation type information stored as JSON. 

/// ### Returns 
/// * Upon success - ()
/// * Upon failure - Returns Error with String description of the associating error. 
/// ### Example
/// call in [`handle_connection`] 
/// ``` no_run
/// let _ = edit_tdx_ticket(&mut database, &tdx_client, body_json) 
/// 
/// ```


async fn edit_tdx_ticket(database: &mut Database, req: &API, body_json: Value) -> Result<(), String> {
    let id = body_json["ID"].as_i64().unwrap_or(-1) as i32;
    info!("[Data] - Sending Edit Ticket Request to TDX (Ticket ID: {})", id);
    
    let url = format!("https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/{}", id);

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // Query TDX for the ticket we want to edit
    let mut ticket_resp = match req
        .build()
        .method("GET")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch Ticket from TDX during update: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if !ticket_resp.status.is_success() && ticket_resp.status == reqwest::StatusCode::UNAUTHORIZED {
        ticket_resp = retry_tdx_token(database, req, "GET", &url, None).await?;
    }

    if !ticket_resp.status.is_success() {
        return Err(format!("TDX API error: {}", ticket_resp.status));
    }

    // Apply Ticket Edits
    let mut revised_ticket: Value = serde_json::from_str(&ticket_resp.body)
        .expect("TDX returned invalid JSON");

    if let Some(status) = body_json.get("StatusName").and_then(|v| v.as_str()) {
        let status_id = match fetch_status_id(database, &req, status).await {
            Ok(v) => v,
            Err(e) => return Err(format!("Failed to fetch StatusID from TDX: {}", e))
        };
        revised_ticket["StatusID"] = status_id.into();
    }
    if let Some(title) = body_json.get("Title").and_then(|v| v.as_str()) {
        revised_ticket["Title"] = Value::String(title.trim().to_string());
    }
    if let Some(uid) = body_json.get("ResponsibleUid").and_then(|v| v.as_str()) {
        revised_ticket["ResponsibleUid"] = Value::String(uid.into());
    }

    // Send updated ticket content and receive the new ticket JSON as a verification response
    let mut new_ticket_resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .body(revised_ticket.clone())
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to update Ticket in TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if !new_ticket_resp.status.is_success() && new_ticket_resp.status == reqwest::StatusCode::UNAUTHORIZED {
        new_ticket_resp = retry_tdx_token(database, req, "POST", &url, Some(revised_ticket)).await?;
    }

    if !new_ticket_resp.status.is_success() {
        return Err(format!("TDX API error: {}", new_ticket_resp.status));
    }

    // Convert New Ticket Response into JSON
    let tickets_json: serde_json::Value = serde_json::from_str(&new_ticket_resp.body)
        .map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, new_ticket_resp.body))?;

    // Update Ticket in DB
    match serialize_ticket(database, tickets_json) {
        Ok(ticket) => {
            if let Err(e) = database.update_ticket(&ticket) {
                error!("Failed to insert/update ticket {}: {}", ticket.ticket_id, e);
            }
        }
        Err(e) => error!("Failed to process ticket: {}", e)
    }

    // TODO:
    // - Post the comment with new function call saying who performed what ticket actions (requires shibboleth to know who made the changes)

    info!("[Data] - Edit Ticket Request was Successful (Ticket ID: {})", id);
    Ok(())
}

// rustdoc
/// Function to post a comment to an existing TDX ticket. 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// * `body_json` - provides request body information stored as JSON. 
/// ### Returns 
/// * Upon success - ()
/// * Upon failure - Returns Error with String description of the associating error. 
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_rust 
///   let _ = match post_comment(&mut database, &tdx_client, body_json).await {
///       Ok(v) => v,
///       Err(e) => {
///           error!("Failed to post comment: {}", e);
///       }
///     };
/// ```

async fn post_comment(database: &mut Database, req: &API, body_json: Value) -> Result<(), String> {
    let id = body_json["ID"].as_i64().unwrap_or(-1) as i32;
    info!("[Data] - Sending Commenting Request to TDX (Ticket ID: {})", id);
    
    let url = format!("https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/{}/feed", id);
    
    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // Remove ticket ID, which is not a valid field for the body
    let mut comment = body_json.clone();
    if let Some(obj) = comment.as_object_mut() {
        obj.remove("ID");
    }

    // Add RichHtml Tag
    if let Some(obj) = comment.as_object_mut() {
        obj.insert("IsRichHtml".to_string(), Value::Bool(true));
    }

    // Query TDX for the ticket we want to edit
    let mut ticket_resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .body(comment.clone())
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch Ticket from TDX during update: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if !ticket_resp.status.is_success() && ticket_resp.status == reqwest::StatusCode::UNAUTHORIZED {
        ticket_resp = retry_tdx_token(database, req, "GET", &url, Some(comment)).await?;
    }

    if !ticket_resp.status.is_success() {
        return Err(format!("TDX API error: {}", ticket_resp.status));
    }

    info!("[Data] - Commenting Request was Successful (Ticket ID: {})", id);
    Ok(())
}

// rustdoc 
/// Function grabs the status id to provide context when creating, and editing ticket statuses. 
/// ### Parameters 
///  * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
///  * `req` - [`API`] (struct) provides information to the function of the request that was made.
///  * `status_name` - String containing the name of the status for which the id is needed. 
/// ### Returns 
/// * Upon Success - Returns the status id as an i32. 
/// * Upon  Error - Returns Error with String description of the associating error. 
/// ### Examples 
/// call in [`edit_tdx_ticket`]
/// ``` no_run
///
///     let status_id = match fetch_status_id(database, &req, status).await {
///         Ok(v) => v,
///         Err(e) => return Err(format!("Failed to fetch StatusID from TDX: {}", e))
///     };
/// ``` 
async fn fetch_status_id(database: &mut Database, req: &API, status_name: &str) -> Result<i32, String> {
    let url = "https://uwyo.teamdynamix.com/TDWebApi/api/216/tickets/statuses/search";

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e))
    };

    // Define search
    let search_body = serde_json::json!({
        "IsActive": true
    });

    // Query TDX for status IDs
    let mut resp = match req
        .build()
        .method("POST")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .body(search_body.clone().into())
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch StatusIDs from TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "POST", &url, Some(search_body)).await?;
    }
    
    if !resp.status.is_success() {
        return Err(format!("TDX API error: {}", resp.status));
    }

    // Find matching status name
    let statuses: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Failed to parse TDX status response: {}", e))?;

    if let Some(statuses) = statuses.as_array() {
        for status in statuses {
            if status["Name"].as_str() == Some(status_name) {
                if let Some(id) = status["ID"].as_i64() {
                    return Ok(id as i32);
                }
            }
        }
    }

    Err(format!("Could not find StatusID for status '{}'", status_name))
}

// rustdoc 
/// Function to grab user from TDX including UID and Display Name. 
/// ### Parameters 
///  * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
///  * `req` - [`API`] (struct) provides information to the function of the request that was made.
///  * `username` - string reference with the username logged into Bronson.
/// ### Returns 
/// * Upon Success - A Value with a JSON object containing the fetched UID and the full name associated with the ID. 
/// * Upon Failure - Returns Error with String description of the associating error. 
/// ### Example
/// call in [`handle_connection`]
/// ``` no_run
/// let username = req.get_current_username();
/// let user = match get_tdx_user(&mut database, &tdx_client, &username.to_string()).await {
///     Ok(u) => u,
///     Err(_) => { ... }
///    };
/// 
/// ```
/// 
async fn get_tdx_user(database: &mut Database, req: &API, username: &str) -> Result<Value, String> {
    let url = format!("https://uwyo.teamdynamix.com/TDWebApi/api/people/getuid/{}{}", username, "@uwyo.edu");

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e))
    };

    // Query TDX for User ID
    let mut resp = match req
        .build()
        .method("GET")
        .endpoint(&url)
        .header("Authorization", &tdx_token.val)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch User ID from TDX: {}", e))
        };

    // Try fetching a new tdx token and try again if Unauthorized
    if resp.status == reqwest::StatusCode::UNAUTHORIZED {
        resp = retry_tdx_token(database, req, "GET", &url, None).await?;
    }

    // User ID wasn't found, return 0 as the ID (ID NOT FOUND)
    if resp.status == reqwest::StatusCode::NOT_FOUND {
        return Ok(Value::Number(0.into()));
    }

    if !resp.status.is_success() {
        return Err(format!("TDX API error: {}", resp.status));
    }

    // Parse Response
    let user_id: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Failed to parse TDX status response: {}", e))?;

    // Default to blank if there is no user ID
    let mut full_name = String::new();

    if user_id.to_string() != 0.to_string() {
        let second_url = format!("https://uwyo.teamdynamix.com/TDWebApi/api/people/{}", user_id.to_string().trim_matches('"'));
        let mut second_resp = match req
            .build()
            .method("GET")
            .endpoint(&second_url)
            .header("Authorization", &tdx_token.val)
            .header("Content-Type", "application/json")
            .timeout(Duration::from_secs(15))
            .send()
            .await {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to fetch User Information from TDX: {}", e)),
            };

            // Try fetching a new TDX token and try again if Unauthorized
        if !second_resp.status.is_success() && second_resp.status == reqwest::StatusCode::UNAUTHORIZED {
            second_resp = retry_tdx_token(database, req, "GET", &second_url, None).await?;
        }

        if !second_resp.status.is_success() {
            return Err(format!("TDX API error: {}", second_resp.status));
        }

        let user_info: Value = serde_json::from_str(&second_resp.body)
            .map_err(|e| format!("Failed to parse TDX user information: {}", e))?;

        full_name = user_info["FullName"]
            .as_str()
            .unwrap_or("")
            .to_string();

    }

    // Return both values
    Ok(json!({"UID": user_id, "FullName": full_name}))
}

/*
 $$$$$$\                      $$\             $$\     $$\                     
$$  __$$\                     $$ |            $$ |    \__|                    
$$ /  $$ |$$$$$$$\   $$$$$$\  $$ |$$\   $$\ $$$$$$\   $$\  $$$$$$$\  $$$$$$$\ 
$$$$$$$$ |$$  __$$\  \____$$\ $$ |$$ |  $$ |\_$$  _|  $$ |$$  _____|$$  _____|
$$  __$$ |$$ |  $$ | $$$$$$$ |$$ |$$ |  $$ |  $$ |    $$ |$$ /      \$$$$$$\  
$$ |  $$ |$$ |  $$ |$$  __$$ |$$ |$$ |  $$ |  $$ |$$\ $$ |$$ |       \____$$\ 
$$ |  $$ |$$ |  $$ |\$$$$$$$ |$$ |\$$$$$$$ |  \$$$$  |$$ |\$$$$$$$\ $$$$$$$  |
\__|  \__|\__|  \__| \_______|\__| \____$$ |   \____/ \__| \_______|\_______/ 
                                  $$\   $$ |                                  
                                  \$$$$$$  |                                  
                                   \______/                                   
*/
// rustdoc 
/// Function grabs projects from TDX and stores them in the database. 
/// ### Parameters 
/// * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
/// * `req` - [`API`] (struct) provides information to the function of the request that was made.
/// ### Returns 
/// * Upon success - ()
/// * Upon failure - Returns Error with String description of the associating error. 
/// ### Example 
/// call in [`handle_connection`]
/// ```no_run
///  match fetch_projects(&mut database, &tdx_client).await {
///      Ok(()) => (),
///      Err(e) => error!("Failed to populate projects: {}", e),
///     }
/// ```
async fn fetch_projects(database: &mut Database, req: &API) -> Result<(), String> {
    let url = "https://uwyo.teamdynamix.com/TDWebApi/api/3444/projects/search";

    // Grab token from database
    let tdx_token = match database.get_key("tdx_api") {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to get TDX API key from database: {}", e)),
    };

    // If no projects exist, perform a projects fetch from Jan 1st, 2020 to now
    if database.check_if_projects_empty() {
        // Define search
        let search_body = serde_json::json!({
            "ModifiedDateFrom": "2020-01-01T00:00:00Z",
            "TypeID": 42460
        });
        // Make the request
        let resp_raw = req
            .build()
            .method("POST")
            .endpoint(url)
            .header("Authorization", &tdx_token.val)
            .header("Content-Type", "application/json")
            .body(search_body)
            .timeout(Duration::from_secs(120))
            .send()
            .await;
        
        let resp = match resp_raw {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch projects: {}", e))
        };

        if !resp.status.is_success() {
            return Err(format!("TDX API error: {}", resp.status));
        }

        // Parse the response as JSON
        let parsed_projects: serde_json::Value = serde_json::from_str(&resp.body)
            .map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, resp.body))?;
        let projects_json: Vec<serde_json::Value> = match parsed_projects.as_array() {
            Some(items) => items.clone(),
            None => parsed_projects
                .get("Items")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .ok_or_else(|| format!("Expected project array in response body: {}", resp.body))?,
        };

        // Map to DB_Project and insert
        for project_val in &projects_json {
            let project = DB_Project {
                project_id: project_val["ID"].as_i64().unwrap_or(0) as i32,
                created_date: project_val["CreatedDate"].as_str().unwrap_or("").to_string(),
                modified_date: project_val["ModifiedDate"].as_str().unwrap_or("").to_string(),
                name: project_val["Name"].as_str().unwrap_or("").to_string(),
                description: project_val["Description"].as_str().unwrap_or("").to_string(),
                is_active: project_val["IsActive"].as_bool().unwrap_or(true),
                type_id: project_val["TypeID"].as_i64().unwrap_or(0) as i32,
                percent_complete: project_val["PercentComplete"].as_i64().unwrap_or(-1) as i16,
                status_name: project_val["StatusName"].as_str().unwrap_or("").to_string(),
                status_comments: project_val["StatusComments"].as_str().unwrap_or("").to_string(),
                start_date: project_val["StartDate"].as_str().unwrap_or("").to_string(),
                end_date: project_val["EndDate"].as_str().unwrap_or("").to_string(),
                health: project_val["HealthDescription"].as_str().unwrap_or("").to_string(),

                is_hidden: project_val["is_hidden"].as_bool().unwrap_or(false),
            };

            // Insert or update
            if let Err(e) = database.update_project(&project) {
                warn!("Failed to insert project {}: {}", project.project_id, e);
            }
        }

        // Double check projects exist in database, but this should not be necessary
        if database.check_if_projects_empty() {
            return Err("Failed to insert projects into database".to_string());
        }

        info!("[Data] - Pulled all TDX projects from Jan 1st, 2020");
    } else { // Projects table not empty, only update more recent projects
        // Look in database for most recent Project and look at its date
        let _ = match database.get_latest_project() {
            Ok(p) => p,
            Err(e) => return Err(format!("Failed to get latest project: {}", e)),
        };

        // Define search
        let search_body = serde_json::json!({
            "MaxResults": 10000,
            "TypeID": 42460
        });

        // Make the request to TDX API
        let mut resp = match req
            .build()
            .method("POST")
            .endpoint(url)
            .header("Authorization", &tdx_token.val)
            .header("Content-Type", "application/json")
            .body(search_body.clone())
            .send()
            .await {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to fetch project from TDX: {}", e))
            };

        // Try fetching a new tdx token and try again if Unauthorized
        if resp.status == reqwest::StatusCode::UNAUTHORIZED {
            warn!("Project data fetch failure was due to an unauthorized response, fetching new token and trying again...");

            // Grab new TDX Token
            let _ = fetch_tdx_token(database, req).await;

            // Get the TDX API token from database
            let tdx_token = match database.get_key("tdx_api") {
                Ok(t) => t,
                Err(e) => return Err(format!("Failed to get TDX API token while fetching project data: {}", e)),
            };

            // Make the request to TDX API
            let retry_resp_raw = req
                .build()
                .method("POST")
                .endpoint(url)
                .header("Authorization", &tdx_token.val)
                .header("Content-Type", "application/json")
                .body(search_body)
                .send()
                .await;
                
            let retry_resp = match retry_resp_raw {
                Ok(r) => r,
                Err(e) => return Err(format!("Failed to fetch project from TDX: {}", e))
            };

            if !retry_resp.status.is_success() {
                return Err(format!("TDX API error: {} - {}", retry_resp.status, retry_resp.status.canonical_reason().unwrap_or("Unknown")));
            } else {
                warn!("Successfully recovered new TDX Token & fetched new project data");
                resp = retry_resp;
            }
        }

        // Get the response body as text and convert to JSON
        let parsed_projects: serde_json::Value = serde_json::from_str(&resp.body)
            .map_err(|e| format!("Failed to parse JSON: {} | Body: {}", e, resp.body))?;
        let projects_json: Vec<serde_json::Value> = match parsed_projects.as_array() {
            Some(items) => items.clone(),
            None => parsed_projects
                .get("Items")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .ok_or_else(|| format!("Expected project array in response body: {}", resp.body))?,
        };

        // Map to DB_Project and update
        for project_val in &projects_json {
            // If it exists, get original project from database
            let id = project_val["ID"].as_i64().unwrap_or(0) as i32;

            let project = DB_Project {
                project_id: id,
                created_date: project_val["CreatedDate"].as_str().unwrap_or("").to_string(),
                modified_date: project_val["ModifiedDate"].as_str().unwrap_or("").to_string(),
                name: project_val["Name"].as_str().unwrap_or("").to_string(),
                description: project_val["Description"].as_str().unwrap_or("").to_string(),
                is_active: project_val["IsActive"].as_bool().unwrap_or(true),
                type_id: project_val["TypeID"].as_i64().unwrap_or(0) as i32,
                percent_complete: project_val["PercentComplete"].as_i64().unwrap_or(-1) as i16,
                status_name: project_val["StatusName"].as_str().unwrap_or("").to_string(),
                status_comments: project_val["StatusComments"].as_str().unwrap_or("").to_string(),
                start_date: project_val["StartDate"].as_str().unwrap_or("").to_string(),
                end_date: project_val["EndDate"].as_str().unwrap_or("").to_string(),
                health: project_val["HealthDescription"].as_str().unwrap_or("").to_string(),
                
                is_hidden: project_val["is_hidden"].as_bool().unwrap_or(false),
            };

            // Insert or update
            if let Err(e) = database.update_project(&project) {
                error!("Failed to insert project {}: {}", project.project_id, e);
            }
        }
    }

    return Ok(());
}

//rustdoc 
/// Function creates a pdf with information concurrent to that currently displayed by the analytics page. 
/// 
/// Note: The PDF engine used creates the file from which the contents are grabbed and then the file is deleted. So only the user has local copy of the export. 
/// Nothing is stored in the Bronson Database.
/// ### Parameters 
///  * `database` - function requires [`Database`] (struct) to provide context of the Bronson database.
///  * `time_period` - the current time period given by radio button selection made on the front end. 
///  * `optional_data` - information grabbed from the JSON body. 
/// ### Returns 
/// * Upon Success - String containing the filename created. (to be deleted) 
/// * Upon failure - Returns Error with String description of the associating error. 
/// ### Example 
/// call in [`handle_connection`]
/// ``` no_run
///   let file_name = match export_to_pdf(&mut database, time_period, optional_data).await {
///          Ok(f) => f,
///          Err(e) => {
///           error!("Failed to export PDF: {}", e);
///        }
///     };
/// ```
async fn export_to_pdf(database: &mut Database, time_period: i16, optional_data: serde_json::Value) -> Result<String, String> {
    // Helper: get date range based on time_period
    let get_date_range = |period: i16| -> (DateTime<Utc>, DateTime<Utc>) {
        let now = Utc::now();
        
        // Handle custom date range separately
        if period == 5 {
            if let Some(custom_start) = optional_data.get("custom_start_date").and_then(|v| v.as_str()) {
                if let Ok(date) = chrono::NaiveDate::parse_from_str(custom_start, "%Y-%m-%d") {
                    let start_dt = DateTime::<Utc>::from_naive_utc_and_offset(
                        date.and_hms_opt(0, 0, 0).unwrap(),
                        Utc
                    );
                    // Parse custom end date
                    if let Some(custom_end) = optional_data.get("custom_end_date").and_then(|v| v.as_str()) {
                        if let Ok(end_date) = chrono::NaiveDate::parse_from_str(custom_end, "%Y-%m-%d") {
                            let end_dt = DateTime::<Utc>::from_naive_utc_and_offset(
                                end_date.and_hms_opt(23, 59, 59).unwrap(),
                                Utc
                            );
                            return (start_dt, end_dt);
                        }
                    }
                    // If end date fails, use now as end
                    return (start_dt, now);
                }
            }
            // Fallback to 7 days if custom dates are not provided or invalid
            return (now - TimeDelta::days(7), now);
        }
        
        let start = match period {
            0 => now - TimeDelta::days(7),
            1 => now - TimeDelta::days(30),
            2 => now - TimeDelta::days(90),
            3 => now - TimeDelta::days(365),
            4 => {
                // all-time: use Jan 1, 2020
                DateTime::parse_from_rfc3339("2020-01-01T00:00:00+00:00")
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| now - TimeDelta::days(365 * 100))
            }
            _ => now - TimeDelta::days(7), // default to 7 days
        };
        return (start, now);
    };

    // Helper: check if date string is within range
    let is_date_in_range = |date_str: &str, start: DateTime<Utc>, end: DateTime<Utc>| -> bool {
        if let Ok(date) = DateTime::parse_from_rfc3339(date_str) {
            let date_utc = date.with_timezone(&Utc);
            return date_utc >= start && date_utc <= end;
        } else {
            return false;
        }
    };

    // Helper: extract building code from ticket title
    let extract_building = |title: &str| -> Option<String> {
        let re = Regex::new(r"^\s*([A-Za-z]{2,4}(?:\s+[A-Za-z]{2,4})?)\s+(\d{1,4})").unwrap();
        re.captures(title).map(|caps| {
            let mut building = caps[1].to_uppercase().trim().to_string();
            
            // Normalize building codes (old_code -> new_code)
            let normalizations: std::collections::HashMap<&str, &str> = [
                ("ST", "STEM"), ("ENZI", "STEM"), ("ENZI STEM", "STEM"),
                ("ENG", "EN"), ("ESB", "ES"), ("SIB", "SI"), ("COE", "CL"), 
                ("CIC", "CI"), ("BCPA", "PA"), ("BE", "BH"),
            ].iter().cloned().collect();
            
            if let Some(&normalized) = normalizations.get(building.as_str()) {
                building = normalized.to_string();
            }
            return building;
        })
    };

    // Helper: extract hour from date string
    let extract_hour = |date_str: &str| -> Option<i32> {
        if let Ok(date) = DateTime::parse_from_rfc3339(date_str) {
            let date_local = date.with_timezone(&Local);
            let hour = date_local.format("%H").to_string().parse::<i32>().ok()?;
            return Some(hour);
        } else {
            return None;
        }
    };

    // Create new Tera and reset delims that won't conflict with LaTeX syntax
    let mut tera = Tera::default();
    tera.set_delimiters(Delimiters {
        block_start: "[%".into(),
        block_end: "%]".into(),
        variable_start: "[[".into(),
        variable_end: "]]".into(),
        comment_start: "[#".into(),
        comment_end: "#]".into(),
    }).map_err(|e| format!("Failed to set Tera Delimiters: {}", e))?;

    // Gather the data for the report
    let (start_date, end_date) = get_date_range(time_period);
    let all_tickets = database.get_all_tickets().map_err(|e| format!("Failed to fetch tickets: {}", e))?;

    let mut tickets_created = 0;
    let mut tickets_closed = 0;
    let mut current_open_tickets = 0;
    let mut false_tickets = 0;
    let mut tickets_from_room_checks = 0;
    let mut wycast_event_tickets = 0;
    let mut pc_related_tickets = 0;
    let mut building_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut hour_counts: Vec<i32> = vec![0; 14]; // 7am-7pm (13 slots) + "Other"

    // Process tickets
    for ticket in &all_tickets {
        // Count open tickets (all-time, not time period-specific)
        let is_open = matches!(
            ticket.status_name.as_str(),
            "New" | "In Process" | "On Hold"
        );
        if is_open {
            current_open_tickets += 1;
        }

        // These represent tickets created within the time period and are currently closed/false tickets
        if is_date_in_range(&ticket.created_date, start_date, end_date) {
            tickets_created += 1;

            // Closed status
            let is_closed = matches!(
                ticket.status_name.as_str(),
                "Closed" | "Completed" | "Resolved" | "Cancelled" | "Closed using Remote Support Tool"
            );
            if is_closed {
                tickets_closed += 1;
            }
            // Room check tickets
            if Regex::new(r"(?i)room check$").unwrap().is_match(&ticket.title) {
                tickets_from_room_checks += 1;
            }
            // WyoCast/Event tickets
            if Regex::new(r"(?i)\b(wyocast|event|zoom|tutorial)\b").unwrap().is_match(&ticket.title) {
                wycast_event_tickets += 1;
            }
            // PC-related tickets
            if Regex::new(r"(?i)\b(pc|computer|laptop|lptp)\b").unwrap().is_match(&ticket.title) {
                pc_related_tickets += 1;
            }
            // False tickets
            if ticket.parent_id == 22873142 {
                false_tickets += 1;
            }

            let title = ticket.title.trim();
            if let Some(building) = extract_building(title) {
                *building_counts.entry(building).or_insert(0) += 1;
            }

            if let Some(hour) = extract_hour(&ticket.created_date) {
                if hour >= 7 && hour <= 19 {
                    hour_counts[(hour - 7) as usize] += 1;
                } else {
                    hour_counts[13] += 1; // "Other"
                }
            }
        }
    }

    // Get leaderboard data for room checks performed
    let room_checks_performed = match database.get_data("lsm_leaderboard") {
        Ok(leaderboard_data) => {
            // Parse JSON and sum up room checks for the appropriate time period
            if let Ok(leaderboard_json) = serde_json::from_str::<Value>(&leaderboard_data.val) {
                let period_key = match time_period {
                    0 => "7days",
                    1 => "30days",
                    2 => "90days",
                    3 | 4 => "365days",
                    5 => {
                        let custom_start = optional_data
                            .get("custom_start_date")
                            .and_then(|v| v.as_str())
                            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

                        let custom_end = optional_data
                            .get("custom_end_date")
                            .and_then(|v| v.as_str())
                            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

                        // Round custom dates to closest available time period
                        match (custom_start, custom_end) {
                            (Some(start), Some(end)) => {
                                let days = (end - start).num_days();

                                let frames = [7, 30, 90, 365];
                                let closest = frames
                                    .iter()
                                    .min_by_key(|&&frame| (frame - days).abs())
                                    .copied()
                                    .unwrap_or(7);

                                match closest {
                                    7 => "7days",
                                    30 => "30days",
                                    90 => "90days",
                                    365 => "365days",
                                    _ => "7days",
                                }
                            }
                            _ => "7days",
                        }
                    },
                    _ => "7days",
                };
                
                if let Some(period_data) = leaderboard_json.get(period_key).and_then(|v| v.as_array()) {
                    period_data.iter()
                        .filter_map(|item| item.get("Count").and_then(|c| c.as_i64()))
                        .sum::<i64>() as i32
                } else {
                    0
                }
            } else {
                0
            }
        }
        Err(_) => 0,
    };

    // Sort buildings by count and get top 10
    let mut sorted_buildings: Vec<_> = building_counts.into_iter().collect();
    sorted_buildings.sort_by(|a, b| b.1.cmp(&a.1));
    let top_10_buildings: Vec<String> = sorted_buildings.iter().take(10).map(|(k, _)| k.clone()).collect();
    let top_10_counts: Vec<i32> = sorted_buildings.iter().take(10).map(|(_, v)| *v).collect();

        // Build the latex
    // Helper: escape common LaTeX special characters to avoid compilation errors
    let escape_latex = |s: &str| -> String {
        let mut out = s.replace("\\", "\\textbackslash{}");
        let reps = [
            ("%", "\\%"), ("&", "\\&"), ("$", "\\$"), ("#", "\\#"),
            ("_", "\\_"), ("{", "\\{"), ("}", "\\}"), ("~", "\\textasciitilde{}"),
            ("^", "\\textasciicircum{}"),
        ];
        for (f, t) in reps.iter() {
            out = out.replace(f, t);
        }
        return out;
    };

    // Helper: create a simple section with an itemize list from a JSON array value
    let make_list = |v: &serde_json::Value, title: &str| -> String {
        if !v.is_array() {
            return String::new();
        }
        let arr = v.as_array().unwrap();
        if arr.is_empty() {
            return String::new();
        }

        let esc_title = "\\huge\n".to_owned() + &escape_latex(title);
        
        let mut s = format!("\\begin{{quote}}\n\\section*{{{}}}\n\\begin{{itemize}}\n\\large", esc_title);
        for item in arr.iter() {
            let item_str = match item.as_str() {
                Some(st) => st.to_string(),
                None => item.to_string(),
            };
            s.push_str(&format!("  \\item {}\n", escape_latex(&item_str)));
        }

        s.push_str("\\end{itemize}\n\\end{quote}\n");
        return s;
    };

    // Convert hour counts to LaTeX coordinates format
    let hour_labels = vec!["7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "Other"];
    let mut building_latex_coords = String::new();
    let mut hour_latex_coords = String::new();

    for (i, building) in top_10_buildings.iter().enumerate() {
        if i > 0 {
            building_latex_coords.push(' ');
        }
        building_latex_coords.push_str(&format!("({},{}) ", building.to_string(), top_10_counts[i]));
    }

    for (i, (label, count)) in hour_labels.iter().zip(hour_counts.iter()).enumerate() {
        if i > 0 {
            hour_latex_coords.push(' ');
        }
        hour_latex_coords.push_str(&format!("({},{}) ", label, count));
    }


    // Build Notes
    let accomplishments_val = optional_data.get("an_accomplishments").unwrap_or(&serde_json::Value::Null);
    let future_notes_val = optional_data.get("an_notesForFuture").unwrap_or(&serde_json::Value::Null);
    let roomcheck_notes_val = optional_data.get("an_ticketAndRoomCheckNotes").unwrap_or(&serde_json::Value::Null);

    let latex_accomplishments = make_list(accomplishments_val, "Accomplishments");
    let mut latex_future_notes = make_list(future_notes_val, "Notes for the Future");
    let latex_roomcheck_tickets_notes = make_list(roomcheck_notes_val, "Notes");

    if latex_future_notes != "" {
        latex_future_notes += r#"
            \newpage
            \maketitle
            \thispagestyle{empty} % Remove page number from page
        "#;
    }

    // Master LaTeX
    let latex_template = r#"
        \documentclass{article}

        % Required LaTeX packages
        \usepackage{pdflscape}
        \usepackage{pgfplots}
        \usepackage{tikz}
        \usepackage{titling}
        \usepackage[T1]{fontenc}
        \usepackage{helvet}
        \renewcommand{\familydefault}{\sfdefault}

        \begin{document}
         \begin{landscape} % Orient the page in landscape mode
 
         \title{\textbf{\huge CTS Analytics: [[ time_frame ]]}}
         \author{} % Leave blank
         \date{} % Leave blank
 
         \Large
         \setlength{\droptitle}{-5.5cm}
 
         \maketitle
         \thispagestyle{empty} % Remove page number from page
 
          \begin{flushleft}
  
  
                % First Page
    
            [[ accomplishments ]] % Accomplishment Notes
            [[ future_notes ]] % Notes for the Future
    
    
                % Second Page

            % Overview Table
            \vspace{-2.25cm}
            \begin{center}
            \begin{tabular}{ c|c|c|c } 
                {\small Tickets Created}                 & {\small Tickets Closed}                 & {\small Current Open Tickets}                 & {\small False Tickets}                \\ 
                {\LARGE \textbf{[[ tickets_created ]]}}  & {\LARGE \textbf{[[ tickets_closed ]]}}  & {\LARGE \textbf{[[ current_open_tickets ]]}}  & {\LARGE \textbf{[[ false_tickets ]]}} \\ 
            \hline
                {\small Room Checks Performed}                 & {\small Tickets from Room Checks}                 & {\small WyoCast / Event Tickets}              & {\small PC Related Tickets}                \\ 
                {\LARGE \textbf{[[ room_checks_performed ]]}}  & {\LARGE \textbf{[[ tickets_from_room_checks ]]}}  & {\Large \textbf{[[ wycast_event_tickets ]]}}  & {\Large \textbf{[[ pc_related_tickets ]]}} \\ 
            \end{tabular}
            \end{center}
    
            % Bar Graphs
            \begin{figure}[htbp]
                \begin{minipage}{0.48\textwidth}
                    \centering
                    \pgfplotsset{width=8.5cm,compat=1.18}
                    \begin{tikzpicture}[scale=1.0]
                    \begin{axis}[
                        title={Ticket Count by Building (Top 10)},
                        ybar,
                        enlargelimits=0.15,
                        legend style={at={(0.5,-0.2)},
                        anchor=north,legend columns=-1},
                        symbolic x coords={[[ building_x_coords ]]},
                        xtick={[[ building_x_coords ]]},
                        nodes near coords,
                        nodes near coords align={vertical},
                        x tick label style={rotate=90,anchor=east},
                        x post scale=1.3,
                        y post scale=0.65,
                    ]
                    \addplot[fill=yellow!50!white, draw=yellow!80!black] coordinates {[[ building_coords ]]};
                    \end{axis}
                    \end{tikzpicture}
                \end{minipage}
                \hspace{0.33\textwidth}
                \begin{minipage}{0.48\textwidth}
                    \centering
                    \pgfplotsset{width=8.5cm,compat=1.18}
                    \begin{tikzpicture}[scale=1.0]
                    \begin{axis}[
                        title={Ticket Count by Hour},
                        ybar,
                        enlargelimits=0.15,
                        legend style={at={(0.5,-0.2)},
                        anchor=north,legend columns=-1},
                        symbolic x coords={7am,8am,9am,10am,11am,12pm,1pm,2pm,3pm,4pm,5pm,6pm,7pm,Other},
                        xtick={7am,8am,9am,10am,11am,12pm,1pm,2pm,3pm,4pm,5pm,6pm,7pm,Other},
                        nodes near coords,
                        nodes near coords align={vertical},
                        x tick label style={rotate=90,anchor=east},
                        x post scale=1.3,
                        y post scale=0.65,
                    ]
                    \addplot[fill=yellow!50!white, draw=yellow!80!black] coordinates {[[ hour_coords ]]};
                    \end{axis}
                    \end{tikzpicture}
                \end{minipage}
            \end{figure}

            \vspace{-1.0cm}
            [[ notes ]] % Ticket & Room Check Notes
  
  
          \end{flushleft}
         \end{landscape}
        \end{document}
    "#;

    // Generate file name using timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("report_{}", timestamp);

    match tera.add_raw_template(&format!("{file_name}.tex"), latex_template) {
        Ok(r) => r,
        Err(e) => return Err(format!("Failed to add LaTeX template: {}", e))
    }

    // Sub in values
    let time_frame_label = match time_period {
        0 => "Last 7 Days".to_string(),
        1 => "Last 30 Days".to_string(),
        2 => "Last 90 Days".to_string(),
        3 => "Last 365 Days".to_string(),
        4 => "All Time".to_string(),
        5 => {
            // Custom date range: format the dates nicely
            if let (Some(start_str), Some(end_str)) = (
                optional_data.get("custom_start_date").and_then(|v| v.as_str()),
                optional_data.get("custom_end_date").and_then(|v| v.as_str())
            ) {
                if let (Ok(start_date), Ok(end_date)) = (
                    chrono::NaiveDate::parse_from_str(start_str, "%Y-%m-%d"),
                    chrono::NaiveDate::parse_from_str(end_str, "%Y-%m-%d")
                ) {
                    let start_formatted = start_date.format("%B %d, %Y").to_string();
                    let end_formatted = end_date.format("%B %d, %Y").to_string();
                    format!("{} - {}", start_formatted, end_formatted)
                } else {
                    "Custom Date Range".to_string()
                }
            } else {
                "Custom Date Range".to_string()
            }
        }
        _ => "ERROR".to_string(),
    };

    // Format building x coordinates for LaTeX
    let building_x_coords = top_10_buildings.join(",");

    let mut context = Context::new();
    context.insert("time_frame", &time_frame_label);
    context.insert("accomplishments", &latex_accomplishments);
    context.insert("future_notes", &latex_future_notes);
    context.insert("tickets_created", &tickets_created);
    context.insert("tickets_closed", &tickets_closed);
    context.insert("current_open_tickets", &current_open_tickets);
    context.insert("false_tickets", &false_tickets);
    context.insert("room_checks_performed", &room_checks_performed);
    context.insert("tickets_from_room_checks", &tickets_from_room_checks);
    context.insert("wycast_event_tickets", &wycast_event_tickets);
    context.insert("pc_related_tickets", &pc_related_tickets);
    context.insert("notes", &latex_roomcheck_tickets_notes);
    context.insert("building_coords", &building_latex_coords);
    context.insert("building_x_coords", &building_x_coords);
    context.insert("hour_coords", &hour_latex_coords);


        // Render
    // Register the template
    match tera.add_raw_template(&format!("{file_name}.tex"), latex_template) {
        Ok(_) => (),
        Err(e) => return Err(format!("Failed to add LaTeX template: {}", e)),
    }
    // Render the template
    let rendered_tex = match tera.render(&format!("{file_name}.tex"), &context) {
        Ok(t) => t,
        Err(e) => return Err(format!("Failed to render LaTeX template: {}", e)),
    };

    // Write .tex
    let temp_dir = Path::new(TEMP_DIR);
    let tex_path = temp_dir.join(&format!("{file_name}.tex"));
    match std::fs::write(&tex_path, rendered_tex) {
        Ok(_) => (),
        Err(e) => return Err(format!("Failed to write .tex file: {}", e)),
    }

    // Run pdflatex (silently, unless error) in the temp directory
    let status = match Command::new("pdflatex")
        .current_dir(temp_dir)
        .arg("-interaction=nonstopmode")
        .arg("-halt-on-error")
        .arg(&format!("{file_name}.tex"))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
    {
        Ok(s) => s,
        Err(e) => return Err(format!("Failed to execute pdflatex: {}", e)),
    };

    if !status.success() {
        return Err("pdflatex failed to compile .tex file".to_string());
    }

    info!("[Data] - Analytics PDF successfully generated!");
    
    Ok(file_name)
}

//rustdoc 
/// Function deletes temp files used to generate the export from analytics. 
/// ### Parameters 
/// * `filename` - the String returned from [`export_to_pdf`]
/// ### Returns 
/// * Upon Success - ()
/// * Upon Failure -  Returns Error with String description of the associating error. 
/// ### Example 
/// call to [`handle_connection`]
/// ``` no_run
/// match cleanup_temp_files(file_name).await {
///      Ok(_) => (),
///      Err(e) => error!("Failed to clean up temporary files: {}", e),
///    };
/// ```
async fn cleanup_temp_files(file_name: String) -> Result<(), String> {
    if !dir_exists(TEMP_DIR) {
        return Err(format!("Missing Temp Directory: ./generated_files/temp does not exist"));
    }

    let entries = match std::fs::read_dir(TEMP_DIR) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read temp directory '{}': {}", TEMP_DIR, e))
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => return Err(format!("Failed to access temp directory entry: {}", e))
        };

        let path = entry.path();

        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                if filename.starts_with(&file_name) {
                    if let Err(e) = std::fs::remove_file(&path) {
                        return Err(format!("Failed to delete temporary file '{}': {}", path.display(), e));
                    }
                }
            }
        }
    }

    Ok(())
}

/*
$$\      $$\ $$\ $$\       $$\ 
$$ | $\  $$ |\__|$$ |      \__|
$$ |$$$\ $$ |$$\ $$ |  $$\ $$\ 
$$ $$ $$\$$ |$$ |$$ | $$  |$$ |
$$$$  _$$$$ |$$ |$$$$$$  / $$ |
$$$  / \$$$ |$$ |$$  _$$<  $$ |
$$  /   \$$ |$$ |$$ | \$$\ $$ |
\__/     \__|\__|\__|  \__|\__|
*/

// rustdoc
/// 
/// Function builds out a JSON object with the articles in the wiki directory. 
/// ### Returns 
///  - A JSON object of all the articles (files) in the `WIKI_DIR` and returns them as a stringified json object   
/// as UTF-8 bytes. 
/// - The JSON object maps each article's filename (key) to it's base64-encoded file contents (value).
///  
/// ### Panics 
/// Panics if any article file cannot be read. 
/// ### Example
/// ```no_run
///  let contents = w_build_articles();
///  assert_eq!(contents,
///             "{
///                 file_name1: base64Data1
///                 file_name2: base64Data2
///                 ...
///               }".to_string().into()
///       );
///```

fn w_build_articles() -> Vec<u8> {
    let mut article_names_vec: Vec<String> = Vec::new();
    let mut article_contents_vec: Vec<String> = Vec::new();

    if dir_exists(WIKI_DIR) {
        // Error handling
    }

    let wiki_dirs = get_dir_contents(WIKI_DIR);

    let cut_index = WIKI_DIR.len();
    for (_, &ref item) in wiki_dirs.iter().enumerate() {
        // Open and read the file in as base64 
        let raw_contents: Vec<u8> = std::fs::read(item).expect("Failed to read wiki article file");
        let contents = general_purpose::STANDARD.encode(raw_contents);

        //let contents: String = std::fs::read_to_string(item).expect("Failed to read wiki article file");

        article_names_vec.push((&item[(cut_index + 1)..]).to_string());
        article_contents_vec.push(contents);
    };
    
    // Build JSON
    use serde_json::{Value, Map};
    let mut articles = Map::new();
    for (name, content) in article_names_vec.iter().zip(article_contents_vec.iter()) {
        articles.insert(name.clone(), Value::String(content.clone()));
    }

    let json_return = Value::Object(articles);

    return json_return.to_string().into();

    
}

// rustdoc
/// Function builds a JSON representation of the wiki articles directory as a tree from a depth first search, then returns it as bytes. 
/// ### Returns 
/// - On success returns the tree structure produced by the call to [`build_tree`] as bytes. 
/// - On failure the error is logged and an empty JSON array (`[]`) is returned as bytes.

/// ### Example
/// ``` no_run 
/// tree: {
///         name: "Root",
///         file_path: "./",
///         children: [
///             {
///              name: "example.md",
///               file_path:"./example/path",
///              children: null
///             },
///
///             {
///              name: "example_dir",
///              file_path:"./example/path",
///              children: [
///                 {
///                 name: "nested_file.txt",
///                 file_path:"./example/path/example_dir",
///                 children: null
///                 },
///                 {
///                  name: "double_nested_dir",
///                  file_path:"./example/path/example_dir",
///                  children: [
///                  {
///                     name: "doubled_nested_file", 
///                     file_path:"./example/path/example_dir/double_nested_dir",
///                     children: null}, 
///                   ]
///                 },
///                ]
///              },
///             {
///             name: "empty_dir",
///             file_path:"./example/path", 
///             children: [] 
///             },
///            ]
///       }
///```
/// ### Blacklist 
/// `_wiki_blacklist`, (currently an empty hashset) can be used to "blacklist" specified file extensions by inserting them into the hashset.
/// ### Example 
///```no_run
///  _wiki_blacklist.insert("txt");
///  _wiki_blacklist.insert("xlsx");
///```
/// In the above example files ending with the extension txt, and xlsx would be excluded. 
fn w_tree() -> Vec<u8>  {
    let  _wiki_blacklist = HashSet::new();
    let json_return = match build_tree(WIKI_DIR, _wiki_blacklist) {
       Ok(j)     =>  j,
       Err(m)    => {error!("[Data] - Tree Build FAILED: {}", m); json!([]).to_string() }
     };
    return json_return.to_string().into();
}




/*
$$$$$$$$\                                $$\                     $$\ 
\__$$  __|                               \__|                    $$ |
   $$ | $$$$$$\   $$$$$$\  $$$$$$\$$$$\  $$\ $$$$$$$\   $$$$$$\  $$ |
   $$ |$$  __$$\ $$  __$$\ $$  _$$  _$$\ $$ |$$  __$$\  \____$$\ $$ |
   $$ |$$$$$$$$ |$$ |  \__|$$ / $$ / $$ |$$ |$$ |  $$ | $$$$$$$ |$$ |
   $$ |$$   ____|$$ |      $$ | $$ | $$ |$$ |$$ |  $$ |$$  __$$ |$$ |
   $$ |\$$$$$$$\ $$ |      $$ | $$ | $$ |$$ |$$ |  $$ |\$$$$$$$ |$$ |
   \__| \_______|\__|      \__| \__| \__|\__|\__|  \__| \_______|\__|
*/

async fn store_collegenet_reservations(database: &mut Database, cn_client: &Arc<API>) -> Result<(), String> {
    let reservations_body = match cn_client
        .build()
        .method("GET")
        .endpoint("https://webservices.collegenet.com/r25ws/wrd/uwyo/run/reservations.xml?start_dt=0")
        .timeout(Duration::from_secs(15))
        .return_type::<Reservations>()
        .send()
        .await {
            Ok(rs) => rs,
            Err(m) => { return Err(m.to_string()); }
        }
        .body;
    
    let reservations: Reservations = match serde_xml_rs::from_str(&reservations_body) {
        Ok(rs) => rs,
        Err(m) => { return Err(m.to_string()); }
    };

    for reservation in reservations.reservations {
        match database.update_reservation(&DB_Reservation {
            reservation_id: reservation.reservation_id,
            start_dt: reservation.start_dt,
            end_dt: reservation.end_dt,
            event_name: reservation.event_name,
            event_space_id: match reservation.space {
                Some(ev) => {
                    let mut ret_vec: Vec<Option<i64>> = Vec::new();

                    for e in ev {
                        ret_vec.push(Some(e.space_id));
                    }

                    Some(ret_vec)
                },
                None    => None
            }
        }) {
            Ok(_) => (),
            Err(m) => { return Err(m.to_string()); }
        };
    }

    Ok(())
}


/*
$$$$$$$$\                    $$\               
\__$$  __|                   $$ |              
   $$ | $$$$$$\   $$$$$$$\ $$$$$$\    $$$$$$$\ 
   $$ |$$  __$$\ $$  _____|\_$$  _|  $$  _____|
   $$ |$$$$$$$$ |\$$$$$$\    $$ |    \$$$$$$\  
   $$ |$$   ____| \____$$\   $$ |$$\  \____$$\ 
   $$ |\$$$$$$$\ $$$$$$$  |  \$$$$  |$$$$$$$  |
   \__| \_______|\_______/    \____/ \_______/ 
*/

async fn collegenet_login(cn_client: &Arc<API>) -> Result<LoginSuccess, String> {
    let url = "https://webservices.collegenet.com/r25ws/wrd/uwyo/run/login.xml";
    let text = match cn_client
        .build()
        .method("GET")
        .endpoint(url)
        .timeout(Duration::from_secs(15))
        .return_type::<LoginSuccess>()
        .send()
        .await {
            Ok(t) => t,
            Err(m) => {return Err(m)}
        }
        .body;

    let doc: LoginSuccess = match serde_xml_rs::from_str(&text) {
        Ok(d) => d,
        Err(m) => { return Err(m.to_string()); }
    };

    Ok(doc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pad_zero() {
        assert_eq!(_pad_zero(String::from("123"), 4), String::from("0123"));
        assert_eq!(_pad_zero(String::from("123"), 3), String::from("123"));
        assert_eq!(_pad_zero(String::from("123"), 2), String::from("123"));
    }

    #[test]
    fn test_pad() {
        assert_eq!(pad(String::from("test"), 6), String::from("  test"));
        assert_eq!(pad(String::from("test"), 4), String::from("test"));
        assert_eq!(pad(String::from("test"), 3), String::from("test"));
    }
    

    // Response Tests 
    #[test] 
    fn test_status() {
       assert_eq!(Response::new()
        .status, 
        String::from(STATUS_500)
    );
        assert_eq!(Response::new()
        .status(STATUS_200)
        .status,
        String::from(STATUS_200)
    );

        assert_eq!(Response::new()
        .status("Uh oh")
        .status, 
        String::from("Uh oh")
    );
       
    }
    #[test]
    fn test_headers() {
        assert_eq!(
            Response::new() 
            .headers, 
            HashMap::from([
                (String::from("Content-Type"),String::from("*/*")),
                (String::from("Content-Length"),String::from("0")),
            ])
        );

        assert_eq!(    
            Response::new()
            .insert_header("Content-Type","application/json")
            .headers,
             
            HashMap::from([
                (String::from("Content-Type"),String::from("application/json")),
                (String::from("Content-Length"),String::from("0")),
            ])

        );

         assert_eq!(    
            Response::new()
            .insert_header("Test-Random","test/random")
            .headers,
             
            HashMap::from([
                (String::from("Test-Random"),String::from("test/random")),
                (String::from("Content-Type"),String::from("*/*")),
                (String::from("Content-Length"),String::from("0")),
            ])
        );
        
    }

    #[test]
    fn test_send_contents() {

          
        assert_eq!(
            Response::new()
            .body, 
            Vec::<u8>::new()

        );

        
        assert_eq!(
            Response::new()
            .send_contents([10, 11, 12, 13].to_vec())
            .body, 
            Vec::from([10, 11, 12, 13])

        );
    }


}