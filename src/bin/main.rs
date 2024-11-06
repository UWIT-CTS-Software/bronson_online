/*                _                  
                 (_)                 
  _ __ ___   __ _ _ _ __    _ __ ___ 
 | '_ ` _ \ / _` | | '_ \  | '__/ __|
 | | | | | | (_| | | | | |_| |  \__ \
 |_| |_| |_|\__,_|_|_| |_(_)_|  |___/         


Backend
    - main()
    - clone_map(source: HashMap) -> HashMap
    - handle_connection(stream: TcpStream, cookie_jar: Arc<Jar>, rooms: HashMap) -> Option
    - process_buffer(buffer: mut [u8]) -> String
    - find_enclosed(s: String, delimeters: (char,char), include_delim: bool) -> String
    - print_type_of<T>(_: &T)

JackNet
    - execute_ping(buffer: mut [u8]) -> String
    - gen_hostnames(sel_devs: Vec<String?, sel_b: String, bd: BuildingData) -> Vec<String>

ChkrBrd
    - construct_headers() -> HeaderMap
    - check_schedule(room: Room) -> String
    - check_lsm(room: Room) -> String

CamCode
-- Helpers ------------------------------
    - dir_exists(path: &str) -> bool
    - is_this_file(path: &str) -> bool
    - is_this_dir(path: &str) -> bool
    - find_files(building: String, rm: String) -> Vec<String>
    - get_dir_contents(path: &str) -> Vec<String>
    - get_origin(buffer: mut [u8]) -> String
-- Handlers -----------------------------
    - cfm_build_dir(buffer: mut [u8]) -> String
    - cfm_build_rm(buffer: mut [u8]) -> String
    - get_cfm(buffer: mut [u8]) -> String
    - get_cfm_file(buffer: mut [u8]) -> String
    - get_cfm_dir(buffer: mut [u8]) -> String

Wiki
    - w_build_articles(buffer: mut [u8]) -> String
*/

// dependencies
// ----------------------------------------------------------------------------
use server_lib::{
    Keys,
    ThreadPool, BuildingData, PingRequest, 
    Room, ZoneRequest,  
    CFMRequest, CFMRoomRequest, CFMRequestFile, 
    jp::{ ping_this, },
};
use getopts::Options;
use std::{
    str, env,
    io::{ prelude::*, Read, stdout, stdin},
    net::{ TcpStream, TcpListener, },
    fs::{
        read, read_to_string, read_dir, metadata,
        File,
    },
    time::{ Duration, },
    sync::{ Arc, },
    string::{ String, },
    borrow::{ Borrow, },
    clone::{ Clone, },
    option::{ Option, },
    collections::{ HashMap, },
    hash::{ Hash, },
    fmt::{ Debug, },
    convert::{ TryFrom, },
};
use reqwest::{ 
    header::{ HeaderMap, HeaderValue, AUTHORIZATION, ACCEPT, }
};
/* use tokio::sync::{ Semaphore, }; */
use csv::{ Reader, };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use regex::Regex;
use chrono::{ Datelike, offset::Local, Weekday, DateTime, TimeDelta, };
// ----------------------------------------------------------------------------

// define static and const variables
// ----------------------------------------------------------------------------
static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/campus.json"));
static CFM_DIR   : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code");
static WIKI_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/md");
static ROOM_CSV  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/roomConfig_agg.csv");
static CAMPUS_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/campus.csv");
static KEYS      : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/src/keys.json");

/* static PERMIT    : Semaphore = Semaphore::const_new(1);
static ROOMS     : Database = Database::setup(); */

const ZONE_1: [&'static str; 11] = [
    "Science%20Initiative%20Building%20(SI)", "Geology%20(GE)", "Health%20Sciences%20(HS)", 
    "STEM%201st%20Floor", "STEM%202nd%20Floor", "STEM%203rd%20Floor", "Berry%20Center%20(BC)",
    "Engineering%20Education%20and%20Research%20Building%20(EERB)", "Anthropology%20(AN)", 
    "Earth%20Sciences%20Building%20(ESB)", "Energy%20Innovation%20Center%20(EIC)", 
];
const ZONE_2: [&'static str; 8] = [
    "Engineering%20(EN)", "Agriculture%20(AG)", "Education%20(ED)", "History%20(HI)", 
    "Half%20Acre%20(HA)", "Business%20(BU)", "Coe%20Library%20(CL)", "Education%20Annex%20(EA)", 
];
const ZONE_3: [&'static str; 9] = [
    "Physical%20Sciences%20(PS)", "Classroom%20Building%20(CR)", 
    "Arts%20%26%20Sciences%20(AS)", "Aven%20Nelson%20(AV)", "Biological%20Sciences%20(BS)", 
    "Native%20American%20Ed%20Research%20%26%20Culteral%20Center%20(NA)", "Ross%20Hall%20(RH)", 
    "Hoyt%20Hall%20(HO)", "Guthrie%20House%20(GH)", 
];
const ZONE_4: [&'static str; 8] = [
    "IT%20Center%20(ITC)", "Corbett%20(CB)", "Law%20School%20(LS)", "Beta%20House%20(BH)", 
    "Buchanan%20Center%20for%20Performing%20Arts%20(PA)", "Visual%20Arts%20(VA)", 
    "Animal%20Science/Molecular%20Biology%20(AB)", "American%20Heritage%20Center%20(AC)", 
];

