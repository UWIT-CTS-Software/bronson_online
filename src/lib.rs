/*
 _ _ _               
| (_) |              
| |_| |__   _ __ ___ 
| | | '_ \ | '__/ __|
| | | |_) || |  \__ \
|_|_|_.__(_)_|  |___/
                    
thread
serde
fnBox
	call_box
job
	message
	worker
threadpool
	new
	execute
	drop
		drop
buildingData
Building
PingRequest
jack_ping
CFMRequest
CFMRoomRequest
CFMRequestFile
GeneralRequest
*/

use std::{
	str,
	thread,
	sync::{
		mpsc, Arc, Mutex,
	},
	fmt::Debug,
	collections::HashMap,
	fs::{ read }
};

use regex::bytes::Regex;
use serde::{Deserialize, Serialize, };

trait FnBox {
    fn call_box(self: Box<Self>);
}

impl<F: FnOnce()> FnBox for F {
    fn call_box(self: Box<F>) {
		(*self)()
    }
}

type Job = Box<dyn FnBox + Send + 'static>;

enum Message {
    NewJob(Job),
    Terminate,
}

struct Worker {
    _id: usize,
    thread: Option<thread::JoinHandle<()>>,
}

impl Worker {
    fn new(id: usize, receiver: Arc<Mutex<mpsc::Receiver<Message>>>) -> Worker {
		let thread = thread::spawn(move || {
			loop {
				let message = receiver.lock().unwrap().recv().unwrap();

				match message {
					Message::NewJob(job) => {
						println!("\rWorker {} got a job. Executing...", id);

						job.call_box();
					},
					Message::Terminate => {
						println!("\rWorker {} was told to terminate.", id);

						break;
					},
				}
			}
		});

		return Worker {
			_id: id,
			thread: Some(thread),
		};
    }
}

pub struct ThreadPool {
    workers: Vec<Worker>,
    sender: mpsc::Sender<Message>,
}

impl ThreadPool {
    pub fn new(size: usize) -> ThreadPool {
		assert!(size > 0);

		let (sender, receiver) = mpsc::channel();
		let receiver = Arc::new(Mutex::new(receiver));

		let mut workers = Vec::with_capacity(size);

		for id in 0..size {
			workers.push(Worker::new(id, Arc::clone(&receiver)));
		}

		return ThreadPool { 
			workers,
			sender,
		};
    }

    pub fn execute<F>(&self, f: F)
	where F: FnOnce() + Send + 'static {
		let job = Box::new(f);
		self.sender.send(Message::NewJob(job)).unwrap();
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
		println!("\rSending terminate message to all workers.");

		for _ in &mut self.workers {
			self.sender.send(Message::Terminate).unwrap();
		}

		for worker in &mut self.workers {
			if let Some(thread) = worker.thread.take() {
				thread.join().unwrap();
			}
		}
    }
}

// keys struct
#[derive(Serialize, Deserialize, Debug)]
pub struct Keys {
	pub lsm_api: String,
	pub gh_api: String,
	pub users: Vec<Vec<String>>
}
impl<'a> Clone for Keys {
	fn clone(&self) -> Keys {
		let new_lsm_api: Box<str> = <String as Clone>::clone(&self.lsm_api).into_boxed_str();
		let new_gh_api: Box<str> = <String as Clone>::clone(&self.gh_api).into_boxed_str();
	
		return Keys { 
			lsm_api: String::from(new_lsm_api),
			gh_api: String::from(new_gh_api),
			users: self.users.to_vec()
		};
	}
}

// ----------- Custom struct for checkerboard - jn <3
#[derive(Serialize, Deserialize, Debug)]
pub struct Room {
	pub name: String,
	pub hostnames: Vec<String>,
	pub ips: Vec<String>,
	pub gp: u8,
	pub checked: String,
	//pub jn_checked: Duration, //
	pub schedule: Vec<String>
}

