/*                _                  
                 (_)                 
  _ __ ___   __ _ _ _ __    _ __ ___ 
 | '_ ` _ \ / _` | | '_ \  | '__/ __|
 | | | | | | (_| | | | | |_| |  \__ \
 |_| |_| |_|\__,_|_|_| |_(_)_|  |___/         


Backend
    - main()
    - handle_connection(stream: TcpStream)
    - process_buffer(buffer: mut [u8]) -> String
    - find_curls(s) -> (usize, usize)
    - print_type_of<T>(_: &T)

JackNet
    - execute_ping(buffer) -> String
    - gen_hostnames(sel_devs, sel_b, bd) -> Vec<String>

ChkrBrd
    - get_room_schedule(buffer) -> String
    - get_lsm(buffer) -> String
    - construct_headers() -> HeaderMap

CamCode
    - cfm_build_dir(buffer) -> String
    - cfm_build_rm(buffer) -> String
    - get_cfm(buffer) -> String
    - get_cfm_file(buffer) -> String
    - dir_exists(path: &str) -> bool
    - is_this_file(path: &str) -> bool
    - is_this_dir(path: &str) -> bool
    - find_files(building: String, rm: String) -> Vec<String>
    - get_dir_contents(path: &str) -> Vec<String>

Jacks TODO 7/2/2024
updated 7/31/2024

 - JackNet 
    [ ]  CLI with JackNet
         - powershell istream doesnt work
 - CamCode (see curtis)
    [ ] Make DOM
    [ ] prints out info on config _PROTOTYPE ITERATE_
       - block for proj1 
       - block for proj2
    [ ] get compiled Q-SYS files to grep binary patterns
    [ ] Build an Error Log for server to pull back output,
       [ ] text file, return error and export it
       [ ] get logic that logs the buffer for 404 requests
 */

// dependencies
// ----------------------------------------------------------------------------
use server_lib::{
    ThreadPool, BuildingData, PingRequest, Room, 
    CFMRequest, CFMRoomRequest, CFMRequestFile, 
    jp::{ ping_this, },
};
//use lambda_http::Body;
use getopts::Options;
use std::{
    str, env,
    io::{ prelude::*, Read, },
    net::{ TcpStream, TcpListener, },
    fs::{
        read, read_to_string, read_dir, metadata,
        File,
    },
    sync::{ Arc, },
    error::{ Error, },
    string::{ String, },
    borrow::{ Borrow, },
    clone::{ Clone, },
    option::{ Option, },
    collections::{ HashMap },
    hash::{ Hash },
    fmt::{ Debug },
};
use reqwest::{ 
    header::{ HeaderMap, HeaderValue, AUTHORIZATION, ACCEPT }
};
use csv::{ Reader, StringRecord};
use local_ip_address::{ local_ip };
use serde_json::json;
use regex::Regex;
use chrono::{ Datelike, offset::Local };
// ----------------------------------------------------------------------------

// load up the ROM
// ----------------------------------------------------------------------------
static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/bin/campus.json"));
static CFM_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code");
static WIKI_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/md");
static ROOM_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/roomConfig.csv");
static CAMPUS_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/campus.csv");

static LOGIN: &'static str = "Basic YXBpX2Fzc2VzczpVb2ZXeW8tQ1RTMzk0NS1BUEk=";
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
    //debug setting
    env::set_var("RUST_BACKTRACE", "1");

    // define flags
    //   -l -- run on localhost:7878
    //   -p -- run with public ip on port 7878
    //   -d -- run in debug mode : NOTE: this is not yet implemented
    // ------------------------------------------------------------------------
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
        println!("Found the d flag!");
    }
    // ------------------------------------------------------------------------

    // define variables
    // ------------------------------------------------------------------------

    let room_filter = Regex::new(r"^[A-Z]+ [0-9A-Z]+$").unwrap();
    let time_filter = Regex::new(r"^[0-9:]+ [AP].M. - [0-9:]+ [AP].M.$").unwrap();
    let day_filter  = Regex::new(r"[MTWRF]+ [0-9]{4}-[0-9]{4}").unwrap();

    let rooms = gen_room_map(room_filter.clone(), time_filter.clone(), day_filter.clone()).ok().unwrap();
    println!("{:?}", Local::now().date_naive().weekday());
    
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
    println!("[!] host_ip set to {}", host_ip);

    env::set_var("API_USER", "api_assess");
    env::set_var("API_PASSWORD", "UofWyo-CTS3945-API");
    let listener = TcpListener::bind(host_ip).unwrap();
    let pool = ThreadPool::new(4);
    let cookie_jar = Arc::new(reqwest::cookie::Jar::default());
    // ------------------------------------------------------------------------

    for stream in listener.incoming() {
        let cookie_jar = Arc::clone(&cookie_jar);
        let stream = stream.unwrap();
        let clone_rooms = clone_map(&rooms);

        pool.execute(move || {
            handle_connection(stream, cookie_jar, clone_rooms);
        });
    }
}

