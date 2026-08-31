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
CFMRequestFile
GeneralRequest
*/

pub mod models;
mod schema;
// Ping Module
mod jack_ping;

pub use crate::jack_ping::jp;

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
	fs::{ read, read_to_string, },
	error::Error,
	time::Duration,
	clone::Clone,
};
use reqwest::header::{ HeaderMap, IntoHeaderName };
use cookie::{ CookieJar, Key, };
use log::{ warn, error, info, debug };
use regex::bytes::Regex as RegBytes;
use regex::Regex;
use serde::{ Deserialize, Serialize, };
use serde_json::{ json, Value };
use chrono::{ DateTime, Utc, Local, Days, };
use diesel::{
	prelude::*,
	r2d2::{ self, ConnectionManager },
	PgConnection,
	result::Error as DieselError,
	/* associations::HasTable, */
};
use dotenvy::dotenv;
use crate::schema::bronson::{
	buildings::dsl::*,
	rooms::dsl::*,
	users::dsl::*,
	keys::dsl::*,
	data::dsl::*,
	tickets::dsl::*,
	projects::dsl::*,
	reservations::dsl::*
};
use crate::models::{
	DB_Hostname, DB_IpAddress,
	DB_Room, DB_Building, DB_User, DB_Key, DB_DataElement,
	DeviceType, DB_Ticket, DB_Reservation, DB_Project
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

pub struct HostnameGenerator { // Make i64 u8 through *n as u8
	pub room: String,
	pub procs: i64,
	pub tps: i64,
	pub pjs: i64,
	pub disps: i64
}

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

	pub async fn init(&mut self, _tdx_client: Arc<API>, lsm_client: Arc<API>) -> Option<()> {
		info!("[Data] Initializing database...");
		info!("[Data] Fetching buildings...");
		let buildings_json: Value = match lsm_client
			.build()
			.method("GET")
			.endpoint("https://uwyo.talem3.com/lsm/api/BuildingInfo")
			.timeout(Duration::from_secs(15))
			.send::<Value>()
			.await {
				Ok(b) => b,
				Err(m) => { 
					error!("Buildings not recieved from lsm: {}", m); 
					return None;
				}
			}
			.body;

		let building_vec: Vec<Value> = match buildings_json["data"].as_array() {
			Some(d) => d.clone(),
			None    => Vec::new()
		};

		for b in building_vec {
			let name_regex = Regex::new(r"^(?<name>.*)\s\((?<abbrev>.*)\)$").unwrap();
			let name_captures = match name_regex.captures(&b["Location"]["name"].as_str().expect("Uh oh")) {
				Some(caps) => caps,
				None       => {
					error!("Unable to collect building name regex."); 
					return None; 
				}
			};

			match self.update_building(
				&DB_Building {
					name: name_captures["name"].to_string(),
					abbrev: name_captures["abbrev"].to_string(),
					building_id: b["Location"]["id"].as_i64().expect("Uh oh"),
					lsm_name: String::from(b["Location"]["name"].as_str().expect("Uh oh")),
					zone: 1,
					total_rooms: 0,
					checked_rooms: 0
				}
			) {
				Ok(_) => (),
				Err(m) => {
					error!("Unable to insert building: {}", m);
				}
			};
		}

		info!("[Data] Preparing to fetch rooms...");
		let mut room_count;
		let mut room_offset;

		info!("[Data] Fetching room DHCP configuration...");

		let mut rooms_map: HashMap<i64, HostnameGenerator> = HashMap::new();

		room_count = 100;
		room_offset = 0;
		while room_count == 100 {
			let procs_json: Value = match lsm_client
				.build()
				.method("GET")
				.endpoint(&format!("https://uwyo.talem3.com/lsm/api/ProcsPerRoom?offset={}", room_offset))
				.timeout(Duration::from_secs(15))
				.send::<Value>()
				.await {
					Ok(b)  => b,
					Err(m) => {
						error!("Unable to parse ProcsPerRoom API call: {}", m);
						return None;
					}
				}
				.body;

			room_count = match procs_json["count"].as_i64() {
				Some(c) => c,
				None    => {
					error!("Unable to get rooms count");
					0
				}
			};

			room_offset += room_count;

			let counts_vec = match procs_json["data"].as_array() {
				Some(cs) => cs,
				None     => {
					error!("Unable to parse ProcsPerRoom data");
					&Vec::new()
				}
			};

			for proc_count in counts_vec {
				match rooms_map.get(&proc_count["Location"]["id"].as_i64().expect("Empty")) {
					Some(cs) =>  {
						rooms_map.insert(
							proc_count["Location"]["id"].as_i64().expect("Empty"), 
							HostnameGenerator {
								room: String::from(proc_count["Location"]["name"].as_str().expect("Empty")),
								procs: proc_count["Processors Count"].as_i64().expect("Empty"),
								tps: cs.tps.clone(),
								pjs: cs.pjs.clone(),
								disps: cs.disps.clone()
						});
					},
					None     => {
						rooms_map.insert(
							proc_count["Location"]["id"].as_i64().expect("Empty"),
							HostnameGenerator {
								room: String::from(proc_count["Location"]["name"].as_str().expect("Empty")),
								procs: proc_count["Processors Count"].as_i64().expect("Empty"),
								tps: 0,
								pjs: 0,
								disps: 0
							}
						);
					}
				}
			}
		}

		room_count = 100;
		room_offset = 0;
		while room_count == 100 {
			let tps_json: Value = match lsm_client
				.build()
				.method("GET")
				.endpoint(&format!("https://uwyo.talem3.com/lsm/api/TPsPerRoom?offset={}", room_offset))
				.timeout(Duration::from_secs(15))
				.send::<Value>()
				.await {
					Ok(b)  => b,
					Err(m) => {
						error!("Unable to parse TPsPerRoom API call: {}", m);
						return None;
					}
				}
				.body;

			room_count = match tps_json["count"].as_i64() {
				Some(c) => c,
				None    => {
					error!("Unable to get rooms count");
					0
				}
			};

			room_offset += room_count;

			let counts_vec = match tps_json["data"].as_array() {
				Some(cs) => cs,
				None     => {
					error!("Unable to parse TpsPerRoom data");
					&Vec::new()
				}
			};

			for tps_count in counts_vec {
				match rooms_map.get(&tps_count["Location"]["id"].as_i64().expect("Empty")) {
					Some(cs) =>  {
						rooms_map.insert(
							tps_count["Location"]["id"].as_i64().expect("Empty"), 
							HostnameGenerator {
								room: String::from(tps_count["Location"]["name"].as_str().expect("Empty")),
								procs: cs.procs.clone(),
								tps: tps_count["TPs Count"].as_i64().expect("Empty"),
								pjs: cs.pjs.clone(),
								disps: cs.disps.clone()
						});
					},
					None     => {
						rooms_map.insert(
							tps_count["Location"]["id"].as_i64().expect("Empty"),
							HostnameGenerator {
								room: String::from(tps_count["Location"]["name"].as_str().expect("Empty")),
								procs: 0,
								tps: tps_count["TPs Count"].as_i64().expect("Empty"),
								pjs: 0,
								disps: 0
							}
						);
					}
				}
			}
		}

		room_count = 100;
		room_offset = 0;
		while room_count == 100 {
			let pjs_json: Value = match lsm_client
				.build()
				.method("GET")
				.endpoint(&format!("https://uwyo.talem3.com/lsm/api/ProjectorsPerRoom?offset={}", room_offset))
				.timeout(Duration::from_secs(15))
				.send::<Value>()
				.await {
					Ok(b)  => b,
					Err(m) => {
						error!("Unable to parse ProjectorsPerRoom API call: {}", m);
						return None;
					}
				}
				.body;

			room_count = match pjs_json["count"].as_i64() {
				Some(c) => c,
				None    => {
					error!("Unable to get rooms count");
					0
				}
			};

			room_offset += room_count;

			let counts_vec = match pjs_json["data"].as_array() {
				Some(cs) => cs,
				None     => {
					error!("Unable to parse ProjectorsPerRoom data");
					&Vec::new()
				}
			};

			for pj_count in counts_vec {
				match rooms_map.get(&pj_count["Location"]["id"].as_i64().expect("Empty")) {
					Some(cs) =>  {
						rooms_map.insert(
							pj_count["Location"]["id"].as_i64().expect("Empty"), 
							HostnameGenerator {
								room: String::from(pj_count["Location"]["name"].as_str().expect("Empty")),
								procs: cs.procs.clone(),
								tps: cs.tps.clone(),
								pjs: pj_count["Projectors Count"].as_i64().expect("Empty"),
								disps: cs.disps.clone()
						});
					},
					None     => {
						rooms_map.insert(
							pj_count["Location"]["id"].as_i64().expect("Empty"),
							HostnameGenerator {
								room: String::from(pj_count["Location"]["name"].as_str().expect("Empty")),
								procs: 0,
								tps: 0,
								pjs: pj_count["Projectors Count"].as_i64().expect("Empty"),
								disps: 0
							}
						);
					}
				}
			}
		}

		room_count = 100;
		room_offset = 0;
		while room_count == 100 {
			let disps_json: Value = match lsm_client
				.build()
				.method("GET")
				.endpoint(&format!("https://uwyo.talem3.com/lsm/api/DisplaysPerRoom?offset={}", room_offset))
				.timeout(Duration::from_secs(15))
				.send::<Value>()
				.await {
					Ok(b)  => b,
					Err(m) => {
						error!("Unable to parse DisplaysPerRoom API call: {}", m);
						return None;
					}
				}
				.body;

			room_count = match disps_json["count"].as_i64() {
				Some(c) => c,
				None    => {
					error!("Unable to get rooms count");
					0
				}
			};

			room_offset += room_count;

			let counts_vec = match disps_json["data"].as_array() {
				Some(cs) => cs,
				None     => {
					error!("Unable to parse DisplaysPerRoom data");
					&Vec::new()
				}
			};

			for disp_count in counts_vec {
				match rooms_map.get(&disp_count["Location"]["id"].as_i64().expect("Empty")) {
					Some(cs) =>  {
						rooms_map.insert(
							disp_count["Location"]["id"].as_i64().expect("Empty"), 
							HostnameGenerator {
								room: String::from(disp_count["Location"]["name"].as_str().expect("Empty")),
								procs: cs.procs.clone(),
								tps: cs.tps.clone(),
								pjs: cs.pjs.clone(),
								disps: disp_count["Displays Count"].as_i64().expect("Empty")
						});
					},
					None     => {
						rooms_map.insert(
							disp_count["Location"]["id"].as_i64().expect("Empty"),
							HostnameGenerator {
								room: String::from(disp_count["Location"]["name"].as_str().expect("Empty")),
								procs: 0,
								tps: 0,
								pjs: 0,
								disps: disp_count["Displays Count"].as_i64().expect("Empty")
							}
						);
					}
				}
			}
		}

		info!("[Data] Fetching rooms...");

		let rooms_ping_data: HashMap<i64, Vec<Option<DB_IpAddress>>> = Self::gen_dhcp_info(rooms_map);

		room_count = 100;
		room_offset = 0;
		while room_count == 100 {
			let rooms_json: Value = match lsm_client
				.build()
				.method("GET")
				.endpoint(&format!("https://uwyo.talem3.com/lsm/api/RoomInfo?offset={}&p=%7BMinAssessmentCount%3A%200%7D", room_offset))
				.timeout(Duration::from_secs(15))
				.send::<Value>()
				.await {
					Ok(r)  => r,
					Err(m) => {
						error!("Unable to parse RoomInfo API call: {}", m);
						return None;
					}
				}
				.body;

			room_count = match rooms_json["count"].as_i64() {
				Some(c) => c,
				None    => {
					error!("Unable to get rooms count");
					0
				}
			};

			room_offset += room_count;

			let rooms_vec = match rooms_json["data"].as_array() {
				Some(rs) => rs,
				None     => {
					error!("Unable to parse RoomInfo data");
					&Vec::new()
				}
			};

			for room in rooms_vec {
				let name_regex = Regex::new(r"^(?<abbrev>[A-Z]*)\s.*$").unwrap();
				let name_captures = match name_regex.captures(&room["Location"]["name"].as_str().expect("Uh oh")) {
					Some(caps) => caps,
					None       => {
						error!("Unable to collect building name regex."); 
						return None; 
					}
				};

				let is_gp = match room["Organizational Group"]["name"].as_str().expect("Uh oh") {
					"General Pool" => true,
					_              => false
				};

				match self.get_room_by_id(room["Location"]["id"].as_i64().expect("Uh oh")) {
					Ok(_) => { debug!("ROOM FOUND: {}", room["Location"]["name"].as_str().expect("Uh oh")); },
					Err(_) => { }
				}

				match self.update_room(
					&DB_Room {
						name: room["Location"]["name"].as_str().expect("Uh oh").to_string(),
						abbrev: name_captures["abbrev"].to_string(),
						room_id: room["Location"]["id"].as_i64().expect("Uh oh"),
						parent_id: room["Parent Id"].as_i64().expect("Uh oh"),
						collegenet_id: match room["25Live Location ID"].as_number() {
							Some(n) => Some(n.as_f64().unwrap() as i64),
							None    => None
						},
						checked: "2000-01-01T00:00:00Z".parse::<DateTime<Local>>().ok()?,
						needs_checked: true,
						gp: is_gp,
						check_period: if is_gp { 0 } else { 2 },
						offln: false,
						onln: "2000-01-01T00:00:00Z".parse::<DateTime<Local>>().ok()?,
						available: true,
						until: Local::now() + Days::new(1),
						ping_data: match rooms_ping_data.get(&room["Location"]["id"].as_i64().expect("Uh oh")) {
							Some(v) => v.clone(),
							None    => Vec::new()
						},
						schedule: Vec::new()
					}
				) {
					Ok(_) => (),
					Err(m) => {
						error!("Error inserting room {}: {}", room["Location"]["name"].as_str().expect("Uh oh"), m);
					}
				};
			}

		}

		info!("[Data] Fetching users...");
		
		let u_json = match env::var("USERS_JSON") {
			Ok(u)  => String::from(u),
			Err(m) => { 
				error!("USERS_JSON environment variable not found: {}", m);
				return None;
			}
		};
		let json_users: HashMap<String, i16> = match serde_json::from_str(&u_json) {
			Ok(ju) => ju,
			Err(m) => {
				error!("Unable to parse users json: {}", m);
				return None;
			}
		};

		for (user, perms) in json_users.iter() {
			let new_user = DB_User { 
				username: user.clone(), 
				permissions: *perms as i16
			};

			let _ = self.update_user(&new_user);
		}

		info!("[Data] Fetching data...");

		let mut conn = self.pool.get().expect("Failed to get DB Connection");
		let data_results = data
			.select(DB_DataElement::as_select())
			.load(&mut conn)
			.expect("Error loading data.");

		if data_results.len() == 0 {
			let _ = self.update_data(&DB_DataElement {
				key: String::from("dashboard"),
				val: String::from("Welcome to bronson!"),
			});

			let _ = self.update_data(&DB_DataElement {
				key: String::from("schedule"),
				val: String::from(read_to_string(TSCH_JSON).unwrap().to_string()),
			});

			let _ = self.update_data(&DB_DataElement {
				key: String::from("alias_table"),
				val: String::from("{\"buildings\": [], \"rooms\": []}"),
			});

			let _ = self.update_data(&DB_DataElement {
				key: String::from("lsm_leaderboard"),
				val: String::from(LDRB_ERR),
			});

			let _ = self.update_data(&DB_DataElement {
				key: String::from("lsm_spares"),
				val: String::from(SPRS_ERR),
			});
		}
		
		let k_json = match env::var("KEYS_JSON") {
			Ok(k)  => String::from(k),
			Err(m) => {
				error!("Unable to parse keys from environment file: {}", m);
				return None;
			}
		};
		let json_keys: HashMap<String, Value> = match serde_json::from_str(&k_json) {
			Ok(jk) => jk,
			Err(m) => {
				error!("Unable to parse key json into hashmap: {}", m);
				return None;
			}
		};


		let _ = self.update_key(
			&DB_Key {
				key_id: String::from("tdx_api_raw"),
				val: String::from(json_keys.get("tdx_api_raw").unwrap().to_string())
			}
		);

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

	pub fn gen_dhcp_info(rooms_map: HashMap<i64, HostnameGenerator> ) -> HashMap<i64, Vec<Option<DB_IpAddress>>> {
		let mut ret_hm: HashMap<i64, Vec<Option<DB_IpAddress>>> = HashMap::new();
		let mut ip_vec: Vec<Option<DB_IpAddress>>;
		for (r_id, devcounts) in rooms_map.iter() {
			ip_vec = Vec::new();
			for proc in 1..=devcounts.procs {
				ip_vec.push(
					Some(DB_IpAddress {
						hostname: DB_Hostname {
							room: devcounts.room.clone(),
							dev_type: DeviceType::PROC,
							num: proc as i32
						},
						ip: String::from("x"),
						last_ping: String::from("2000-01-01T00:00:00Z"),
						alert: 1,
						error_message: String::from("Not run yet.")
					})
				);
			}

			for tp in 1..=devcounts.tps {
				ip_vec.push(
					Some(DB_IpAddress {
						hostname: DB_Hostname {
							room: devcounts.room.clone(),
							dev_type: DeviceType::TP,
							num: tp as i32
						},
						ip: String::from("x"),
						last_ping: String::from("2000-01-01T00:00:00Z"),
						alert: 1,
						error_message: String::from("Not run yet.")
					})
				);
			}

			for pj in 1..=devcounts.pjs {
				ip_vec.push(
					Some(DB_IpAddress {
						hostname: DB_Hostname {
							room: devcounts.room.clone(),
							dev_type: DeviceType::PJ,
							num: pj as i32
						},
						ip: String::from("x"),
						last_ping: String::from("2000-01-01T00:00:00Z"),
						alert: 1,
						error_message: String::from("Not run yet.")
					})
				);
			}

			for disp in 1..=devcounts.disps {
				ip_vec.push(
					Some(DB_IpAddress {
						hostname: DB_Hostname {
							room: devcounts.room.clone(),
							dev_type: DeviceType::DISP,
							num: disp as i32
						},
						ip: String::from("x"),
						last_ping: String::from("2000-01-01T00:00:00Z"),
						alert: 1,
						error_message: String::from("Not run yet.")
					})
				);
			}

			ret_hm.insert(
				*r_id,
				ip_vec.clone()
			);
		}

		ret_hm
	}

	pub fn gen_ip(hn_vec: &Vec<Option<DB_Hostname>>) -> Vec<Option<DB_IpAddress>> {
		let mut ip_vec: Vec<Option<DB_IpAddress>> = Vec::new();
		for hn in hn_vec {
			ip_vec.push(
				Some(DB_IpAddress {
					hostname: hn.clone().unwrap().clone(),
					ip: String::from("x"),
					last_ping: String::from("2000-01-01T00:00:00Z"),
					alert: 1,
					error_message: String::from("Not run yet.")
				})
			);
		}

		return ip_vec;
	}

	pub fn get_cookie_key(&mut self) -> Key {
		return self.key.clone();
	}

	pub fn get_campus(&mut self) -> Result<HashMap<String, Building>, DieselError> {
		let mut ret_map: HashMap<String, Building> = HashMap::new();
		let bldg_map = self.get_buildings();
		match bldg_map {
			Ok(bm) => {
				for (bldg_abbrev, bldg) in bm {
					let rooms_by_abbrev: Vec<DB_Room> = match self.get_rooms_by_abbrev(&bldg_abbrev) {
						Ok(rs) => rs,
						Err(_)     => Vec::new()
					};
					ret_map.insert(
						bldg_abbrev.clone(),
						Building {
							abbrev: bldg.abbrev,
							name: bldg.name,
							lsm_name: bldg.lsm_name,
							rooms: rooms_by_abbrev,
							zone: bldg.zone,
							total_rooms: bldg.total_rooms,
							checked_rooms: bldg.checked_rooms
						}
					);
				}

				Ok(ret_map)
			},
			Err(m) => Err(m)
		}
	}

	pub fn get_buildings(&mut self) -> Result<HashMap<String, DB_Building>, DieselError> {
		let mut ret_map: HashMap<String, DB_Building> = HashMap::new();
		let mut conn = self.pool.get().expect("Failed to get DB Connection");
		let bldg_array = buildings
			.select(DB_Building::as_select())
			.load(&mut conn);

		match bldg_array {
			Ok(ba) => {
				for bldg in ba {
					ret_map.insert(bldg.abbrev.to_string(), bldg);
				}

				Ok(ret_map)
			},
			Err(m)   => Err(m)
		}
	}

	pub fn get_building_by_abbrev(&mut self, bldg_abbrev: &String) -> Result<DB_Building, DieselError> {
		use crate::schema::bronson::buildings::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		buildings
			.select(DB_Building::as_select())
			.filter(abbrev.eq(bldg_abbrev))
			.first(&mut conn)
	}

	pub fn get_building_by_id(&mut self, bldg_id: i64) -> Result<DB_Building, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		buildings
			.find(bldg_id)
			.select(DB_Building::as_select())
			.first(&mut conn)
	}

	pub fn update_building(&mut self, building: &DB_Building) -> Result<DB_Building, DieselError> {
		use crate::schema::bronson::buildings::dsl::building_id;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(buildings)
			.values(building)
			.on_conflict(building_id)
			.do_update()
			.set(building)
			.returning(DB_Building::as_returning())
			.get_result(&mut conn)
	}

	pub fn delete_building_by_abbrev(&mut self, bldg_abbrev: &String) -> Result<DB_Building, DieselError> {
		use crate::schema::bronson::buildings::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(buildings)
			.filter(abbrev.eq(bldg_abbrev))
			.returning(DB_Building::as_returning())
			.get_result(&mut conn)
	}

	pub fn delete_building_by_id(&mut self, bldg_id: i64) -> Result<DB_Building, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(buildings)
			.filter(building_id.eq(bldg_id))
			.returning(DB_Building::as_returning())
			.get_result(&mut conn)
	}

	pub fn get_rooms_by_abbrev(&mut self, bldg_abbrev: &String) -> Result<Vec<DB_Room>, DieselError> {
		use crate::schema::bronson::rooms::dsl::abbrev;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let ret_vec = rooms
			.select(DB_Room::as_select())
			.filter(abbrev.eq(bldg_abbrev))
			.load(&mut conn);

		match ret_vec {
			Ok(mut rv) => {
				rv.sort_by_key(|r| r.name.clone());
				Ok(rv)
			},
			Err(m) => Err(m)
		}
	}

	pub fn get_rooms_by_parent_id(&mut self, bldg_id: i64) -> Result<Vec<DB_Room>, DieselError> {
		use crate::schema::bronson::rooms::dsl::parent_id;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		let ret_vec = rooms
			.select(DB_Room::as_select())
			.filter(parent_id.eq(bldg_id))
			.load(&mut conn);

		match ret_vec {
			Ok(mut rv) => {
				rv.sort_by_key(|r| r.name.clone());
				Ok(rv)
			},
			Err(m) => Err(m)
		}		
	}

	pub fn get_room_by_name(&mut self, room_name: &String) -> Result<DB_Room, DieselError> {
		use crate::schema::bronson::rooms::dsl::name;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		/* rooms
			.find(room_name)
			.select(DB_Room::as_select())
			.first(&mut conn) */
		rooms
			.select(DB_Room::as_select())
			.filter(name.eq(room_name))
			.first(&mut conn)
	}

	pub fn get_room_by_id(&mut self, r_id: i64) -> Result<DB_Room, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		rooms
			.find(r_id)
			.select(DB_Room::as_select())
			.first(&mut conn)
	}

	pub fn update_room(&mut self, room: &DB_Room) -> Result<DB_Room, DieselError> {
		use crate::schema::bronson::rooms::dsl::name;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(rooms)
			.values(room)
			.on_conflict(name)
			.do_update()
			.set(room)
			.returning(DB_Room::as_returning())
			.get_result(&mut conn)
	}


	pub fn delete_room(&mut self, id: &String) -> Result<DB_Room, DieselError> {
		use crate::schema::bronson::rooms::dsl::name;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(rooms)
			.filter(name.eq(id))
			.returning(DB_Room::as_returning())
			.get_result(&mut conn)
	}

	pub fn get_user(&mut self, user: &str) -> Result<DB_User, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		users
			.select(DB_User::as_select())
			.filter(username.eq(user))
			.first(&mut conn)
	}

	pub fn update_user(&mut self, user: &DB_User) -> Result<DB_User, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(users)
			.values(user)
			.on_conflict(username)
			.do_update()
			.set(user)
			.returning(DB_User::as_returning())
			.get_result(&mut conn)
	}

	pub fn delete_user(&mut self, user: &String) -> Result<DB_User, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(users)
			.filter(username.eq(user))
			.returning(DB_User::as_returning())
			.get_result(&mut conn)
	}

	pub fn get_key(&mut self, id: &str) -> Result<DB_Key, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		keys
			.select(DB_Key::as_select())
			.filter(key_id.eq(id))
			.first(&mut conn)
	}

	pub fn update_key(&mut self, update_key: &DB_Key) -> Result<DB_Key, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(keys)
			.values(update_key)
			.on_conflict(key_id)
			.do_update()
			.set(update_key)
			.returning(DB_Key::as_returning())
			.get_result(&mut conn)
	}

	pub fn delete_key(&mut self, id: &String) -> Result<DB_Key, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(keys)
			.filter(key_id.eq(id))
			.returning(DB_Key::as_returning())
			.get_result(&mut conn)
	}

	pub fn get_data(&mut self, data_key: &str) -> Result<DB_DataElement, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		data
			.select(DB_DataElement::as_select())
			.filter(key.eq(data_key))
			.first(&mut conn)
	}

	pub fn update_data(&mut self, element: &DB_DataElement) -> Result<DB_DataElement, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(data)
			.values(element)
			.on_conflict(key)
			.do_update()
			.set(element)
			.returning(DB_DataElement::as_returning())
			.get_result(&mut conn)
	}

	pub fn delete_data(&mut self, data_key: &String) -> Result<DB_DataElement, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(data)
			.filter(key.eq(data_key))
			.returning(DB_DataElement::as_returning())
			.get_result(&mut conn)
	}

	pub fn get_ticket(&mut self, id_value: i32) -> Result<Option<DB_Ticket>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		tickets
			.select(DB_Ticket::as_select())
			.filter(ticket_id.eq(id_value))
			.first(&mut conn)
			.optional()
	}

	pub fn get_latest_ticket(&mut self) -> Result<DB_Ticket, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		tickets
			.select(DB_Ticket::as_select())
			.order(crate::schema::bronson::tickets::dsl::created_date.desc())
			.first(&mut conn)
	}

	pub fn get_all_tickets(&mut self) -> Result<Vec<DB_Ticket>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		tickets
			.select(DB_Ticket::as_select())
			.load::<DB_Ticket>(&mut conn)
	}

	pub fn check_if_tickets_empty(&mut self) -> bool {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		tickets
			.count()
			.get_result::<i64>(&mut conn)
			.unwrap() == 0
	}

	pub fn update_ticket(&mut self, element: &DB_Ticket) -> Result<DB_Ticket, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		// Check if ticket exists in database
		let ticket_exists = self.get_ticket(element.ticket_id)?.is_some();
		
		// If ticket doesn't exist, set has_been_viewed to false
		let element_to_insert = if !ticket_exists {
			let mut new_element = element.clone();
			new_element.has_been_viewed = false;
			new_element
		} else {
			element.clone()
		};

		diesel::insert_into(tickets)
			.values(&element_to_insert)
			.on_conflict(ticket_id)
			.do_update()
			.set(&element_to_insert)
			.returning(DB_Ticket::as_returning())
			.get_result(&mut conn)
	}

	pub fn update_ticket_mark_as_viewed(&mut self, id: i32, new_bool: bool) -> Result<Option<DB_Ticket>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		// Try to fetch the ticket first
		let ticket_opt = tickets
			.filter(ticket_id.eq(id))
			.first::<DB_Ticket>(&mut conn)
			.optional()?;

		// If not found, quietly return
		let Some(_) = ticket_opt else { return Ok(None); };

		// Update the flag
		let updated = diesel::update(tickets.filter(ticket_id.eq(id)))
			.set(has_been_viewed.eq(new_bool))
			.returning(DB_Ticket::as_returning())
			.get_result::<DB_Ticket>(&mut conn)?;

		Ok(Some(updated))
	}


	pub fn update_ticket_parent_id(&mut self, id: i32, new_parent_id: i32) -> Result<Option<DB_Ticket>, DieselError> {
		use crate::schema::bronson::tickets::dsl::parent_id;
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		// Try to fetch the ticket first
		let ticket_opt = tickets
			.filter(ticket_id.eq(id))
			.first::<DB_Ticket>(&mut conn)
			.optional()?;

		// If not found, quietly return
		let Some(_) = ticket_opt else { return Ok(None); };

		// Update the parent ID
		let updated = diesel::update(tickets.filter(ticket_id.eq(id)))
			.set(parent_id.eq(new_parent_id))
			.returning(DB_Ticket::as_returning())
			.get_result::<DB_Ticket>(&mut conn)?;

		Ok(Some(updated))
	}

	pub fn update_ticket_comment_count(&mut self, id: i32, new_count: i16) -> Result<Option<DB_Ticket>,	DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		// Try to fetch the ticket first
		let ticket_opt = tickets
			.filter(ticket_id.eq(id))
			.first::<DB_Ticket>(&mut conn)
			.optional()?;

		// If not found, quietly return
		let Some(ticket) = ticket_opt else { return Ok(None); };

		// If ticket counts match, don't update the counters
		if new_count != ticket.comment_count { 
			// Update the old comment counter
			let _ = diesel::update(tickets.filter(ticket_id.eq(id)))
				.set(old_comment_count.eq(comment_count))
				.returning(DB_Ticket::as_returning())
				.get_result::<DB_Ticket>(&mut conn)?;

			// Update the current comment counter
			let updated = diesel::update(tickets.filter(ticket_id.eq(id)))
				.set(comment_count.eq(new_count))
				.returning(DB_Ticket::as_returning())
				.get_result::<DB_Ticket>(&mut conn)?;

			return Ok(Some(updated))
		}

		Ok(None)
	}

	pub fn delete_ticket(&mut self, id_value: i32) -> Result<DB_Ticket, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(tickets)
			.filter(ticket_id.eq(id_value))
			.returning(DB_Ticket::as_returning())
			.get_result(&mut conn)
	}

	pub fn mark_all_tickets_as_viewed(&mut self) -> Result<usize, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::update(tickets)
			.set(has_been_viewed.eq(true))
			.execute(&mut conn)
	}

	pub fn get_reservation(&mut self, res_id: i64) -> Result<Option<DB_Reservation>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		reservations
			.select(DB_Reservation::as_select())
			.filter(reservation_id.eq(res_id))
			.first(&mut conn)
			.optional()
	}

	pub fn get_reservation_by_cn_id(&mut self, cn_id: i64) -> Result<Option<DB_Reservation>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		reservations
			.select(DB_Reservation::as_select())
			.filter(event_space_id.contains(vec![cn_id]))
			.filter(end_dt.gt(Local::now()))
			.first(&mut conn)
			.optional()
	}

	pub fn update_reservation(&mut self, res: &DB_Reservation) -> Result<DB_Reservation, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(reservations)
			.values(res)
			.on_conflict(reservation_id)
			.do_update()
			.set(res)
			.returning(DB_Reservation::as_returning())
			.get_result(&mut conn)
	}
	
	pub fn get_project(&mut self, id_value: i32) -> Result<Option<DB_Project>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		projects
			.select(DB_Project::as_select())
			.filter(project_id.eq(id_value))
			.first(&mut conn)
			.optional()
	}

	pub fn get_latest_project(&mut self) -> Result<DB_Project, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		projects
			.select(DB_Project::as_select())
			.order(crate::schema::bronson::projects::dsl::created_date.desc())
			.first(&mut conn)
	}

	pub fn get_all_projects(&mut self) -> Result<Vec<DB_Project>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		projects
			.select(DB_Project::as_select())
			.load::<DB_Project>(&mut conn)
	}
	
	pub fn check_if_projects_empty(&mut self) -> bool {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		projects
			.count()
			.get_result::<i64>(&mut conn)
			.unwrap() == 0
	}

	pub fn update_project(&mut self, element: &DB_Project) -> Result<DB_Project, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::insert_into(projects)
			.values(element)
			.on_conflict(project_id)
			.do_update()
			.set(element)
			.returning(DB_Project::as_returning())
			.get_result(&mut conn)
	}

	pub fn update_project_hidden(&mut self, id: i32, new_bool: bool) -> Result<Option<DB_Project>, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		// Try to fetch the project first
		let project_opt = projects
			.filter(project_id.eq(id))
			.first::<DB_Project>(&mut conn)
			.optional()?;

		// If not found, quietly return
		let Some(_) = project_opt else { return Ok(None); };

		// Update the flag
		let updated = diesel::update(projects.filter(project_id.eq(id)))
			.set(is_hidden.eq(new_bool))
			.returning(DB_Project::as_returning())
			.get_result::<DB_Project>(&mut conn)?;

		Ok(Some(updated))
	}
	
	pub fn delete_project(&mut self, id_value: i32) -> Result<DB_Project, DieselError> {
		let mut conn = self.pool.get().expect("Failed to get DB Connection");

		diesel::delete(projects)
			.filter(project_id.eq(id_value))
			.returning(DB_Project::as_returning())
			.get_result(&mut conn)
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
	pub fn from(buf_vec: Vec<u8>) -> Request {
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
            Ok(u)  => u,
            Err(_) => DB_User{ username: String::from(&uname["username"]), permissions: -1 },
        };

        let mut jar = CookieJar::new();
        jar.signed_mut(&database.get_cookie_key()).add((user.username.clone(), user.username.clone()));
        let signed_val = jar.get(&user.username).cloned().unwrap();

		if signed_val.value() != &uname["key"] {
			return false;
		}

		return true;
	}

	pub fn get_current_username(&mut self) -> String {
		if !self.headers.contains_key("Cookie") {
			return "".to_string();
		}

		let username_search = Regex::new("^[^=]*").unwrap();
		let cookie = self.headers.get("Cookie").unwrap();
		
		match username_search.find(cookie) {
			Some(matched) => matched.as_str().to_string(),
			None => panic!("Unable to capture username.")
		}
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

	pub fn status(mut self, status: &str) -> Response {
		self.status = String::from(status);

		self
	} 

	pub fn insert_header(mut self, header: &str, value: &str) -> Response {
		self.headers.insert(String::from(header), String::from(value));

		self
	}

	pub fn send_file(mut self, filepath: &str) -> Response {
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
			"pdf" => self.headers.insert(content_type, String::from("application/pdf")),
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

		self
	}

	pub fn send_contents(mut self, contents: Vec<u8>) -> Response {
		if self.headers.contains_key("Content-Type") {
			self.headers.remove("Content-Type");
		}
		if self.headers.contains_key("Content-Length") {
			self.headers.remove("Content-Length");
		}
		
		self.headers.insert(String::from("Content-Type"), String::from("text/text"));
		self.body = contents.into();
		self.headers.insert(String::from("Content-Length"), self.body.len().to_string());

		self
	}

	pub fn insert_onload(mut self, function: &str) -> Response {
		let pre_post_search = RegBytes::new(r"(?<preamble>[\d\D]*<body).*(?<postamble>>[\d\D]*)").unwrap();
		let pre_contents = &self.body;
		let Some(pre_post) = pre_post_search.captures(&pre_contents) else { return self };
		let pre = String::from_utf8(pre_post["preamble"].to_vec()).unwrap();
		let post = String::from_utf8(pre_post["postamble"].to_vec()).unwrap();
		let contents = format!("{} onload={}{}", pre, function, post);
		if self.headers.contains_key("Content-Length") {
			self.headers.remove("Content-Length");
		}
		self.headers.insert(String::from("Content-Length"), self.body.len().to_string());
		self.body = contents.into();

		self
	}

	pub fn build(self) -> Option<Vec<u8>> {
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

		return Some(content);
	}
}

