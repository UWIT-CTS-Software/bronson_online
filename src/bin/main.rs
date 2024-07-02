use jn_server::ThreadPool;
use std::io::prelude::*;
use std::net::TcpStream;
use std::net::TcpListener;
use std::fs;
use std::str;

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

    if buffer.starts_with(b"GET") {

        let (status_line, filename) = 
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
    
        let contents = fs::read_to_string(filename).unwrap();
        let response = format!(
            "{}\r\nContent-Length: {}\r\n\r\n{}",
            status_line, contents.len(), contents
        );
        stream.write(response.as_bytes()).unwrap();
        stream.flush().unwrap();
    } else if buffer.starts_with(b"POST") {
        ;
    }

    println!("Request: {}", str::from_utf8(&buffer).unwrap());
}

fn execute_command(buffer: &mut [u8]) {
    println!("Request: {}", String::from_utf8_lossy(&buffer[..]));
    return;
}