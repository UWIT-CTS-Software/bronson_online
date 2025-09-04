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
    ThreadPool, PingRequest, 
    Building, 
    CFMRequest, CFMRoomRequest, CFMRequestFile, 
    jp::{ ping_this, },
    CFM_DIR, WIKI_DIR, /* LOG, */
    Request, Response, STATUS_200, /* STATUS_303, */ STATUS_401, STATUS_404, STATUS_500, 
    Database, Terminal, 
    models::{
        DB_Room, DB_Building, DB_User, DB_DataElement, 
        DB_IpAddress,  
    },
};
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
    time::{ Duration, SystemTime },
    string::{ String, },
    clone::{ Clone, },
    option::{ Option, },
    collections::{ HashMap, },
};
use reqwest::{ 
    header::{ HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, ACCEPT, }
};
use log::{ debug, info, warn, error, }; // trace, };
use cookie::{ /* Cookie, */ CookieJar, /* Key, */ };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use regex::Regex;
use chrono::{ Datelike, offset::Local, Weekday, DateTime, TimeDelta };
use urlencoding::decode;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use diesel::{PgConnection, Connection};
use dotenvy::dotenv;
// ----------------------------------------------------------------------------
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

    let pool = ThreadPool::new(6);
    let mut buffer = [0; BUFF_SIZE];

    // ----------------------------------------------------------------------
    match stdout().flush() {
        Ok(_) => (),
        Err(e) => error!("STDOUT flush failed: {}", e)
    };

    // embed_migrations
    dotenv().ok(); // Load .env file
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let mut connection = PgConnection::establish(&database_url)
        .expect("Error Connecting to Database");
    connection.run_pending_migrations(MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;

    let mut database = Database::new();
    database.init_if_empty();

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
        let clone_db = database.clone();

        pool.execute(move || {
            let mut res = handle_connection(req, clone_db).unwrap();
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

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{} {} {}] {}",
                humantime::format_rfc3339_seconds(SystemTime::now()),
                record.level(),
                record.target(),
                message
            ))
        })
        .level(log_filter)
        .chain(stdout())
        .chain(fern::log_file("output.log")?)
        .apply()?;
    
    return Ok(());
}