#[derive(Debug, Clone)]
pub enum APIClient {
	SingleThread(Arc<std::sync::RwLock<reqwest::Client>>),
	MultiThread(reqwest::Client),
}

#[derive(Debug, Clone)]
pub struct API {
	pub client: APIClient
}

impl API {
	pub fn new(c: APIClient) -> API {
		return API {
			client: c
		};
	}

	pub fn build(&self) -> APIEndpoint {
		return APIEndpoint {
			client: self.client.clone(),
			method: None,
			data: None,
			endpoint: None,
			headers: HeaderMap::new(),
			args: json!([]),
			timeout: Duration::from_secs(15)
		};
	}
}

#[derive(Clone)]
pub struct APIEndpoint {
	pub client: APIClient,
	pub method: Option<Arc<dyn Fn(reqwest::Client, String) -> reqwest::RequestBuilder>>,
	pub data: Option<Arc<dyn Fn(reqwest::RequestBuilder, Value) -> reqwest::RequestBuilder>>,
	pub endpoint: Option<String>,
	pub headers: HeaderMap,
	pub args: Value,
	pub timeout: Duration
}

impl APIEndpoint {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.debug_struct("APIEndpoint")
			.field("client", &self.client)
			.field("method", &"dyn Fn")
			.field("endpoint", &self.endpoint)
			.field("headers", &self.headers)
			.field("args", &self.args)
			.field("timeout", &self.timeout)
			.finish()
	}
}