fn clone_map<'a, String: Eq + Hash + Debug + Clone, Room: Clone + Debug>(source: &'a HashMap<String, Room>) -> HashMap<String, Room> where String: Borrow<String> {
    let mut target: HashMap<String, Room> = HashMap::new();
    for (k, v) in source.iter() {
        target.insert(String::from(k.clone()), v.clone());
    }
    return target;
}

fn handle_connection(mut stream: TcpStream, cookie_jar: Arc<reqwest::cookie::Jar>, rooms: HashMap<String, Room>) -> Option<()> {
    let mut buffer = [0; 1024];

    stream.read(&mut buffer).unwrap();

    // define variables
    // ------------------------------------------------------------------------
    // ------------------------------------------------------------------------

    // HTML-oriented files
    // ------------------------------------------------------------------------
    let get_index   = b"GET / HTTP/1.1\r\n";
    let get_css     = b"GET /page.css HTTP/1.1\r\n";
    let get_cc      = b"GET /camcode.js HTTP/1.1\r\n";
    let get_ccalt   = b"GET /cc-altmode.js HTTP/1.1\r\n";
    let get_cb      = b"GET /checkerboard.js HTTP/1.1\r\n";
    let get_jn      = b"GET /jacknet.js HTTP/1.1\r\n";
    let get_jn_json = b"GET /campus.json HTTP/1.1\r\n";
    let get_cb_json = b"GET /roomChecks.json HTTP/1.1\r\n";
    let get_wiki    = b"GET /wiki.js HTTP/1.1\r\n";
    // ------------------------------------------------------------------------
    
    // fetch data from the backend
    // ------------------------------------------------------------------------
    // Jacknet
    let ping        = b"POST /ping HTTP/1.1\r\n";
    // Checkerboard
    let run_cb         = b"POST /run_cb HTTP/1.1\r\n";
    // CamCode
    // CamCode - CFM Requests
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
    let (contents, filename);
    
    if buffer.starts_with(b"GET") {
        if buffer.starts_with(get_index) {
            filename = "html-css-js/index.html";
        } else if buffer.starts_with(get_css) {
            filename = "html-css-js/page.css";
        } else if buffer.starts_with(get_cc) {
            filename = "html-css-js/camcode.js";
        } else if buffer.starts_with(get_ccalt) {
            filename = "html-css-js/cc-altmode.js";
        } else if buffer.starts_with(get_cb) {
            filename = "html-css-js/checkerboard.js";
        } else if buffer.starts_with(get_jn) {
            filename = "html-css-js/jacknet.js";
        } else if buffer.starts_with(get_jn_json) {
            filename = "html-css-js/campus.json";
        } else if buffer.starts_with(get_cb_json) {
            filename = "html-css-js/roomChecks.json";
        } else if buffer.starts_with(get_wiki) {
            filename = "html-css-js/wiki.js";
        } else {
            status_line =  "HTTP/1.1 404 NOT FOUND";
            filename = "html-css-js/404.html";
        };
        contents = read_to_string(filename).unwrap();
    } else if buffer.starts_with(b"POST") {
        if buffer.starts_with(ping) {
            contents = execute_ping(&mut buffer); // JN
        } else if buffer.starts_with(run_cb) {
            let mut return_str: String = String::new();
            for (name, room) in rooms.into_iter() {
                return_str.push_str(&pad(name, 10));
                return_str.push_str(" | [-] NEEDS CHECKED");
                return_str.push_str(" | LAST CHECKED 01/01/2000");
                return_str.push_str(" | [+] AVAILABLE");
                return_str.push_str(" | UNTIL 00:00");
                return_str.push_str("\n");
            }
            let json_return = json!({
                "rooms": return_str,
            });
            
            contents = json_return.to_string();
        } /* else if buffer.starts_with(lsm) {
            let req = reqwest::blocking::Client::builder()
                .cookie_provider(cookie_jar)
                .user_agent("server_lib/0.3.1")
                .default_headers(construct_headers())
                .build().ok()?
                .get("https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D")
            ;

            println!("{:?}", req);

            println!("Fetching url...");
            let res = req.send().ok()?;

            println!("Response: {:?} {}", res.version(), res.status());
            println!("Headers: {:#?}\n", res.headers());

            contents = String::from(res.text().ok()?);
        } */ else if buffer.starts_with(cfm_build) { // CC-CFM
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
            contents = String::from("Empty");
        };
    } else {
        status_line = "HTTP/1.1 404 NOT FOUND";
        contents = String::from("Empty");
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

        println!("Request: {}", str::from_utf8(&buffer).unwrap());
    } else {
        response = format!(
            "{}\r\nContent-Length: {}\r\n\r\n{}",
            status_line, contents.len(), contents
        );
        // Sends to STDOUT
        stream.write(response.as_bytes()).unwrap();
        stream.flush().unwrap();

        println!("Request: {}", str::from_utf8(&buffer).unwrap());
    }
    // ------------------------------------------------------------------------

    Option::Some(())
}

