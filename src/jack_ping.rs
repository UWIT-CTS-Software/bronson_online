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
        println!("Hey I am in jack_ping.rs");

        let t_hn = "EN-1055-PROC1"; // test hostname
        //println!("{}", pinger::ping(t_hn));

        let mut response = String::from("");

        match pinger::ping(t_hn.to_string(), None) {
            Ok(resp) => {
                println!("{}", resp.recv().unwrap());
                response = resp.recv().unwrap().to_string(); 
                use pinger::PingResult;
                match resp.recv().unwrap() {
                    PingResult::Pong(dur, string) => println!("Duration: {:?}\nPong String: \n {}", dur, string),
                    PingResult::Timeout(string) => println!("Timeout:\n{}", string),
                    PingResult::Unknown(string) => println!("Unknown:\n{}",string),
                    PingResult::PingExited(es, string) => println!("Exit:\n{}", string),
                }},
            Err(x) => println!("{}", x),
        }
        //filter pong
        
        String::from("Test: Ping Output")
    }
}

/* Jack Notes

*/