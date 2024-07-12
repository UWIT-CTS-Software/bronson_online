use jn_server::ThreadPool;
use lambda_http::Body;

use std::io::prelude::*;
use std::io::BufReader;
use std::io::Read;

use std::net::TcpStream;
use std::net::TcpListener;
use std::fs;
use std::fs::File;
use std::path::Path;
use std::str;
use std::env;
use std::env::*;
use std::collections::HashMap;
use std::error::Error;

use reqwest::{ Response, header::{ HeaderMap, HeaderName, HeaderValue, ACCEPT, COOKIE }};

use serde::{Deserialize, Serialize};

// ----------- Structs
// campus.json format
#[derive(Serialize, Deserialize)]
struct BuildingData {
    buildingData: Vec<Building>,
}

#[derive(Serialize, Deserialize)]
struct Building {
    name: String,
    abbrev: String,
    rooms: Vec<String>
}

#[derive(Serialize, Deserialize)]
struct PingRequest {
    devices: Vec<String>,
    building: String
}

static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/bin/campus.json"));
/*
Jacks TODO 7/2/2024

 - JackNet 
        - potential scoping issues
    - read doc on lambda_http to handle ping request
    - pull data on body store in struct
    - reference struct to build hostnames w. campus.json
    - ping hosts
    - return boolean outputs of found or not.
     - type: string w/ json formatting.
    - ONCE THIS WORKS PROPOGATE TO USE MULTIPLE WORKS
 - CLI with JackNet
    - powershell istream doesnt work
 - CamCode (see curtis)
    - Make DOM
    - prints out info on config _PROTOTYPE ITERATE_
        - block for proj1 
        - block for proj2
    - get compiled Q-SYS files to grep binary patterns
    - Build an Error Log for server to pull back output,
        - text file, return error and export it
        - get logic that logs the buffer for 404 requests
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

// TODO - execute_ping
// call ping_this executible here
// 7.8.2024 notes
//  -- starting to spin wheels, loaded in the campu.json as CAMPUS_STR
//  -- struggling with rust and manipulating variables
//  need to break the buffer up into correct variables as well as
//  load in the correct data from CAMPUS_STR
fn execute_ping(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));

    // load ping options
    // println!("testtestestes: {}", input);
    let pr: PingRequest = serde_json::from_str(&String::from_utf8_lossy(&buffer[..]))
        .expect("REASON");

    // println!("Looking for {}", pr);

    println!("Looking for {:?} in {}", pr.devices, pr.building);
    // Read the json file (../../html-css-js/jacknet.js)
    // where am i
    // print out the json for test
    //println!("Final directory: {}", CAMPUS_STR);
    // store relevant campus_str entries for use
    let b: BuildingData = serde_json::from_str(CAMPUS_STR).expect("REASON");

    println!("Rooms within {:?}", b.buildingData[0].name);

    // Alex's addition
    let output = Command::new("./src/ping_this")
        .arg("bc-0138-proc1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .output()
        .expect("[-] Failed to execute")
    ;

    println!("{:?}", output);

    if let Some(exit_code) = output.status.code() {
        if exit_code == 0 {
            println!("[+] Ok.");
        } else {
            eprintln!("[-] Failed with exit code {}", exit_code);
        }
    } else {
        eprintln!("[!] Interrupted!");
    }
    
    return String::from_utf8(output.stdout).unwrap();
}

// Debug function
//   Prints the type of a variable
fn print_type_of<T>(_: &T) {
    println!("{}", std::any::type_name::<T>());
}

// TODO - read json file
fn read_from_file<P: AsRef<Path>>(path: P) -> Result<Building, Box<dyn Error>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    // Read JSON file
    let b = serde_json::from_reader(reader)?;
    Ok(b)
}

// TODO - compile hostnames with devices and building
// fn gen_hostnames(devices: [&String], building: String) -> [&String] {
//     return
//}





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

