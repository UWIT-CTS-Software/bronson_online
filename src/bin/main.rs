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
    - find_enclosed(s: String, delimeters: (char,char), include_delim: bool) -> String

JackNet
    - execute_ping(body: Vec<u8>) -> String

ChkrBrd
    - construct_headers(call_type: &str, database: &mut Database) -> HeaderMap
    - check_schedule(room: Room) -> String
    - check_lsm(room: Room) -> String

CamCode
-- Helpers ------------------------------
    - dir_exists(path: &str) -> bool
    - is_this_file(path: &str) -> bool
    - is_this_dir(path: &str) -> bool
    - find_files(building: String, rm: String) -> Vec<String>
    - get_dir_contents(path: &str) -> Vec<String>
    - get_origin(req: Request) -> String
-- Handlers -----------------------------
    - cfm_build_dir() -> Vec<u8>
    - cfm_build_rm(body: Vec<u8>) -> String
    - get_cfm(body: Vec<u8>) -> String
    - get_cfm_file(body: Vec<u8>) -> String
    - get_cfm_dir(body: Vec<u8>) -> String

Wiki
    - w_build_articles() -> String
*/

// dependencies
// ----------------------------------------------------------------------------
use server_lib::{
    BUFF_SIZE, 
    ThreadPool, ThreadSchedule, TaskSchedule, PingRequest, 
    Building, 
    CFMRequest, CFMRoomRequest, CFMRequestFile, 
    jp::{ ping_this, },
    CFM_DIR, WIKI_DIR, /* LOG, */
    Request, Response, STATUS_200, /* STATUS_303, */ STATUS_401, STATUS_404, STATUS_500, 
    SCHD_ERR, DASH_ERR, LDRB_ERR, SPRS_ERR, 
    Database, Terminal, 
    models::{
        DB_Room, DB_Building, DB_User, DB_DataElement,
        DB_IpAddress,  
    },
};
use futures_util::future::FutureExt;
use getopts::Options;
use std::{
    str, env,
    io::{ prelude::*, Read, stdout, },
    net::{ TcpListener, IpAddr, Ipv4Addr, },
    fs::{
        read_dir, metadata,
        File, 
    },
    path::Path,
    time::{ Duration, /* SystemTime */},
    string::{ String, },
    sync::{Arc, /*Mutex,*/ RwLock,
        atomic::{AtomicBool, Ordering}},
    clone::{ Clone, },
    option::{ Option, },
    collections::{ HashMap, },
};
use reqwest::{
    Client,
    header::{ HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, ACCEPT, }
};
use log::{ debug, info, warn, error, }; // trace, };
use cookie::{ /* Cookie, */ CookieJar, /* Key, */ };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use regex::Regex;
use chrono::{ Datelike, offset::Local, Weekday, DateTime, TimeDelta,Utc };
use urlencoding::decode;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use diesel::{PgConnection, Connection};
use dotenvy::dotenv;
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
    
    // set TcpListener and initalize
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

    let mut request_database = Database::new();
    //let data_database = Database::new();

    let _ = match request_database.init_if_empty() {
        Some(()) => (),
        None     => {
            return Err("Unable to initialize database!".into());
        }
    };
    // Data Thread Pool Loop (data transfer)
    if matches.opt_present("j") {
        set_jn_thread_true();
    }
    let thread_schedule = Arc::new(RwLock::new(ThreadSchedule::new()));
    let data_ts = Arc::clone(&thread_schedule);
    data_pool.execute(move || {
        data_sync(data_ts);
    });

    // User Requests / User Thread Pool    let _ = database.backup();

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
        pool.execute(move || {
            let mut res = handle_connection(req, clone_db, req_ts).unwrap();
            stream.write(&res.build()).unwrap();
            stream.flush().unwrap();
            stdout().flush().unwrap();
        });

        buffer = [0; BUFF_SIZE];
    }

    return Ok(());
}

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

