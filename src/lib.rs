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
use log::{ warn, };
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
						job.call_box();
					},
					Message::Terminate => {
						warn!("\rWorker {} was told to terminate.", id);

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
		warn!("\rSending terminate message to all workers.");

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
pub struct Building {
	pub name: String,
	pub lsm_name: String,
	pub abbrev: String,
	pub rooms: Vec<Room>,
}

impl Building {
	pub fn get_completion(&self) -> f32 {
		return 1.0;
	}
}
impl<'a> Clone for Building {
	fn clone(&self) -> Building {
		let new_name: Box<str> = <String as Clone>::clone(&self.name).into_boxed_str();
		let new_lsm_name: Box<str> = <String as Clone>::clone(&self.lsm_name).into_boxed_str();
		let new_abbrev: Box<str> = <String as Clone>::clone(&self.abbrev).into_boxed_str();

		return Building {
			name: String::from(new_name),
			lsm_name: String::from(new_lsm_name),
			abbrev: String::from(new_abbrev),
			rooms: (&self.rooms).to_vec()
		}
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Room {
	pub name: String,
	pub hostnames: Vec<Vec<String>>,
	pub ips: Vec<Vec<String>>,
	pub gp: u8,
	pub checked: String,
	pub needs_checked: u8,
	pub schedule: Vec<String>,
	pub available: u8,
	pub until: String
}

// this is very rag-tag - error handling needs to be built-in
impl Room {
	pub fn update_checked(&mut self, val: String) {
		self.checked = val;
	}
	pub fn update_ips(&mut self, val: Vec<Vec<String>>) {
		self.ips = val;
	}
}
impl<'a> Clone for Room {
	fn clone(&self) -> Room {
		let new_name: Box<str> = <String as Clone>::clone(&self.name).into_boxed_str();
		let new_checked: Box<str> = <String as Clone>::clone(&self.checked).into_boxed_str();
		let new_until: Box<str> = <String as Clone>::clone(&self.until).into_boxed_str();

		return Room {
			name: String::from(new_name),
			hostnames: (&self.hostnames).to_vec(),
			ips: (&self.ips).to_vec(),
			gp: self.gp,
			checked: String::from(new_checked),
			needs_checked: self.needs_checked,
			schedule:(&self.schedule).to_vec(),
			available: self.available,
			until: String::from(new_until),
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

		let first_null_char = body.iter().position(|&x| x == 0);
		if first_null_char.is_some() {
			let _ = body.split_off(first_null_char.unwrap());
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

#[derive(Serialize, Deserialize, Debug)]
pub struct BuildingJSON {
    pub name: String,
    pub abbrev: String,
    pub rooms: Vec<String>
}

// building.get_building_hostnames()
//   - Could this be a good idea?
//   - TODO (?)
// impl BuildingJSON {
//     fn get_building_hostnames(&self) -> Vec<String> {
//         let mut string_vec: Vec<String> = ["EN-0104-PROC1"];
//         string_vec
//     }
// }

#[derive(Serialize, Deserialize, Debug)]
pub struct PingRequest {
    pub devices: Vec<u8>,
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

pub static CAMPUS_STR: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/data/campus.json"));
pub static CFM_DIR   : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code");
pub static WIKI_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/md");
pub static ROOM_CSV  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/roomConfig_agg.csv");
pub static CAMPUS_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/campus.csv");
pub static KEYS      : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/src/keys.json");
pub static STATUS_200: &str = "HTTP/1.1 200 OK";
pub static STATUS_303: &str = "HTTP/1.1 303 See Other";
pub static STATUS_404: &str = "HTTP/1.1 404 Not Found";
pub static STATUS_500: &str = "HTTP/1.1 500 Internal Server Error";

pub const ZONE_1: [&'static str; 9] = [
    "Science%20Initiative%20Building%20(SI)", "Geology%20(GE)", "Health%20Sciences%20(HS)", 
    "Michael%20B.%20Enzi%20STEM%20(STEM)", "Berry%20Center%20(BC)",
    "Engineering%20Education%20and%20Research%20Building%20(EERB)", "Anthropology%20(AN)", 
    "Earth%20Sciences%20Building%20(ESB)", "Energy%20Innovation%20Center%20(EIC)", 
];
pub const ZONE_2: [&'static str; 8] = [
    "Engineering%20(EN)", "Agriculture%20(AG)", "Education%20(ED)", "History%20(HI)", 
    "Half%20Acre%20(HA)", "Business%20(BU)", "Coe%20Library%20(CL)", "Education%20Annex%20(EA)", 
];
pub const ZONE_3: [&'static str; 11] = [
    "Physical%20Sciences%20(PS)", "Classroom%20Building%20(CR)", 
    "Arts%20%26%20Sciences%20(AS)", "Aven%20Nelson%20(AV)", "Biological%20Sciences%20(BS)", 
    "Native%20American%20Ed%20Research%20%26%20Culteral%20Center%20(NA)", "Ross%20Hall%20(RH)", 
    "Hoyt%20Hall%20(HO)", "Guthrie%20House%20(GH)", "Cheney%20International%20Center%20(CIC)",
	"Knight%20Hall%20(KH)"
];
pub const ZONE_4: [&'static str; 8] = [
    "IT%20Center%20(ITC)", "Corbett%20(CB)", "Law%20School%20(LS)", "Beta%20House%20(BH)", 
    "Buchanan%20Center%20for%20Performing%20Arts%20(PA)", "Visual%20Arts%20(VA)", 
    "Animal%20Science/Molecular%20Biology%20(AB)", "American%20Heritage%20Center%20(AC)", 
];

pub const ZONE_1_SHORT: [&'static str; 9] = [
    "SI", "GE", "HS", "ST", "BC", "EERB", "AN", "ES", "EIC",
];
pub const ZONE_2_SHORT: [&'static str; 8] = [
    "EN", "AG", "ED", "HI", "HA", "BU", "CL", "EA",
];
pub const ZONE_3_SHORT: [&'static str; 11] = [
    "PS", "CR", "AS", "AV", "BS", "NAC", "RH", "HO", "GH", "CI", "KH" // Add to ZONE_3
];
pub const ZONE_4_SHORT: [&'static str; 8] = [
    "IT", "CB", "LS", "BH", "PA", "VA", "AB", "AC",
];

pub const ABBREV_TO_NAME: [(&'static str, &'static str, &'static str); 36] = [
	("SI",   "Science Initiative",          "Science%20Initiative%20Building%20(SI)"),
	("GE",   "Geology",                     "Geology%20(GE)"),
	("HS",   "Health Sciences",             "Health%20Sciences%20(HS)"),
	("ST",   "Enzi STEM",                   "Michael%20B.%20Enzi%20STEM%20(STEM)"),
	("BC",   "Berry Center",                "Berry%20Center%20(BC)"),
	("EERB", "EERB",                        "Engineering%20Education%20and%20Research%20Building%20(EERB)"),
	("AN",   "Anthropology",                "Anthropology%20(AN)"),
	("ES",   "Earth Sciences",              "Earth%20Sciences%20Building%20(ESB)"),
	("EIC",  "Energy Innovation Center",    "Energy%20Innovation%20Center%20(EIC)"),
	("EN",   "Engineering",                 "Engineering%20(EN)"),
	("AG",   "Agriculture",                 "Agriculture%20(AG)"),
	("ED",   "Education",                   "Education%20(ED)"),
	("HI",   "History",                     "History%20(HI)"),
	("HA",   "Half Acre",                   "Half%20Acre%20(HA)"),
	("BU",   "Business",                    "Business%20(BU)"),
	("CL",   "Coe Library",                 "Coe%20Library%20(CL)"),
	("EA",   "Education Annex",             "Education%20Annex%20(EA)"),
	("PS",   "Physical Sciences",           "Physical%20Sciences%20(PS)"),
	("CR",   "Classroom Building",          "Classroom%20Building%20(CR)"),
	("AS",   "Arts and Sciences",           "Arts%20%26%20Sciences%20(AS)"),
	("AV",   "Aven Nelson",                 "Aven%20Nelson%20(AV)"),
	("BS",   "Biological Sciences",         "Biological%20Sciences%20(BS)"),
	("NAC",  "Native American Center",      "Native%20American%20Ed%20Research%20%26%20Culteral%20Center%20(NA)"),
	("RH",   "Ross Hall",                   "Ross%20Hall%20(RH)"),
	("HO",   "Hoyt Hall",                   "Hoyt%20Hall%20(HO)"),
	("GH",   "Guthrie House",               "Guthrie%20House%20(GH)"),
	("CI",   "Cheney International Center", "Cheney%20International%20Center%20(CIC)"),
	("IT",   "IT Center",                   "IT%20Center%20(ITC)"),
	("CB",   "Corbett",                     "Corbett%20(CB)"),
	("LS",   "Law School",                  "Law%20School%20(LS)"),
	("BH",   "Beta House",                  "Beta%20House%20(BH)"),
	("PA",   "Performing Arts",             "Buchanan%20Center%20for%20Performing%20Arts%20(PA)"),
	("VA",   "Visual Arts",                 "Visual%20Arts%20(VA)"),
	("AB",   "Animal Sciences",             "Animal%20Science/Molecular%20Biology%20(AB)"),
	("AC",   "American Heritage Center",    "American%20Heritage%20Center%20(AC)"),
	("KH",   "Knight Hall",                 "Knight%20Hall%20(KH)")
];