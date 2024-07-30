/*
                  _                  
                 (_)                 
  _ __ ___   __ _ _ _ __    _ __ ___ 
 | '_ ` _ \ / _` | | '_ \  | '__/ __|
 | | | | | | (_| | | | | |_| |  \__ \
 |_| |_| |_|\__,_|_|_| |_(_)_|  |___/         


Backend
    - main()
    - handle_connection(stream: TcpStream)

JackNet
    - execute_ping(buffer) -> String
    - print_type_of<T>(_: &T)
    - find_curls(s) -> (usize, usize)
    - gen_hostnames(sel_devs, sel_b, bd) -> Vec<String>

ChkrBrd
    - get_room_schedule(buffer) -> String
    - get_lsm(buffer) -> String
    - construct_headers() -> HeaderMap

Jacks TODO 7/2/2024
updated 7/17/2024

 - JackNet 
        - potential scoping issues
    [ ]  read doc on lambda_http to handle ping request response.
    [x]  pull data on body store in struct
    [x]  reference struct to build hostnames w. campus.json
    [x]  ping hosts
         - ping c code doesnt support windows
         - permission issues w/ unix
         - looking into writing ping in rust
    [ ]  return boolean outputs of found or not.
         - type: string w/ json formatting.
         - ONCE THIS WORKS PROPOGATE TO USE MULTIPLE WORKS
    [ ]  CLI with JackNet
         - powershell istream doesnt work
    [ ]  CamCode (see curtis)
         [ ] Make DOM
         [ ] prints out info on config _PROTOTYPE ITERATE_
            - block for proj1 
            - block for proj2
         [ ] get compiled Q-SYS files to grep binary patterns
         [ ] Build an Error Log for server to pull back output,
            [ ] text file, return error and export it
            [ ] get logic that logs the buffer for 404 requests
 */

use jn_server::ThreadPool;
use jn_server::BuildingData;
use jn_server::Building;
use jn_server::PingRequest;

use jn_server::jp::{ping_this};

use lambda_http::Body;

use std::io::prelude::*;
use std::io::BufReader;
use std::io::Read;

use std::net::TcpStream;
use std::net::TcpListener;
use std::fs;

use std::str;
use std::env;
use std::env::*;
use std::collections::HashMap;

use std::process::*;

use reqwest::{ Response, header::{ HeaderMap, HeaderName, HeaderValue, ACCEPT, COOKIE }};

use serde::{Deserialize, Serialize};
use serde_json::json;

static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/bin/campus.json"));

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
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();
    let pool = ThreadPool::new(4);

    for stream in listener.incoming() {
        let stream = stream.unwrap();

        pool.execute(|| {
            handle_connection(stream);
        });
    }
}

fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0; 1024];

    stream.read(&mut buffer).unwrap();

    let get_index = b"GET / HTTP/1.1\r\n";
    let get_css = b"GET /page.css HTTP/1.1\r\n";
    let get_cc = b"GET /camcode.js HTTP/1.1\r\n";
    let get_cb = b"GET /checkerboard.js HTTP/1.1\r\n";
    let get_jn = b"GET /jacknet.js HTTP/1.1\r\n";
    let get_jn_json = b"GET /campus.json HTTP/1.1\r\n";
    let get_cb_json = b"GET /roomChecks.json HTTP/1.1\r\n";
    let get_main = b"GET /main.js HTTP/1.1\r\n";
    
    let ping = b"POST /ping HTTP/1.1\r\n";
    let schedule = b"POST /schedule HTTP/1.1\r\n";
    let lsm = b"POST /lsm HTTP/1.1\r\n";

    let (status_line, contents, filename);
    if buffer.starts_with(b"GET") {
        (status_line, filename) = 
            if buffer.starts_with(get_index) {
                ("HTTP/1.1 200 OK", "html-css-js/index.html")
            } else if buffer.starts_with(get_css) {
                ("HTTP/1.1 200 OK", "html-css-js/page.css")
            } else if buffer.starts_with(get_cc) {
                ("HTTP/1.1 200 OK", "html-css-js/camcode.js")
            } else if buffer.starts_with(get_cb) {
                ("HTTP/1.1 200 OK", "html-css-js/checkerboard.js")
            } else if buffer.starts_with(get_main) {
                ("HTTP/1.1 200 OK", "html-css-js/main.js")
            } else if buffer.starts_with(get_jn) {
                ("HTTP/1.1 200 OK", "html-css-js/jacknet.js")
            } else if buffer.starts_with(get_jn_json) {
                ("HTTP/1.1 200 OK", "html-css-js/campus.json")
            } else if buffer.starts_with(get_cb_json) {
                ("HTTP/1.1 200 OK", "html-css-js/roomChecks.json")
            } else {
                ("HTTP/1.1 404 NOT FOUND", "html-css-js/404.html")
            };
    
        contents = fs::read_to_string(filename).unwrap();

    } else if buffer.starts_with(b"POST") {
        (status_line, contents) = 
            if buffer.starts_with(ping) {
                ("HTTP/1.1 200 OK", execute_ping(&mut buffer))
            } else if buffer.starts_with(schedule) {
                ("HTTP/1.1 200 OK", get_room_schedule(&mut buffer))
            } else if buffer.starts_with(lsm) {
                ("HTTP/1.1 200 OK", get_lsm(&mut buffer))
            } else {
                ("HTTP/1.1 404 NOT FOUND", String::from("Empty"))
            };
    } else {
        (status_line, contents) = ("HTTP/1.1 404 NOT FOUND", String::from("Empty"));
    }

    // NOTE - look at this for error log format
    // ie:  
    //  if status_line == 404 not found
    //      then put in error file instead.
    //      add timestamp at top of line
    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line, contents.len(), contents
    );

    // Sends to STDOUT
    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();

    println!("Request: {}", str::from_utf8(&buffer).unwrap());
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
        
TODO:
   [ ] - Rewrite find_curls() for '(' instead to handle "hn.uwyo.edu (ip-addr)"
*/

// call ping_this executible here
fn execute_ping(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));

    let bs: BuildingData = serde_json::from_str(CAMPUS_STR)
        .expect("Fatal Error: Failed to build building data structs");

    let mut buff_copy: String = String::from_utf8_lossy(&buffer[..])
        .to_string();

    // functon that returns first '{' index location and it's '}' location
    let (i, j) = find_curls(&buff_copy);
    let buff_copy = &buff_copy[i..j+1];


    println!("Buffer Output:\n {}", buff_copy);
    let pr: PingRequest = serde_json::from_str(buff_copy)
        .expect("Fatal Error 2: Failed to parse ping request");
    println!("Ping Request: \n {:?}", pr);

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

    // TODO: Get this return to output in the console on the site.
    //String::from("jackpingtest")
    json_return.to_string()
}

// Debug function
//   Prints the type of a variable
fn print_type_of<T>(_: &T) {
    println!("{}", std::any::type_name::<T>());
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
    let mut tmp_tmp = String::new();

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
    for item in bd.buildingData { //  For each building in the data
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

fn get_room_schedule(buffer: &mut [u8]) -> String {
    return String::from("Empty");
}

#[tokio::main]
async fn get_lsm(buffer: &mut [u8]) -> String {
    let client = reqwest::Client::new();
    /* let resp = client.get("https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D")
        .headers(construct_headers())
        .send().await;
        
    println!("Response: {:?}", resp); */
    return String::from("Test");
}

// NOTE: do something like this when receiving ping info (this doesnt work)
// THEN reference this in gen_hostnames to compile a list of pingable hostnames.

/* pub struct Headers<'a> {
    auth: &'a str,
    cookie: &'a str,
}

impl Headers<'_> {
    fn new() {
        let auth = "Basic YXBpX2Fzc2VzczpVb2ZXeW8tQ1RTMzk0NS1BUEk=";
        let cookie = "JSESSIONID=none";

        return Headers {
            auth,
            cookie,
        };
    }
} */

fn construct_headers() -> HeaderMap {
    let mut header_map = HeaderMap::new();
    // let mut headers = Headers::new();
    header_map.insert(ACCEPT, HeaderValue::from_static("application/json"));
    header_map.insert(HeaderName::from_static("Authorization"), HeaderValue::from_static("Basic YXBpX2Fzc2VzczpVb2ZXeW8tQ1RTMzk0NS1BUEk="));
    header_map.insert(COOKIE, HeaderValue::from_static("JSESSIONID=none"));

    return header_map;
}