// Preps the Buffer to be parsed as json string
fn process_buffer(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));
    let buff_copy: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    // functon that returns first '{' index location and it's '}' location
    let (i, j) = find_curls(&buff_copy);
    let buff_copy  = &buff_copy[i..j+1];

    println!("Buffer Output:\n {}", buff_copy);
    //String::from("Test")
    buff_copy.to_string()
}

// used to trim excess info off of the buffer
fn find_curls(s: &String) -> (usize, usize) {
    let bytes = s.as_bytes();
    let mut i_return: usize = 0;
    
    for (i, &item) in bytes.iter().enumerate() {
        if item == b'{' {
            i_return = i;
        }
        if item == b'}' {
            return (i_return, i);
        }
    }
    (s.len(), s.len())
}

// generate room HashMap
// ----------------------------------------------------------------------------
fn gen_room_map<'a>(room_filter: Regex, time_filter: Regex, day_filter: Regex) -> Result<HashMap<String, Room<'a>>, Box<dyn Error>> {

    /* let mut schedules: HashMap<String, Vec<&str>> = HashMap::new();
    let schedule_data = File::open(ROOM_CSV)?;
    let mut schedule_rdr = Reader::from_reader(schedule_data);
    let mut current_room: String = String::from("Init");
    let mut room_array: Vec<&str> = vec![];
    for result in schedule_rdr.records() {
        let record = result?;
        if room_filter.is_match(record.get(0).expect("Empty")) {
            schedules.insert(current_room, room_array);
            current_room = String::from(record.get(0).expect("Empty"));
            room_array = vec![];
        } else if time_filter.is_match(record.get(0).expect("Empty")) {
            let find = if day_filter.find(record.get(1).expect("Empty")).is_some() {
                day_filter.find(record.get(1).expect("Empty")).expect("Empty").as_str()
            } else {
                ""
            };
            println!("{:?}", find);
            room_array.push(&find);
        }
    } */


    let mut rooms: HashMap<String, Room> = HashMap::new();
    let room_data = File::open(CAMPUS_CSV)?;
    let mut room_rdr = Reader::from_reader(room_data);
    for result in room_rdr.records() {
        let record = result?;
        if room_filter.is_match(record.get(0).expect("Empty")) {
            let mut item_vec: Vec<i32> = Vec::new();
            for i in 1..6 {
                item_vec.push(record.get(i).expect("-1").parse().unwrap());
            }

            /* let schedule = (&schedules.get(&String::from(record.get(0).expect("Empty"))).unwrap()).to_vec(); */

            let room = Room {
                name: String::from(record.get(0).expect("Empty")),
                items: item_vec,
                gp: record.get(6).expect("-1").parse().unwrap(),
                checked: 0,
                schedule: vec![],
            };

            rooms.insert(String::from(&room.name), room);
        }
    }

    Ok(rooms)
}

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
        