const ZONE_1_SHORT: [&'static str; 9] = [
    "SI", "GE", "HS", "STEM", "BC", "EERB", "AN", "ES", "EIC",
];
const ZONE_2_SHORT: [&'static str; 8] = [
    "EN", "AG", "ED", "HI", "HA", "BU", "CL", "EA",
];
const ZONE_3_SHORT: [&'static str; 10] = [
    "PS", "CR", "AS", "AV", "BS", "NAC", "RH", "HO", "GH", "CI" // Add to ZONE_3
];
const ZONE_4_SHORT: [&'static str; 8] = [
    "IT", "CB", "LS", "BH", "PA", "VA", "AB", "AC",
];
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

fn main() {
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
        println!("\rTest\n> ");
    }

    let room_filter = Regex::new(r"^[A-Z]+ [0-9A-Z]+$").unwrap();

    // terminal input stuff
    // ------------------------------------------------------------------------

    let mut terminal_input = String::new();

    stdin().read_line(&mut terminal_input)
        .expect("Failed to Read Line in Terminal Console");
    
    handle_terminal_in(terminal_input);

    // generate rooms HashMap
    // ------------------------------------------------------------------------
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
    let mut rooms: HashMap<String, Room> = HashMap::new();
    let room_data = File::open(CAMPUS_CSV).unwrap();
    let mut room_rdr = Reader::from_reader(room_data);
    for result in room_rdr.records() {
        let record = result.unwrap();
        if room_filter.is_match(record.get(0).expect("Empty")) {
            let mut item_vec: Vec<u8> = Vec::new();
            for i in 1..6 {
                item_vec.push(record.get(i).expect("-1").parse().unwrap());
            }

            let schedule = if schedules.get(&String::from(record.get(0).expect("Empty"))) == None {
                Vec::new()
            } else {
                schedules.get(&String::from(record.get(0).expect("Empty"))).unwrap().to_vec()
            };

            let room = Room {
                name: String::from(record.get(0).expect("Empty")),
                items: item_vec,
                gp: record.get(6).expect("-1").parse().unwrap(),
                checked: String::from("2000-01-01T00:00:00Z"),
                schedule: schedule,
            };

            rooms.insert(String::from(&room.name), room);
        }
    }
    // ------------------------------------------------------------------------
    
    // set TcpListener and initalize
    // ------------------------------------------------------------------------
    let host_ip: &str;
    let local_ip_addr = &(local_ip().unwrap().to_string()+":7878");
    if matches.opt_present("l") {
        println!("[#] -- You are running using localhost --");
        host_ip = "127.0.0.1:7878";
    } else {
        println!("[#] -- You are running using public IP --");
        host_ip = local_ip_addr;
    }
    println!("[!] ... {} ...", host_ip);

    let listener = TcpListener::bind(host_ip).unwrap();
    let pool = ThreadPool::new(4);
    let cookie_jar = Arc::new(reqwest::cookie::Jar::default());
    // ------------------------------------------------------------------------
    print!("> ");
    stdout().flush().unwrap();

    for stream in listener.incoming() {
        let cookie_jar = Arc::clone(&cookie_jar);
        let stream = stream.unwrap();
        let clone_rooms = clone_map(&rooms);
        let clone_keys = keys.clone();

        pool.execute(move || {
            handle_connection(stream, cookie_jar, clone_rooms, clone_keys);
        });
    }
}

fn clone_map<
    'a, String: Eq + Hash + Debug + Clone, 
    Room: Clone + Debug
> (
    source: &'a HashMap<String, Room>
) -> HashMap<String, Room> where String: Borrow<String> {
    let mut target: HashMap<String, Room> = HashMap::new();
    for (k, v) in source.iter() {
        target.insert(String::from(k.clone()), v.clone());
    }
    return target;
}