impl<'de> APIEndpoint {
	pub fn method(mut self, m: &str) -> APIEndpoint {

		match m.to_uppercase().as_str() {
			"GET"    => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::get(&c, u) }));
			},
			"POST"   => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::post(&c, u) }));
			},
			"PUT"    => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::put(&c, u) }));
			},
			"PATCH"  => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::patch(&c, u)}));
			},
			"DELETE" => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::delete(&c, u)}));
			},
			"HEAD"   => {
				self.method = Some(Arc::new(|c, u| { reqwest::Client::head(&c, u)}));
			},
			_        => {
				warn!("Unknown method call");
				self.method = None;
				self.data   = None;
			}
		}

		self
	}

	pub fn body(mut self, v: Value) -> APIEndpoint {
		self.args = v;
		self.data = Some(Arc::new(|c, b| { reqwest::RequestBuilder::body(c, b.to_string()) }));

		self
	}

	pub fn json(mut self, v: Value) -> APIEndpoint {
		self.args = v;
		self.data = Some(Arc::new(|c, b| { reqwest::RequestBuilder::json(c, &b) }));

		self
	}

	pub fn endpoint(mut self, e: &str) -> APIEndpoint {
		self.endpoint = Some(String::from(e));

		self
	}

	pub fn header<K>(mut self, k: K, v: &str) -> APIEndpoint
	where K: IntoHeaderName {
		self.headers.insert(k, v.parse().unwrap());

		self
	}

	pub fn timeout(mut self, d: Duration) -> APIEndpoint {
		self.timeout = d;

		self
	}

	pub async fn send<T: APIFormat<'de, T> + Deserialize<'de>>(&mut self) -> Result<APIResponse<T>, String> {
		let url = match &self.endpoint {
			Some(u) => u,
			None    => {
				return Err(String::from("Cannot send without URL"));
			}
		};

		let method = match &self.method {
			Some(m) => m,
			None    => {
				return Err(String::from("No method to call with"));
			}
		};

		if !self.data.clone().is_some() {
			self.data = Some(Arc::new(|c, b| { reqwest::RequestBuilder::json(c, &b) }));
			
			assert_eq!(self.data.clone().is_some(), true);
		}

		let data_endpoint = self.data.clone().unwrap();

		let client = match &self.client {
			APIClient::SingleThread(c) => method(c.write().unwrap().clone(), url.to_string()),
			APIClient::MultiThread(c)  => method(c.clone(),                  url.to_string()),
		};

		let send = data_endpoint(client.timeout(self.timeout)
						.headers(self.headers.clone())
						, self.args.clone())
						.send()
						.await;

		let mut resp = match send {
			Ok(r) => r,
			Err(m) => { return Err(format!("{:?}", m)); }
		};

		let raw_status = resp.status().clone();
		let raw_version = format!("{:?}", resp.version());
		let raw_headers = resp.headers().clone();

		let mut raw_body: Vec<u8> = Vec::new();

		while let Some(chunk) = match resp.chunk().await {
			Ok(c) => c,
			Err(m) => { return Err(m.to_string() + &String::from_utf8(raw_body.clone()).expect("Cannot parse")); }
		} {
			raw_body.extend_from_slice(&chunk);
		}

		let body_string_raw: String = format!("{}", match String::from_utf8(raw_body) {
			Ok(b) => b,
			Err(m) => { return Err(m.to_string()); }
		});

		let body_string: &'de String = &body_string_raw;

		let tbd_body: T;
		tbd_body.compile(&body_string);

		Ok(APIResponse::<T> {
			status: raw_status,
			version: raw_version,
			headers: raw_headers,
			body: tbd_body
		})
	}
}

