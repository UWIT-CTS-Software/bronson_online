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

pub mod models;
pub mod schema;

use std::{
	string,
	str,
	env,
	thread,
	sync::{
		mpsc, Arc, Mutex,
	},
	fmt::{ Debug, Display, Formatter, Result as FmtResult, },
	collections::HashMap,
	fs::{ read, read_to_string, File },
	error::Error,
};
use cookie::{ CookieJar, Key, };
use csv::Reader;
use log::{ warn, error, /* info */ };
use regex::bytes::Regex as RegBytes;
use regex::Regex;
use serde::{ Deserialize, Serialize, };
use serde_json::json;
use chrono::{ DateTime, Utc, };
use diesel::{
	prelude::*,
	r2d2::{ self, ConnectionManager },
	PgConnection,
	/* associations::HasTable, */
};
use dotenvy::dotenv;
use crate::schema::bronson::{
	buildings::dsl::*,
	rooms::dsl::*,
	users::dsl::*,
	keys::dsl::*,
	data::dsl::*,
};
use crate::models::{
	DB_Hostname, DB_IpAddress,
	DB_Room, DB_Building, DB_User, DB_Key, DB_DataElement,
	DeviceType,
};

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
		let receiver_clone = Arc::clone(&receiver);
		let thread = thread::Builder::new()
			.name(id.to_string())
			.spawn(move || {
				loop {
					let message = receiver_clone.lock().unwrap().recv().unwrap();

					match message {
						Message::NewJob(job) => {
								//info!("[Worker {} got a job; executing]", id);
							job.call_box();
						},
						Message::Terminate => {
							warn!("\rWorker {} was told to terminate.", id);

							break;
						},
					}
				}
			}
		);

		match thread {
			Ok(thread) => {
				return Worker {
					_id: id,
					thread: Some(thread),
				};
			},
			Err(error) => {
				println!("Error: {}", error);
				return Self::new(id, Arc::clone(&receiver));
			},
		}
		// return Worker {
		// 	_id: id,
		// 	thread: Some(thread),
		// };
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
		match self.sender.send(Message::NewJob(job)) {
			Ok(_) => (),
			Err(e) => panic!("EXC_ERR: {}", e)
		};
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

// Thread Schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSchedule {
    pub duration: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadSchedule {
    pub tasks: HashMap<String, TaskSchedule>
}

impl ThreadSchedule {
    pub fn new() -> Self {
        ThreadSchedule {
            tasks: HashMap::new()
        }
    }
    pub fn from_json(json_str: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json_str)
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}

// pub struct ThreadQueue {
// 	pub 
// }

// Database
pub type PgPool = r2d2::Pool<ConnectionManager<PgConnection>>;

#[derive(Debug, Clone)]
pub struct Database {
	pub pool: Arc<PgPool>,
	key: Key,
}

impl Database {
	pub fn new() -> Database {
		dotenv().ok();

		let db_url = env::var("DATABASE_URL").expect("DATABASE_URL env variable not found.");
		//let connection = PgConnection::establish(&db_url)
		//	.unwrap_or_else(|_| panic!("Error connecting to {}", db_url));
		let manager = ConnectionManager::<PgConnection>::new(db_url);
		let pool = r2d2::Pool::builder()
			.build(manager)
			.expect("Failed to create Database Connection Pool");
		
		return Database {
			pool: Arc::new(pool),
			key: Key::generate(),
		}
	}

	pub fn init_if_empty(&mut self) -> Option<()> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let bldg_results = buildings
			.select(DB_Building::as_select())
			.load(&mut conn)
			.expect("Error loading buildings.");

		if bldg_results.len() == 0 {
			let bldg_file: String = read_to_string(BLDG_JSON).ok()?;
			let json_buildings: HashMap<String, Building> = serde_json::from_str(bldg_file.as_str()).ok()?;

			for (json_abbrev, building) in json_buildings.iter() {
				let new_bldg = DB_Building { 
					abbrev: json_abbrev.to_string(), 
					name: building.name.clone(), 
					lsm_name: building.lsm_name.clone(), 
					zone: building.zone as i16,
					total_rooms: 0,
					checked_rooms: 0
				};

				self.update_building(&new_bldg);
			}
		}

		let room_results = rooms
			.select(DB_Room::as_select())
			.load(&mut conn)
			.expect("Error loading rooms.");
		