#[tokio::main]
async fn handle_connection(
    mut stream: TcpStream, 
    cookie_jar: Arc<reqwest::cookie::Jar>, 
    mut rooms: HashMap<String, Room>,
    keys: Keys,
) -> Option<()> {
    let mut buffer = [0; 1024];

    stream.read(&mut buffer).unwrap();

    // HTML-oriented files
    // ------------------------------------------------------------------------
    let _get_icon    = b"GET /favicon.ico HTTP/1.1\r\n";
    let get_index   = b"GET / HTTP/1.1\r\n";
    let get_css     = b"GET /page.css HTTP/1.1\r\n";
    let get_cc      = b"GET /camcode.js HTTP/1.1\r\n";
    let get_ccalt1  = b"GET /cc-altmode.js HTTP/1.1\r\n";
    let get_cb1     = b"GET /checkerboard.js HTTP/1.1\r\n";
    let get_jn1     = b"GET /jacknet.js HTTP/1.1\r\n";
    let get_wiki1   = b"GET /wiki.js HTTP/1.1\r\n";
    let get_ccalt2  = b"GET /cc-altmode HTTP/1.1\r\n";
    let get_cb2     = b"GET /checkerboard HTTP/1.1\r\n";
    let get_jn2     = b"GET /jacknet HTTP/1.1\r\n";
    let get_wiki2   = b"GET /wiki HTTP/1.1\r\n";
    let get_jn_json = b"GET /campus.json HTTP/1.1\r\n";
    let get_cb_json = b"GET /roomChecks.json HTTP/1.1\r\n";

    let get_logo1   = b"GET /logo.png HTTP/1.1\r\n";
    let _get_logo2   = b"GET /logo-2-line.png HTTP/1'1\r\n";
    // ------------------------------------------------------------------------
    
    // make calls to backend functionality
    // ------------------------------------------------------------------------
    // login
    let login       = b"POST /login HTTP/1.1\r\n";
    // Jacknet
    let ping        = b"POST /ping HTTP/1.1\r\n";
    // Checkerboard
    let run_cb      = b"POST /run_cb HTTP/1.1\r\n";
    // CamCode
    //  - CamCode - CFM Requests
    let cfm_build   = b"POST /cfm_build HTTP/1.1\r\n";
    let cfm_build_r = b"POST /cfm_build_r HTTP/1.1\r\n";
    let cfm_c_dir   = b"POST /cfm_c_dir HTTP/1.1\r\n";
    let cfm_file    = b"POST /cfm_file HTTP/1.1\r\n";
    let cfm_dir     = b"POST /cfm_dir HTTP/1.1\r\n";
    // Wiki
    let w_build     = b"POST /w_build HTTP/1.1\r\n";
    // ------------------------------------------------------------------------

    // Handle requests
    // ------------------------------------------------------------------------
    let mut status_line = "HTTP/1.1 200 OK";
    let contents;
    let filename;
    let mut user_homepage: &str = "html-css-js/index_guest.html";
    
    if buffer.starts_with(b"GET") {
        if buffer.starts_with(get_index) {
            filename = "html-css-js/login.html";
        } else if buffer.starts_with(get_css) {
            filename = "html-css-js/page.css";
        } else if buffer.starts_with(get_cc) {
            filename = "html-css-js/camcode.js";
        } else if buffer.starts_with(get_ccalt1) {
            filename = "html-css-js/cc-altmode.js";
        } else if buffer.starts_with(get_cb1) {
            filename = "html-css-js/checkerboard.js";
        } else if buffer.starts_with(get_jn1) {
            filename = "html-css-js/jacknet.js";
        } else if buffer.starts_with(get_wiki1) {
            filename = "html-css-js/wiki.js";
        } else if buffer.starts_with(get_ccalt2) {
            let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body)(?<postamble>[\d\D]*)").unwrap();
            let pre_contents = read_to_string(user_homepage).unwrap();
            let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return Option::Some(()) };
            let pre = String::from(pre_post["preamble"].to_string().into_boxed_str());
            let post = String::from(pre_post["postamble"].to_string().into_boxed_str());
            contents = format!("{} onload='setCrestronFile()'{}", pre, post);
            let response = format!(
                "{}\r\nContent-Length: {}\r\n\r\n{}",
                status_line, contents.len(), contents
            );
            stream.write(response.as_bytes()).unwrap();
            stream.flush().unwrap();
    
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
            print!("> ");
            stdout().flush().unwrap();
            return Option::Some(());
        } else if buffer.starts_with(get_cb2) {
            let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body)(?<postamble>[\d\D]*)").unwrap();
            let pre_contents = read_to_string(user_homepage).unwrap();
            let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return Option::Some(()) };
            let pre = String::from(pre_post["preamble"].to_string().into_boxed_str());
            let post = String::from(pre_post["postamble"].to_string().into_boxed_str());
            contents = format!("{} onload='setChecker()'{}", pre, post);
            let response = format!(
                "{}\r\nContent-Length: {}\r\n\r\n{}",
                status_line, contents.len(), contents
            );
            stream.write(response.as_bytes()).unwrap();
            stream.flush().unwrap();
    
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
            print!("> ");
            stdout().flush().unwrap();
            return Option::Some(());
        } else if buffer.starts_with(get_jn2) {
            let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body)(?<postamble>[\d\D]*)").unwrap();
            let pre_contents = read_to_string(user_homepage).unwrap();
            let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return Option::Some(()) };
            let pre = String::from(pre_post["preamble"].to_string().into_boxed_str());
            let post = String::from(pre_post["postamble"].to_string().into_boxed_str());
            contents = format!("{} onload='setJackNet()'{}", pre, post);
            let response = format!(
                "{}\r\nContent-Length: {}\r\n\r\n{}",
                status_line, contents.len(), contents
            );
            stream.write(response.as_bytes()).unwrap();
            stream.flush().unwrap();
    
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
            print!("> ");
            stdout().flush().unwrap();
            return Option::Some(());
        } else if buffer.starts_with(get_wiki2) {
            let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body)(?<postamble>[\d\D]*)").unwrap();
            let pre_contents = read_to_string(user_homepage).unwrap();
            let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return Option::Some(()) };
            let pre = String::from(pre_post["preamble"].to_string().into_boxed_str());
            let post = String::from(pre_post["postamble"].to_string().into_boxed_str());
            contents = format!("{} onload='setWiki()'{}", pre, post);
            let response = format!(
                "{}\r\nContent-Length: {}\r\n\r\n{}",
                status_line, contents.len(), contents
            );
            stream.write(response.as_bytes()).unwrap();
            stream.flush().unwrap();
    
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
            print!("> ");
            stdout().flush().unwrap();
            return Option::Some(());
        } else if buffer.starts_with(get_jn_json) {
            filename = "html-css-js/campus.json";
        } else if buffer.starts_with(get_cb_json) {
            filename = "html-css-js/roomChecks.json";
        } else if buffer.starts_with(get_logo1) {
            filename = "html-css-js/logo.png";
            let img_contents = read(filename).unwrap();
            let response = format!(
                "{}\r\n\
                Content-Type: img/png\r\n\
                Content-Length: {}\r\n\r\n",
                status_line, img_contents.len()
            );
            stream.write(response.as_bytes()).unwrap();
            stream.write(&img_contents).unwrap();
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
            print!("> ");
            stdout().flush().unwrap();
            return Option::Some(());
        } else {
            status_line =  "HTTP/1.1 404 NOT FOUND";
            filename = "html-css-js/404.html";
        };
        contents = read_to_string(filename).unwrap();
    } else if buffer.starts_with(b"POST") {
        if buffer.starts_with(login) {
            let buff_copy = str::from_utf8(&buffer[..]).unwrap();
            let credential_search = Regex::new(r"uname=(?<user>.*)&psw=(?<pass>[\d\w%]*)").unwrap();
            let Some(credentials) = credential_search.captures(buff_copy) else { return Option::Some(()) };
            let user = String::from(credentials["user"].to_string().into_boxed_str());
            let pass = String::from(credentials["pass"].to_string().into_boxed_str());
            println!("{}:{}", user, pass);
            for credential in keys.users {
                if user == credential[0] && pass == credential[1] {
                    user_homepage = credential[2].as_str();
                    contents = read_to_string(user_homepage).unwrap();
                    let response = format!(
                        "{}\r\nContent-Length: {}\r\n\r\n{}",
                        status_line, contents.len(), contents
                    );
                    // Sends to STDOUT
                    stream.write(response.as_bytes()).unwrap();
                    stream.flush().unwrap();
            
                    println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());

                    print!("> ");
                    stdout().flush().unwrap();
                    return Option::Some(());
                }
            }
            contents = read_to_string("html-css-js/login.html").unwrap();
        } else if buffer.starts_with(ping) {
            contents = execute_ping(&mut buffer, rooms); // JN
        } else if buffer.starts_with(run_cb) {
            let buff_copy = process_buffer(&mut buffer);
            // get zone selection from request and store
            // ----------------------------------------------------------------
            let zone_selection: ZoneRequest = serde_json::from_str(&buff_copy)
                .expect("Fatal Error 2: Failed to parse ping request");

            let mut buildings: Vec<&str> = Vec::new();
            let mut parent_locations: Vec<&str> = Vec::new();
            if zone_selection.zones.clone().into_iter().find(|x| x == "1") == Some("1".to_string()) {
                buildings.extend(&ZONE_1_SHORT);
                parent_locations.extend(&ZONE_1);
            }
            if zone_selection.zones.clone().into_iter().find(|x| x == "2") == Some("2".to_string()) {
                buildings.extend(&ZONE_2_SHORT);
                parent_locations.extend(&ZONE_2);
            }
            if zone_selection.zones.clone().into_iter().find(|x| x == "3") == Some("3".to_string()) {
                buildings.extend(&ZONE_3_SHORT);
                parent_locations.extend(&ZONE_3);
            }
            if zone_selection.zones.clone().into_iter().find(|x| x == "4") == Some("4".to_string()) {
                buildings.extend(&ZONE_4_SHORT);
                parent_locations.extend(&ZONE_4);
            }
            // ----------------------------------------------------------------

            // call for roomchecks in LSM and store
            // ----------------------------------------------------------------
            for parent_location in parent_locations.into_iter() {
                let clone_keys = keys.clone();
                let url = format!(
                    r"https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last7days%22%2CParentLocation%3A%22{}%22%7D", 
                    parent_location
                );
                let req = reqwest::Client::builder()
                    .cookie_provider(Arc::clone(&cookie_jar))
                    .user_agent("server_lib/0.3.1")
                    .default_headers(construct_headers(clone_keys))
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
                if v["count"].as_i64() > Some(0) {
                    for i in 0..v["count"].as_i64().unwrap() {
                        let check = v["data"].as_array().unwrap()[usize::try_from(i).unwrap()].as_object().unwrap();
                        if rooms.contains_key(check["LocationName"].as_str().unwrap()) {
                            let room = rooms.get_mut(&String::from(check["LocationName"].as_str().unwrap()));
                            room.expect("Empty")
                                .update_checked(String::from(check["CompletedOn"].as_str().unwrap()));
                        }
                    }
                }
            }
            // ----------------------------------------------------------------

            // parse rooms map to load statuses for return
            // ----------------------------------------------------------------
            let mut return_str: String = String::new();
            let mut return_vec = Vec::new();
            for (name, room) in rooms.into_iter() {
                if buildings.iter().any(|e| name.starts_with(e)) {
                    let available = check_schedule(room.clone());
                    let checked   = check_lsm(room.clone());
                    return_str.clear();
                    return_str.push_str(&name);
                    return_str.push_str(&checked);
                    return_str.push_str(&available);
                    return_vec.push(return_str.clone());

                }
            }

            let json_return = json!({
                "rooms": return_vec,
            });
            
            contents = json_return.to_string();
            // ----------------------------------------------------------------
        } else if buffer.starts_with(cfm_build) { // CC-CFM
            contents = cfm_build_dir(&mut buffer);
        } else if buffer.starts_with(cfm_build_r) {
            contents = cfm_build_rm(&mut buffer);
        } else if buffer.starts_with(cfm_c_dir) {
            contents = get_cfm(&mut buffer);
        } else if buffer.starts_with(cfm_dir) {
            contents = get_cfm_dir(&mut buffer);
        } else if buffer.starts_with(cfm_file) {
            contents = get_cfm_file(&mut buffer);
        } else if buffer.starts_with(w_build) {
            contents = w_build_articles(&mut buffer);
        } else {
            status_line = "HTTP/1.1 404 NOT FOUND";
            contents = read_to_string("html-css-js/404.html").unwrap();
        };
    } else {
        status_line = "HTTP/1.1 404 NOT FOUND";
        contents = read_to_string("html-css-js/404.html").unwrap();
    }

    // NOTE - look at this for error log format
    // ie:  
    //  if status_line == 404 not found
    //      then put in error file instead.
    //      add timestamp at top of line
    // let response = format!(
    //     "{}\r\nContent-Length: {}\r\n\r\n{}",
    //     status_line, contents.len(), contents
    // );

    let response;

    if buffer.starts_with(cfm_file) {
        let mut f = File::open(contents.clone()).unwrap();
        
        let mut file_buffer = Vec::new();
        f.read_to_end(&mut file_buffer).unwrap();

        let buf_content = read(&contents).unwrap();
        let length = buf_content.len();
        
        response = format!("\
        {}\r\n\
        Content-Type: application/zip\r\n\
        Content-length: {}\r\n\
        Content-Disposition: attachment; filename=\"{}\"\r\n\
        \r\n",
            status_line, 
            length, 
            contents
        );
        // Sends to STDOUT
        stream.write(response.as_bytes()).unwrap();
        stream.write_all(&file_buffer).unwrap();
        stream.flush().unwrap();

        println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
    } else {
        response = format!(
            "{}\r\nContent-Length: {}\r\n\r\n{}",
            status_line, contents.len(), contents
        );
        // Sends to STDOUT
        stream.write(response.as_bytes()).unwrap();
        stream.flush().unwrap();

        println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
    }
    // ------------------------------------------------------------------------

    print!("> ");
    stdout().flush().unwrap();
    return Option::Some(());
}

