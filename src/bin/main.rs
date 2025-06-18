/*                _                  
                 (_)                 
  _ __ ___   __ _ _ _ __    _ __ ___ 
 | '_ ` _ \ / _` | | '_ \  | '__/ __|
 | | | | | | (_| | | | | |_| |  \__ \
 |_| |_| |_|\__,_|_|_| |_(_)_|  |___/         


Backend
    - main()
    - handle_connection(stream: TcpStream, cookie_jar: Arc<Jar>, buildings: HashMap) -> Option
    - process_buffer(buffer: mut [u8]) -> String
    - find_enclosed(s: String, delimeters: (char,char), include_delim: bool) -> String

JackNet
    - execute_ping(body: Vec<u8>) -> String

ChkrBrd
    - construct_headers(call_type: &str, keys: Keys) -> HeaderMap
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
    Keys,
    ThreadPool, PingRequest, 
    Room, Building, ZoneRequest, 
    CFMRequest, CFMRoomRequest, CFMRequestFile, 
    jp::{ ping_this, },
    ZONE_1, ZONE_1_SHORT, ZONE_2, ZONE_2_SHORT, ZONE_3, ZONE_3_SHORT, ZONE_4, ZONE_4_SHORT, ABBREV_TO_NAME,
    CFM_DIR, WIKI_DIR, ROOM_CSV, CAMPUS_CSV, KEYS,
    Request, Response, STATUS_200, STATUS_303, STATUS_404,
};
use getopts::Options;
use std::{
    str, env,
    io::{ prelude::*, Read, stdout, },
    net::{ TcpStream, TcpListener, },
    fs::{
        read_dir, metadata,
        File,
    },
    time::{ Duration, SystemTime },
    string::{ String, },
    clone::{ Clone, },
    option::{ Option, },
    collections::{ HashMap, },
};
use reqwest::{ 
    header::{ HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, ACCEPT, }
};
use log::{ debug, info, }; // error, trace, warn, };
use cookie::{ Cookie, };
use csv::{ Reader, };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use regex::Regex;
use chrono::{ Datelike, offset::Local, Weekday, DateTime, TimeDelta };
use urlencoding::decode;
// ----------------------------------------------------------------------------

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

    // get keys
    let key_file = File::open(KEYS)
        .expect("[-] FILE_ERR: Could not open.");
    let keys: Keys = serde_json::from_reader(key_file)
        .expect("[-] PARSE_ERR: Could not parse into struct.");

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
        init_logger("debug")?;
    } else {
        init_logger("info")?;
    }

    // generate rooms HashMap
    let buildings = gen_building_map();
    
    // set TcpListener and initalize
    // ------------------------------------------------------------------------
    let host_ip: &str;
    let mut host_port = 7878;
    let local_ip_addr = &(local_ip().unwrap().to_string());
    if matches.opt_present("p") {
        info!("[#] -- You are running using public IP --");
        host_ip = local_ip_addr;
    } else {
        info!("[#] -- You are running using localhost --");
        host_ip = "127.0.0.1";
    }

    while let Err(_e) = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())) {
        host_port += 1;
    }
    let listener = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())).unwrap();

    info!("[!] ... {}:{} ...", host_ip, host_port.to_string());
    debug!("Server mounted!");

    let pool = ThreadPool::new(6);

    // ----------------------------------------------------------------------
    stdout().flush().unwrap();

    for stream in listener.incoming() {
        let stream = stream.unwrap();
        let clone_bldg = buildings.clone();
        let clone_keys = keys.clone();

        pool.execute(move || {
            handle_connection(stream, clone_bldg, clone_keys);
        });
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

fn gen_building_map() -> HashMap<String, Building> {
    let room_filter = Regex::new(r"^[A-Z]+ [0-9A-Z]+$").unwrap();
    let abbrev_map: HashMap<String, Vec<String>> = {
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        for entry in ABBREV_TO_NAME {
            map.insert(String::from(entry.0), vec![String::from(entry.1), String::from(entry.2)]);
        }
        map
    };

    let mut schedules: HashMap<String, Vec<String>> = HashMap::new();
    let schedule_data = File::open(ROOM_CSV).unwrap();
    let mut schedule_rdr = Reader::from_reader(schedule_data);
    for result in schedule_rdr.records() {
        let record = result.unwrap();
        if room_filter.is_match(record.get(0).expect("Empty")) {
            let room = String::from(record.get(0).expect("Empty"));
            let mut schedule = Vec::new();
            for block in 1..8 {
                if record.get(block).expect("Empty") == "" {
                    break;
                }

                schedule.push(String::from(record.get(block).expect("Empty")));
            }

            schedules.insert(room, schedule);
        }
    }

    let mut buildings: HashMap<String, Building> = HashMap::new();
    let room_data = File::open(CAMPUS_CSV).unwrap();
    let mut room_rdr = Reader::from_reader(room_data);
    for result in room_rdr.records() {
        let record = result.unwrap();
        let room_name = record.get(0).expect("Empty");
        if room_filter.is_match(room_name) {
            let mut item_vec: Vec<u8> = Vec::new();
            for i in 1..7 {
                item_vec.push(record.get(i).expect("-1").parse().unwrap());
            }

            let schedule = match schedules.get(&String::from(room_name)) {
                Some(x) => x.clone(),
                _       => Vec::<String>::new(),
            };
            let hn_vec = gen_hn(String::from(room_name), item_vec.clone());
            let ip_vec = gen_ip(item_vec);

            let room = Room {
                name: String::from(room_name),
                hostnames: hn_vec,
                ips: ip_vec,
                gp: record.get(7).expect("-1").parse().unwrap(),
                //checked: String::from("2000-01-01"), // Switched this to DateTime Friendly
                checked: String::from("2000-01-01T00:00:00Z"),
                needs_checked: 1,
                schedule: schedule.to_vec(),
                available: 0,
                until: String::from("Tomorrow")
            };

            let bldg_abbrev = String::from(room_name.split(" ").collect::<Vec<_>>()[0]);
            let mut building = match buildings.get(&bldg_abbrev) {
                Some(x) => x.clone(),
                _       => Building {
                            name: abbrev_map.get(&bldg_abbrev).unwrap()[0].clone(),
                            lsm_name: abbrev_map.get(&bldg_abbrev).unwrap()[1].clone(),
                            abbrev: bldg_abbrev.clone(),
                            rooms: Vec::<Room>::new()
                        },
            };

            building.rooms.push(room);
            buildings.insert(bldg_abbrev, building.clone());
        }
    }

    //debug!("{:?}", buildings);

    return buildings;
}

#[tokio::main]
#[allow(unused_assignments)]
async fn handle_connection(
    mut stream: TcpStream,
    mut buildings: HashMap<String, Building>,
    keys: Keys,
) -> Option<()> {
    let mut buffer = [0; 1024];

    stream.read(&mut buffer).unwrap();
    
    let mut user_homepage: &str = "html-css-js/login.html";
    let req = Request::build(buffer.clone());
    let mut res: Response = Response::new();
    if req.headers.contains_key("Cookie") {
        let username_search = Regex::new("user=(?<username>admin|guest)").unwrap();
        let Some(username) = username_search.captures(&req.headers.get("Cookie").unwrap()) else { panic!("Empty") };
        if &username["username"] == "admin" {
            user_homepage = "html-css-js/index_admin.html";
        } else {
            user_homepage = "html-css-js/index.html"
        }
    }

    // Handle requests
    // ------------------------------------------------------------------------

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
        // Data Requests
        "GET /campus.json HTTP/1.1"        => {
            res.status(STATUS_200);
            res.send_file("data/campus.json");
        },
        "POST /zoneData HTTP/1.1" => { // NEW: returns data in lib.rs as json
            let contents = get_zone_data();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
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
        // Terminal
        // --------------------------------------------------------------------
        "GET /refresh/all HTTP/1.1"     => {
            let contents = json!({
                "body": "[+] All updated successfully."
            }).to_string().into();
            buildings = gen_building_map();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /refresh/threads HTTP/1.1" => {
            let contents = json!({
                "body": "[!] Feature not implemented."
            }).to_string().into();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /refresh/map HTTP/1.1"     => {
            let contents = json!({
                "body": "[+] Map updated successfully."
            }).to_string().into();
            buildings = gen_building_map();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "GET /get/PLACEHOLDER HTTP/1.1" => {
            debug!("test!");
            debug!("{:?}", req.body);
            res.status(STATUS_200);
            res.send_contents("".into());
        },
        "GET /get/log HTTP/1.1"         => {
            let mut f = File::open("/home/beth-c137/Desktop/UWIT/bronson_online/output.log").unwrap();
            
            let mut file_buffer = Vec::new();
            f.read_to_end(&mut file_buffer).unwrap();

            res.status(STATUS_200);
            res.insert_header("Content-Type", "application/zip");
            let filename = "attachment; filename=output.log";
            res.insert_header("Content-Disposition", &filename);
            res.send_contents(file_buffer);
        },
        "POST /add/user HTTP/1.1"       => {
            
        }      
        // --------------------------------------------------------------------
        // make calls to backend functionality
        // --------------------------------------------------------------------
        // login
        "POST /login HTTP/1.1"          => {
            let credential_search = Regex::new(r"uname=(?<user>.*)&psw=(?<pass>[\d\w%]*)").unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return Option::Some(()) };
            let user = String::from(credentials["user"].to_string().into_boxed_str());
            let pass = String::from(credentials["pass"].to_string().into_boxed_str());
            let mut found_user: bool = false;
            for credential in keys.users {
                if user == credential[0] && pass == credential[1] {
                    found_user = true;
                    let cookie;
                    if user == "admin" {
                        cookie = Cookie::build(("user","admin"));
                        user_homepage = "html-css-js/index_admin.html";
                    } else {
                        cookie = Cookie::build(("user","guest"));
                        user_homepage = "html-css-js/index.html";
                    }
                    res.insert_header("Set-Cookie", cookie.to_string().as_str());
                    res.insert_header("Access-Control-Expose-Headers", "Set-Cookie");
                    res.status(STATUS_303);
                    res.send_file(user_homepage);
                    break;
                }
            }
            if !found_user {
                res.status(STATUS_200);
                res.send_file(user_homepage);
            }
        },
        "POST /bugreport HTTP/1.1"      => {
            let credential_search = Regex::new(r#"title=(?<title>.*)&desc=(?<desc>.*)"#).unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&req.body).expect("Empty")) else { return Option::Some(()) };
            let encoded_title = String::from(credentials["title"].to_string().into_boxed_str());
            let mut encoded_desc = String::from(credentials["desc"].to_string().into_boxed_str());
            if encoded_desc == String::from("") {
                encoded_desc = encoded_title.clone();
            }
            let mut decoded_title = decode(&encoded_title).expect("UTF-8");
            let mut decoded_desc = decode(&encoded_desc).expect("UTF-8");
            decoded_title = decoded_title.replace("+", " ").into();
            decoded_desc = decoded_desc.replace("+", " ").into();
            decoded_desc = decoded_desc.replace("\0", "").into();
            let mut arg_map = HashMap::new();
            arg_map.insert("title", decoded_title);
            arg_map.insert("body", decoded_desc);

            let clone_keys = keys.clone();
            let url = "https://api.github.com/repos/UWIT-CTS-Software/bronson_online/issues";
            let req = reqwest::Client::builder()
                .cookie_store(true)
                // .cookie_provider(Arc::clone(&cookie_jar))
                .user_agent("server_lib/1.1.0")
                .default_headers(construct_headers("gh", clone_keys))
                .timeout(Duration::from_secs(15))
                .build()
                .ok()?
            ;

            let _body = req.post(url)
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
        "POST /ping HTTP/1.1"           => {
            let contents = execute_ping(req.body, buildings); // JN
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        // Checkerboard
        "POST /run_cb HTTP/1.1"         => {
            //// --- REWRITE OF RUN_CB, NOW TAKES ONE BUILDING ABBREVIATION ---
            // get zone selection from request and store
            // ----------------------------------------------------------------
            let tmp = String::from_utf8(req.body.clone()).expect("CamCode Err, invalid UTF-8");
            let building_sel = tmp.trim_matches(char::from(0));
            // An Abbreviaition 
            //let building_selection: String = serde_json::from_str(tmp)
            //    .expect("Failed to build zone request struct");
            debug!("Checkerboard Debug: building selection {:?}", building_sel);
            // ----------------------------------------------------------------
            // call for roomchecks in LSM and store
            // ----------------------------------------------------------------
            let mut return_body: Vec<Building> = Vec::new();
            let clone_keys = keys.clone();
            // attempt to fix buildings.get
            let building_LSMName: &str = &mut buildings.get_mut(building_sel)
                .unwrap()
                .lsm_name
                .as_str();
            debug!("Checkerboard Debug - building LSM Name:\n{:?}",building_LSMName);
            let url = format!(
                r"https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last30days%22%2CParentLocation%3A%22{}%22%7D", 
                building_LSMName
            );
            let req = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("server_lib/1.1.0")
                .default_headers(construct_headers("lsm", clone_keys))
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
                let num_entries = v["count"].as_i64().unwrap();
                let checks: &mut Vec<Value> = &mut v["data"].as_array().unwrap().to_vec();
                checks.reverse();
                for i in 0..num_entries {
                    let check = checks[i as usize].as_object().unwrap();
                    check_map.insert(String::from(check["LocationName"].as_str().unwrap()), String::from(check["CompletedOn"].as_str().unwrap()));
                }
            }

            for room in &mut buildings.get_mut(building_sel).unwrap().rooms {
                if check_map.contains_key(&room.name) {
                    // checked Date format may need changed here
                    debug!("Checkerboard Debug - checked value: \n{:?}", String::from(check_map.get(&room.name).unwrap()));
                    //room.checked = String::from(check_map.get(&room.name).unwrap().split("T").collect::<Vec<&str>>()[0]);
                    room.checked = String::from(check_map.get(&room.name).unwrap());
                    debug!("Checkerboard Debug - Room struct: \n{:?}", room.clone());
                    room.needs_checked = check_lsm(room.clone());
                }
                let schedule_params = check_schedule(room.clone());
                room.available = schedule_params.0;
                room.until = schedule_params.1;
            }

            return_body.push(buildings.get(building_sel).unwrap().clone());
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
        "POST /cfm_build HTTP/1.1"      => {
            let contents = cfm_build_dir();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_build_r HTTP/1.1"    => {
            let contents = cfm_build_rm(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_c_dir HTTP/1.1"      => {
            let contents = get_cfm(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_dir HTTP/1.1"        => {
            let contents = get_cfm_dir(req.body);
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        "POST /cfm_file HTTP/1.1"       => {
            let contents = get_cfm_file(req.body);
            let mut f = File::open(contents.clone()).unwrap();
            
            let mut file_buffer = Vec::new();
            f.read_to_end(&mut file_buffer).unwrap();

            res.status(STATUS_200);
            res.insert_header("Content-Type", "application/zip");
            let filename = format!("attachment; filename={}", contents);
            res.insert_header("Content-Disposition", &filename);
            res.send_contents(file_buffer);
        },
        // Wiki
        "POST /w_build HTTP/1.1"        => {
            let contents = w_build_articles();
            res.status(STATUS_200);
            res.send_contents(contents);
        },
        &_                              => {
            res.status(STATUS_404);
            res.send_file("html-css-js/404.html");
        }
    };
    
    stream.write(&res.build()).unwrap();
    stream.flush().unwrap();
    stdout().flush().unwrap();
    return Option::Some(());
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

fn get_zone_data() -> Vec<u8> {
    let json_return = json!({
        "zones":[ 
                {
                    "name": 1,
                    "building_list": ZONE_1_SHORT, 
                },
                {
                    "name": 2,
                    "building_list": ZONE_2_SHORT,
                },
                {
                    "name": 3,
                    "building_list": ZONE_3_SHORT,
                },
                {
                    "name": 4,
                    "building_list": ZONE_4_SHORT,
                }
            ]
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

TO-DO:
   [ ] - Consider returning a building as follows
        [[[room1-proc],[room1-pj1,room1-pj2],[],[room1-tp]],
        [[room2-proc],[],[room2-disp1, room2-disp2],[room2-tp]]]
          The hashmap will utilize this structure to some extent. 
          The structure of this return is important.
          It is currently returning a massive list of every hostname
          and ip within a building. This will turn it into a nested
          vector of nested vectors. The front-end (jacknet.js) is
          not written to handle this structure and will need
          to be able to.
*/
// call ping_this executible here
fn execute_ping(body: Vec<u8>, mut buildings: HashMap<String, Building>) -> Vec<u8> {
    let tmp = String::from_utf8(body.clone()).expect("Err, invalid UTF-8");
    let tmp = tmp.trim_matches(char::from(0));
    debug!("JacknetClientRequest: {:?}", tmp);
    // Prep Request into Struct
    let pr: PingRequest = serde_json::from_str(tmp)
        .expect("Fatal Error 2: Failed to parse ping request");

    debug!("JacknetPingRequest: {:?}", pr);
    // BuildingData Struct
    //   NOTE: CAMPUS_CSV -> "html-css-js/campus.csv"
    //         CAMPUS_STR -> "html-css-js/campus.json" 

    let rooms_to_ping: &mut Vec<Room> = &mut buildings.get_mut(&pr.building.clone()).unwrap().rooms;
    let mut hn_ips: Vec<Vec<String>> = Vec::new();

    for rm in 0..rooms_to_ping.len() {
        let dev_map; 
        if pr.devices.iter().sum::<u8>() == 0 {
            dev_map = vec![1,1,1,1,1,1];
        } else {
            dev_map = pr.devices.clone();
        }
        for hn_group in 0..rooms_to_ping[rm].hostnames.len() { // make this ping
            hn_ips.push(Vec::new());
            if dev_map[hn_group] == 0 {
                continue;
            }
            for hn in &rooms_to_ping[rm].hostnames[hn_group] {
                let hn_ip = ping_this(hn.to_string());
                hn_ips[hn_group].push(hn_ip);
            }
        }
        
        rooms_to_ping[rm].ips = hn_ips;
        hn_ips = Vec::new();
    }

    buildings.get_mut(&pr.building.clone()).unwrap().rooms = rooms_to_ping.to_vec();

    let json_return = json!({
        "jn_body": buildings.get(&pr.building.clone()).unwrap(),
    });
    // Return JSON with ping results
    return json_return.to_string().into();
}

