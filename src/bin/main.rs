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
    ZONE_1, ZONE_1_SHORT, ZONE_2, ZONE_2_SHORT, ZONE_3, ZONE_3_SHORT, ZONE_4, ZONE_4_SHORT,
    CAMPUS_STR, CFM_DIR, WIKI_DIR, ROOM_CSV, CAMPUS_CSV, KEYS,
    STATUS_200, STATUS_404,
};
use getopts::Options;
use std::{
    str, env,
    io::{ prelude::*, Read, stdout, },
    net::{ TcpStream, TcpListener, },
    fs::{
        read, read_to_string, read_dir, metadata,
        File,
    },
    time::{ Duration, SystemTime},
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
    header::{ HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, ACCEPT, }
};
use csv::{ Reader, };
use local_ip_address::{ local_ip, };
use serde_json::{ json, Value, };
use regex::Regex;
use chrono::{ Datelike, offset::Local, Weekday, DateTime, TimeDelta, };
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
        println!("\rTest\n");
    }


    // generate rooms HashMap
    let rooms = gen_hashmap();
    
    // set TcpListener and initalize
    // ------------------------------------------------------------------------
    let host_ip: &str;
    let mut host_port = 7878;
    let local_ip_addr = &(local_ip().unwrap().to_string());
    if matches.opt_present("l") {
        println!("[#] -- You are running using localhost --");
        host_ip = "127.0.0.1";
    } else {
        println!("[#] -- You are running using public IP --");
        host_ip = local_ip_addr;
    }

    while let Err(_e) = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())) {
        host_port += 1;
    }
    let listener = TcpListener::bind(format!("{}:{}", host_ip, host_port.to_string())).unwrap();

    println!("[!] ... {}:{} ...", host_ip, host_port.to_string());

    let pool = ThreadPool::new(4);
    let cookie_jar = Arc::new(reqwest::cookie::Jar::default());
    // ------------------------------------------------------------------------
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

