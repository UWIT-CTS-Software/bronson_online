//jack_ping.rs
/*
Written by Jack Nyman
University of Wyoming

Simple implementation of ICMP ping
 - intended to be used by JackNet to ping devices on campus via hostname.
*/

// module declaration
pub mod jp {
    // ping this, takes a hostname and returns it's IP or an exit code
    //   exit code indicates not found or some other issue.
    pub fn ping_this(hostname: String) -> String {
        use pinger::PingResult;
        use regex::Regex;
        // let mut response = String::from("x");
        let ip_filter = Regex::new(r"[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}").unwrap();


        let ping_response: PingResult;

        match pinger::ping(hostname.to_string(), None) {
            Ok(resp) => {
                ping_response = resp.recv().unwrap(); 
                },
            Err(_) => {
                println!("Error Pinging {}", hostname);
                 return String::from("x");
                },
        }

        let mut pong_string = String::from("");

        match ping_response {
            PingResult::Pong(_dur, string) => { 
                //println!("Duration: {:?}\nPong String: \n {}", dur, string);
                pong_string = String::from(ip_filter.find(&string).unwrap().as_str());
            },
            PingResult::Timeout(string) => {
                println!("Timeout:\n{}", string);
                return String::from("x");
            },
            PingResult::Unknown(string) => println!("Unknown:\n{}",string),
            PingResult::PingExited(_es, string) => {
                println!("Ping Failed Exit:\n{}", string);
                return String::from("x");
            },
        }

        pong_string
    }
}

/* Jack Notes

*/