// Generate Hostnames
//    Nov. 5 Revision Paradigm Shift -> genHost @ database init
//      room_name -> "AN 104"
//      item_vec  -> "[0,1,2,3,4]" 
//          "[ Proc , Pj , Disp , Ws , Tp ]"
fn gen_hn(
    room_name: String, 
    item_vec: Vec<u8>
) -> Vec<Vec<String>> {
    let mut hostnames = Vec::new();
    let mut tmp_hn    = String::new();
    let parts: Vec<&str> = room_name.split(" ").collect();
    // let building_prefix = parts[0];
    // let room_number     = parts[1];

    // Assemble the hostname here
    for i in 0..6 {
        let dev_type = match i {
            0 => "PROC",
            1 => "PROJ",
            2 => "DISP",
            3 => "WS",
            4 => "TP",
            5 => "CMICX",
            _ => "ERROR"
        };

        hostnames.push(Vec::new());
        for j in 0..item_vec[i] {
            tmp_hn.push_str(parts[0]);
            tmp_hn.push('-');
            tmp_hn.push_str(parts[1]);
            tmp_hn.push('-');
            tmp_hn.push_str(dev_type);
            tmp_hn.push(char::from_digit((j+1).into(), 10).expect("digit bad idk"));
            hostnames[i].push(tmp_hn);
            tmp_hn = String::new();
        };
    };
    return hostnames;
}

