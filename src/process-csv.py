import csv, re

oddballs = {"BU AUD": "BU 0057", "AG AUD": "AG 0133", "ESB": "ES", "AC 404A": "AC 404", "CIC": "CI"}
days = ["M", "T", "W", "R", "F"]

def pad(in_string, buff_char, out_len):
    if len(in_string) < out_len:
        return buff_char*(out_len-len(in_string)) + in_string
    else:
        return in_string
    
for day_of_week in days:
    sched_file = "schedule_" + day_of_week + ".csv"
    config_file = "roomConfig" + day_of_week + ".csv"

    with open(sched_file) as file:
        reader = csv.reader(file, delimiter=',')
        push_vec = []
        for row in reader:
            if re.search("^[A-Z]+ [0-9]+", row[0]):
                with open(config_file, 'a', newline='\n') as write:
                    writer = csv.writer(write, delimiter=',')
                    for _ in range(12-len(push_vec)):
                        push_vec.append('')
                    writer.writerow(push_vec)
                push_vec = []
                if row[0] in oddballs.keys():
                    row[0] = oddballs[row[0]]
                split_string = row[0].split(' ')
                if split_string[0] in oddballs.keys():
                    split_string[0] = oddballs[split_string[0]]
                proc_string = split_string[0], pad(split_string[1], '0', 4)
                out_string = proc_string[0] + ' ' + proc_string[1]
                push_vec.append(out_string)
            elif re.search("[MTWRF]+ [0-9]{4}-[0-9]{4}", row[1]):
                search = re.search("[MTWRF]+ [0-9]{4}-[0-9]{4}", row[1]).group()
                if push_vec.count(search) == 0:
                    push_vec.append(search)

        with open(config_file, 'a', newline='\n') as write:
            writer = csv.writer(write, delimiter=',')
            for _ in range(12-len(push_vec)):
                push_vec.append('')
            writer.writerow(push_vec)