TODO:
   [ ] - Rewrite find_curls() for '(' instead to handle "hn.uwyo.edu (ip-addr)"
*/

// call ping_this executible here
fn execute_ping(buffer: &mut [u8]) -> String {
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
        bs);

    println!("{:?}", hostnames);

    // Write for loop through hostnames
    let mut hn_ips: Vec<String> = Vec::new();
    for hn in hostnames.clone() {
        println!("Hostname: {}", hn);
        let hn_ip = ping_this(hn);
        println!("IpAdr:    {}", hn_ip);
        hn_ips.push(hn_ip);
    }

    // format data into json using Serde
    let json_return = json!({
        "building": pr.building,
        "hostnames": hostnames,
        "ips": hn_ips
    });

    // convert to string and return it
    println!("Pulled IP's:\n{:?}",hn_ips);
    println!("----\n------\nEND OF execute_ping() FUNCTION\n------\n-----\n");

    // Return JSON with ping results
    json_return.to_string()
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
    bd: BuildingData) -> Vec<String> {
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
                temp_hostname.push_str(&item.abbrev);
                temp_hostname.push('-');
                temp_hostname.push_str(&format!("{:0>4}", j).to_string());
                temp_hostname.push('-');
                if devices[0] {
                    tmp_tmp = temp_hostname.clone();
                    tmp_tmp.push_str("proc1");
                    //println!("generated hostname: \n {}", tmp_tmp);
                    hostnames.push(tmp_tmp);
                }
                if devices [1] {
                    tmp_tmp = temp_hostname.clone();
                    tmp_tmp.push_str("pj1");
                    //println!("generated hostname: \n {}", tmp_tmp);
                    hostnames.push(tmp_tmp);
                }
                if devices [2] {
                    tmp_tmp = temp_hostname.clone();
                    tmp_tmp.push_str("ws1");
                    //println!("generated hostname: \n {}", tmp_tmp);
                    hostnames.push(tmp_tmp);
                }
                if devices [3] {
                    tmp_tmp = temp_hostname.clone();
                    tmp_tmp.push_str("tp1");
                    //println!("generated hostname: \n {}", tmp_tmp);
                    hostnames.push(tmp_tmp);
                }
                if devices [4] {
                    tmp_tmp = temp_hostname.clone();
                    tmp_tmp.push_str("cmicx1");
                    //println!("generated hostname: \n {}", tmp_tmp);
                    hostnames.push(tmp_tmp);
                }
                /* TODO (?): FORMAT WHEN QUANTITY IS KNOWN
                for q in procCount {
                    hostnames.push(temp_hostname.push("proc{}", q))
                } */
                
                //hostnames.push(temp_hostname.clone());
                temp_hostname = String::new();
            }       
        }
    }
    // Return value
    hostnames
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

fn construct_headers() -> HeaderMap {
    let mut header_map = HeaderMap::new();
    header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
    header_map.insert(AUTHORIZATION, HeaderValue::from_static(LOGIN));

    return header_map;
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
    metadata(path).is_ok()
}

fn is_this_file(path: &str) -> bool {
    metadata(path).unwrap().is_file()
}

fn is_this_dir(path: &str) -> bool {
    metadata(path).unwrap().is_dir()
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
    return strings
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
    //return String::from("127.0.0.1:7878");
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
    json_return.to_string()
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
    json_return.to_string()
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

    json_return.to_string()
    //return String::from("{names: cfm-test}");
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

    //let cfm_files = find_files(cfmr.building, cfmr.rm);
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
    //return String::from("THIS SHOULD BE A DIRECTORY VEC")
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

fn w_build_articles(buffer: &mut [u8]) -> String {
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

    // strings = ;
    
    let json_return = json!({
        "names": article_vec
    });

    return json_return.to_string();
    // return "TEST STRING"
}