// helper function for packing x's into the hashmap on init
fn gen_ip(item_vec: Vec<u8>) -> Vec<Vec<String>> {
    let mut ips = Vec::new();
    let mut ip_groups = Vec::new();
    for i in item_vec {
        for _ in 0..i {
            ips.push("x".to_string());
        }
        ip_groups.push(ips.clone());
        ips = Vec::new();
    };
    return ip_groups;
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

fn construct_headers(call_type: &str, keys: Keys) -> HeaderMap {
    let mut header_map = HeaderMap::new();
    if call_type == "lsm" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&keys.lsm_api).expect("[-] KEY_ERR: Not found."));
    } else if call_type == "gh" {
        header_map.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
        header_map.insert(AUTHORIZATION, HeaderValue::from_str(&keys.gh_api).expect("[-] KEY_ERR: Not found."));
        header_map.insert(HeaderName::from_static("x-github-api-version"), HeaderValue::from_static("2022-11-28"));
    }

    return header_map;
}

fn check_schedule(room: Room) -> (u8, String) {
    let mut available: u8 = 1;
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

    let hours: u16 = time["hours"].parse().unwrap();
    let minutes: u16 = time["minutes"].parse().unwrap();
    let adjusted_time: u16 = (hours * 100) + minutes;
    
    for block in &room.schedule {
        let block_vec: Vec<&str> = block.split(&[' ', '-']).collect();
        let adjusted_start: u16 = block_vec[1].parse().unwrap();
        let adjusted_end: u16 = block_vec[2].parse().unwrap();
        if block_vec[0].contains(day_of_week) {
            if adjusted_time < adjusted_start {
                available = 1;
                until = pad_zero((adjusted_start % 100).to_string(), 2);
                return (available, until);
            } else if (adjusted_start <= adjusted_time) && (adjusted_time <= adjusted_end) {
                available = 0;
                until = pad_zero((adjusted_end).to_string(), 4);
                return (available, until);
            }
        }
    }

    return (available, until);
}

