use std::thread;
use std::sync::mpsc;
use std::sync::Arc;
use std::sync::Mutex;

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
			println!("Worker {} got a job. Executing...", id);

			job.call_box();
		    },
		    Message::Terminate => {
			println!("Worker {} was told to terminate.", id);

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
	where
	    F: FnOnce() + Send + 'static
    {
	let job = Box::new(f);

	self.sender.send(Message::NewJob(job)).unwrap();
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
	println!("Sending terminate message to all workers.");

	for _ in &mut self.workers {
	    self.sender.send(Message::Terminate).unwrap();
	}

	println!("Shutting down all workers"); 

	for worker in &mut self.workers {
	    println!("Shutting down worker {}", worker.id);

	    if let Some(thread) = worker.thread.take() {
		thread.join().unwrap();
	    }
	}
    }
}

// 

// ----------- Custom structs for JackNet Requests
// campus.json format
#[derive(Serialize, Deserialize, Debug)]
pub struct BuildingData {
    pub buildingData: Vec<Building>,
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
	pub abbrev: String,
	pub rm: String
}