#[tokio::main]
#[allow(unused_assignments)]
async fn handle_connection(
    mut req: Request,
    mut database: Database,
) -> Option<Response> {    
    let mut user_homepage: &str = "html-css-js/login.html";
    if req.headers.contains_key("Cookie") {
        let username_search = Regex::new("^(?<username>.*)=(?<key>.*=.*)").unwrap();
        let username = match username_search.captures(&req.headers.get("Cookie").unwrap()) {
            Some(uname) => uname,
            None => panic!("Unable to capture username.")
        };
        let user = match database.get_user(&username["username"]) {
            Some(u) => u,
            None => DB_User{ username: String::new(), permissions: 0 },
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
            let contents = database.get_data("schedule").val.into();
            res.status(STATUS_200);
            //res.send_file("data/techSchedule.json");
            res.send_contents(contents);
        },
        "GET /campusData HTTP/1.1"         => {
            let contents = json!(&database.get_campus()).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /zoneData HTTP/1.1"           => { // NEW: returns data in lib.rs as json
            let contents = get_zone_data(database.get_buildings());
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /dashContents HTTP/1.1"       => {
            let contents = json!({
                "contents": database.get_data("dashboard").val
            }).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // "GET /dashboard/checker"           => { // Returns zone checked. NOTE: trying method of including information in the ZoneData
        //     // Get Room Counts
        //     let contents = json!({
        //         "contents": database.get_data("dashchecker").val
        //     }).to_string().into();
        //     res.status(STATUS_200);
        //     res.send_contents(contents);
        // }
        "GET /leaderboard HTTP/1.1"        => {
            let url_7_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D";
            let url_30_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last30days%22%7D";
            let url_90_days = "https://uwyo.talem3.com/lsm/api/Leaderboard?offset=0&p=%7BCompletedOn%3A%22last90days%22%7D";


            let req = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("lsm", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let body_7_days = req.get(url_7_days)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

            let v_7_days: Value = serde_json::from_str(&body_7_days).expect("Empty");
            let data_7_days: Vec<Value> = match v_7_days["data"].as_array() {
                Some(data) => data.clone(),
                None => Vec::<Value>::new()
            };

            let body_30_days = req.get(url_30_days)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

            let v_30_days: Value = serde_json::from_str(&body_30_days).expect("Empty");
            let data_30_days: Vec<Value> = match v_30_days["data"].as_array() {
                Some(data) => data.clone(),
                None => Vec::<Value>::new()
            };

            let body_90_days = req.get(url_90_days)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

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
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // Testing Spares LSM API Call.
        "GET /spares HTTP/1.1"             => {
            let url_spares = "https://uwyo.talem3.com/lsm/api/Spares?offset=0&p=%7B%7D";
            // Build and Send Request
            let req = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("lsm", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let body_spares = req.get(url_spares)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

            let v_spares: Value = serde_json::from_str(&body_spares).expect("Empty");
            let data_spares: Vec<Value> = match v_spares["data"].as_array() {
                Some(data) => data.clone(),
                None => Vec::<Value>::new()
            };
            // Pack into JSON response to front-end
            let contents = json!({
                 "spares": data_spares
            }).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /updateSchedule HTTP/1.1"        => {
            let new_data = DB_DataElement {
                key: String::from("schedule"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents")
            };
            database.update_data(&new_data);
            res.status(STATUS_200);
            res.send_contents("".into());
        },
        "POST /update/dash HTTP/1.1"       => {
            database.update_data(&DB_DataElement {
                key: String::from("dashboard"),
                val: String::from_utf8(req.body).expect("Unable to parse body contents"),
            });
            res.status(STATUS_200);
            res.send_contents("".into());
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
            let db_user: Option<DB_User> = database.get_user(&user.as_str());
            if db_user.is_some() {
                match &db_user.unwrap().permissions {
                    7 => user_homepage = "html-css-js/index_admin.html",  // admin
                    6 => user_homepage = "html-css-js/index_admin.html", // manager / lead tech
                    0 => user_homepage = "html-css-js/login.html",      // revoked
                    _ => user_homepage = "html-css-js/index.html",     // tech default
                }

            } else {
                user_homepage = "html-css-js/index.html";
            }

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
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return Option::Some(res) };
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
        "POST /ping HTTP/1.1"              => {
            let contents = execute_ping(req.body, database); // JN
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // Checkerboard
        "POST /run_cb HTTP/1.1"            => {
            // get zone selection from request and store
            // ----------------------------------------------------------------
            let building_sel = String::from_utf8(req.body).expect("CheckerBoard Err, invalid UTF-8");
            // call for roomchecks in LSM and store
            // ----------------------------------------------------------------
            let mut return_body: Vec<Building> = Vec::new();
            let lsm_building = database.get_building_by_abbrev(&building_sel);
            debug!("Checkerboard Debug - building LSM Name:\n{:?}", &lsm_building.lsm_name.as_str());
            let url = format!(
                r"https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last30days%22%2CParentLocation%3A%22{}%22%7D", 
                &lsm_building.lsm_name.as_str()
            );
            let req = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.10.1")
                .default_headers(construct_headers("lsm", &mut database))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let body = req.get(url)
                              .timeout(Duration::from_secs(15))
                              .send()
                              .await
                              .expect("[-] RESPONSE ERROR")
                              .text()
                              .await
                              .expect("[-] PAYLOAD ERROR");

            let v: Value = serde_json::from_str(&body).expect("Empty");
            let mut check_map: HashMap<String, String> = HashMap::new();
            if v["count"].as_i64() > Some(0) {
                let num_entries = match v["count"].as_i64() {
                    Some(num) => num,
                    None => 0
                };
                let checks: &mut Vec<Value> = match &mut v["data"].as_array() {
                    Some(data) => &mut data.clone(),
                    None => {
                        error!("Unable to get API data as vec.");
                        &mut Vec::<Value>::new()
                    }
                };
                checks.reverse();
                for i in 0..num_entries {
                    let check = checks[i as usize].as_object().unwrap();
                    check_map.insert(
                        String::from(check["LocationName"].as_str().unwrap()), 
                        String::from(check["CompletedOn"].as_str().unwrap())
                    );
                }
            }

            // TODO: get checked_rooms
            // let checked_rooms: i16 = v["count"].as_i64().unwrap().try_into().unwrap();
            let mut checked_rooms: i16 = 0;
            for mut room in database.get_rooms_by_abbrev(&building_sel) {
                if check_map.contains_key(&room.name) {
                    // checked Date format may need changed here
                    room.checked = String::from(match check_map.get(&room.name) {
                        Some(r) => r,
                        None => {
                            warn!("Unable to fetch room, defaulting.");
                            "2000-01-01T00:00:00Z"
                        }
                    });
                    room.needs_checked = check_lsm(&room);
                }
                let schedule_params = check_schedule(&room);
                room.available = schedule_params.0;
                room.until = schedule_params.1;
                // Check for room check
                if !room.needs_checked {
                    checked_rooms += 1;
                }
                database.update_room(&room);
            }
            let ret_building = database.get_building_by_abbrev(&building_sel);
            let ret_rooms = database.get_rooms_by_abbrev(&ret_building.abbrev);
            // TODO: Get number of Checked and Total Number of rooms.
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
            database.update_building(&new_building);

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
            // ----------------------------------------------------------------

            // parse rooms map to load statuses for return
            // ----------------------------------------------------------------

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

 - execute_ping()
 - gen_hn()
 - gen_ip()
 - gen_rooms()

*/

/*
execute_ping()
--
NOTE: CAMPUS_CSV -> "html-css-js/campus.csv"
      CAMPUS_STR -> "html-css-js/campus.json"
*/
// call ping_this executible here
fn execute_ping(body: Vec<u8>, mut database: Database) -> Vec<u8> {
    let tmp = String::from_utf8(body).expect("Err, invalid UTF-8");
    debug!("JacknetClientRequest: {:?}", tmp);
    // Prep Request into Struct
    let pr: PingRequest = serde_json::from_str(&tmp)
        .expect("Fatal Error 2: Failed to parse ping request");

    debug!("JacknetPingRequest: {:?}", pr);
    // BuildingData Struct
    //   NOTE: CAMPUS_CSV -> "html-css-js/campus.csv"
    //         CAMPUS_STR -> "html-css-js/campus.json" 

    let rooms_to_ping: Vec<DB_Room> = database.get_rooms_by_abbrev(&pr.building);

    for rm in rooms_to_ping {
        std::thread::scope(|s| {
            s.spawn(|| {
                let mut room = rm.clone();
                room.ping_data = ping_room(room.ping_data);
                database.update_room(&room);
            });
        });
    }

    let json_return = json!({
        "jn_body": database.get_rooms_by_abbrev(&pr.building),
    });
    // Return JSON with ping results
    return json_return.to_string().into();
}

fn ping_room(net_elements: Vec<Option<DB_IpAddress>>) -> Vec<Option<DB_IpAddress>> {
    let mut pinged_hns: Vec<Option<DB_IpAddress>> = Vec::new();
    for net in net_elements {
        let hn_string: String = net.as_ref().unwrap().hostname.to_string();
        pinged_hns.push(Some(
            DB_IpAddress {
                hostname: net.unwrap().hostname,
                ip: ping_this(&hn_string)
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
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&database.get_key("lsm_api").val).expect("[-] KEY_ERR: Not found."));
    } else if call_type == "gh" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&database.get_key("gh_api").val).expect("[-] KEY_ERR: Not found."));
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
}