		if room_results.len() == 0 {
			let room_filter = RegBytes::new(r"^[A-Z]+ [0-9A-Z]+$").unwrap();

			let mut schedules: HashMap<String, Vec<String>> = HashMap::new();
			let schedule_data = File::open(ROOM_CSV).unwrap();
			let mut schedule_rdr = Reader::from_reader(schedule_data);
			for result in schedule_rdr.records() {
				let record = result.unwrap();
				let room_name = record.get(0).expect("Empty");
				if room_filter.is_match(room_name.as_bytes()) {
					let room = String::from(room_name);
					let mut room_schedule = Vec::new();
					for block in 1..8 {
						if record.get(block).expect("Empty") == "" {
							break;
						}

						room_schedule.push(String::from(record.get(block).expect("Empty")));
					}

					schedules.insert(room, room_schedule);
				}
    		}

			let room_data = File::open(CAMPUS_CSV).unwrap();
			let mut room_rdr = Reader::from_reader(room_data);
			for result in room_rdr.records() {
				let record = result.unwrap();
				let room_name = record.get(0).expect("Empty");
				if room_filter.is_match(room_name.as_bytes()) {
					let mut item_vec: Vec<u8> = Vec::new();
					for i in 1..7 {
						item_vec.push(record.get(i).expect("-1").parse().unwrap());
					}

					let room_schedule = match schedules.get(&String::from(room_name)) {
						Some(x) => {
							let mut opt_vec = Vec::<Option<String>>::new();
							for item in x {
								opt_vec.push(Some(item.to_string()));
							}

							opt_vec
						},
						_       => Vec::<Option<String>>::new(),
					};
					let hn_vec = Self::gen_hn(String::from(room_name), &item_vec);
					let ping_vec = Self::gen_ip(&hn_vec);

					let new_room = DB_Room {
						abbrev: String::from(room_name.split(' ').next().unwrap()),
						name: String::from(room_name),
						checked: String::from("2000-01-01T00:00:00Z"),
						needs_checked: true,
						gp: match record.get(7).expect("-1").parse().unwrap() {
							0 => false,
							_ => true,
						},
						available: false,
						until: String::from("Tomorrow"),
						ping_data: ping_vec,
						schedule: room_schedule.to_vec()
					};

					self.update_room(&new_room);
				}
			}
		}

		let user_results = users
			.select(DB_User::as_select())
			.load(&mut conn)
			.expect("Error loading users.");

		if user_results.len() == 0 {
			let user_file: String = read_to_string(USERS).ok()?;
			let json_users: HashMap<String, i16> = serde_json::from_str(user_file.as_str()).ok()?;

			for (user, perms) in json_users.iter() {
				let new_user = DB_User { 
					username: user.clone(), 
					permissions: *perms as i16
				};

				self.update_user(&new_user);
			}

		}

		let key_results = keys
			.select(DB_Key::as_select())
			.load(&mut conn)
			.expect("Error loading keys");

		if key_results.len() == 0 {
			let key_file: String = read_to_string(KEYS).ok()?;
			let json_keys: HashMap<String, String> = serde_json::from_str(key_file.as_str()).ok()?;

			for (id, value) in json_keys.iter() {
				let new_key = DB_Key {
					key_id: id.clone(),
					val: value.clone()
				};

				self.update_key(&new_key);
			}
		}

		let data_results = data
			.select(DB_DataElement::as_select())
			.load(&mut conn)
			.expect("Error loading data.");

		if data_results.len() == 0 {
			self.update_data(&DB_DataElement {
				key: String::from("dashboard"),
				val: String::from("Welcome to bronson!"),
			});

			self.update_data(&DB_DataElement {
				key: String::from("schedule"),
				val: String::from(read_to_string(TSCH_JSON).unwrap().to_string()),
			});

			self.update_data(&DB_DataElement {
				key: String::from("alias_table"),
				val: String::from("\"buildings\": [],\"rooms\": []"),
			});
		}

