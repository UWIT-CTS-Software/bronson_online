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
	thread,
	sync::{
		mpsc, Arc, Mutex,
	},
	collections::HashMap,
	hash::Hash,
	fmt::Debug,
};

use serde::{Deserialize, Serialize};

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
    id: usize,
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

		Worker {
			id,
			thread: Some(thread),
		}
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

		ThreadPool { 
			workers,
			sender,
		}
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

		println!("\rShutting down all workers"); 

		for worker in &mut self.workers {
			println!("\rShutting down worker {}", worker.id);

			if let Some(thread) = worker.thread.take() {
				thread.join().unwrap();
			}
		}
    }
}

// ----------- Custom struct for checkerboard - jn <3
#[derive(Serialize, Debug)]
pub struct Room<'a> {
	pub name: String,
	pub items: Vec<i32>,
	pub gp: i32,
	pub checked: i32,
	pub schedule: Vec<&'a str>
}

// this is very rag-tag - error handling needs to be built-in
impl Room<'_> {
	pub fn update(&mut self, _key: &str, _val: &str) {
		/* if key == "name" {
			self.name = val;
		} else if key == "items" {
			self.items = val;
		} else if key == "gp" {
			self.gp = val;
		} else if key == "checked" {
			self.checked = val;
		} else if key == "schedule" {
			self.schedule = val;
		} */
	}
}

impl<'a> Clone for Room<'a> {
	fn clone(&self) -> Room<'a> {
		let new_name: Box<str> = <String as Clone>::clone(&self.name).into_boxed_str();
		let new_items = &self.items;
		let new_schedule = &self.schedule;
		Room {
			name: String::from(new_name),
			items: (&new_items).to_vec(),
			gp: self.gp,
			checked: self.checked,
			schedule:(&new_schedule).to_vec(),
		}
	}
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