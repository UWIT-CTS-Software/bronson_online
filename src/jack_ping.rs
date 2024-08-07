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
        // let mut response = String::from("x");


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
                pong_string = string;
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

        //filter pong 
        //   drop first 14 characters, find the first colon ':' and drop it and everything that follows it
        let ci = filter_pong(&pong_string);

        pong_string = pong_string[14..ci].to_string();
        pong_string
    }

    fn filter_pong(s: &String) -> usize {
        let bytes = s.as_bytes();
        for (i, &item) in bytes.iter().enumerate() {
            if item == b':' {
                return i;
            }
        }
        s.len()
    }
}

/* Jack Notes

*/