// Preps the Buffer to be parsed as json string
fn process_buffer(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));
    let buff_copy: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    // functon that returns first '{' index location and it's '}' location
    let in_curls = find_enclosed(&buff_copy, ('{', '}'), true);
    return in_curls;
}

// used to trim excess info off of the buffer
fn find_enclosed(s: &String, delimiters: (char,char), include_delim: bool) -> String {
    let search_rule;
    if include_delim {
        search_rule = Regex::new(format!("(?<search_return>\\{}.*{})", delimiters.0, delimiters.1).as_str()).unwrap();
    } else {
        search_rule = Regex::new(format!("\\{}(?<search_return>.*){}", delimiters.0, delimiters.1).as_str()).unwrap();
    }

    let Some(returned_text) = search_rule.captures(s) else { return "Empty".to_string() };
    println!("\r\nSearch results are {:?}", returned_text["search_return"].to_string());

    let curl_find = Regex::new(r"(?<in_curls>\{.*})").unwrap();
    let Some(in_curls) = curl_find.captures(s) else { return "{}".to_string() };

    return in_curls["in_curls"].to_string();
}

/* fn pad(raw_in: String, length: usize) -> String {
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
} */

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

// NEW
// handle_terminal_in() - takes io::stdin
async fn handle_terminal_in(t_in: String) {
    println!("SUCCESS: handle_terminal_in Successfully Called");
    println!("{}",t_in);
    return;
}

