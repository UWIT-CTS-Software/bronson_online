use jn_server::ThreadPool;
use lambda_http::Body;

use std::io::prelude::*;
use std::net::TcpStream;
use std::net::TcpListener;
use std::fs;
use std::str;
use std::collections::HashMap;
use std::error::Error;

use reqwest::{ Response, header::{ HeaderMap, HeaderName, HeaderValue, ACCEPT, COOKIE }};

fn main() {
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


    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line, contents.len(), contents
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();

    println!("Request: {}", str::from_utf8(&buffer).unwrap());
}

fn execute_ping(buffer: &mut [u8]) -> String {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));
    
    return String::from("Empty");
}

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