pub struct APIResponse<T> {
	pub status: reqwest::StatusCode,
	pub version: String,
	pub headers: HeaderMap,
	pub body: T
}

trait APIFormat<'de, Format: Deserialize<'de>> {
	fn compile(&self, str_data: &'de String) -> Format;
}

impl<'de, Format: Deserialize<'de>> APIFormat<'de, Format> for String {
	fn compile(&self, str_data: &String) -> Format {
		str_data.clone()
	}
}

impl<'de, Format: Deserialize<'de> + Clone> APIFormat<'de, Format> for Value {
	fn compile(&self, str_data: &'de String) -> Format {
		serde_json::from_str::<Format>(str_data).unwrap().clone()
	}
}

impl<'de, Format: Deserialize<'de> + Clone> APIFormat<'de, Format> for LoginSuccess {
	fn compile(&self, str_data: &'de String) -> Format {
		serde_xml_rs::from_str::<Format>(str_data).unwrap().clone()
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

		let contents: Vec<u8>;
		Ok(match arg_vec[0].as_str() {
			"get"    => {
				if arg_vec.len() == 1 || arg_vec[1] == "" {
					return Err(TerminalError::InvalidArgument("Unknown `get` argument. See `get -h` for help".to_owned()));
				}

				match arg_vec[1].as_str() {
					"-h"        => {
						Response::new()
								.status(STATUS_200)
								.send_contents(
									json!({
										"response": "get [ log | campus | version | alerts | blacklist ]"
									}).to_string().into()
								)
					},
					"log"       => {
						Response::new()
								.status(STATUS_200)
								.send_file(LOG)
					},
					"campus"       => {
						// WARNING: This function call generates an entirely new Database object that will have a cookie key that is different than the database object in main.
						// This was done because the only thing being done is data retrieval, not cookie management. 
						// I am too lazy to pass a database object to this function.
						contents = match Database::get_campus(&mut Database::new()) {
							Ok(c)  => json!(c).to_string().into(),
							Err(_) => "".into()
						};

						Response::new()
								.status(STATUS_200)
								.send_contents(
									json!({
										"response": contents
									}).to_string().into()
								)
					},
					"version"   => {
						Response::new()
								.status(STATUS_200)
								.send_contents(
									json!({
										"response": env!("CARGO_PKG_VERSION")
									}).to_string().into()
								)
					},
					"alerts"    => {
						Response::new()
								.status(STATUS_200)
								.send_contents(
									json!({
										"response": "none"
									}).to_string().into()
								)
					},
					"blacklist" => {
						Response::new()
								.status(STATUS_200)
								.send_contents(
									json!({
										"response": "none"
									}).to_string().into()
								)
					},
					&_          => {
						return Err(TerminalError::InvalidArgument("Unknown `get` argument. See `get -h` for help.".to_owned())).into();
					}
				}
			},
			"add"    => {
				Response::new()
						.status(STATUS_200)
						.send_contents(
							json!({
								"response": "add page"
							}).to_string().into()
						)
			},
			"update" => {
				Response::new()
						.status(STATUS_200)
						.send_contents(
							json!({
								"response": "update page"
							}).to_string().into()
						)
			},
			"delete" => {
				Response::new()
						.status(STATUS_200)
						.send_contents(
							json!({
								"response": "delete page"
							}).to_string().into()
						)
			},
			"help"   => {
				let contents = "
hello  : hello NAME
get    : get [ log | campus | version | alerts | blacklist ]
add    : add [ user '{username: permissions}' | data '{key: val}' | key '{key: val}' ]
update : update []
delete : delete []
help   : help
            ";
				Response::new()
						.status(STATUS_200)
						.send_contents(
							json!({
								"response": contents
							}).to_string().into()
						)
			},
			&_       => {
				return Err(TerminalError::InvalidArgument("Unknown comand: ".to_owned() + &arg_vec[0]));
			}
		})
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

// ----------- Custom structs for CFM Requests
#[derive(Serialize, Deserialize, Debug)]
pub struct CFMRequestFile {
	pub filename: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TreeNode {
    pub name: String,
    pub file_path: String,
    pub children: Option<Vec<TreeNode>>, // can be null (None)
}

impl TreeNode {
    pub fn new() -> Self {
        Self {
            name: String::new(),
            file_path: String::new(),
            children: Some(Vec::new()),
        }
    }

    pub fn with_name_path(node_name: impl Into<String>, file_path: impl Into<String>) -> Self {
        Self {
            name: node_name.into(),
            file_path: file_path.into(),
            children: Some(Vec::new()),
        }
    }

    pub fn push(&mut self, child: TreeNode) {
        match &mut self.children {
            Some(children) => children.push(child),
            None => {
                // If children is None, we can convert it to Some(vec) and push
                self.children = Some(vec![child]);
            }
        }
    }
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

#[derive(Debug, Deserialize, Clone)]
#[serde(rename="r25:login_response")]
pub struct LoginSuccess {
	#[serde(rename="@pubdate")]
	pub pubdate: Option<String>,
	#[serde(rename="@engine")]
	pub engine: Option<String>,
	#[serde(rename="r25:login")]
	pub login: Login
}

#[derive(Debug, Deserialize, Clone)]
pub struct Login {
	#[serde(rename="r25:message")]
	pub message: String,
	#[serde(rename="r25:success")]
	pub success: String,
	#[serde(rename="r25:user_type")]
	pub user_type: String,
	#[serde(rename="r25:user_id")]
	pub user_id: u16,
	#[serde(rename="r25:username")]
	pub username: String,
	#[serde(rename="r25:contact_name")]
	pub contact_name: String,
	#[serde(rename="r25:security_group_id")]
	pub security_group_id: u16,
	#[serde(rename="r25:security_group_name")]
	pub security_group_name: String,
	#[serde(rename="r25:login_url")]
	pub login_url: String,
	#[serde(rename="r25:logout_url")]
	pub logout_url: String
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename="r25:reservations")]
pub struct Reservations {
	#[serde(rename="r25:reservation")]
	pub reservations: Vec<Reservation>
}

#[derive(Debug, Deserialize, Clone)]
pub struct Reservation {
	#[serde(rename="r25:reservation_id")]
	pub reservation_id: i64,
	#[serde(rename="r25:event_start_dt")]
	pub start_dt: DateTime<Local>,
	#[serde(rename="r25:event_end_dt")]
	pub end_dt: DateTime<Local>,
	#[serde(rename="r25:event_name")]
	pub event_name: String,
	#[serde(rename="r25:space_reservation")]
	pub space: Option<Vec<Space>>
}

#[derive(Debug, Deserialize, Clone)]
pub struct Space {
	#[serde(rename="r25:space_id")]
	pub space_id: i64
}

pub static BUFF_SIZE : usize = 4096;
pub static TSCH_JSON : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/techSchedule.json");
pub static TICKT_JSON: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/create_ticket_template.json");
pub static CFM_DIR   : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/CFM_Code/");
pub static WIKI_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/wiki_articles/");
pub static TEMP_DIR  : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/generated_files/temp/");
pub static LOG       : &str = concat!(env!("CARGO_MANIFEST_DIR"), "/output.log");
pub static STATUS_200: &str = "HTTP/1.1 200 OK";
pub static STATUS_303: &str = "HTTP/1.1 303 See Other";
pub static STATUS_400: &str = "HTTP/1.1 400 Bad Request";
pub static STATUS_401: &str = "HTTP/1.1 401 Unauthorized";
pub static STATUS_404: &str = "HTTP/1.1 404 Not Found";
pub static STATUS_500: &str = "HTTP/1.1 500 Internal Server Error";
pub static SCHD_ERR  : &str = "{\n\t\"No Tech Found\":{\"Name\":\"None\",\"Assignment\":\"N/A\",\"Schedule\":{\"Monday\":\"NA\",\"Tuesday\":\"NA\",\"Wednesday\":\"NA\",\"Thursday\":\"NA\",\"Friday\":\"NA\"}}}";
pub static DASH_ERR  : &str = "No dashboard found. Please contact an administrator.";
pub static LDRB_ERR  : &str = "{\"7days\":[{\"Count\":0, \"Name\":\"N/A\"}],\"30days\":[{\"Count\":0, \"Name\":\"N/A\"}],\"90days\":[{\"Count\":0, \"Name\":\"N/A\"}],\"365days\":[{\"Count\":0, \"Name\":\"N/A\"}]}";
pub static SPRS_ERR  : &str = "{\"spares\":[{\"Asset Tag\":\"NOTFOUND\",\"Catalog Item\":{\"fullTitle\":\"N/A\",\"id\":0},\"Last Updated\":\"0000-00-00T00:00:00Z\",\"Location\":{\"id\":0,\"name\":\"NOT FOUND\"},\"Serial Number\":\"N/A\",\"User\":{\"displayName\":\"N/A\",\"id\":0}}}";