// Debug function
//   Prints the type of a variable
/* fn print_type_of<T>(_: &T) {
    println!("{}", std::any::type_name::<T>());
} */

/*
   $$$$$\                     $$\       $$\   $$\            $$\     
   \__$$ |                    $$ |      $$$\  $$ |           $$ |    
      $$ | $$$$$$\   $$$$$$$\ $$ |  $$\ $$$$\ $$ | $$$$$$\ $$$$$$\   
      $$ | \____$$\ $$  _____|$$ | $$  |$$ $$\$$ |$$  __$$\\_$$  _|  
$$\   $$ | $$$$$$$ |$$ /      $$$$$$  / $$ \$$$$ |$$$$$$$$ | $$ |    
$$ |  $$ |$$  __$$ |$$ |      $$  _$$<  $$ |\$$$ |$$   ____| $$ |$$\ 
\$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$ | \$$\ $$ | \$$ |\$$$$$$$\  \$$$$  |
 \______/  \_______| \_______|\__|  \__|\__|  \__| \_______|  \____/ 
*/

// call ping_this executible here
fn execute_ping(buffer: &mut [u8], rooms: HashMap<String, Room>) -> String {
    // Prep Request into Struct
    let buff_copy = process_buffer(buffer);
    let pr: PingRequest = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 2: Failed to parse ping request");
    println!("Ping Request: \n {:?}", pr);

    // BuildingData Struct
    let bs: BuildingData = serde_json::from_str(CAMPUS_STR)
        .expect("Fatal Error: Failed to build building data structs");

    // Generate the hostnames here
    let hostnames: Vec<String> = gen_hostnames(
        pr.devices,
        pr.building.clone(),
        bs,
        rooms);

    println!("{:?}", hostnames);

    // Write for loop through hostnames
    let mut hn_ips: Vec<String> = Vec::new();
    for hn in hostnames.clone() {
        println!("Hostname: {}", hn);
        let hn_ip = ping_this(hn);
        println!("IpAdr:    {}", hn_ip);
        hn_ips.push(hn_ip);
    }

    // format data into json using SerdeLOGIN
    let json_return = json!({
        "building": pr.building,
        "hostnames": hostnames,
        "ips": hn_ips
    });

    // convert to string and return it
    println!("\rPulled IP's:\n{:?}",hn_ips);
    println!("----\n------\nEND OF execute_ping() FUNCTION\n------\n-----\n");

    // Return JSON with ping results
    return json_return.to_string();
}