#[tokio::main]
#[allow(unused_assignments)]
#[allow(unreachable_code)]
async fn data_sync(thread_schedule: Arc<RwLock<ThreadSchedule>>) {
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
        ts.tasks.insert("backup".to_string(), TaskSchedule {
            duration: 86400,
            timestamp: Utc::now() - Duration::from_secs(86400)
        });
        ts.tasks.insert("checkerboard".to_string(), TaskSchedule {
            duration: 1800,
            timestamp: Utc::now() - Duration::from_secs(1799),
        });
        ts.tasks.insert("jacknet".to_string(), TaskSchedule {
            duration: 3600,
            timestamp: Utc::now() - Duration::from_secs(3580),
        });
    }
    // Database Init
    let mut database = Database::new();
    // Init Datapool
    // TODO: Once there is sufficient need, multithreading this will be done with 'data_threads', in addition, the following loop block will need refactored.
    //let _data_threads = ThreadPool::new(3);
    // Note: Arc<RwLock<Reqwest>>
    //       ^ The above line will prevent concurent access with LSM.
    //       Normal Reqwests, Other API's that can handle concurent requests
    //       will not need to be locked.
    let lsm_request: Arc<RwLock<Client>> = Arc::new(RwLock::new(
        reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("lsm", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()
                .expect("Unable to build LSM Request Client")
            ));
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
                    update_room_check_leaderboard(&mut database, Arc::clone(&lsm_request)).await;
                    info!("[Data] - New LSM Leaderboard Pulled")
                },
                "spares"          => {
                    info!("[Data] - Pulling New LSM Spare Information");
                    update_lsm_spares(&mut database, Arc::clone(&lsm_request)).await;
                    info!("[Data] - New LSM Spare Information Pulled")
                },
                "backup"          => {
                    info!("[Backup] - Backing up the database.");
                    let _ = match database.backup() {
                        Ok(_)     => (),
                        Err(s)    => {
                            error!("DBB_ERR: {}", s);
                            ()
                        }
                    };
                    info!("[Backup] - Backup request fulfilled.");
                },
                "lsmData"         => {
                    info!("[Data] - Pulling LSM Inventory Information");
                    println!("MAYBE TODO: Get Diagnostic Information from LSM");
                    //update_lsm_data(&mut database, Arc::clone(&lsm_request)).await;
                    info!("[Data] - Completed LSM Inventory Data Retreieval");
                },
                "checkerboard"    => {
                    info!("[Data] - Running Checkerboard");
                    let _ = match run_checkerboard(&mut database, Arc::clone(&lsm_request)).await {
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
    return;
}

#[tokio::main]
#[allow(unused_assignments)]
async fn handle_connection(
    mut req: Request,
    mut database: Database,
    thread_schedule: Arc<RwLock<ThreadSchedule>>,
) -> Option<Response> {
    let mut user_homepage: &str = "html-css-js/login.html";
    if req.headers.contains_key("Cookie") {
        let username_search = Regex::new("^(?<username>.*)=(?<key>.*=.*)").unwrap();
        let username = match username_search.captures(&req.headers.get("Cookie").unwrap()) {
            Some(uname) => uname,
            None => panic!("Unable to capture username.")
        };
        //let mut database = arc_database.write().unwrap();
        let user = match database.get_user(&username["username"]) {
            Ok(u)  => u,
            Err(m) => {
                error!("DB_ERR: {}", m);
                DB_User{ username: String::new(), permissions: 0 }
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
    // Handle requests
    // ------------------------------------------------------------------------
    let mut res: Response = Response::new();

    match req.start_line.as_str() {
        // Page Content
        // --------------------------------------------------------------------
        "GET / HTTP/1.1"                   => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
        },
        "GET /page.css HTTP/1.1"           => {
            res.status(STATUS_200);
            res.send_file("html-css-js/page.css");
        },
        "GET /index.html HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file("html-css-js/index.html");
        },
        "GET /login.html HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file("html-css-js/login.html");
        },
        // Javascript Files
        "GET /bronson-manager.js HTTP/1.1" => {
            res.status(STATUS_200);
            res.send_file("html-css-js/bronson-manager.js");
        },
        "GET /camcode.js HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file("html-css-js/camcode.js");
        },
        "GET /cc-altmode.js HTTP/1.1"      => {
            res.status(STATUS_200);
            res.send_file("html-css-js/cc-altmode.js");
        },
        "GET /checkerboard.js HTTP/1.1"    => {
            res.status(STATUS_200);
            res.send_file("html-css-js/checkerboard.js");
        },
        "GET /jacknet.js HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file("html-css-js/jacknet.js");
        },
        "GET /wiki.js HTTP/1.1"            => {
            res.status(STATUS_200);
            res.send_file("html-css-js/wiki.js");
        },
        "GET /admin_tools.js HTTP/1.1"     => {
            res.status(STATUS_200);
            res.send_file("html-css-js/admin_tools.js");
        },
        // Tool Homepage Stuff
        "GET /cc-altmode HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
            res.insert_onload("setCamcode()");
        },
        "GET /checkerboard HTTP/1.1"       => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
            res.insert_onload("setChecker()");
        },
        "GET /jacknet HTTP/1.1"            => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
            res.insert_onload("setJackNet()");
        },
        "GET /wiki HTTP/1.1"               => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
            res.insert_onload("setWiki()");
        },
        "GET /admintools HTTP/1.1"         => {
            res.status(STATUS_200);
            res.send_file(user_homepage);
            res.insert_onload("setAdminTools()");
        }
        // Assets
        "GET /favicon.ico HTTP/1.1"        => {
            res.status(STATUS_200);
            res.send_file("assets/logo_main.png");
        },
        "GET /logo.png HTTP/1.1"           => {
            res.status(STATUS_200);
            res.send_file("assets/logo.png");
        },
        "GET /logo-2-line.png HTTP/1.1"    => {
            res.status(STATUS_200);
            res.send_file("assets/logo-2-line.png");
        },
        "GET /button2.png HTTP/1.1"        => {
            res.status(STATUS_200);
            res.send_file("assets/button2.png");
        },
        // Data Requests
        "GET /techSchedule HTTP/1.1"  => {
            let contents = match database.get_data("schedule") {
                Ok(s)  => s.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(SCHD_ERR)
                }
            }.into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /campusData HTTP/1.1"         => {
            let campus = database.get_campus();
            let contents = match campus {
                Ok(c)  => json!(&c).to_string().into(),
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from("{}").into()
                }
            };
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /zoneData HTTP/1.1"           => { // NEW: returns data in lib.rs as json
            let bldgs = database.get_buildings();
            let contents = match bldgs {
                Ok(b)  => get_zone_data(b),
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from("{}").into()
                }
            };
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /dashContents HTTP/1.1"       => { // Dashboard Message
            let contents = json!({
                "contents": match database.get_data("dashboard") {
                    Ok(e)  => e.val,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        String::from(DASH_ERR)
                    }
                }
            }).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /leaderboard HTTP/1.1"        => { // OUTGOING, Dashboard Leaderboard
            let contents = match database.get_data("lsm_leaderboard") {
                Ok(l)  => l.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(LDRB_ERR)
                }
            }.into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // Spares LSM API Call.
        "GET /spares HTTP/1.1"             => { // OUTGOING, Dashboard Spares
            // Get Spares from Database
            let contents: Vec<u8> = match database.get_data("lsm_spares") {
                Ok(s)  => s.val,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    String::from(SPRS_ERR)
                }
            }.into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /lsmData HTTP/1.1"              => { // OUTGOING
            let body_str = String::from_utf8(req.body).expect("AT: LSM Data Err, invalid UTF-8");
            let body_parts: Vec<&str> = body_str.split(',').collect();
            if body_parts.len() != 2 {
                res.status(STATUS_500);
                res.send_contents("Invalid request body.".into());
                return Some(res);
            }
            let building_sel:String = body_parts[0].to_string();
            let device_type = body_parts[1];
            let lsm_building = match database.get_building_by_abbrev(&building_sel) {
                Ok(b)  => b,
                Err(m) => {
                    res.status(STATUS_500);
                    res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                    return Some(res);
                }
            };
            debug!("[Admin Tools] - Grabbing LSM Data for Diagnostics:\n{:?}", &lsm_building.lsm_name.as_str());
            let api_endpoint = match device_type {
                "PROC" => "BuildingProcs",
                "DISP" => "BuildingDisplays",
                "PJ" => "BuildingProjectors",
                "TP"   => "BuildingTouchPanels",
                _    => {
                    res.status(STATUS_500);
                    res.send_contents("Invalid device type.".into());
                    return Some(res);
                }
            };
            debug!("[Admin Tools] - Diagnostic API Endpoint: {}", api_endpoint);
            let url_devs = format!(
                r"https://uwyo.talem3.com/lsm/api/{}?offset=0&p=%7BParentName%3A%22{}%22%7D", 
                &api_endpoint,
                &lsm_building.lsm_name.as_str()
            );
            // Build and Send Request
            let req = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("lsm", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let devs = req.get(url_devs)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

            let v_devs: Value = serde_json::from_str(&devs).expect("Empty");
            let data_devs: Vec<Value> = match v_devs["data"].as_array() {
                Some(data) => data.clone(),
                None => Vec::<Value>::new()
            };
            // Pack into JSON response to front-end
            let contents = json!({
                 "data": data_devs
            }).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /updateSchedule HTTP/1.1"        => {
            let new_data = DB_DataElement {
                key: String::from("schedule"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents")
            };
            let _ = database.update_data(&new_data);
            res.status(STATUS_200);
            res.send_contents("".into());
        },
        "POST /update/dash HTTP/1.1"       => {
            let _ = database.update_data(&DB_DataElement {
                key: String::from("dashboard"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents"),
            });
            res.status(STATUS_200);
            res.send_contents("".into());
        },
        "POST /update/database_room HTTP/1.1"     => { // destination, newValue
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                debug!("[Admin Tools] - Updating Target Room:{}\n New Values: {:?}", target_room, new_values);
                // Get Existing Room Record from database
                let mut new_db_room : DB_Room = match database.get_room_by_name(&target_room) {
                    Ok(tr) => tr,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        res.status(STATUS_500);
                        res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                        return Some(res);
                    }
                };
                //println!("DEBUG Existing DB_Room (Pre-Update) -> \n {:?}", new_db_room);
                // Update General Pool Status
                new_db_room.gp = match new_values[6] { 
                    1 => true,
                    0 => false,
                    _ => false,
                };
                // Build Updated Ping Data Vector
                let hn_vec = Database::gen_hn(String::from(target_room), &new_values);
                let ping_vec = Database::gen_ip(&hn_vec);
                // Update Ping Data in room
                new_db_room.ping_data = ping_vec;
                // Update Database
                //println!("DEBUG Updating DB_Room -> \n {:?}", new_db_room);
                let _ = database.update_room(&new_db_room);
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /insert/database_room HTTP/1.1"     => { // destination
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                // Parse Request Body
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                let new_room: String = body_json["destination"]
                    .as_str()
                    .unwrap()
                    .to_string();
                let new_values: Vec<u8> = [0,0,0,0,0,0,0].to_vec();
                // Note: When we are inserting a new room, we are not providing the inventory in the same call. The intention is that the front-end will send the rooms to insert first and if their is inventory associated with it it will come after.
                // Build DB_Room Object and insert to Database
                // Ping Data Vector
                let hn_vec = Database::gen_hn(new_room.clone(), &new_values);
                let ping_vec = Database::gen_ip(&hn_vec);
                // Insert New Room to Database
                let new_db_room = DB_Room {
                    abbrev: new_room.split(' ').collect::<Vec<&str>>()[0].to_string(),
                    name: new_room,
                    checked: "2000-01-01T00:00:00Z".to_string(),
                    needs_checked: true,
                    gp: match new_values[6] { 
                        1 => true,
                        0 => false,
                        _ => false,
                    },
                    available: false,
                    until: String::from("TOMORROW"),
                    ping_data: ping_vec,
                    schedule: Vec::new(),
                };
                debug!("[Admin Tools] - INSERTING DB_ROOM => \n {:?}", new_db_room);
                // Note, the schedule field here is initialized as empty.
                //   we will require some more tooling to get this data in here.
                //   whether that be some kind of csv import or a manual page.
                let _ = database.update_room(&new_db_room); // UNCOMMENT ME WHEN READY
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /remove/database_room HTTP/1.1"     => { // destination
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                // Parse Request Body
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                let target_room: String = body_json["destination"]
                    .as_str()
                    .unwrap()
                    .to_string();
                debug!("[Admin Tools] - REMOVING ROOM -> {:?}", target_room);
                // Remove Specified Room from Database
                let _ = database.delete_room(&target_room);
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /update/database_building HTTP/1.1" => { // destination, newValue
            //let mut database = arc_database.write().unwrap();
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                // Parse Request Body
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                let target_building: String = body_json["destination"]
                    .as_str()
                    .unwrap()
                    .to_string();
                let new_values: Vec<String> = body_json["newValue"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap();
                
                //println!("DEBUG Updating Building -> {} {:?}", target_building, new_values);
                // Get Existing Building Record from database
                let mut new_db_building : DB_Building = match database.get_building_by_abbrev(&target_building) {
                    Ok(b)  => b,
                    Err(m) => {
                        error!("DB_ERR: {}", m);
                        res.status(STATUS_500);
                        res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                        return Some(res);
                    }
                };
                // Update Building Values
                new_db_building.name = new_values[0].to_string();
                new_db_building.abbrev = new_values[1].to_string();
                new_db_building.lsm_name = new_values[2].to_string();
                new_db_building.zone = new_values[3].parse().expect("invalid zone");
                // Update Database
                debug!("[Admin Tools] - Updated Building Record:\n{:?}", &new_db_building);
                let _ = database.update_building(&new_db_building); // UNCOMMENT ME WHEN READY
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /insert/database_building HTTP/1.1" => { // destination, newValue
            //let mut database = arc_database.write().unwrap();
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                //println!("{:?}", body_json);
                let new_values: Vec<String> = body_json["newValue"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap();
                //println!("{} {:?}", target_building, new_values);
                // Create New DB_Builing with new_values
                let new_db_building = DB_Building {
                    name: new_values[0].clone(),
                    abbrev: new_values[1].clone(),
                    lsm_name: new_values[2].clone(),
                    zone: new_values[3].parse().expect("invalid zone"),
                    checked_rooms: 0,
                    total_rooms: 0
                };
                debug!("Inserting Building Record:\n {:?}", &new_db_building);
                let _ = database.update_building(&new_db_building); //UNCOMMENT ME WHEN READY
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /remove/database_building HTTP/1.1" => { // destination
            //let mut database = arc_database.write().unwrap();
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                let target_building: String = body_json["destination"]
                    .as_str()
                    .unwrap()
                    .to_string();
                debug!("[Admin Tools] - DB Target Building to remove:\n {:?}", target_building);
                let _ = database.delete_building(&target_building);
                res.status(STATUS_200);
                res.send_contents("".into());
            }
        },
        "POST /update/database_roomSchedule HTTP/1.1" => { // [Changes to make]
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                            res.status(STATUS_500);
                            res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                            return Some(res);
                        }
                    };
                    // Update Schedule
                    new_db_room.schedule = new_schedule.clone();
                    // Update Database
                    let _ = database.update_room(&new_db_room);
                    debug!("[Admin Tools] - Updating Room: {} with Schedule:\n {:?}", target_room, new_schedule);
                }
                res.status(STATUS_200);
                res.send_contents("Room Schedules in Database Updated".into());
            }
        },
        "POST /update/roomSchd/timestamps HTTP/1.1" => { // Updates the timestamps stored in DB_DataElement
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                res.status(STATUS_200);
                res.send_contents("Successful Room Schedule Timestamps Update".into());
            }
        },
        "GET /roomSchd/timestamps HTTP/1.1" => { // Returns 25Live Report Dates
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let timestamps = database.get_data("report_timestamps").unwrap_or( DB_DataElement {key:"report_timestamps".to_string(),val:"[\"Timestamp Not Found\"]".to_string()}).val;
                debug!("Fetched Timestamps:\n {:?}", &timestamps);
                let contents = json!({
                    "timestamps": timestamps
                }).to_string().into();
                res.status(STATUS_200);
                res.send_contents(contents);
            }
        },
        "GET /aliasTable HTTP/1.1"         => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let alias_table = database.get_data("alias_table")
                    .unwrap_or(DB_DataElement {
                        key: "alias_table".to_string(),
                        val: "Alias Table has not been updated".to_string()
                    })
                    .val;
                let contents = json!({
                    "response": alias_table
                }).to_string().into();
                res.status(STATUS_200);
                res.send_contents(contents);
            }
        },
        "GET /threadSchedule HTTP/1.1"   => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let ts = thread_schedule.read().unwrap();
                let contents = json!({
                    "response": ts.tasks
                }).to_string().into();
                res.status(STATUS_200);
                res.send_contents(contents);
            }
        },
        "POST /resetThreadInterval HTTP/1.1" => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                let body_json : Value = serde_json::from_str(std::str::from_utf8(&req.body).unwrap()).expect("Failed Parsing JSON");
                let task_name: String = body_json["task_name"]
                    .as_str()
                    .unwrap()
                    .to_string();
                debug!("[Admin Tools] - Updating ThreadSchedule Task: \"{}\" to run now", task_name);
                if let Some(task) = thread_schedule.write().unwrap().tasks.get_mut(&task_name) {
                    task.timestamp = task.timestamp - Duration::from_secs(task.duration);
                    res.status(STATUS_200);
                    res.send_contents("ThreadSchedule Updated".into());
                } else {
                    res.status(STATUS_500);
                    res.send_contents("Task Not Found".into());
                }
            }
        },
        "POST /setThreadDuration HTTP/1.1" => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                    res.status(STATUS_200);
                    res.send_contents("ThreadSchedule Duration Updated".into());
                } else {
                    res.status(STATUS_500);
                    res.send_contents("Task Not Found".into());
                }
            }
        }
        "POST /setAliasTable HTTP/1.1"     => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                    //println!("{}", room_name.len());
                    if hostname_exception != "" {
                        debug!("[Alias] - Hostname Exception: \n {} at {}", hostname_exception, room_name);
                        let mut room : DB_Room = match database.get_room_by_name(&room_name) {
                            Ok(r)  => r,
                            Err(m) => {
                                error!("DB_ERR: {}", m);
                                res.status(STATUS_500);
                                res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                                return Some(res);
                            }
                        };
                        let mut pd = room.ping_data.clone();
                        for ping_record in &mut pd {
                            ping_record
                                .as_mut()
                                .unwrap()
                                .hostname.room = hostname_exception.clone();
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
                res.status(STATUS_200);
                res.send_contents("Database Alias Table Updated".into());
            }
        },
        "POST /resetAlias HTTP/1.1"        => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
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
                            res.status(STATUS_500);
                            res.send_contents(format!("An internal server error occured. Please contact a system administrator.\n{}", m).into());
                            return Some(res);
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
                    //println!("Reset room {}:\n{:?}", &room_name, &room);
                    let _ = database.update_room(&room);
                }
                debug!("[Alias] - Reverting Alias Change for target_rooms, {:?}", &target_rooms);
                res.status(STATUS_200);
                res.send_contents("Reset Requested Rooms".into());
            }
        },
        // Terminal
        // --------------------------------------------------------------------
        "POST /terminal HTTP/1.1"          => {
            if !req.has_valid_cookie(&mut database) {
                res.status(STATUS_401);
                res.send_contents(json!({
                    "response": "Unauthorized"
                }).to_string().into());
            } else {
                res = match Terminal::execute(&req) {
                    Ok(resp) => {
                        resp
                    },
                    Err(e) => {
                        let mut resp = res;
                        resp.status(STATUS_500);
                        resp.send_contents(json!({
                            "response": format!("Internal error: {:?}", e)
                        }).to_string().into());
                        resp
                    }
                };
            }
        },
        // --------------------------------------------------------------------
        // make calls to backend functionality
        // --------------------------------------------------------------------
        // login
        "POST /login HTTP/1.1"             => {
            let credential_search = Regex::new(r"uname=(?<user>.*)&remember=[on|off]").unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return Option::Some(res) };
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
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    "html-css-js/index.html"
                }
            };

            let mut jar = CookieJar::new();
            jar.signed_mut(&database.get_cookie_key()).add((user.clone(), user.clone()));
            let signed_val = jar.get(&user).cloned().unwrap();
        
            res.insert_header("Set-Cookie", &signed_val.to_string());
            res.insert_header("Access-Control-Expose-Headers", "Set-Cookie");

            res.status(STATUS_200);
            res.send_file(user_homepage);
        },
        "POST /bugreport HTTP/1.1"         => {
            let credential_search = Regex::new(r#"title=(?<title>.*)&desc=(?<desc>.*)"#).unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return Some(res) };
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

            let mut arg_map = HashMap::new();
            arg_map.insert("title", decoded_title);
            arg_map.insert("body", decoded_desc);

            let url = "https://api.github.com/repos/UWIT-CTS-Software/bronson_online/issues";
            let req = reqwest::Client::builder()
                .cookie_store(true)
                // .cookie_provider(Arc::clone(&cookie_jar))
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("gh", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let _ = req.post(url)
                .timeout(Duration::from_secs(15))
                .json(&arg_map)
                .send()
                .await
                .expect("[-] RESPONSE ERROR")
                .text()
                .await
                .expect("[-] PAYLOAD ERROR");

            res.status(STATUS_200);
            res.send_file(user_homepage);
        },
        // Jacknet
        "POST /ping HTTP/1.1"              => { // OUTGOING
            let contents = ping_response(String::from_utf8(req.body).expect("Err, invalid UTF-8"), database);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // Checkerboard
        "POST /run_cb HTTP/1.1"            => { // OUTGOING
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
                    res.status(STATUS_500);
                    res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                    return Some(res);
                }
            };
            let ret_rooms = match database.get_rooms_by_abbrev(&building_sel) {
                Ok(rs) => rs,
                Err(m) => {
                    error!("DB_ERR: {}", m);
                    res.status(STATUS_500);
                    res.send_contents(format!("An internal error occured. Please contact a system administrator.\n{}", m).into());
                    return Some(res);
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
            res.status(STATUS_200);
            res.send_contents(contents);
            // ----------------------------------------------------------------
        },
        // CamCode
        //  - CamCode - CFM Requests
        "POST /cfm_build HTTP/1.1"         => {
            let contents = cfm_build_dir();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_build_r HTTP/1.1"       => {
            let contents = cfm_build_rm(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_c_dir HTTP/1.1"         => {
            let contents = get_cfm(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_dir HTTP/1.1"           => {
            let contents = get_cfm_dir(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_file HTTP/1.1"          => {
            let contents = get_cfm_file(req.body);
            let mut f = match File::open(&contents) {
                Ok(file) => file,
                Err(e) => {
                    error!("Unable to open file {}: {}", &contents, e);
                    res.status(STATUS_500);
                    res.send_contents(format!("File not found: {}", &contents).into());
                    return Some(res);
                }
            };
            
            let mut file_buffer = Vec::new();
            match f.read_to_end(&mut file_buffer) {
                Ok(_) => (),
                Err(e) => error!("Unable to read to end of file: {}", e)
            };

            res.status(STATUS_200);
            res.insert_header("Content-Type", "application/zip");
            let filename = format!("attachment; filename={}", contents);
            res.insert_header("Content-Disposition", &filename);
            res.send_contents(file_buffer);
        },
        // Wiki
        "POST /w_build HTTP/1.1"           => {
            let contents = w_build_articles();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        &_                                 => {
            res.status(STATUS_404);
            res.send_file("html-css-js/404.html");
        }
    };
    
    return Some(res);
}


async fn update_room_check_leaderboard(database: &mut Database, req: Arc<RwLock<Client>>) {
    let url_7_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D";
    let url_30_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last30days%22%7D";
    let url_90_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last90days%22%7D";

    let body_7_days: String;
    let body_30_days: String;
    let body_90_days: String;
    {
        body_7_days = req.write().unwrap().get(url_7_days)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .expect("[-] RESPONSE ERROR")
            .text()
            .await
            .expect("[-] PAYLOAD ERROR");
    }
    let v_7_days: Value = serde_json::from_str(&body_7_days).expect("Empty");
    let data_7_days: Vec<Value> = match v_7_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };

    {
        body_30_days = req.write().unwrap().get(url_30_days)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .expect("[-] RESPONSE ERROR")
            .text()
            .await
            .expect("[-] PAYLOAD ERROR");
    }

    let v_30_days: Value = serde_json::from_str(&body_30_days).expect("Empty");
    let data_30_days: Vec<Value> = match v_30_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };

    {
        body_90_days = req.write().unwrap().get(url_90_days)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .expect("[-] RESPONSE ERROR")
            .text()
            .await
            .expect("[-] PAYLOAD ERROR");
    }

    let v_90_days: Value = serde_json::from_str(&body_90_days).expect("Empty");
    let data_90_days: Vec<Value> = match v_90_days["data"].as_array() {
        Some(data) => data.clone(),
        None => Vec::<Value>::new()
    };

    let contents = json!({
        "7days": data_7_days,
        "30days": data_30_days,
        "90days": data_90_days
    }).to_string().into();

    let _ = database.update_data(&DB_DataElement {
        key: String::from("lsm_leaderboard"),
        val: String::from_utf8(contents).expect("Unable to parse LSM Return"),
    });
    return;
}

async fn update_lsm_spares(database: &mut Database, req: Arc<RwLock<Client>>) {
    let url_spares = "https://uwyo.talem3.com/lsm/api/Spares?offset=0&p=%7B%7D";

    let body_spares: String;
    {
        body_spares = req.write().unwrap().get(url_spares)
                        .timeout(Duration::from_secs(15))
                        .send()
                        .await
                        .expect("[-] RESPONSE ERROR")
                        .text()
                        .await
                        .expect("[-] PAYLOAD ERROR");
    }
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
    return;
}

// Unsure if this is worth implementing...
#[allow(dead_code)]
async fn update_lsm_data(_database: &mut Database, _req: Arc<RwLock<Client>>) {
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
    return;
}

async fn run_checkerboard(database: &mut Database, req: Arc<RwLock<Client>>) -> Result<(), String> {
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
        //println!("{:?}", building);
        let url = format!(r"https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last30days%22%2CParentLocation%3A%22{}%22%7D", building.1.lsm_name.as_str());
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
        let body: String;
        {
            body = req.write().unwrap().get(url)
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .expect("[-] RESPONSE ERROR")
                .text()
                .await
                .expect("[-] PAYLOAD ERROR");
        }
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
        let mut check_map: HashMap<String, String> = HashMap::new();
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
            //checks.reverse();
            for i in 0..num_entries {
                let mut check: serde_json::Map<std::string::String, Value> = checks[i as usize].as_object().unwrap().clone();
                // Look to see if check["LocationName"] is in the alias_obj, replace it if so.
                //println!("Current Check: {:?}", &check);
                for tuple in &alias_vec {
                    if tuple.1 == check["LocationName"].as_str().unwrap() {
                        debug!("[Checkerboard Alias] Room - {:?} to be replaced with {:?}", check["LocationName"].as_str().unwrap(), tuple.0);
                        check["LocationName"] = serde_json::Value::String(tuple.0.clone());
                    }
                }
                // Replace Abbrevition if exists
                if alias_abbrev.0 != "NOTSET" {
                    // check["LocationName"]
                    debug!("[Checkerboard Alias] Building - {:?} to be replaced with {:?}",alias_abbrev.0, alias_abbrev.1);
                    check["LocationName"] = serde_json::Value::String(
                        check["LocationName"]
                            .as_str()
                            .unwrap()
                            .replace(&alias_abbrev.0, &alias_abbrev.1)
                    );
                }
                check_map.insert(
                    String::from(check["LocationName"].as_str().unwrap()), 
                    String::from(check["CompletedOn"].as_str().unwrap())
                );
            }
        }
        // Get checked_rooms
        let mut checked_rooms: i16 = 0;
        let rooms = match database.get_rooms_by_abbrev(&building.1.abbrev) {
            Ok(rs) => rs,
            Err(m) => {
                error!("DB_ERR: {}", m);
                Vec::new()
            }
        };
        for mut room in rooms {
            if check_map.contains_key(&room.name) {
                room.checked = String::from(match check_map.get(&room.name) {
                    Some(r) => r,
                    None => {
                        warn!("Unable to fetch room, defaulting.");
                        "2000-01-01T00:00:00Z"
                    }
                });
            }
            room.needs_checked = check_lsm(&room);
            let schedule_params = check_schedule(&room);
            room.available = schedule_params.0;
            room.until = schedule_params.1;
            // Check for room check
            if !room.needs_checked {
                checked_rooms += 1;
            }
            let _ = database.update_room(&room);
        }
        let ret_building = match database.get_building_by_abbrev(&building.1.abbrev) {
            Ok(b)  => b,
            Err(m) => { return Err(m.to_string()); }
        };
        let ret_rooms = match database.get_rooms_by_abbrev(&ret_building.abbrev) {
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

fn pad_zero(raw_in: String, length: usize) -> String {
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

fn ping_response(tmp: String, mut database: Database) -> Vec<u8> {
    //println!("{}", tmp);
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

// call ping_this executible here
async fn execute_ping(database: &mut Database) {
    let buildings: HashMap<String, DB_Building> = match database.get_buildings() {
        Ok(bs) => bs,
        Err(m) => {
            error!("DB_ERR: {}", m);
            HashMap::new()
        }
    };

    for building in buildings {
        let rooms_to_ping: Vec<DB_Room> = match database.get_rooms_by_abbrev(&building.1.abbrev) {
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
    return;
}

fn ping_room(net_elements: Vec<Option<DB_IpAddress>>) -> Vec<Option<DB_IpAddress>> {
    let mut pinged_hns: Vec<Option<DB_IpAddress>> = Vec::new();
    for net in net_elements {
        let hn_string: String = net.as_ref().unwrap().hostname.to_string();
        pinged_hns.push(Some(
            match ping_this(&hn_string) {
                Ok(ip) => DB_IpAddress {
                    hostname: net.clone().unwrap().hostname,
                    ip: ip,
                    last_ping: String::from(format!("{}", chrono::Utc::now())),
                    alert: 0,
                    error_message: String::new()
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
        ))
    }

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

fn construct_headers(call_type: &str,database: &mut Database) -> HeaderMap {
    let mut header_map = HeaderMap::new();
    if call_type == "lsm" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&database.get_key("lsm_api").expect("No key found!").val).expect("[-] KEY_ERR: Not found."));
    } else if call_type == "gh" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&database.get_key("gh_api").expect("No key found!").val).expect("[-] KEY_ERR: Not found."));
        header_map.insert(HeaderName::from_static("x-github-api-version"), HeaderValue::from_static("2022-11-28"));
    }

    return header_map;
}

fn check_schedule(room: &DB_Room) -> (bool, String) {
    let mut available: bool = true;
    let mut until: String = String::from("TOMORROW");

    let now = Local::now();
    let day_of_week = match now.date_naive().weekday() {
        Weekday::Mon => "M",
        Weekday::Tue => "T",
        Weekday::Wed => "W",
        Weekday::Thu => "R",
        Weekday::Fri => "F",
        _            => "?",
    };
    let now_str = now.to_string();
    let time_filter = Regex::new(r"(?<hours>[0-9]{2}):(?<minutes>[0-9]{2})").unwrap();
    let time = time_filter.captures(&now_str).unwrap();

    let hours: u16 = match time["hours"].parse() {
        Ok(h) => h,
        Err(e) => {
            error!("Unable to parse schedule hours: {}\nDefaulting to 0.", e);
            0
        }
    };
    let minutes: u16 = match time["minutes"].parse() {
        Ok(m) => m,
        Err(e) => {
            error!("Unable to parse schedule minutes: {}\nDefaulting to 0.", e);
            0
        }
    };
    let adjusted_time: u16 = (hours * 100) + minutes;
    
    for block in &room.schedule {
        let block_vec: Vec<&str> = block.as_ref().unwrap().split(&[' ', '-']).collect::<Vec<_>>().to_vec();
        let adjusted_start: u16 = match block_vec[1].parse() {
            Ok(t) => t,
            Err(e) => {
                error!("Unable to parse schedule start time: {}", e);
                0
            }
        };
        let adjusted_end: u16 = match block_vec[2].parse() {
            Ok(t) => t,
            Err(e) => {
                error!("Unable to parse schedule end time: {}", e);
                0
            }
        };
        if block_vec[0].contains(day_of_week) {
            if adjusted_time < adjusted_start {
                available = true;
                until = pad_zero((adjusted_start % 100).to_string(), 4);
                return (available, until);
            } else if (adjusted_start <= adjusted_time) && (adjusted_time <= adjusted_end) {
                available = false;
                until = pad_zero((adjusted_end).to_string(), 4);
                return (available, until);
            }
        }
    }

    return (available, until);
}

fn check_lsm(room: &DB_Room) -> bool {
    let needs_checked;
    // Line below produces -> ParseError(TooShort)
    let parsed_checked: DateTime<Local> = match room.checked.parse() {
        Ok(dt) => dt,
        Err(e) => {
            error!("Unable to parse incoming DateTime: {}", e);
            String::from("2000-01-01T00:00:00Z").parse().unwrap()
        }
    };
    let time_diff: TimeDelta = Local::now() - parsed_checked;
    if room.gp {
        if time_diff.num_seconds() >= 604800 {
            needs_checked = true;
        } else {
            needs_checked = false;
        }
    } else {
        if time_diff.num_days() >= 30 {
            needs_checked = true;
        } else {
            needs_checked = false;
        }
    }

    return needs_checked;
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

fn dir_exists(path: &str) -> bool {
    return metadata(path).is_ok();
}

fn is_this_file(path: &str) -> bool {
    return metadata(path).unwrap().is_file();
}

fn is_this_dir(path: &str) -> bool {
    return metadata(path).unwrap().is_dir();
}

fn find_files(building: String, rm: String) -> Vec<String> {
    let mut strings = Vec::new();
    let mut path = String::from(CFM_DIR);
    path.push_str("/");
    path.push_str(&building);
    path.push_str(&rm);

    if dir_exists(&path) {
        strings = get_dir_contents(&path);
    }

    return strings;
}

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
                                             
//   cfm_build_dir() - post BUILDING dropdown
fn cfm_build_dir() -> Vec<u8> {
    // Vars
    let mut final_dirs: Vec<String> = Vec::new();
    // Check for CFM_Code Directory
    if dir_exists(CFM_DIR) {

    }
    let cfm_dirs = get_dir_contents(CFM_DIR);
    // iterate over cfm_dirs and snip ../CFM_Code/
    // DO NOT INCLUDE DIRS w/ '_'
    let cut_index = CFM_DIR.len();
    for (_, &ref item) in cfm_dirs.iter().enumerate() {
        if (&item[(cut_index + 1)..]).to_string().starts_with('_') {
            continue; // ignore directories starting with '_'
        } else if (&item[(cut_index + 1)..]).to_string().starts_with('.') {
            continue; // ignore directories starting with '.'
        } else if is_this_file(&item) {
            continue; // ignore files
        }
        else {
            final_dirs.push((&item[(cut_index + 1)..]).to_string());
        }
    };
    // return file
    let json_return = json!({
        "dir_names": final_dirs
    });

    return json_return.to_string().into();
}

// cfm_build_rm() - post ROOM dropdown
fn cfm_build_rm(body: Vec<u8>) -> Vec<u8> {
    let mut final_dirs: Vec<String> = Vec::new();

    // Check for CFM_Code Directory
    if dir_exists(CFM_DIR) {
    }

    // Prep buffer into Room List Request Struct
    //     - building
    let tmp = String::from_utf8(body).expect("CamCode Err, invalid UTF-8");
    let cfm_rms: CFMRoomRequest = serde_json::from_str(&tmp)
        .expect("Failed to build CamCode Room Request Struct");

    // Build Directory
    let mut path = String::from(CFM_DIR);
    path.push('/');
    path.push_str(&cfm_rms.building);

    let cfm_room_dirs = get_dir_contents(&path);
    let cut_index = CFM_DIR.len() + cfm_rms.building.len();
    for (_, &ref item) in cfm_room_dirs.iter().enumerate() {
        if (&item[(cut_index + 2)..]).to_string().starts_with('_') {
            continue; // ignore folders starting with '_'
        } else if is_this_file(&item) {
            continue; // ignore files
        }
        else {
            final_dirs.push((&item[(cut_index + 1)..]).to_string());
        }
    };

    // return file
    let json_return = json!({
        "rooms": final_dirs
    });

    return json_return.to_string().into();
}

// get_cfm - generate code (Sends list of files to user)
fn get_cfm(body: Vec<u8>) -> Vec<u8> {
    // crestron file manager request (CFMR)
    //   - building
    //   - rm
    let tmp = String::from_utf8(body).expect("CamCode Err, invalid UTF-8");
    let cfmr: CFMRequest = serde_json::from_str(&tmp)
        .expect("Failed to build cfm request");
    // Check CFM_Code Directory
    if dir_exists(CFM_DIR) {

    }
    
    let cfm_files = find_files(cfmr.building, cfmr.rm);

    // return file
    let json_return = json!({
        "names": cfm_files
    });

    return json_return.to_string().into();
}


// get_cfm_file() - sends the selected file to the client
// TODO:
//    [ ] - store selected file as bytes ?
//    [ ] - send in json as usual ?
fn get_cfm_file(body: Vec<u8>) -> String {
    let tmp = String::from_utf8(body).expect("CamCode Err, invalid UTF-8");
    //
    let cfmr_f: CFMRequestFile = serde_json::from_str(&tmp)
        .expect("CamCode Err, Failed to grab file");
    
    if dir_exists(CFM_DIR) {
        // Error handling that never got implemented?
    }

    // build_path
    // Path within repo
    let mut path_repo: String = String::from("/CFM_Code");
    path_repo.push_str(&cfmr_f.filename);

    // Full Path
    let mut path_raw: String = String::from(CFM_DIR);
    path_raw.push_str(&cfmr_f.filename);


    // Check for file
    if dir_exists(&path_raw) {
        // Error handling?
    }

    return path_raw.to_string();
}

// get_cfm_dir() - sends the selected file to the client
// TODO:
//    [ ] - store selected file as bytes ?
//    [ ] - send in json as usual ?
fn get_cfm_dir(body: Vec<u8>) -> Vec<u8> {
    // RequstFile
    //    - filename
    let mut strings = Vec::new();
    //
    let tmp = String::from_utf8(body).expect("CamCode Err, invalid UTF-8");
    //
    let cfmr_d: CFMRequestFile = serde_json::from_str(&tmp)
        .expect("CamCode Err, Failed to get dir struct");

    if dir_exists(CFM_DIR) {
        // Error handling
    }

    let mut path = String::from(CFM_DIR);
    path.push_str(&cfmr_d.filename);
    
    if dir_exists(&path) {
        if is_this_dir(&path) {
            strings = get_dir_contents(&path);
        } else {
            strings.push("FAILED, directory is a file".to_string());
            let json_return = json!({"names": strings});
            return json_return.to_string().into();
        }
    }

    // return file
    let json_return = json!({
        "names": strings
    });

    return json_return.to_string().into();
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

fn w_build_articles() -> Vec<u8> {
    // Vars
    let mut article_vec: Vec<String> = Vec::new();

    // Check for CFM_Code Directory
    if dir_exists(WIKI_DIR) {
        // Error handling
    }
    let cfm_dirs = get_dir_contents(WIKI_DIR);
    // iterate over cfm_dirs and snip ../CFM_Code/
    // DO NOT INCLUDE DIRS w/ '_'
    let cut_index = WIKI_DIR.len();
    for (_, &ref item) in cfm_dirs.iter().enumerate() {
        article_vec.push((&item[(cut_index + 1)..]).to_string());
    };
    
    let json_return = json!({
        "names": article_vec
    });

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

#[cfg(test)]
mod tests {
    use super::*;
    use server_lib::models::DB_Key;

    #[test]
    fn test_pad_zero() {
        assert_eq!(pad_zero(String::from("123"), 4), String::from("0123"));
        assert_eq!(pad_zero(String::from("123"), 3), String::from("123"));
        assert_eq!(pad_zero(String::from("123"), 2), String::from("123"));
    }

    #[test]
    fn test_pad() {
        assert_eq!(pad(String::from("test"), 6), String::from("  test"));
        assert_eq!(pad(String::from("test"), 4), String::from("test"));
        assert_eq!(pad(String::from("test"), 3), String::from("test"));
    }

    // This test works great, but cannot be used in GitHub's auto test due to the need for a database connection.
    // Uncomment this test for local testing on DB CRUD operations :)
    /* #[test]
    fn test_db() {
        let dummy_building = DB_Building {
            abbrev: String::from("TEST"),
            name: String::from("TEST"),
            lsm_name: String::from("TEST"),
            zone: -1,
            checked_rooms: 0,
            total_rooms: 0,
        };

        let dummy_room = DB_Room {
            abbrev: String::from("TEST"),
            name: String::from("TEST"),
            checked: "2000-01-01T00:00:00Z".to_string(),
            needs_checked: true,
            gp: false,
            available: false,
            until: String::from("TOMORROW"),
            ping_data: Vec::new(),
            schedule: Vec::new(),
        };

        let dummy_key = DB_Key {
            key_id: String::from("TEST"),
            val: String::from("TEST")
        };

        let dummy_user = DB_User {
            username: String::from("TEST"),
            permissions: 0
        };

        let dummy_data = DB_DataElement {
            key: String::from("TEST"),
            val: String::from("TEST")
        };

        let mut db = Database::new();

        let _ = match db.get_building_by_abbrev(&String::from("TEST")) {
            Ok(_) => panic!("BUILDING FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_room_by_name(&String::from("TEST")) {
            Ok(_) => panic!("ROOM FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_key(&String::from("TEST")) {
            Ok(_) => panic!("KEY FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_user(&String::from("TEST")) {
            Ok(_) => panic!("USER FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_data(&String::from("TEST")) {
            Ok(_) => panic!("DATA FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = db.update_building(&dummy_building).expect("BUILDING UPDATE FAILED");
        let _ = db.update_room(&dummy_room).expect("ROOM UPDATE FAILED");
        let _ = db.update_key(&dummy_key).expect("KEY UPDATE FAILED");
        let _ = db.update_user(&dummy_user).expect("USER UPDATE FAILED");
        let _ = db.update_data(&dummy_data).expect("DATA UPDATE FAILED");

        let _ = db.get_building_by_abbrev(&String::from("TEST")).expect("NO BUILDING FETCHED");
        let _ = db.get_room_by_name(&String::from("TEST")).expect("NO ROOM FETCHED");
        let _ = db.get_key(&String::from("TEST")).expect("NO KEY FETCHED");
        let _ = db.get_user(&String::from("TEST")).expect("NO USER FETCHED");
        let _ = db.get_data(&String::from("TEST")).expect("NO DATA FETCHED");

        let dummy_building2 = DB_Building {
            abbrev: String::from("TEST"),
            name: String::from("TEST2"),
            lsm_name: String::from("TEST"),
            zone: -1,
            checked_rooms: 0,
            total_rooms: 0,
        };

        let dummy_room2 = DB_Room {
            abbrev: String::from("TEST"),
            name: String::from("TEST"),
            checked: "2000-01-01T00:00:00Z".to_string(),
            needs_checked: true,
            gp: false,
            available: false,
            until: String::from("TOMORROW2"),
            ping_data: Vec::new(),
            schedule: Vec::new(),
        };

        let dummy_key2 = DB_Key {
            key_id: String::from("TEST"),
            val: String::from("TEST2")
        };

        let dummy_user2 = DB_User {
            username: String::from("TEST"),
            permissions: -1
        };

        let dummy_data2 = DB_DataElement {
            key: String::from("TEST"),
            val: String::from("TEST2")
        };

        let _ = db.update_building(&dummy_building2).expect("BUILDING UPDATE FAILED.");
        let _ = db.update_room(&dummy_room2).expect("ROOM UPDATE FAILED.");
        let _ = db.update_key(&dummy_key2).expect("KEY UPDATE FAILED.");
        let _ = db.update_user(&dummy_user2).expect("USER UPDATE FAILED.");
        let _ = db.update_data(&dummy_data2).expect("DATA UPDATE FAILED.");

        let _ = db.delete_room(&String::from("TEST")).expect("ROOM DELETION FAILED.");
        let _ = db.delete_building(&String::from("TEST")).expect("BUILDING DELETION FAILED.");
        let _ = db.delete_key(&String::from("TEST")).expect("KEY DELETION FAILED.");
        let _ = db.delete_user(&String::from("TEST")).expect("USER DELETION FAILED.");
        let _ = db.delete_data(&String::from("TEST")).expect("DATA DELETION FAILED.");

        let _ = match db.get_building_by_abbrev(&String::from("TEST")) {
            Ok(_) => panic!("BUILDING FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_room_by_name(&String::from("TEST")) {
            Ok(_) => panic!("ROOM FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_key(&String::from("TEST")) {
            Ok(_) => panic!("KEY FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_user(&String::from("TEST")) {
            Ok(_) => panic!("USER FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

        let _ = match db.get_data(&String::from("TEST")) {
            Ok(_) => panic!("DATA FETCHED WHEN NONE EXPECTED"),
            Err(_) => ()
        };

    } */
}