		Some(())
	}

	pub fn gen_hn(room_name: String, items: &Vec<u8>) -> Vec<Option<DB_Hostname>> {
		let mut hn_vec: Vec<Option<DB_Hostname>> = Vec::new(); 
		for dev_count in 0..items.len() {
			for dev in 1..=items[dev_count] {
				hn_vec.push(
					Some(DB_Hostname {
						room: room_name.clone(),
						dev_type: match dev_count {
							0 => DeviceType::PROC,
							1 => DeviceType::PJ,
							2 => DeviceType::DISP,
							3 => DeviceType::TP,
							4 => DeviceType::WS,
							5 => DeviceType::CMIC,
							_ => DeviceType::UNKNOWN
						},
						num: dev as i32
					})
				);
			}
		}

		return hn_vec;
	}

	pub fn gen_ip(hn_vec: &Vec<Option<DB_Hostname>>) -> Vec<Option<DB_IpAddress>> {
		let mut ip_vec: Vec<Option<DB_IpAddress>> = Vec::new();
		for hn in hn_vec {
			ip_vec.push(
				Some(DB_IpAddress {
					hostname: hn.clone().unwrap().clone(),
					ip: String::from("x"),
					last_ping: String::from("2000-01-01T00:00:00Z"),
					alert: 0,
					error_message: String::new()
				})
			);
		}

		return ip_vec;
	}

	pub fn get_cookie_key(&mut self) -> Key {
		return self.key.clone();
	}

	pub fn get_campus(&mut self) -> HashMap<String, Building>{
		let mut ret_map: HashMap<String, Building> = HashMap::new();
		let bldg_map = self.get_buildings();
		for (bldg_abbrev, bldg) in bldg_map {
			ret_map.insert(
				bldg_abbrev.clone(),
				Building {
					abbrev: bldg.abbrev,
					name: bldg.name,
					lsm_name: bldg.lsm_name,
					rooms: self.get_rooms_by_abbrev(&bldg_abbrev),
					zone: bldg.zone,
					total_rooms: bldg.total_rooms,
					checked_rooms: bldg.checked_rooms
				}
			);
		}

		ret_map
	}

	pub fn get_buildings(&mut self) -> HashMap<String, DB_Building> {
		let mut ret_map: HashMap<String, DB_Building> = HashMap::new();
		let mut conn = self.pool.get().expect("Failed to get DB Connection");
		let bldg_array = buildings
			.select(DB_Building::as_select())
			.load(&mut conn)
			.expect("SQL_ERR: Error loading buildings");

		for bldg in bldg_array {
			ret_map.insert(bldg.abbrev.to_string(), bldg);
		}

		ret_map
	}

	pub fn get_building_by_abbrev(&mut self, bldg_abbrev: &String) -> DB_Building {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");
		buildings
			.find(bldg_abbrev)
			.select(DB_Building::as_select())
			.first(&mut conn)
			.optional()
			.expect("SQL_ERR: Error loading buildings by abbreviation")
			.unwrap()
	}

	pub fn update_building(&mut self, building: &DB_Building) {
		use crate::schema::bronson::buildings::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::insert_into(buildings)
			.values(building)
			.on_conflict(abbrev)
			.do_update()
			.set(building)
			.returning(DB_Building::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error inserting building");
	}

	pub fn delete_building(&mut self, id: &String) {
		use crate::schema::bronson::buildings::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::delete(buildings)
			.filter(abbrev.eq(id))
			.returning(DB_Building::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error deleting building");
	}

	pub fn get_rooms_by_abbrev(&mut self, bldg_abbrev: &String) -> Vec<DB_Room> {
		use crate::schema::bronson::rooms::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let mut ret_vec = rooms
			.select(DB_Room::as_select())
			.filter(abbrev.eq(bldg_abbrev))
			.load(&mut conn)
			.expect("SQL_ERR: Error loading rooms by abbreviation");

		ret_vec.sort_by_key(|r| r.name.clone());
		ret_vec
	}

	pub fn get_room_by_name(&mut self, room_name: &String) -> DB_Room {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		rooms
			.find(room_name)
			.select(DB_Room::as_select())
			.first(&mut conn)
			.optional()
			.expect("SQL_ERR: Error loading room by name")
			.unwrap()
	}

	pub fn update_room(&mut self, room: &DB_Room) {
		use crate::schema::bronson::rooms::dsl::name;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::insert_into(rooms)
			.values(room)
			.on_conflict(name)
			.do_update()
			.set(room)
			.returning(DB_Room::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error inserting room");
	}

	pub fn delete_room(&mut self, id: &String) {
		use crate::schema::bronson::rooms::dsl::name;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::delete(rooms)
			.filter(name.eq(id))
			.returning(DB_Room::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error deleting key");
	}

	pub fn get_user(&mut self, user: &str) -> Option<DB_User> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		users
			.select(DB_User::as_select())
			.filter(username.eq(user))
			.first(&mut conn)
			.optional()
			.expect("SQL_ERR: Error loading user")
	}

	pub fn update_user(&mut self, user: &DB_User) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::insert_into(users)
			.values(user)
			.on_conflict(username)
			.do_update()
			.set(user)
			.returning(DB_User::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error inserting user");
	}

	pub fn delete_user(&mut self, user: &String) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::delete(users)
			.filter(username.eq(user))
			.returning(DB_User::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error deleting user");
	}

	pub fn get_key(&mut self, id: &str) -> DB_Key {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		keys
			.select(DB_Key::as_select())
			.filter(key_id.eq(id))
			.first(&mut conn)
			.optional()
			.expect("SQL_ERR: Error loading key")
			.unwrap()
	}

	pub fn update_key(&mut self, update_key: &DB_Key) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::insert_into(keys)
			.values(update_key)
			.on_conflict(key_id)
			.do_update()
			.set(update_key)
			.returning(DB_Key::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error inserting key");
	}

	pub fn delete_key(&mut self, id: &String) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::delete(keys)
			.filter(key_id.eq(id))
			.returning(DB_Key::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error deleting key");
	}

	pub fn get_data(&mut self, data_key: &str) -> Option<DB_DataElement> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		data
			.select(DB_DataElement::as_select())
			.filter(key.eq(data_key))
			.first(&mut conn)
			.optional()
			.expect("SQL_ERR: Error loading data element")
	}

	pub fn update_data(&mut self, element: &DB_DataElement) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::insert_into(data)
			.values(element)
			.on_conflict(key)
			.do_update()
			.set(element)
			.returning(DB_DataElement::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error inserting user");
	}

	pub fn delete_data(&mut self, data_key: &String) {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let _ = diesel::delete(data)
			.filter(key.eq(data_key))
			.returning(DB_DataElement::as_returning())
			.get_result(&mut conn)
			.expect("SQL_ERR: Error deleting data element");

	}
}

// impl<'a> Clone for Database {
// 	fn clone(&self) -> Database {
// 		return Database {
// 			pool: self.pool.clone(),
// 			key: self.key.clone(),
// 		};
// 	}
// }

//TODO Sync + Send for Database {}

// ----------- Custom struct for checkerboard - jn <3
#[derive(Serialize, Deserialize, Debug)]
pub struct Building {
	pub abbrev: String,
	pub name: String,
	pub lsm_name: String,
	pub rooms: Vec<DB_Room>,
	pub zone: i16,
	pub total_rooms: i16,
	pub checked_rooms: i16
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
			rooms: (&self.rooms).to_vec(),
			zone: self.zone,
			total_rooms: self.total_rooms,
			checked_rooms: self.checked_rooms,
		}
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Request {
	pub start_line: String,
	pub headers: HashMap<String, String>,
	pub body: Vec<u8>
}

impl Request {
	pub fn from(buffer: [u8; BUFF_SIZE]) -> Request {
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

	pub fn has_valid_cookie(&mut self, database: &mut Database) -> bool {
		if !self.headers.contains_key("Cookie") {
			return false;
		}
        
        let username_search = Regex::new("^(?<username>.*)=(?<key>.*=.*)").unwrap();
        let uname = match username_search.captures(self.headers.get("Cookie").unwrap()) {
            Some(uname) => uname,
            None => panic!("Unable to capture username.")
        };
        let user = match database.get_user(&uname["username"]) {
            Some(u) => u,
            None => DB_User{ username: String::new(), permissions: 0 },
        };

        let mut jar = CookieJar::new();
        jar.signed_mut(&database.get_cookie_key()).add((user.username.clone(), user.username.clone()));
        let signed_val = jar.get(&user.username).cloned().unwrap();

		if signed_val.value() != &uname["key"] {
			return false;
		}

		return true;
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

	pub fn insert_header(&mut self, header: &str, value: &str) {
		self.headers.insert(String::from(header), String::from(value));
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
		let pre_post_search = RegBytes::new(r"(?<preamble>[\d\D]*<body).*(?<postamble>>[\d\D]*)").unwrap();
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
		for (header, value) in <HashMap<String, String> as Clone>::clone(&self.headers).into_iter() {
			for c in header.chars() {
				content.push(c as u8);
			}
			content.push(b':');
			content.push(b' ');
			for c in value.chars() {
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

#[derive(Debug)]
pub enum TerminalError {
	Unauthorized,
	EmptyArray,
	InvalidArgument(String),
	StrParseError(str::Utf8Error),
	StringParseError(string::FromUtf8Error),
	ResponseError(String),
}

impl Display for TerminalError {
	fn fmt(&self, f: &mut Formatter) -> FmtResult {
		match self {
			TerminalError::Unauthorized => write!(f, "Unauthorized.\n"),
			TerminalError::EmptyArray => write!(f, "No command found.\n"),
			TerminalError::InvalidArgument(item) => write!(f, "Invalid argument: {}\n", item),
			TerminalError::StrParseError(item) => write!(f, "Unable to parse: {}\n", item),
			TerminalError::StringParseError(item) => write!(f, "Unable to parse: {}", item),
			TerminalError::ResponseError(item) => write!(f, "An error occured: {}\n", item),
		}
	}
}

impl Error for TerminalError {}

pub struct Terminal;
impl Terminal {
    pub fn execute(req: &Request) -> Result<Response, TerminalError> {
		let mut res = Response::new();
		let arg_str: &str = match str::from_utf8(&req.body) {
			Ok(s) => s,
			Err(e) => {
				error!("Unable to parse argument string: {}", e);
				return Err(TerminalError::StrParseError(e));
			}
		};
		let arg_vec: Vec<String> = Self::group_delimited(arg_str.split(" ").collect());
		
		if arg_vec.len() == 0 || arg_vec[0].as_str() == "" {
			return Err(TerminalError::EmptyArray);
		}

		let mut contents: Vec<u8> = Vec::new();
		let mut is_file = false;
		match arg_vec[0].as_str() {
			"get"    => {
				if arg_vec.len() == 1 || arg_vec[1] == "" {
					return Err(TerminalError::InvalidArgument("Unknown `get` argument. See `get -h` for help".to_owned()))
				}

				match arg_vec[1].as_str() {
					"-h"        => {
						contents = "get [ log | campus | version | alerts | blacklist ]".into();
					},
					"log"       => {
						is_file = true;
						res.send_file(LOG);
					},
					"campus"       => {
						// WARNING: This function call generates an entirely new Database object that will have a cookie key that is different than the database object in main.
						// This was done because the only thing being done is data retrieval, not cookie management. I am too lazy to pass a database object to this function.
						contents = json!(Database::get_campus(&mut Database::new())).to_string().into();
					},
					"version"   => {
						contents = env!("CARGO_PKG_VERSION").into();
					},
					"alerts"    => {
						contents = "none".into();
					},
					"blacklist" => {
						contents = "none".into();
					},
					&_          => {
						return Err(TerminalError::InvalidArgument("Unknown `get` argument. See `get -h` for help.".to_owned())).into();
					}
				}
			},
			"add"    => {
				contents = "add page".into();
			},
			"update" => {
				contents = "update page".into();
			},
			"delete" => {
				contents = "delete page".into();
			},
			"help"   => {
				contents = "
hello  : hello NAME
get    : get [ log | campus | version | alerts | blacklist ]
add    : add [ user '{username: permissions}' | data '{key: val}' | key '{key: val}' ]
update : update []
delete : delete []
help   : help
            ".into();
			},
			&_       => {
				return Err(TerminalError::InvalidArgument("Unknown comand: ".to_owned() + &arg_vec[0]));
			},
		}

		res.status(STATUS_200);
		if !is_file {
			res.send_contents(json!({
				"response": String::from_utf8(contents).unwrap()
			}).to_string().into());
		}

		return Ok(res);
    }

	pub fn group_delimited(args: Vec<&str>) -> Vec<String> {
		let mut ret_vec: Vec<String> = Vec::new();
		let mut agg_string: String = String::new();
		let mut aggregate = false;
		let mut q_char: &str = "";
		for word in args {
			if word.starts_with("\"") && q_char == "" {
				q_char = "\"";
				aggregate = true;
			} else if word.starts_with("\'") && q_char == "" {
				q_char = "\'";
				aggregate = true;
			}
			
			if q_char != "" && word.ends_with(q_char) && !word.ends_with(&("\\".to_owned() + q_char)) {
				agg_string.push(' ');
				agg_string.push_str(word);
				ret_vec.push(agg_string.clone());
				q_char = "";
				aggregate = false;
				continue;
			}

			if aggregate {
				agg_string.push_str(word);
			} else {
				ret_vec.push(String::from(word));
			}
		}
		ret_vec
	}
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ZoneRequest {
	pub zones: Vec<String>,
}

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

pub static BUFF_SIZE : usize = 4096;
pub static TSCH_JSON : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/techSchedule.json");
pub static BLDG_JSON : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/buildings.json");
pub static CAMPUS_STR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/campus.json");
pub static CFM_DIR   : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code");
pub static WIKI_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/md");
pub static ROOM_CSV  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/roomConfig_agg.csv");
pub static CAMPUS_CSV: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/campus.csv");
pub static LOG       : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/output.log");
pub static KEYS      : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/keys.json");
pub static USERS     : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/users.json");
pub static STATUS_200: &str = "HTTP/1.1 200 OK";
pub static STATUS_303: &str = "HTTP/1.1 303 See Other";
pub static STATUS_401: &str = "HTTP/1.1 401 Unauthorized";
pub static STATUS_404: &str = "HTTP/1.1 404 Not Found";
pub static STATUS_500: &str = "HTTP/1.1 500 Internal Server Error";