// this could change alot,
// we want to implement device counts into the campus.json/csv
// that will come into play here
//    gen_hostnames(
//      sel_devs - Selected Devices from ping request (TODO: use booleans)
//      sel_b    - Selected building form ping request (TODO: Use an ID number)
//      bd       - Building Data
fn gen_hostnames(
    sel_devs: Vec<String>, 
    sel_b: String,
    bd: BuildingData,
    rooms: HashMap<String, Room>) -> Vec<String> {
    // init
    let mut devices: Vec<bool> = [false ,false ,false ,false ,false].to_vec();
    let mut hostnames = Vec::new();
    let mut temp_hostname = String::new();
    let mut tmp_tmp;

    // Set selection flags
    for i in sel_devs {
        match i.as_ref() {
            "proc"  => devices[0] = true,
            "pj"    => devices[1] = true,
            "ws"    => devices[2] = true,
            "tp"    => devices[3] = true,
            "cmicx" => devices[4] = true,
            &_      => ()
        }
    }
    println!("Boolean Device Flags: \n {:?}", devices);
    // Implement device count here (Probably?)
        
    // Find relavant data in struct AND build
    for item in bd.building_data { //  For each building in the data
        if sel_b == item.name { // check selection
            for j in item.rooms { // iterate through rooms
                // Build and append hostnames
                temp_hostname.push_str(&item.abbrev.clone());
                temp_hostname.push('-');
                temp_hostname.push_str(&format!("{:0>4}", j).to_string());
                temp_hostname.push('-');
                println!("{} {}: {:?}", &item.abbrev.clone(), j.clone(), rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())));
                if devices[0] {
                    for n in 0..rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())).unwrap().items[0] {
                        tmp_tmp = temp_hostname.clone();
                        tmp_tmp.push_str(format!("proc{}", n+1).as_str());
                        //println!("generated hostname: \n {}", tmp_tmp);
                        hostnames.push(tmp_tmp);
                    }
                }
                if devices [1] {
                    for n in 0..rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())).unwrap().items[1] {
                        tmp_tmp = temp_hostname.clone();
                        tmp_tmp.push_str(format!("pj{}", n+1).as_str());
                        //println!("generated hostname: \n {}", tmp_tmp);
                        hostnames.push(tmp_tmp);
                    }
                }
                if devices [2] {
                    for n in 0..rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())).unwrap().items[2] {
                        tmp_tmp = temp_hostname.clone();
                        tmp_tmp.push_str(format!("ws{}", n+1).as_str());
                        //println!("generated hostname: \n {}", tmp_tmp);
                        hostnames.push(tmp_tmp);
                    }
                }
                if devices [3] {
                    for n in 0..rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())).unwrap().items[3] {
                        tmp_tmp = temp_hostname.clone();
                        tmp_tmp.push_str(format!("tp{}", n+1).as_str());
                        //println!("generated hostname: \n {}", tmp_tmp);
                        hostnames.push(tmp_tmp);
                    }
                }
                if devices [4] {
                    for n in 0..rooms.get(&format!("{} {}", &item.abbrev.clone(), j.clone())).unwrap().items[4] {
                        tmp_tmp = temp_hostname.clone();
                        tmp_tmp.push_str(format!("cmic{}", n+1).as_str());
                        //println!("generated hostname: \n {}", tmp_tmp);
                        hostnames.push(tmp_tmp);
                    }
                }
                
                //hostnames.push(temp_hostname.clone());
                temp_hostname = String::new();
            }       
        }
    }
    // Return value
    return hostnames;
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