fn gen_hashmap() -> HashMap<String, Room> {
    let room_filter = Regex::new(r"^[A-Z]+ [0-9A-Z]+$").unwrap();

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
            for i in 1..7 { // Packing item_vec from csv file
                item_vec.push(record.get(i).expect("-1").parse().unwrap());
            }

            let schedule = if schedules.get(&String::from(record.get(0).expect("Empty"))) == None {
                Vec::new()
            } else {
                schedules.get(&String::from(record.get(0).expect("Empty"))).unwrap().to_vec()
            };

            // Need to set room hostnames here.
            // add hostnames and ip addr (empty at first) attributes
            // function that gen hostnames here
            let hn_vec = gen_hn2(String::from(record.get(0).expect("Empty")), item_vec.clone());

            let ip_vec = gen_ip2(item_vec);
            let duration = Duration::from_secs(1_000_000);
            let room = Room {
                name: String::from(record.get(0).expect("Empty")),
                hostnames: hn_vec,
                ips: ip_vec,
                gp: record.get(7).expect("-1").parse().unwrap(),
                checked: String::from("2000-01-01T00:00:00Z"),
                jn_checked: SystemTime::now().checked_sub(duration).expect("Failed to init unchecked time"),
                schedule: schedule,
            };

            rooms.insert(String::from(&room.name), room);
        }
    }

    return rooms;
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
#[allow(unused_assignments)]
async fn handle_connection(
    mut stream: TcpStream, 
    cookie_jar: Arc<reqwest::cookie::Jar>, 
    mut rooms: HashMap<String, Room>,
    keys: Keys,
) -> Option<()> {
    let mut buffer = [0; 1024];

    stream.read(&mut buffer).unwrap();

    // Handle requests
    // ------------------------------------------------------------------------
    let mut user_homepage: &str = "html-css-js/index_guest.html";
    let stream_clone = stream.try_clone().expect("[-] CLONE ERROR: Stream failed to clone.");

    let first_line_search = Regex::new(r"^.*\n").unwrap();
    let buff_copy = buffer.clone();
    let first_line = first_line_search.find(str::from_utf8(&buff_copy).expect("Empty"));
    let first_line_str = if first_line.is_some() { first_line.unwrap().as_str() } else { "Empty" };

    match first_line_str {
        "GET / HTTP/1.1\r\n"                => send_data_string(STATUS_200, "html-css-js/login.html", stream_clone, &buff_copy),
        "GET /page.css HTTP/1.1\r\n"        => send_data_string(STATUS_200, "html-css-js/page.css", stream_clone, &buff_copy),
    
        "GET /camcode.js HTTP/1.1\r\n"      => send_data_string(STATUS_200, "html-css-js/camcode.js", stream_clone, &buff_copy),
        "GET /cc-altmode.js HTTP/1.1\r\n"   => send_data_string(STATUS_200, "html-css-js/cc-altmode.js", stream_clone, &buff_copy),
        "GET /checkerboard.js HTTP/1.1\r\n" => send_data_string(STATUS_200, "html-css-js/checkerboard.js", stream_clone, &buff_copy),
        "GET /jacknet.js HTTP/1.1\r\n"      => send_data_string(STATUS_200, "html-css-js/jacknet.js", stream_clone, &buff_copy),
        "GET /wiki.js HTTP/1.1\r\n"         => send_data_string(STATUS_200, "html-css-js/wiki.js", stream_clone, &buff_copy),
        "GET /cc-altmode HTTP/1.1\r\n"      => insert_onload(STATUS_200, "setCrestronFile()", "html-css-js/index_guest.html", stream_clone, &buff_copy),
        "GET /checkerboard HTTP/1.1\r\n"    => insert_onload(STATUS_200, "setChecker()", "html-css-js/index_guest.html", stream_clone, &buff_copy),
        "GET /jacknet HTTP/1.1\r\n"         => insert_onload(STATUS_200, "setJackNet()", "html-css-js/index_guest.html", stream_clone, &buff_copy),
        "GET /wiki HTTP/1.1\r\n"            => insert_onload(STATUS_200, "setWiki()", "html-css-js/index_guest.html", stream_clone, &buff_copy),

        "GET /refresh HTTP/1.1\r\n"         => {
            let contents = json!({
                "body": "[+] File updated successfully."
            }).to_string();
            rooms = gen_hashmap();
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        }
    
        "GET /campus.json HTTP/1.1\r\n"     => send_data_string(STATUS_200, "html-css-js/campus.json", stream_clone, &buff_copy),
    
        "GET /favicon.ico HTTP/1.1\r\n"     => send_data_bytes(STATUS_200, "html-css-js/logo_main.png", "image/png", stream_clone, &buff_copy),
        "GET /logo.png HTTP/1.1\r\n"        => send_data_bytes(STATUS_200, "html-css-js/logo.png", "img/png", stream_clone, &buff_copy),
        "GET /logo-2-line.png HTTP/1.1\r\n" => send_data_bytes(STATUS_200, "html-css-js/logo-2-line.png", "img/png", stream_clone, &buff_copy),
        // ------------------------------------------------------------------------
        
        // make calls to backend functionality
        // ------------------------------------------------------------------------
        // login
        "POST /login HTTP/1.1\r\n"          => {
            let credential_search = Regex::new(r"uname=(?<user>.*)&psw=(?<pass>[\d\w%]*)").unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&buff_copy).expect("Empty")) else { return Option::Some(()) };
            let user = String::from(credentials["user"].to_string().into_boxed_str());
            let pass = String::from(credentials["pass"].to_string().into_boxed_str());
            for credential in keys.users {
                if user == credential[0] && pass == credential[1] {
                    user_homepage = credential[2].as_str();
                    let login_stream_clone = stream.try_clone().expect("[-] CLONE ERROR: Stream failed to clone.");
                    send_data_string(STATUS_200, user_homepage, login_stream_clone, &buff_copy);
                }
            }
        },
        "POST /bugreport HTTP/1.1\r\n"      => {
            let credential_search = Regex::new(r#"title=(?<title>.*)&desc=(?<desc>.*)"#).unwrap();
            let Some(credentials) = credential_search.captures(str::from_utf8(&buff_copy).expect("Empty")) else { return Option::Some(()) };
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

            println!("{:?}:{:?}", arg_map.get("title").unwrap(), arg_map.get("body").unwrap());

            let clone_keys = keys.clone();
            let url = "https://api.github.com/repos/UWIT-CTS-Software/bronson_online/issues";
            let req = reqwest::Client::builder()
                .cookie_provider(Arc::clone(&cookie_jar))
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

            
            send_data_string(STATUS_200, user_homepage, stream_clone, &buff_copy);

        },
        // Jacknet
        "POST /ping HTTP/1.1\r\n"           => {
            let contents = execute_ping(&mut buffer, rooms); // JN
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        // Checkerboard
        "POST /run_cb HTTP/1.1\r\n"         => {
            // get zone selection from request and store
            // ----------------------------------------------------------------
            let buff_copy_string = process_buffer(&mut buffer);
            let zone_selection: ZoneRequest = serde_json::from_str(&buff_copy_string)
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
            
            let contents = json_return.to_string();
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
            // ----------------------------------------------------------------
        },
        // CamCode
        //  - CamCode - CFM Requests
        "POST /cfm_build HTTP/1.1\r\n"      => {
            let contents = cfm_build_dir(&mut buffer);
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        "POST /cfm_build_r HTTP/1.1\r\n"    => {
            let contents = cfm_build_rm(&mut buffer);
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        "POST /cfm_c_dir HTTP/1.1\r\n"      => {
            let contents = get_cfm(&mut buffer);
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        "POST /cfm_dir HTTP/1.1\r\n"        => {
            let contents = get_cfm_dir(&mut buffer);
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        "POST /cfm_file HTTP/1.1\r\n"       => {
            let contents = get_cfm_file(&mut buffer);
            let mut f = File::open(contents.clone()).unwrap();
            
            let mut file_buffer = Vec::new();
            f.read_to_end(&mut file_buffer).unwrap();
    
            let buf_content = read(&contents).unwrap();
            let length = buf_content.len();
            
            let response = format!("\
            {}\r\n\
            Content-Type: application/zip\r\n\
            Content-length: {}\r\n\
            Content-Disposition: attachment; filename=\"{}\"\r\n\
            \r\n",
                STATUS_200, 
                length, 
                contents
            );
            // Sends to STDOUT
            stream.write(response.as_bytes()).unwrap();
            stream.write_all(&file_buffer).unwrap();
            stream.flush().unwrap();
    
            println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
        },
        // Wiki
        "POST /w_build HTTP/1.1\r\n"        => {
            let contents = w_build_articles(&mut buffer);
            send_contents(STATUS_200, contents, stream_clone, &buff_copy);
        },
        &_                                  => send_data_string(STATUS_404, "html-css-js/404.html", stream_clone, &buff_copy)
    };

    stdout().flush().unwrap();
    return Option::Some(());
}

fn send_data_string(status_line: &str, filepath: &str, mut stream: TcpStream, buffer: &[u8]) {
    let contents = read_to_string(filepath).unwrap();
    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line, contents.len(), contents
    );
    // Sends to STDOUT
    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();

    println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
}

fn send_data_bytes(status_line: &str, filepath: &str, content_type: &str, mut stream: TcpStream, buffer: &[u8]) {
    let contents = read(filepath).unwrap();
    let response = format!(
        "{}\r\n\
        Content-Type: {}\r\n\
        Content-Length: {}\r\n\r\n",
        status_line, content_type, contents.len()
    );
    stream.write(response.as_bytes()).unwrap();
    stream.write(&contents).unwrap();
    println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
    stdout().flush().unwrap();
}

fn send_contents(status_line: &str, contents: String, mut stream: TcpStream, buffer: &[u8]) {
    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line, contents.len(), contents
    );
    stream.write(response.as_bytes()).unwrap();
    println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
    stdout().flush().unwrap();
}

fn insert_onload(status_line: &str, function: &str, user_homepage: &str, mut stream: TcpStream, buffer: &[u8]) {
    let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body)(?<postamble>[\d\D]*)").unwrap();
    let pre_contents = read_to_string(user_homepage).unwrap();
    let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return () };
    let pre = String::from(pre_post["preamble"].to_string().into_boxed_str());
    let post = String::from(pre_post["postamble"].to_string().into_boxed_str());
    let contents = format!("{} onload='{}'{}", pre, function, post);
    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line, contents.len(), contents
    );
    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();

    println!("\rRequest: {}", str::from_utf8(&buffer).unwrap());
    stdout().flush().unwrap();
}