// this is very rag-tag - error handling needs to be built-in
impl Room {
	pub fn update_checked(&mut self, val: String) {
		self.checked = val;
	}
	// pub fn update_jn_checked(&mut self) {
	// 	self.jn_checked = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).expect("Failed to init unchecked time");
	// }
	pub fn update_ips(&mut self, val: Vec<String>) {
		self.ips = val;
	}
}
impl<'a> Clone for Room {
	fn clone(&self) -> Room {
		let new_name: Box<str> = <String as Clone>::clone(&self.name).into_boxed_str();
		let new_checked: Box<str> = <String as Clone>::clone(&self.checked).into_boxed_str();
		// let new_jn_checked = &self.jn_checked;
		let new_hostnames = &self.hostnames;
		let new_ips = &self.ips;
		let new_schedule = &self.schedule;

		return Room {
			name: String::from(new_name),
			hostnames: (&new_hostnames).to_vec(),
			ips: (&new_ips).to_vec(),
			gp: self.gp,
			// jn_checked: self.jn_checked,
			checked: String::from(new_checked),
			schedule:(&new_schedule).to_vec(),
		};
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Request {
	pub start_line: String,
	pub headers: HashMap<String, String>,
	pub body: Vec<u8>
}

impl Request {
	pub fn build(buffer: [u8; 1024]) -> Request {
		let buf_vec: Vec<u8> = Vec::from(buffer);
		let mut lines: Vec<Vec<u8>> = Vec::new();

		let buf_lines = buf_vec
			.split(|b| b == &0xA)
			.map(|line| line.strip_suffix(&[0xD])
			.unwrap_or(line));

		for line in buf_lines {
			lines.push(line.into());
		}

		let start_line: String = String::from_utf8(lines[0].to_vec()).unwrap();
		let mut headers: HashMap<String, String> = HashMap::new();

		let mut iter = lines[1..].iter();
		while let Some(header_line) = iter.next() {
			let header_string = String::from_utf8(header_line.to_vec()).unwrap();
			if *header_string == *"" {
				break;
			}

			let header_parts: Vec<_> = header_string.split(": ").collect();
			if header_parts.len() == 2 {
				headers.insert(
					String::from(header_parts[0]), 
					String::from(header_parts[1])
				);
			}
		}

		let body: &mut Vec<u8> = &mut Vec::new();
		while let Some(body_line) = iter.next() {
			body.extend_from_slice(&body_line);
		}

		return Request{start_line, headers, body: body.to_vec()};
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
	pub status: String,
	pub headers: HashMap<String, String>,
	pub body: Vec<u8>,
	pub is_bytes: bool
}

impl Response {
	pub fn new() -> Response {
		let mut default_headers = HashMap::new();
		default_headers.insert(String::from("Content-Type"), String::from("*/*"));
		default_headers.insert(String::from("Content-Length"), String::from("0"));

		return Response{
			status: String::from(STATUS_500),
			headers: default_headers,
			body: Vec::new(),
			is_bytes: false
		};
	}

	pub fn status(&mut self, status: &str) {
		self.status = String::from(status);
	}

	pub fn insert_header(&mut self, key: &str, val: &str) {
		self.headers.insert(String::from(key), String::from(val));
	}

	pub fn send_file(&mut self, filepath: &str) {
		let file_parts: Vec<&str> = filepath.split(".").collect();
		let content_type = String::from("Content-Type");
		match file_parts[1] {
			"png"  => {
				self.headers.insert(content_type, String::from("image/png"));
				self.is_bytes = true;
				Some(String::new())
			},
			"html" => self.headers.insert(content_type, String::from("text/html")),
			"css"  => self.headers.insert(content_type, String::from("text/css")),
			"js"   => self.headers.insert(content_type, String::from("text/javascript")),
			"json" => self.headers.insert(content_type, String::from("application/json")),
			"zip"  => {
				self.headers.insert(content_type, String::from("application/zip"));
				let attachment_string = format!("attachment; filename=\"{}\"", filepath);
				self.headers.insert(String::from("Content-Disposition"), attachment_string);
				self.is_bytes = true;
				Some(String::new())
			},
			_      => self.headers.insert(content_type, String::from("application/octet-stream"))
		};

		self.body = read(filepath).unwrap();
		self.headers.insert(String::from("Content-Length"), self.body.len().to_string());
	}

	pub fn send_contents(&mut self, contents: Vec<u8>) {
		if self.headers.contains_key("Content-Type") {
			self.headers.remove("Content-Type");
		}
		if self.headers.contains_key("Content-Length") {
			self.headers.remove("Content-Length");
		}
		
		self.headers.insert(String::from("Content-Type"), String::from("text/text"));
		self.body = contents.into();
		self.headers.insert(String::from("Content-Length"), self.body.len().to_string());
	}

	pub fn insert_onload(&mut self, function: &str) {
		let pre_post_search = Regex::new(r"(?<preamble>[\d\D]*<body).*(?<postamble>>[\d\D]*)").unwrap();
		let pre_contents = &self.body;
		let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return () };
		let pre = String::from_utf8(pre_post["preamble"].to_vec()).unwrap();
		let post = String::from_utf8(pre_post["postamble"].to_vec()).unwrap();
		let contents = format!("{} onload={}{}", pre, function, post);
		if self.headers.contains_key("Content-Length") {
			self.headers.remove("Content-Length");
		}
		self.headers.insert(String::from("Content-Length"), self.body.len().to_string());
		self.body = contents.into();
	}

	pub fn build(&mut self) -> Vec<u8> {
		let mut content: Vec<u8> = Vec::new();
		for c in self.status.chars() {
			content.push(c as u8);
		}
		content.push(b'\r');
		content.push(b'\n');
		for (key, val) in <HashMap<String, String> as Clone>::clone(&self.headers).into_iter() {
			for c in key.chars() {
				content.push(c as u8);
			}
			content.push(b':');
			content.push(b' ');
			for c in val.chars() {
				content.push(c as u8);
			}
			content.push(b'\r');
			content.push(b'\n');
		}
		content.push(b'\r');
		content.push(b'\n');
		content.extend(&self.body);

		return content;
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ZoneRequest {
	pub zones: Vec<String>,
}

// ----------- Custom structs for JackNet Requests
// campus.json format
#[derive(Serialize, Deserialize, Debug)]
pub struct BuildingData {
    pub building_data: Vec<Building>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Building {
    pub name: String,
    pub abbrev: String,
    pub rooms: Vec<String>
}

// building.get_building_hostnames()
//   - Could this be a good idea?
//   - TODO (?)
// impl Building {
//     fn get_building_hostnames(&self) -> Vec<String> {
//         let mut string_vec: Vec<String> = ["EN-0104-PROC1"];
//         string_vec
//     }
// }

#[derive(Serialize, Deserialize, Debug)]
pub struct PingRequest {
    pub devices: Vec<String>,
    pub building: String
}

// Ping Module
mod jack_ping;

pub use crate::jack_ping::jp;

// ----------- Custom structs for CFM Requests
#[derive(Serialize, Deserialize, Debug)]
pub struct CFMRequest {
	pub building: String,
	pub rm: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CFMRoomRequest {
	pub building: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CFMRequestFile {
	pub filename: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeneralRequest {
	pub request: String,
	pub host: String,
	//pub User-Agent: String, 
	pub accept: String,
	//pub Accept-Language: String,
	//pub Accept-Encoding: String,
	pub referer: String,
	//pub Content-Type: String,
	//pub Content-Length: String,
	pub origin: String,
	pub connection: String,
	//pub Sec-Fetch-Dest: String,
	//pub Sec-Fetch-Mode: String,
	//pub Sec-Fetch-Site: String,
	pub dnt: String,
	//pub Sec-GPC: String,
	pub priority: String,
	pub buffer: String
}

pub static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/campus.json"));
pub static CFM_DIR   : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code");
pub static WIKI_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/md");
pub static ROOM_CSV  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/roomConfig_agg.csv");
pub static CAMPUS_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/html-css-js/campus.csv");
pub static KEYS      : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/src/keys.json");
pub static STATUS_200: &str = "HTTP/1.1 200 OK";
pub static STATUS_303: &str = "HTTP/1.1 303 See Other";
pub static STATUS_404: &str = "HTTP/1.1 404 Not Found";
pub static STATUS_500: &str = "HTTP/1.1 500 Internal Server Error";

pub const ZONE_1: [&'static str; 11] = [
    "Science%20Initiative%20Building%20(SI)", "Geology%20(GE)", "Health%20Sciences%20(HS)", 
    "STEM%201st%20Floor", "STEM%202nd%20Floor", "STEM%203rd%20Floor", "Berry%20Center%20(BC)",
    "Engineering%20Education%20and%20Research%20Building%20(EERB)", "Anthropology%20(AN)", 
    "Earth%20Sciences%20Building%20(ESB)", "Energy%20Innovation%20Center%20(EIC)", 
];
pub const ZONE_2: [&'static str; 8] = [
    "Engineering%20(EN)", "Agriculture%20(AG)", "Education%20(ED)", "History%20(HI)", 
    "Half%20Acre%20(HA)", "Business%20(BU)", "Coe%20Library%20(CL)", "Education%20Annex%20(EA)", 
];
pub const ZONE_3: [&'static str; 9] = [
    "Physical%20Sciences%20(PS)", "Classroom%20Building%20(CR)", 
    "Arts%20%26%20Sciences%20(AS)", "Aven%20Nelson%20(AV)", "Biological%20Sciences%20(BS)", 
    "Native%20American%20Ed%20Research%20%26%20Culteral%20Center%20(NA)", "Ross%20Hall%20(RH)", 
    "Hoyt%20Hall%20(HO)", "Guthrie%20House%20(GH)", 
];
pub const ZONE_4: [&'static str; 8] = [
    "IT%20Center%20(ITC)", "Corbett%20(CB)", "Law%20School%20(LS)", "Beta%20House%20(BH)", 
    "Buchanan%20Center%20for%20Performing%20Arts%20(PA)", "Visual%20Arts%20(VA)", 
    "Animal%20Science/Molecular%20Biology%20(AB)", "American%20Heritage%20Center%20(AC)", 
];

pub const ZONE_1_SHORT: [&'static str; 9] = [
    "SI", "GE", "HS", "STEM", "BC", "EERB", "AN", "ES", "EIC",
];
pub const ZONE_2_SHORT: [&'static str; 8] = [
    "EN", "AG", "ED", "HI", "HA", "BU", "CL", "EA",
];
pub const ZONE_3_SHORT: [&'static str; 10] = [
    "PS", "CR", "AS", "AV", "BS", "NAC", "RH", "HO", "GH", "CI" // Add to ZONE_3
];
pub const ZONE_4_SHORT: [&'static str; 8] = [
    "IT", "CB", "LS", "BH", "PA", "VA", "AB", "AC",
];