fn construct_headers(keys: Keys) -> HeaderMap {
    let mut header_map = HeaderMap::new();
    header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
    header_map.insert(AUTHORIZATION, HeaderValue::from_str(&keys.api).expect("[-] KEY_ERR: Not found."));

    return header_map;
}

fn check_schedule(room: Room) -> String {
    let now = Local::now();
    let day_of_week = match now.date_naive().weekday() {
        Weekday::Mon => "M",
        Weekday::Tue => "T",
        Weekday::Wed => "W",
        Weekday::Thu => "R",
        Weekday::Fri => "F",
        _            => "?",
    };
    let return_string = String::from(" | [+] AVAILABLE   | UNTIL TOMORROW");
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
            let mut f = Vec::new();
            if adjusted_time < adjusted_start {
                write!(&mut f, " | [+] AVAILABLE   | UNTIL {}:{}", adjusted_start / 100, pad_zero((adjusted_start % 100).to_string(), 2)).unwrap();
                return String::from_utf8(f).expect("EMPTY");
            } else if (adjusted_start <= adjusted_time) && (adjusted_time <= adjusted_end) {
                write!(&mut f, " | [-] UNAVAILABLE | UNTIL {}:{}", adjusted_end / 100, pad_zero((adjusted_end % 100).to_string(), 2)).unwrap();
                return String::from_utf8(f).expect("EMPTY");
            }
        }
    }

    return return_string;
}

fn check_lsm(room: Room) -> String {
    let parsed_checked: DateTime<Local> = room.checked.parse().unwrap();
    let chopped_checked: Vec<&str> = room.checked.split('T').collect();
    let time_diff: TimeDelta = Local::now() - parsed_checked;
    let mut d = Vec::new();
    if room.gp == 1 {
        if time_diff.num_seconds() >= 604800 {
            write!(&mut d, " | [-] NEEDS CHECKED | LAST CHECKED {}", chopped_checked[0]).unwrap();
        } else {
            write!(&mut d, " | [+] CHECKED       | LAST CHECKED {}", chopped_checked[0]).unwrap();
        }
    } else {
        write!(&mut d, "--- UNDER CONSTRUCTION ---").unwrap();
    }

    return String::from_utf8(d).expect("Empty");
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

    println!("CFM Debug - Looking for path:\n{:?}", path);

    if dir_exists(&path) {
        println!("SUCCESS 2: ROOM DIRECTORY FOUND");
        // let paths = fs::read_dir(&path).unwrap();
        // for p in paths {
        //     println!("{}\n", p.as_ref().unwrap().path().display());
        //     strings.push(p.unwrap().path().display().to_string());
        // }
        strings = get_dir_contents(&path);
        return strings;
    }
    
    println!("Fatal Error 4: ROOM DIRECTORY DOES NOT EXIST");
    return strings;
}

fn get_dir_contents(path: &str) -> Vec<String> {
    let mut strings = Vec::new();
    let paths = read_dir(&path).unwrap();
    for p in paths {
        println!("{}\n", p.as_ref().unwrap().path().display());
        strings.push(p.unwrap().path().display().to_string());
    }

    return strings;
}