// Preps the Buffer to be parsed as json string
fn process_buffer(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));
    let buff_copy: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    // functon that returns first '{' index location and it's '}' location
    let in_curls = find_enclosed(&buff_copy, (r"\{", r"}"), true);
    return in_curls;
}

// used to trim excess info off of the buffer
fn find_enclosed(s: &String, delimiters: (&str,&str), include_delim: bool) -> String {
    let search_rule;
    if include_delim {
        let search_setup = format!("(?<search_return>{}.*{})", delimiters.0, delimiters.1);
        println!("search_setup = {}", search_setup);
        search_rule = Regex::new(search_setup.as_str()).unwrap();
    } else {
        search_rule = Regex::new(format!("{}(?<search_return>.*){}", delimiters.0, delimiters.1).as_str()).unwrap();
    }

    let Some(returned_text) = search_rule.captures(s) else { return "Empty".to_string() };
    println!("\r\nSearch results are {:?}", returned_text["search_return"].to_string());

    return returned_text["search_return"].to_string();
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
fn execute_ping(buffer: &mut [u8], mut rooms: HashMap<String, Room>) -> String {
    // Prep Request into Struct
    let buff_copy = process_buffer(buffer);
    let pr: PingRequest = serde_json::from_str(&buff_copy)
        .expect("Fatal Error 2: Failed to parse ping request");
    println!("Ping Request: \n {:?}", pr);

    // BuildingData Struct
    //   NOTE: CAMPUS_CSV -> "html-css-js/campus.csv"
    //         CAMPUS_STR -> "html-css-js/campus.json" 
    let bs: BuildingData = serde_json::from_str(CAMPUS_STR)
        .expect("Fatal Error: Failed to build building data structs");

    
    /////   TRYING TO REMOVE THIS BLOCK AND REPLACE
    // Generate the hostnames here
    // let hostnames: Vec<String> = gen_hostnames(
    //     pr.devices,
    //     pr.building.clone(),
    //     bs,
    //     rooms);

    // NEED TO PULL HOSTNAMES FROM DATABASE NOW
    // make array of room names -> [AB 104, AB 105, ...]
    //    USING BuildingData Struct / front-end request info.
    // AB -> [AB 104 , AB 105 , ... ]
    // TODO
    let rooms_to_ping: Vec<String> = gen_rooms(pr.building.clone(), bs);

    let mut hostnames: Vec<String> = Vec::new();
    let mut hn_ips: Vec<String> = Vec::new();
    let mut hostnames_cached: Vec<String> = Vec::new();
    let mut ip_addr_cached: Vec<String> = Vec::new();
    
    let mut room_vec: Vec<Vec<String>> = Vec::new();
    // let mut jn_checked_vec: Vec<String> = Vec::new();


    for rm in rooms_to_ping {
        match rooms.get(&rm) {
            Some(rm_info) => {
                println!("Hostnames: {:?}", rm_info.hostnames);
                let time = SystemTime::now().duration_since(rm_info.jn_checked);
                println!("Time since last run: {:?}", time.clone().expect("Time failed to do time").as_secs());
                // 10 minutes = 600 Seconds
                if time.expect("Time failed to do time").as_secs() > 600 {
                    //DEBUG - Print rm_info stuff
                    println!("Logged Time: {:?}", rm_info.jn_checked);

                    // append rm_info.hostnames to hostnames
                    for hn in &rm_info.hostnames { // make this ping
                        println!("Hostname: {}", hn);
                        let hn_ip = ping_this(hn.to_string());
                        println!("IpAdr:    {}", hn_ip);
                        hn_ips.push(hn_ip);
                        hostnames.push(hn.to_string());
                    }
                    room_vec.push(hostnames.clone());
                    room_vec.push(hn_ips.clone());
                    rooms.get_mut(&rm).expect("Error").update_ips(hn_ips);
                    //update jn_checked timestamp here
                    rooms.get_mut(&rm).expect("failed to get room").update_jn_checked();

                    hostnames = Vec::new();
                    hn_ips = Vec::new();
                    
                    // Check update
                    println!("Updated Logged Time: {:?}", rooms.get(&rm).expect("error").jn_checked);
                } else {
                    println!("Cache response!");
                    // append rm_info.hostnames to hostnames
                    for hn in &rm_info.hostnames {
                        hostnames_cached.push(hn.to_string());
                    }
                    // append rm_info.ips to cached ips
                    for ip in &rm_info.ips {
                        ip_addr_cached.push(ip.to_string());
                    }
                    room_vec.push(hostnames_cached.clone());
                    room_vec.push(ip_addr_cached.clone());
                }
                // jn_checked_vec.push();
            }
            _ => (),
        }
    }

    // let hostnames = ["BROKEN_SORRY_FIXING_IT"];

    println!("Hostnames Generated {:?}", room_vec);

    // Write for loop through hostnames
    // [ ] TODO - Check timestamp and see if it's been ran in the last 10 minutes
    //            If so return cache. 
    
    // let room_vec_len = room_vec.len();
    // for i in (1..room_vec_len).step_by(2) {
    //     println!("i: {}", i);
    //     println!("j: {}", i - 1);
    //     if room_vec[i].is_empty() {
    //         for hn in room_vec[i-1].clone() {
    //             println!("Hostname: {}", hn);
    //             let hn_ip = ping_this(hn.to_string());
    //             println!("IpAdr:    {}", hn_ip);
    //             hn_ips.push(hn_ip);
    //         }
    //         room_vec[i] = hn_ips.clone();
    //         //rooms.get_mut()
    //         // Update room hash with updated ips
    //         hn_ips = Vec::new();
    //     }
    // }

    // println!("Hostnames Generated {:?}", room_vec);
    // for hn in hostnames.clone() {
    //     println!("Hostname: {}", hn);
    //     let hn_ip = ping_this(hn.to_string());
    //     println!("IpAdr:    {}", hn_ip);
    //     hn_ips.push(hn_ip);
    // }

    // format data into json using serde
    //Final Prep
    let mut f_hn = Vec::new();
    let mut f_ip = Vec::new();

    let room_vec_len = room_vec.len();

    for i in 0..room_vec_len {
        if i % 2 == 0 {
            f_hn.append(&mut room_vec[i].clone());
        } else {
            f_ip.append(&mut room_vec[i].clone());
        }
    }

    println!("Final Hostname Vec: {:?}", f_hn);
    println!("Final IP Vec: {:?}", f_ip);

    // [ ] TODO - Save output / Cache, filter return to only be selected devices
    let json_return = json!({
        "building": pr.building,
        "hostnames": f_hn,
        "ips": f_ip
    });

    // convert to string and return it
    println!("\rPulled IP's:\n{:?}",hn_ips);
    println!("----\n------\nEND OF execute_ping() FUNCTION\n------\n-----\n");

    // Return JSON with ping results
    return json_return.to_string();
}

// Generate Hostnames
//    Nov. 5 Revision Paradigm Shift -> genHost @ database init
//      room_name -> "AN 104"
//      item_vec  -> "[0,1,2,3,4]" 
//          "[ Proc , Pj , Disp , Ws , Tp ]"
fn gen_hn2(
    room_name: String, 
    item_vec: Vec<u8>) -> Vec<String> {
    let mut hostnames = Vec::new();
    let mut tmp_hn    = String::new();
    let parts: Vec<&str> = room_name.split(" ").collect();
    // let building_prefix = parts[0];
    // let room_number     = parts[1];

    // Assemble the hostname here
    for i in 0..4 {
        let tmp_dev = match i {
            0 => "PROC",
            1 => "PROJ",
            2 => "DISP",
            3 => "WS",
            4 => "TP",
            _ => "ERROR"
        };
        if item_vec[i] != 0 {
            for j in 0..item_vec[i] { // make n hostnames
                tmp_hn.push_str(parts[0]);
                tmp_hn.push('-');
                tmp_hn.push_str(parts[1]);
                tmp_hn.push('-');
                tmp_hn.push_str(tmp_dev);
                tmp_hn.push(char::from_digit((j+1).into(), 10).expect("digit bad idk"));
                hostnames.push(tmp_hn);
                tmp_hn = String::new();
            };
        };
    };
    return hostnames;
}

fn gen_ip2(item_vec: Vec<u8>) -> Vec<String> {
    let mut ips = Vec::new();
    let mut count = 0;
    for i in item_vec{
        count += i;
    };
    for _ in 0..count{
        ips.push("x".to_string());
    };
    return ips;
}

// TODO (AG -> [AG 1, AG 2, ...])
fn gen_rooms(
    sel_b: String,
    bd: BuildingData) -> Vec<String> {
    // open campus.csv take each record that begins with respective abbreviation. In the event of 'All Buildings' Take the entirty of collumn 1 (Ignore the first row / header). CAMPUS_CSV.
    let mut rooms = Vec::new();
    let mut tmp = String::new();

    for item in bd.building_data { //  For each building in the data
        if (sel_b == item.name) || (sel_b == "All Buildings") {
            for j in item.rooms {  // iterate through rooms
                tmp.push_str(&item.abbrev.clone());
                tmp.push(' ');
                tmp.push_str(&j);
                rooms.push(tmp);
                tmp = String::new();
            }
        }
    }
    return rooms;
}

// given a hostname, returns a string that can be used to look it up in the hashmap, ie: AN-0204-PROC1 -> AN 204
// Helper function to track down the right records in the hasmap to make correct updates.
// fn hn_to_rm(hn: String) -> String {
//     let parts = hn.split("-");
//     let tmp = parts[0].clone();
//     for part in parts {
//         println!(part);
//     }
// }

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