fn check_lsm(room: Room) -> u8 {
    let needs_checked;
    // Line below produces -> ParseError(TooShort)
    let parsed_checked: DateTime<Local> = room.checked.parse().unwrap();
    let time_diff: TimeDelta = Local::now() - parsed_checked;
    if room.gp == 1 {
        if time_diff.num_seconds() >= 604800 {
            needs_checked = 1;
        } else {
            needs_checked = 0;
        }
    } else {
        if time_diff.num_days() >= 30 {
            needs_checked = 1;
        } else {
            needs_checked = 0;
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
    let paths = read_dir(&path).unwrap();
    for p in paths {
        strings.push(p.unwrap().path().display().to_string());
    }

    return strings;
}

fn get_origin(body: Vec<u8>) -> String {
    let buff_copy: String = String::from_utf8_lossy(&body).to_string();

    let bytes = buff_copy.as_bytes();
    let mut ir: usize = 0;
    let mut ir_end: usize = 0;

    let mut newline:     bool = false;
    let mut origin_line: bool = false;

    for (i, &item) in bytes.iter().enumerate() {
        if item == b'O'{ // newline isnt real
            newline = true;
        }
        if newline {
            if item == b'r' {
                ir = i;
                origin_line = true;
            }
        }
        if origin_line {
            if item == b'C' {
                ir_end = i;
                return buff_copy[ir+10..ir_end-3].to_string();
            }
        }
    }
    return buff_copy[ir..ir_end].to_string();
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
    let tmp = String::from_utf8(body.clone()).expect("CamCode Err, invalid UTF-8");
    let tmp = tmp.trim_matches(char::from(0));
    //let cfm_rms: CFMRoomRequest = serde_json::from_str(String::from_utf8(body).unwrap().as_str())
    //    .expect("Fatal Error 39: Failed to parse cfm room request.");
    let cfm_rms: CFMRoomRequest = serde_json::from_str(tmp)
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

    //let cfmr: CFMRequest = serde_json::from_str(String::from_utf8(body).unwrap().as_str())
    //    .expect("Fatal Error 3: Failed to parse cfm request");
    let tmp = String::from_utf8(body.clone()).expect("CamCode Err, invalid UTF-8");
    let tmp = tmp.trim_matches(char::from(0));
    let cfmr: CFMRequest = serde_json::from_str(tmp)
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
    // RequstFile
    //    - filename

    // let gr: GeneralRequest = serde_json::from_str(&buff_copy1)
    //     .expect("Fatal Error 49: general Request Failed");
    let _gr_origin: String = get_origin(body.clone());
    //
    let tmp = String::from_utf8(body.clone()).expect("CamCode Err, invalid UTF-8");
    let tmp = tmp.trim_matches(char::from(0));
    //
    let cfmr_f: CFMRequestFile = serde_json::from_str(tmp)
        .expect("CamCode Err, Failed to grab file");
    //let cfmr_f: CFMRequestFile = serde_json::from_str(String::from_utf8(body.clone()).unwrap().as_str())
    //    .expect("Fatal Error 38: failed to parse filename");
    
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
    let tmp = String::from_utf8(body.clone()).expect("CamCode Err, invalid UTF-8");
    let tmp = tmp.trim_matches(char::from(0));
    //
    let cfmr_d: CFMRequestFile = serde_json::from_str(tmp)
        .expect("CamCode Err, Failed to get dir struct");
    //let cfmr_d: CFMRequestFile = serde_json::from_str(String::from_utf8(body).unwrap().as_str())
    //    .expect("Fatal Error 38: failed to parse filename");

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

    #[test]
    fn test_enclosed() {
        assert_eq!(
            find_enclosed(&String::from("(item1 {item2} item3)"), (r"\{",r"}"), true),
            String::from("{item2}")
        );
        assert_eq!(
            find_enclosed(&String::from("(item1 {item2} item3)"), (r"(",r")"), true ),
            String::from("(item1 {item2} item3)")
        );
        assert_eq!(
            find_enclosed(&String::from("item1 {item2} item3"), (r"\{",r"}"), false),
            String::from("item2")
        );
    }
}