fn get_origin(buffer: &mut [u8]) -> String {
    let buff_copy: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    let bytes = buff_copy.as_bytes();
    let mut ir: usize = 0;
    let mut ir_end: usize = 0;

    let mut newline:     bool = false;
    let mut origin_line: bool = false;

    for (i, &item) in bytes.iter().enumerate() {
        //println!("get_origin() Lookng at\n{}", item as char);
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

    println!("FINDING ORIGIN FAILED");
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
fn cfm_build_dir(_buffer: &mut [u8]) -> String {
    // Vars
    let mut final_dirs: Vec<String> = Vec::new();
    // Check for CFM_Code Directory
    if dir_exists(CFM_DIR) {
        println!("SUCCESS: CFM_Code Directory Found");
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

    println!("----\n------\nEND OF get_cfm() FUNCTION\n------\n-----\n");
    return json_return.to_string();
}

// cfm_build_rm() - post ROOM dropdown
fn cfm_build_rm(buffer: &mut [u8]) -> String {
    let mut final_dirs: Vec<String> = Vec::new();

    // Check for CFM_Code Directory
    if dir_exists(CFM_DIR) {
        println!("SUCCESS: CFM_Code Directory Found");
    }

    // Prep buffer into Room List Request Struct
    //     - building
    let buff_copy: String = process_buffer(buffer);
    let cfm_rms: CFMRoomRequest = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 39: Failed to parse cfm room request.");
    
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

    println!("----\n------\nEND OF cfm_build_rm() FUNCTION\n------\n-----\n");
    return json_return.to_string();
}

// get_cfm - generate code (Sends list of files to user)
fn get_cfm(buffer: &mut [u8]) -> String {
    // crestron file manager request (CFMR)
    //   - building
    //   - rm
    let buff_copy: String = process_buffer(buffer);
    let cfmr: CFMRequest = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 3: Failed to parse cfm request");
    
    // Check CFM_Code Directory
    if dir_exists(CFM_DIR) {
        println!("SUCCESS: CFM_Code Directory Found");
    }
    
    let cfm_files = find_files(cfmr.building, cfmr.rm);

    // return file
    let json_return = json!({
        "names": cfm_files
    });

    println!("----\n------\nEND OF get_cfm() FUNCTION\n------\n-----\n");
    return json_return.to_string();
}


// get_cfm_file() - sends the selected file to the client
// TODO:
//    [ ] - store selected file as bytes ?
//    [ ] - send in json as usual ?
fn get_cfm_file(buffer: &mut [u8]) -> String {
    // RequstFile
    //    - filename
    let buff_copy1: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    println!("Testing buff_copy1\n{}", buff_copy1);
    // let gr: GeneralRequest = serde_json::from_str(&buff_copy1)
    //     .expect("Fatal Error 49: general Request Failed");
    let gr_origin: String = get_origin(buffer);

    println!("Origin IP Address\n{}", gr_origin);
    
    let buff_copy: String = process_buffer(buffer);
    let cfmr_f: CFMRequestFile = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 38: failed to parse filename");
    
    if dir_exists(CFM_DIR) {
        println!("SUCCESS: CFM_Code Directory Found");
    }

    // build_path
    // Path within repo
    let mut path_repo: String = String::from("/CFM_Code");
    path_repo.push_str(&cfmr_f.filename);

    // Full Path
    let mut path_raw: String = String::from(CFM_DIR);
    path_raw.push_str(&cfmr_f.filename);

    println!("Filename Path:\n {:?}", &path_raw);

    // Check for file
    if dir_exists(&path_raw) {
        println!("SUCCESS: FILE Found");
    }

    return path_raw.to_string();
}

// get_cfm_dir() - sends the selected file to the client
// TODO:
//    [ ] - store selected file as bytes ?
//    [ ] - send in json as usual ?
fn get_cfm_dir(buffer: &mut [u8]) -> String {
    // RequstFile
    //    - filename
    let mut strings = Vec::new();
    let buff_copy: String = process_buffer(buffer);
    let cfmr_d: CFMRequestFile = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 38: failed to parse filename");

    if dir_exists(CFM_DIR) {
        println!("SUCCESS: CFM_Code Directory Found");
    }

    let mut path = String::from(CFM_DIR);
    path.push_str(&cfmr_d.filename);
    
    if dir_exists(&path) {
        println!("SUCCESS 2: ROOM DIRECTORY FOUND");
        if is_this_dir(&path) {
            println!("SUCCESS 3: ROOM DIRECTORY IS A DIR");
            strings = get_dir_contents(&path);
        } else {
            println!("Failure Not really a directory!");
            strings.push("FAILED, directory is a file".to_string());
            let json_return = json!({"names": strings});
            return json_return.to_string();
        }
    }

    // return file
    let json_return = json!({
        "names": strings
    });

    println!("----\n------\nEND OF get_cfm() FUNCTION\n------\n-----\n");
    return json_return.to_string();
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

fn w_build_articles(_buffer: &mut [u8]) -> String {
    // Vars
    let mut article_vec: Vec<String> = Vec::new();

    // Check for CFM_Code Directory
    if dir_exists(WIKI_DIR) {
        println!("SUCCESS: WIKI Directory Found");
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

    return json_return.to_string();
}